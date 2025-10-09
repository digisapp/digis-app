#!/usr/bin/env node

const https = require('https');

const VERCEL_TOKEN = 'raQCA8CfyaVMkEfH5mSC1kso';

// Backend environment variables
const backendEnvVars = {
  DATABASE_URL: 'postgresql://postgres:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  SUPABASE_URL: 'https://lpphsjowsivjtcmafxnj.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU0ODk4NCwiZXhwIjoyMDY4MTI0OTg0fQ.8zZmXH-nLvBzrqFXGNmqrVxjwTqvGZ_4P8YKj-XYZYA',
  STRIPE_SECRET_KEY: 'sk_test_51H2HgsGxPvXyJ8zjK9R5Nk7xJf9K3jH2Xk8zJf9K3jH2Xk8z',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_for_local_development',
  AGORA_APP_ID: '565d5cfda0db4588ad0f6d90df55424e',
  AGORA_APP_CERTIFICATE: 'dbad2a385798493390ac0c5b37344417',
  AGORA_CHAT_APP_KEY: '411305034#1504278',
  AGORA_CHAT_ORG_NAME: '411305034',
  AGORA_CHAT_APP_NAME: '1504278',
  AGORA_CHAT_REST_API: 'a41.chat.agora.io',
  AGORA_CHAT_APP_TOKEN: '007eJxTYHD4vUPaxWz9x8/JvzsN1kxQ8n1gVRIa3/hSNvPaOY1EC08FBlMz0xTT5LSURIOUJBNTC4vEFIM0sxRLg5Q0U1MTI5PUeUorMxoCGRnSpixjZWRgZWBkYGIA8RkYAL03Hkg=',
  JWT_SECRET: 'aXh8Kj9mN3Qw2Ld5Fg7Hp9Zx3Cv6Bn8MqWe4Rt6Yu8IkOp2As4Df6Gh8JlZx3Cv5Bn7',
  JWT_ACCESS_SECRET: 'aXh8Kj9mN3Qw2Ld5Fg7Hp9Zx3Cv6Bn8MqWe4Rt6Yu8IkOp2As4Df6Gh8JlZx3Cv5Bn7',
  JWT_REFRESH_SECRET: 'bYj9Lk0oP4Sx2We5Rf7Th9Ui8Ok3Lp6Mn8Bv2Cx5Vz7As4Df6Gh8Jk9Lz1Xc3Vb5Nm7',
  PORT: '3005',
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://frontend-eizc7dza2-nathans-projects-43dfdae0.vercel.app',
  UPSTASH_REDIS_REST_URL: 'https://uncommon-chamois-5568.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'ARXAAAImcDI5YzNjZGZlNDVlOTk0NTA4ODZlNWJlNzNiYjFiNDI5NXAyNTU2OA',
  POSTMARK_API_KEY: '61043964-bcce-4c53-8479-f97a8a3f0843',
  POSTMARK_FROM_EMAIL: 'team@digis.cc',
  EMAIL_ENABLED: 'true',
  ABLY_API_KEY: 'T0HI7A.Er1OCA:r2HsGKDl05ja3hOdh8dZeICZF8gY-vGTZH9ahoeEdN4',
  INNGEST_EVENT_KEY: 'sOAW9RMeNp5ft6uumR_weU2OQPacU_zsxghWIsUuSXEvsJRtx6srIignEUcs4ri7gEY7DmaJ8-gzlagNspRAjQ',
  INNGEST_SIGNING_KEY: 'signkey-prod-719bb75dd4bcdbe09caf59bb120f975e9f06e467f034d2bfa2ed31049e1a226d',
  BACKEND_URL: 'https://backend-mexl6lw9e-nathans-projects-43dfdae0.vercel.app'
};

