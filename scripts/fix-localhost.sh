#!/bin/bash

# Fix localhost references in frontend code

echo "🔧 Fixing localhost references in frontend..."

# Update config file
sed -i '' "s|'http://localhost:3001'|process.env.VITE_BACKEND_URL|g" frontend/src/config/env.js

# Update WebSocket URLs
find frontend/src -name "*.js" -type f -exec sed -i '' "s|'ws://localhost:3001'|process.env.VITE_WS_URL|g" {} +

# Update test files to use mock URLs
find frontend/src -name "*.test.js" -type f -exec sed -i '' "s|'http://localhost:3001'|'http://test.backend.url'|g" {} +

echo "✅ Fixed localhost references"

# Count remaining console.logs
echo "📊 Checking console.log usage..."
CONSOLE_COUNT=$(grep -r "console.log\|console.error\|console.warn" backend --include="*.js" | grep -v node_modules | wc -l)
echo "⚠️  Found $CONSOLE_COUNT console statements in backend that should be removed"

echo "
🚀 Next steps:
1. Review the changes made
2. Set VITE_BACKEND_URL in your .env file
3. Set VITE_WS_URL in your .env file
4. Remove console.log statements from production code
5. Test all functionality before deploying
"