const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadLogo() {
  try {
    console.log('📤 Uploading Digis logo to Supabase Storage...\n');

    // Read the logo file
    const logoPath = path.join(__dirname, '../frontend/public/digis-logo-black.png');
    const logoBuffer = fs.readFileSync(logoPath);

    // Create public bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    const publicBucket = buckets?.find(b => b.name === 'public');

    if (!publicBucket) {
      console.log('Creating public bucket...');
      const { error: createError } = await supabase.storage.createBucket('public', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      });

      if (createError && !createError.message.includes('already exists')) {
        throw createError;
      }
    }

    // Upload the logo
    const fileName = 'digis-logo-black.png';
    const { data, error } = await supabase.storage
      .from('public')
      .upload(fileName, logoBuffer, {
        contentType: 'image/png',
        upsert: true // Replace if exists
      });

    if (error) {
      throw error;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('public')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    console.log('✅ Logo uploaded successfully!');
    console.log(`📍 Public URL: ${publicUrl}`);
    console.log('\n💡 This URL can be used in emails and will always be accessible.');

    return publicUrl;

  } catch (error) {
    console.error('❌ Error uploading logo:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    console.error('2. Check that the logo file exists in frontend/public/');
    console.error('3. Ensure your Supabase project has storage enabled');
  }
}

// Run the upload
uploadLogo();