// Frontend environment variables
const frontendEnvVars = {
  VITE_BACKEND_URL: 'https://backend-mexl6lw9e-nathans-projects-43dfdae0.vercel.app',
  VITE_WS_URL: 'wss://backend-mexl6lw9e-nathans-projects-43dfdae0.vercel.app',
  VITE_SUPABASE_URL: 'https://lpphsjowsivjtcmafxnj.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM',
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_51H2HgsGxPvXyJ8zjYourTestKey',
  VITE_AGORA_APP_ID: '565d5cfda0db4588ad0f6d90df55424e',
  VITE_AGORA_RTC_VERSION: '4.20.0',
  VITE_AGORA_RTM_VERSION: '1.5.1',
  VITE_AGORA_EXTENSIONS_VERSION: '4.20.0',
  VITE_AGORA_CHAT_APP_KEY: '411305034#1504278',
  VITE_AGORA_CHAT_ORG_NAME: '411305034',
  VITE_AGORA_CHAT_APP_NAME: '1504278',
  VITE_ANALYTICS_ENABLED: 'true',
  VITE_PWA_ENABLED: 'true',
  VITE_NOTIFICATIONS_ENABLED: 'true',
  VITE_USE_ABLY: 'true',
  VITE_SENTRY_DSN: 'https://39643d408b9ed97b88abb63fb81cfeb6@o4510043742994432.ingest.us.sentry.io/4510043876229120',
  VITE_SENTRY_ENABLED: 'true',
  VITE_USE_SUPABASE_STORAGE: 'true',
  VITE_APP_NAME: 'Digis',
  VITE_APP_VERSION: '2.0.0'
};

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function addEnvVar(projectId, key, value, target = ['production']) {
  try {
    const result = await makeRequest('POST', `/v10/projects/${projectId}/env`, {
      key,
      value,
      type: 'encrypted',
      target
    });
    return result;
  } catch (error) {
    console.error(`Error adding ${key}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Setting up Vercel environment variables...\n');

  // Get projects
  console.log('📋 Fetching projects...');
  const projects = await makeRequest('GET', '/v9/projects');

  const backend = projects.projects.find(p => p.name === 'backend');
  const frontend = projects.projects.find(p => p.name === 'frontend');

  if (!backend || !frontend) {
    console.error('❌ Could not find backend or frontend project');
    process.exit(1);
  }

  console.log(`✅ Found backend project: ${backend.id}`);
  console.log(`✅ Found frontend project: ${frontend.id}\n`);

  // Add backend env vars
  console.log('🔧 Adding backend environment variables...');
  let backendCount = 0;
  for (const [key, value] of Object.entries(backendEnvVars)) {
    process.stdout.write(`  Adding ${key}... `);
    const result = await addEnvVar(backend.id, key, value);
    if (result && !result.error) {
      console.log('✅');
      backendCount++;
    } else {
      console.log(`⚠️  ${result?.error?.message || 'Unknown error'}`);
    }
  }
  console.log(`\n✅ Added ${backendCount}/${Object.keys(backendEnvVars).length} backend variables\n`);

  // Add frontend env vars
  console.log('🔧 Adding frontend environment variables...');
  let frontendCount = 0;
  for (const [key, value] of Object.entries(frontendEnvVars)) {
    process.stdout.write(`  Adding ${key}... `);
    const result = await addEnvVar(frontend.id, key, value);
    if (result && !result.error) {
      console.log('✅');
      frontendCount++;
    } else {
      console.log(`⚠️  ${result?.error?.message || 'Unknown error'}`);
    }
  }
  console.log(`\n✅ Added ${frontendCount}/${Object.keys(frontendEnvVars).length} frontend variables\n`);

  console.log('🎉 Environment variables setup complete!');
  console.log('\n📝 Next steps:');
  console.log('  1. Redeploy backend: vercel --prod --cwd backend --token raQCA8CfyaVMkEfH5mSC1kso');
  console.log('  2. Redeploy frontend: vercel --prod --cwd frontend --token raQCA8CfyaVMkEfH5mSC1kso');
  console.log('  3. Register Inngest endpoint at https://app.inngest.com');
}

main().catch(console.error);
