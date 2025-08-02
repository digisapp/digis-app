const validateEnvironmentVariables = () => {
  const requiredEnvVars = {
    // Database Configuration
    DATABASE_URL: {
      required: true,
      description: 'PostgreSQL connection string for Supabase'
    },
    
    // Supabase Configuration
    SUPABASE_URL: {
      required: true,
      description: 'Supabase project URL'
    },
    SUPABASE_ANON_KEY: {
      required: true,
      description: 'Supabase anonymous key'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      required: true,
      description: 'Supabase service role key'
    },
    
    // Stripe Configuration
    STRIPE_SECRET_KEY: {
      required: true,
      description: 'Stripe secret key for payment processing'
    },
    STRIPE_WEBHOOK_SECRET: {
      required: false,
      description: 'Stripe webhook secret for webhook verification'
    },
    
    // Agora Configuration
    AGORA_APP_ID: {
      required: true,
      description: 'Agora.io application ID for video/voice calls'
    },
    AGORA_APP_CERTIFICATE: {
      required: true,
      description: 'Agora.io application certificate for token generation'
    },
    
    // Server Configuration
    PORT: {
      required: false,
      description: 'Server port (defaults to 3001)',
      defaultValue: '3001'
    },
    NODE_ENV: {
      required: false,
      description: 'Node environment (development/production)',
      defaultValue: 'development'
    },
    FRONTEND_URL: {
      required: false,
      description: 'Frontend URL for CORS configuration',
      defaultValue: 'http://localhost:3000'
    }
  };

  const missing = [];
  const warnings = [];
  const configured = [];

  console.log('🔍 Validating environment variables...');
  console.log('=' .repeat(50));

  Object.entries(requiredEnvVars).forEach(([varName, config]) => {
    const value = process.env[varName];
    
    if (!value) {
      if (config.required) {
        missing.push({
          name: varName,
          description: config.description
        });
      } else {
        warnings.push({
          name: varName,
          description: config.description,
          defaultValue: config.defaultValue
        });
        
        // Set default value if provided
        if (config.defaultValue) {
          process.env[varName] = config.defaultValue;
        }
      }
    } else {
      configured.push({
        name: varName,
        description: config.description,
        hasValue: true
      });
    }
  });

  // Display results
  if (configured.length > 0) {
    console.log('✅ Configured environment variables:');
    configured.forEach(env => {
      console.log(`   ✓ ${env.name}: ${env.description}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️ Optional environment variables (using defaults):');
    warnings.forEach(env => {
      const defaultMsg = env.defaultValue ? ` (default: ${env.defaultValue})` : '';
      console.log(`   ! ${env.name}: ${env.description}${defaultMsg}`);
    });
    console.log('');
  }

  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(env => {
      console.log(`   ✗ ${env.name}: ${env.description}`);
    });
    console.log('');
    console.log('💡 Please create a .env file in the backend directory with the following variables:');
    missing.forEach(env => {
      console.log(`${env.name}=your_${env.name.toLowerCase()}_here`);
    });
    console.log('');
    
    throw new Error(`Missing ${missing.length} required environment variable(s). See above for details.`);
  }

  // Validate specific environment variable formats
  validateEnvironmentFormats();

  console.log('✅ All environment variables validated successfully!');
  console.log('=' .repeat(50));
};

const validateEnvironmentFormats = () => {
  const validations = [];

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
      validations.push('DATABASE_URL must start with postgresql:// or postgres://');
    }
  }

  // Validate Stripe key format
  if (process.env.STRIPE_SECRET_KEY) {
    if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      validations.push('STRIPE_SECRET_KEY must start with sk_');
    }
  }

  // Validate Supabase URL format
  if (process.env.SUPABASE_URL) {
    if (!process.env.SUPABASE_URL.startsWith('https://') || !process.env.SUPABASE_URL.includes('.supabase.co')) {
      validations.push('SUPABASE_URL must be a valid Supabase project URL');
    }
  }

  // Validate Agora App ID format (should be a string of alphanumeric characters)
  if (process.env.AGORA_APP_ID) {
    if (!/^[a-f0-9]{32}$/.test(process.env.AGORA_APP_ID)) {
      console.log('⚠️ AGORA_APP_ID format may be incorrect (expected 32-character hex string)');
    }
  }

  // Validate PORT is a number
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      validations.push('PORT must be a valid port number (1-65535)');
    }
  }

  if (validations.length > 0) {
    console.log('❌ Environment variable format errors:');
    validations.forEach(error => {
      console.log(`   ✗ ${error}`);
    });
    throw new Error(`${validations.length} environment variable format error(s). See above for details.`);
  }
};

module.exports = {
  validateEnvironmentVariables
};