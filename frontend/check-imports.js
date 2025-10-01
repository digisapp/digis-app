const fs = require('fs');
const path = require('path');

// Read App.js and extract imports
const appContent = fs.readFileSync('./src/App.js', 'utf8');
const importLines = appContent.split('\n').filter(line => line.trim().startsWith('import'));

console.log('=== CHECKING IMPORTS IN APP.JS ===\n');

const missing = [];
const existing = [];

importLines.forEach((line, index) => {
  console.log(`${index + 1}: ${line.trim()}`);
  
  // Extract the path from import
  const pathMatch = line.match(/from ['"]([^'"]+)['"];?\s*$/);
  if (pathMatch) {
    const importPath = pathMatch[1];
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Local import - check if file exists
      let fullPath = path.resolve('./src/', importPath);
      
      // Try with .js extension if not present
      if (!fs.existsSync(fullPath) && !importPath.endsWith('.js')) {
        fullPath = fullPath + '.js';
      }
      
      if (!fs.existsSync(fullPath)) {
        console.log(`   ❌ MISSING: ${fullPath}`);
        missing.push({ line: line.trim(), path: fullPath });
      } else {
        console.log(`   ✅ EXISTS: ${fullPath}`);
        existing.push({ line: line.trim(), path: fullPath });
      }
    } else {
      console.log(`   📦 EXTERNAL: ${importPath}`);
    }
  }
  console.log('');
});

console.log('\n=== SUMMARY ===');
console.log(`Total imports: ${importLines.length}`);
console.log(`Missing files: ${missing.length}`);
console.log(`Existing files: ${existing.length}`);

if (missing.length > 0) {
  console.log('\n=== MISSING FILES ===');
  missing.forEach(item => {
    console.log(`❌ ${item.path}`);
    console.log(`   Import: ${item.line}`);
  });
}