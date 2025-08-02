const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix incomplete toast comments
function fixToastComments(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match incomplete toast comments
  const pattern = /(\s*)(\/\/ toast\.[a-zA-Z]+\([^)]*\), \{)\n(\s+)(duration:[^}]+)\n(\s+)(icon:[^}]+)?\n?(\s*)\}\);?/gm;
  
  content = content.replace(pattern, (match, indent1, toastStart, indent2, duration, indent3, icon, indent4) => {
    modified = true;
    let result = `${indent1}${toastStart}\n`;
    result += `${indent1}//   ${duration}\n`;
    if (icon) {
      result += `${indent1}//   ${icon}\n`;
    }
    result += `${indent1}// });`;
    return result;
  });
  
  // Also fix simpler patterns
  const simplePattern = /(\s*)(\/\/ toast\.[a-zA-Z]+\([^)]*\), \{)([^}]+)\}\);/g;
  content = content.replace(simplePattern, (match, indent, toastStart, params) => {
    modified = true;
    const lines = params.split(',').map(p => p.trim());
    let result = `${indent}${toastStart}\n`;
    lines.forEach((line, i) => {
      result += `${indent}//   ${line}${i < lines.length - 1 ? ',' : ''}\n`;
    });
    result += `${indent}// });`;
    return result;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
  
  return modified;
}

// Find all JS files
const files = glob.sync('src/**/*.js');

console.log(`Found ${files.length} JavaScript files to check...`);

let fixedCount = 0;
files.forEach(file => {
  if (fixToastComments(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} files with incomplete toast comments.`);