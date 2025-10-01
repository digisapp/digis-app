#!/bin/bash

# Create a temporary directory for clean export
TEMP_DIR="/tmp/digis-app-clean"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy all files except sensitive ones
rsync -av --exclude='.git' \
         --exclude='*.env' \
         --exclude='*.env.*' \
         --exclude='node_modules' \
         --exclude='*.log' \
         --exclude='logs/' \
         --exclude='.DS_Store' \
         --exclude='dist/' \
         --exclude='build/' \
         --exclude='coverage/' \
         --exclude='*.pem' \
         --exclude='*.key' \
         --exclude='service-account*.json' \
         . "$TEMP_DIR/"

# Create .env.example files
cat > "$TEMP_DIR/backend/.env.example" << 'EOF'
# Database Configuration
DATABASE_URL=your_postgresql_connection_string

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Agora Configuration
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Optional: Session Configuration
SESSION_SECRET=your_session_secret
EOF

cat > "$TEMP_DIR/frontend/.env.example" << 'EOF'
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Agora Configuration (optional, can be fetched from backend)
VITE_AGORA_APP_ID=your_agora_app_id
EOF

echo "Clean export created in: $TEMP_DIR"
echo "You can now:"
echo "1. cd $TEMP_DIR"
echo "2. git init"
echo "3. git add ."
echo "4. git commit -m 'Initial commit'"
echo "5. git remote add origin https://github.com/digisapp/digis-app.git"
echo "6. git push -u origin master"