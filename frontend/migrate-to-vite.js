#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting migration from Create React App to Vite...\n');

// Step 1: Backup current package.json
console.log('📦 Step 1: Backing up package.json...');
fs.copyFileSync('package.json', 'package.json.backup');
console.log('✅ Backup created: package.json.backup\n');

// Step 2: Copy new modern package.json
console.log('📦 Step 2: Installing modern package.json...');
fs.copyFileSync('package.modern.json', 'package.json');
console.log('✅ Modern package.json installed\n');

// Step 3: Convert environment variables
console.log('🔧 Step 3: Converting environment variables...');
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const convertedEnv = envContent.replace(/REACT_APP_/g, 'VITE_');
  fs.writeFileSync('.env', convertedEnv);
  console.log('✅ Environment variables converted from REACT_APP_ to VITE_\n');
} else {
  console.log('⚠️  No .env file found, skipping...\n');
}

// Step 4: Update imports in files
console.log('📝 Step 4: Updating imports in source files...');
const updateImports = (dir) => {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules')) {
      updateImports(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace process.env.REACT_APP_ with import.meta.env.VITE_
      if (content.includes('process.env.REACT_APP_')) {
        content = content.replace(/process\.env\.REACT_APP_/g, 'import.meta.env.VITE_');
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Updated: ${filePath}`);
      }
    }
  });
};

updateImports('./src');
console.log('✅ Import updates complete\n');

// Step 5: Create .gitignore entries
console.log('📝 Step 5: Updating .gitignore...');
const gitignoreAdditions = `
# Vite
dist
dist-ssr
*.local
.vite

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;

if (fs.existsSync('.gitignore')) {
  fs.appendFileSync('.gitignore', gitignoreAdditions);
  console.log('✅ .gitignore updated\n');
}

// Step 6: Instructions
console.log('📋 Migration steps completed! Now follow these manual steps:\n');
console.log('1. Delete node_modules and package-lock.json:');
console.log('   rm -rf node_modules package-lock.json\n');
console.log('2. Install dependencies:');
console.log('   npm install\n');
console.log('3. Move public/index.html to root (already done)\n');
console.log('4. Start the development server:');
console.log('   npm run dev\n');
console.log('5. If you see any errors, check:');
console.log('   - Environment variables are prefixed with VITE_');
console.log('   - Image imports use proper syntax');
console.log('   - CSS imports are correct\n');
console.log('🎉 Migration script complete! Your app is now powered by Vite!\n');
console.log('⚡ Vite benefits:');
console.log('   - 10-100x faster HMR (Hot Module Replacement)');
console.log('   - Instant server start');
console.log('   - Optimized builds');
console.log('   - Native ESM support');
console.log('   - Better tree-shaking\n');