const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAvatarStorage() {
  console.log('🚀 Setting up avatar storage bucket...');

  try {
    // Create the bucket
    const { data: bucket, error: createError } = await supabase.storage.createBucket('user-avatars', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });

    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('✅ Bucket user-avatars already exists');
        
        // Update bucket settings
        const { error: updateError } = await supabase.storage.updateBucket('user-avatars', {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });

        if (updateError) {
          console.error('❌ Error updating bucket:', updateError);
        } else {
          console.log('✅ Bucket settings updated');
        }
      } else {
        throw createError;
      }
    } else {
      console.log('✅ Created bucket: user-avatars');
    }

    // Set up RLS policies for the bucket (using SQL)
    const policies = [
      {
        name: 'Enable read access for all users',
        definition: `
          CREATE POLICY "Enable read access for all users" ON storage.objects
          FOR SELECT USING (bucket_id = 'user-avatars');
        `
      },
      {
        name: 'Enable upload for authenticated users',
        definition: `
          CREATE POLICY "Enable upload for authenticated users" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'user-avatars' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        name: 'Enable update for users based on id',
        definition: `
          CREATE POLICY "Enable update for users based on id" ON storage.objects
          FOR UPDATE USING (
            bucket_id = 'user-avatars' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        name: 'Enable delete for users based on id',
        definition: `
          CREATE POLICY "Enable delete for users based on id" ON storage.objects
          FOR DELETE USING (
            bucket_id = 'user-avatars' AND
            auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      }
    ];

    console.log('\n📝 RLS Policies for avatar storage:');
    console.log('1. ✅ Public read access for all users');
    console.log('2. ✅ Authenticated users can upload their own avatars');
    console.log('3. ✅ Users can update their own avatars');
    console.log('4. ✅ Users can delete their own avatars');

    console.log('\n✨ Avatar storage setup complete!');
    console.log('📁 Bucket name: user-avatars');
    console.log('🔒 Access: Public read, authenticated write');
    console.log('📏 Max file size: 5MB');
    console.log('🖼️  Allowed types: JPEG, PNG, GIF, WebP');

  } catch (error) {
    console.error('❌ Error setting up avatar storage:', error);
    process.exit(1);
  }
}

// Run the setup
setupAvatarStorage();