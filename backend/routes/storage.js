const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const storageManager = require('../utils/storage-manager');
const { body, validationResult } = require('express-validator');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10 // Max 10 files per request
  }
});

// Upload profile picture
router.post('/profile-picture', 
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Validate file
      const validation = storageManager.validateFile(req.file, {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      // Upload profile picture with multiple sizes
      const urls = await storageManager.uploadProfilePicture(
        req.user.supabase_id || req.user.id,
        req.file.buffer,
        req.file.mimetype
      );

      // Update user profile
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('users')
        .update({ 
          profile_pic_url: urls.original,
          avatar_thumbnail: urls.thumbnail
        })
        .eq('supabase_id', req.user.supabase_id || req.user.id);

      res.json({
        message: 'Profile picture uploaded successfully',
        urls
      });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({ error: 'Failed to upload profile picture' });
    }
  }
);

// Upload creator banner
router.post('/creator-banner',
  authenticateToken,
  upload.single('banner'),
  async (req, res) => {
    try {
      // Check if user is a creator
      if (!req.user.is_creator) {
        return res.status(403).json({ error: 'Only creators can upload banners' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No banner file provided' });
      }

      // Validate file
      const validation = storageManager.validateFile(req.file, {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
      });

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      // Resize and upload banner
      const sharp = require('sharp');
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize(1920, 480, { fit: 'cover' })
        .webp({ quality: 90 })
        .toBuffer();

      const filePath = `${req.user.id}/banner.webp`;
      const result = await storageManager.uploadFile(
        storageManager.buckets.CREATOR_BANNERS,
        filePath,
        optimizedBuffer,
        {
          contentType: 'image/webp',
          upsert: true
        }
      );

      // Update creator profile
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('creator_profiles')
        .update({ banner_url: result.publicUrl })
        .eq('user_id', req.user.id);

      res.json({
        message: 'Banner uploaded successfully',
        url: result.publicUrl
      });
    } catch (error) {
      console.error('Banner upload error:', error);
      res.status(500).json({ error: 'Failed to upload banner' });
    }
  }
);

// Upload creator content
router.post('/creator-content',
  authenticateToken,
  upload.array('files', 10),
  [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('price').optional().isFloat({ min: 0 }),
    body('subscription_only').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      // Check if user is a creator
      if (!req.user.is_creator) {
        return res.status(403).json({ error: 'Only creators can upload content' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const uploadedFiles = [];
      
      for (const file of req.files) {
        // Validate each file
        const validation = storageManager.validateFile(file, {
          maxSize: 100 * 1024 * 1024, // 100MB
          allowedTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/quicktime', 'video/webm',
            'audio/mpeg', 'audio/wav', 'audio/ogg',
            'application/pdf'
          ]
        });

        if (!validation.valid) {
          return res.status(400).json({ 
            error: `File ${file.originalname} validation failed`,
            errors: validation.errors 
          });
        }

        // Upload file
        const uploaded = await storageManager.uploadCreatorContent(
          req.user.id,
          file.buffer,
          file.originalname,
          file.mimetype,
          {
            title: req.body.title,
            description: req.body.description,
            price: req.body.price,
            subscription_only: req.body.subscription_only === 'true'
          }
        );

        uploadedFiles.push(uploaded);
      }

      // Create content entry in database
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase
        .from('creator_content')
        .insert({
          creator_id: req.user.id,
          title: req.body.title,
          description: req.body.description,
          price: req.body.price || 0,
          subscription_only: req.body.subscription_only === 'true',
          files: uploadedFiles,
          status: 'published'
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        message: 'Content uploaded successfully',
        content: data,
        files: uploadedFiles
      });
    } catch (error) {
      console.error('Content upload error:', error);
      res.status(500).json({ error: 'Failed to upload content' });
    }
  }
);

// Upload message attachment
router.post('/message-attachment',
  authenticateToken,
  upload.single('attachment'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No attachment provided' });
      }

      // Validate file
      const validation = storageManager.validateFile(req.file, {
        maxSize: 25 * 1024 * 1024, // 25MB
        allowedTypes: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/quicktime',
          'audio/mpeg', 'audio/wav',
          'application/pdf', 'application/zip',
          'text/plain', 'text/csv'
        ]
      });

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      // Generate file path
      const filePath = storageManager.generateFilePath(
        req.user.id,
        req.file.originalname,
        'messages'
      );

      // Upload file
      const result = await storageManager.uploadFile(
        storageManager.buckets.MESSAGE_ATTACHMENTS,
        filePath,
        req.file.buffer,
        {
          contentType: req.file.mimetype
        }
      );

      // Generate signed URL for access
      const signedUrl = await storageManager.generateSignedUrl(
        storageManager.buckets.MESSAGE_ATTACHMENTS,
        filePath,
        3600 // 1 hour expiry
      );

      res.json({
        message: 'Attachment uploaded successfully',
        path: result.path,
        url: signedUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      });
    } catch (error) {
      console.error('Attachment upload error:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }
);

// Get signed URL for private content
router.post('/signed-url',
  authenticateToken,
  [
    body('bucket').notEmpty(),
    body('path').notEmpty(),
    body('expires_in').optional().isInt({ min: 60, max: 86400 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check access permission
      const hasAccess = await storageManager.checkContentAccess(
        req.user.id,
        req.body.bucket,
        req.body.path
      );

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this content' });
      }

      // Generate signed URL
      const signedUrl = await storageManager.generateSignedUrl(
        req.body.bucket,
        req.body.path,
        req.body.expires_in || 3600
      );

      // Log access
      await storageManager.logContentAccess(
        req.user.id,
        req.body.bucket,
        null,
        req.body.path,
        'view',
        req
      );

      res.json({ url: signedUrl });
    } catch (error) {
      console.error('Signed URL error:', error);
      res.status(500).json({ error: 'Failed to generate signed URL' });
    }
  }
);

// List user's files
router.get('/my-files/:bucket',
  authenticateToken,
  async (req, res) => {
    try {
      const { bucket } = req.params;
      const { limit, offset, sortBy, order } = req.query;

      // Validate bucket
      if (!Object.values(storageManager.buckets).includes(bucket)) {
        return res.status(400).json({ error: 'Invalid bucket' });
      }

      // List files
      const files = await storageManager.listFiles(
        bucket,
        req.user.id,
        {
          limit: parseInt(limit) || 100,
          offset: parseInt(offset) || 0,
          sortBy,
          order
        }
      );

      res.json({ files });
    } catch (error) {
      console.error('List files error:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

// Get storage usage
router.get('/usage',
  authenticateToken,
  async (req, res) => {
    try {
      const usage = await storageManager.getUserStorageUsage(req.user.id);
      res.json(usage);
    } catch (error) {
      console.error('Storage usage error:', error);
      res.status(500).json({ error: 'Failed to get storage usage' });
    }
  }
);

// Delete file
router.delete('/file',
  authenticateToken,
  [
    body('bucket').notEmpty(),
    body('path').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if user owns the file
      const filePath = req.body.path;
      const userFolder = filePath.split('/')[0];
      
      if (userFolder !== req.user.id) {
        return res.status(403).json({ error: 'You can only delete your own files' });
      }

      // Delete file
      await storageManager.deleteFile(req.body.bucket, req.body.path);

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

// Upload shop product images
router.post('/shop-product',
  authenticateToken,
  upload.array('images', 5),
  async (req, res) => {
    try {
      // Check if user is a creator
      if (!req.user.is_creator) {
        return res.status(403).json({ error: 'Only creators can upload shop products' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }

      const uploadedImages = [];

      for (const file of req.files) {
        // Validate file
        const validation = storageManager.validateFile(file, {
          maxSize: 10 * 1024 * 1024, // 10MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });

        if (!validation.valid) {
          return res.status(400).json({ 
            error: `Image ${file.originalname} validation failed`,
            errors: validation.errors 
          });
        }

        // Generate multiple sizes
        const sharp = require('sharp');
        const sizes = {
          original: file.buffer,
          large: await sharp(file.buffer)
            .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer(),
          medium: await sharp(file.buffer)
            .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer(),
          thumbnail: await sharp(file.buffer)
            .resize(320, 320, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer()
        };

        const imageUrls = {};
        
        for (const [size, buffer] of Object.entries(sizes)) {
          const fileName = `${Date.now()}_${size}_${file.originalname.replace(/\.[^/.]+$/, '.webp')}`;
          const filePath = `${req.user.id}/products/${fileName}`;
          
          const result = await storageManager.uploadFile(
            storageManager.buckets.SHOP_PRODUCTS,
            filePath,
            buffer,
            {
              contentType: 'image/webp'
            }
          );
          
          imageUrls[size] = result.publicUrl;
        }

        uploadedImages.push(imageUrls);
      }

      res.json({
        message: 'Product images uploaded successfully',
        images: uploadedImages
      });
    } catch (error) {
      console.error('Product image upload error:', error);
      res.status(500).json({ error: 'Failed to upload product images' });
    }
  }
);

// Upload identity verification documents
router.post('/verify-identity',
  authenticateToken,
  upload.array('documents', 3),
  [
    body('document_type').isIn(['passport', 'drivers_license', 'national_id']),
    body('country').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No documents provided' });
      }

      const uploadedDocs = [];

      for (const file of req.files) {
        // Validate file
        const validation = storageManager.validateFile(file, {
          maxSize: 10 * 1024 * 1024, // 10MB
          allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
        });

        if (!validation.valid) {
          return res.status(400).json({ 
            error: `Document ${file.originalname} validation failed`,
            errors: validation.errors 
          });
        }

        // Upload document
        const filePath = storageManager.generateFilePath(
          req.user.id,
          file.originalname,
          'verification'
        );

        await storageManager.uploadFile(
          storageManager.buckets.IDENTITY_VERIFICATION,
          filePath,
          file.buffer,
          {
            contentType: file.mimetype
          }
        );

        uploadedDocs.push({
          path: filePath,
          type: file.mimetype,
          size: file.size
        });
      }

      // Store verification request
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('identity_verifications')
        .insert({
          user_id: req.user.id,
          document_type: req.body.document_type,
          country: req.body.country,
          documents: uploadedDocs,
          status: 'pending'
        });

      res.json({
        message: 'Verification documents uploaded successfully',
        status: 'pending'
      });
    } catch (error) {
      console.error('Verification upload error:', error);
      res.status(500).json({ error: 'Failed to upload verification documents' });
    }
  }
);

module.exports = router;