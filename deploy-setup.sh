#!/bin/bash

echo "🚀 Digis Platform - Deployment Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the digis-app root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 This script will help you set up the Digis platform for deployment${NC}"
echo ""

# Backend setup
echo -e "${GREEN}🔧 Backend Setup${NC}"
echo "================"
cd backend

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${RED}⚠️  Please edit backend/.env and add your actual credentials${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir logs
    echo -e "${GREEN}✅ Logs directory created${NC}"
fi

cd ..

# Frontend setup
echo ""
echo -e "${GREEN}🎨 Frontend Setup${NC}"
echo "=================="
cd frontend

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOL
# Frontend Environment Variables
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
REACT_APP_FIREBASE_PROJECT_ID=your_project_id_here
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
REACT_APP_FIREBASE_APP_ID=your_app_id_here
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
REACT_APP_AGORA_APP_ID=your_agora_app_id_here
EOL
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${RED}⚠️  Please edit frontend/.env and add your actual credentials${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

# Build CSS
echo -e "${YELLOW}Building Tailwind CSS...${NC}"
npm run build:css
echo -e "${GREEN}✅ CSS built${NC}"

cd ..

# Summary
echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=================="
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Edit backend/.env with your actual credentials:"
echo "   - DATABASE_URL (Supabase PostgreSQL)"
echo "   - Firebase Admin SDK credentials"
echo "   - Stripe API keys"
echo "   - Agora.io credentials"
echo ""
echo "2. Edit frontend/.env with your actual credentials:"
echo "   - Firebase web app configuration"
echo "   - Stripe publishable key"
echo "   - Agora app ID"
echo ""
echo "3. Set up your database:"
echo "   cd backend && npm run migrate"
echo ""
echo "4. Test locally:"
echo "   Backend: cd backend && npm run dev"
echo "   Frontend: cd frontend && npm start"
echo ""
echo "5. Deploy:"
echo "   Backend: vercel (in backend directory)"
echo "   Frontend: vercel (in frontend directory)"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Never commit .env files to git!${NC}"
echo ""
echo "For detailed deployment instructions, see DEPLOYMENT_READINESS_REPORT.md"