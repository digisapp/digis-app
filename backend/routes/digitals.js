const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { initializeSupabaseAdmin } = require('../utils/supabase-admin');
const supabaseAdmin = initializeSupabaseAdmin();
const { pool } = require('../utils/db');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP images and MP4, MOV videos are allowed.'));
    }
  }
});

// Get all digitals for a creator (public view)
router.get('/creator/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { category, type } = req.query;

    // Get creator info
    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('users')
      .select('supabase_id, username, display_name, profile_pic_url')
      .eq('username', username)
      .single();

    if (creatorError || !creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Build query
    let query = supabaseAdmin
      .from('digitals')
      .select('*')
      .eq('creator_id', creator.supabase_id)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (type) {
      query = query.eq('file_type', type);
    }

    const { data: digitals, error } = await query;

    if (error) {
      console.error('Error fetching digitals:', error);
      return res.status(500).json({ error: 'Failed to fetch digitals' });
    }

    // Get categories
    const { data: categories } = await supabaseAdmin
      .from('digital_categories')
      .select('*')
      .eq('creator_id', creator.supabase_id)
      .order('created_at', { ascending: false });

    // Track view if viewer is logged in
    const viewerId = req.user?.id;
    if (viewerId && digitals.length > 0) {
      // Track views for analytics (batch insert)
      const viewRecords = digitals.map(digital => ({
        digital_id: digital.id,
        viewer_id: viewerId,
        viewer_type: 'public',
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      }));

      await supabaseAdmin
        .from('digital_views')
        .insert(viewRecords);
    }

    res.json({
      creator: {
        username: creator.username,
        displayName: creator.display_name,
        avatar: creator.profile_pic_url
      },
      digitals,
      categories: categories || []
    });
  } catch (error) {
    console.error('Error in get digitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get digitals for authenticated creator (dashboard view)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;

    // Use database query instead of Supabase to avoid permission issues
    const digitalsResult = await pool.query(`
      SELECT * FROM digitals 
      WHERE creator_id = $1 
      ORDER BY created_at DESC
    `, [userId]);

    const digitals = digitalsResult.rows;

    // Get categories using database query
    const categoriesResult = await pool.query(`
      SELECT * FROM digital_categories 
      WHERE creator_id = $1 
      ORDER BY created_at DESC
    `, [userId]);
    const categories = categoriesResult.rows;

    // Get analytics summary using database query
    let analytics = [];
    if (digitals.length > 0) {
      const analyticsResult = await pool.query(`
        SELECT digital_id, viewer_type 
        FROM digital_views 
        WHERE digital_id = ANY($1)
      `, [digitals.map(d => d.id)]);
      analytics = analyticsResult.rows;
    }

    // Process analytics
    const viewStats = {};
    if (analytics) {
      analytics.forEach(view => {
        if (!viewStats[view.digital_id]) {
          viewStats[view.digital_id] = { total: 0, byType: {} };
        }
        viewStats[view.digital_id].total++;
        viewStats[view.digital_id].byType[view.viewer_type] = 
          (viewStats[view.digital_id].byType[view.viewer_type] || 0) + 1;
      });
    }

    // Add stats to digitals
    const digitalsWithStats = digitals.map(digital => ({
      ...digital,
      stats: viewStats[digital.id] || { total: 0, byType: {} }
    }));

    res.json({
      digitals: digitalsWithStats,
      categories: categories || []
    });
  } catch (error) {
    console.error('Error in get my digitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload new digital
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { title, description, category, tags, isPublic, allowDownload } = req.body;

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}/digitals/${uuidv4()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('digitals')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('digitals')
      .getPublicUrl(fileName);

    // Determine file type
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Create database record
    const { data: digital, error: dbError } = await supabaseAdmin
      .from('digitals')
      .insert({
        creator_id: userId,
        title: title || file.originalname,
        description,
        file_url: publicUrl,
        file_type: fileType,
        category: category || 'general',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        is_public: isPublic === 'true',
        allow_download: allowDownload === 'true',
        file_size: file.size,
        mime_type: file.mimetype
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to delete uploaded file
      await supabaseAdmin.storage.from('digitals').remove([fileName]);
      return res.status(500).json({ error: 'Failed to save digital' });
    }

    res.json({ digital });
  } catch (error) {
    console.error('Error uploading digital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update digital
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('digitals')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (checkError || !existing || existing.creator_id !== userId) {
      return res.status(404).json({ error: 'Digital not found' });
    }

    // Update digital
    const { data: digital, error } = await supabaseAdmin
      .from('digitals')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating digital:', error);
      return res.status(500).json({ error: 'Failed to update digital' });
    }

    res.json({ digital });
  } catch (error) {
    console.error('Error in update digital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete digital
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get digital info for file deletion
    const { data: digital, error: fetchError } = await supabaseAdmin
      .from('digitals')
      .select('file_url, creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !digital || digital.creator_id !== userId) {
      return res.status(404).json({ error: 'Digital not found' });
    }

    // Extract file path from URL
    const urlParts = digital.file_url.split('/');
    const filePath = urlParts.slice(-3).join('/'); // Gets "userId/digitals/filename"

    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('digitals')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // Delete from database
    const { error } = await supabaseAdmin
      .from('digitals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting digital:', error);
      return res.status(500).json({ error: 'Failed to delete digital' });
    }

    res.json({ message: 'Digital deleted successfully' });
  } catch (error) {
    console.error('Error in delete digital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder digitals
router.post('/reorder', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { digitalIds } = req.body;

    if (!Array.isArray(digitalIds)) {
      return res.status(400).json({ error: 'Invalid digital IDs' });
    }

    // Update display order for each digital
    const updates = digitalIds.map((id, index) => 
      supabaseAdmin
        .from('digitals')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('creator_id', userId)
    );

    await Promise.all(updates);

    res.json({ message: 'Digitals reordered successfully' });
  } catch (error) {
    console.error('Error reordering digitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get digital analytics
router.get('/analytics/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const { data: digital, error: checkError } = await supabaseAdmin
      .from('digitals')
      .select('creator_id, title')
      .eq('id', id)
      .single();

    if (checkError || !digital || digital.creator_id !== userId) {
      return res.status(404).json({ error: 'Digital not found' });
    }

    // Get view analytics
    const { data: views, error } = await supabaseAdmin
      .from('digital_views')
      .select('viewer_type, viewer_info, viewed_at')
      .eq('digital_id', id)
      .order('viewed_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    // Process analytics
    const analytics = {
      total_views: views.length,
      views_by_type: {},
      recent_views: views.slice(0, 10),
      daily_views: {}
    };

    views.forEach(view => {
      // Count by type
      analytics.views_by_type[view.viewer_type] = 
        (analytics.views_by_type[view.viewer_type] || 0) + 1;

      // Count by day
      const day = new Date(view.viewed_at).toISOString().split('T')[0];
      analytics.daily_views[day] = (analytics.daily_views[day] || 0) + 1;
    });

    res.json({ digital: digital.title, analytics });
  } catch (error) {
    console.error('Error in get analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manage categories
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const { data: category, error } = await supabaseAdmin
      .from('digital_categories')
      .insert({
        creator_id: userId,
        name,
        slug,
        description
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Category already exists' });
      }
      console.error('Error creating category:', error);
      return res.status(500).json({ error: 'Failed to create category' });
    }

    res.json({ category });
  } catch (error) {
    console.error('Error in create category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('digital_categories')
      .delete()
      .eq('id', id)
      .eq('creator_id', userId);

    if (error) {
      console.error('Error deleting category:', error);
      return res.status(500).json({ error: 'Failed to delete category' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error in delete category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;