const fs = require('fs');
const path = require('path');

function fixToastComments(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern 1: Multi-line toast with duration only
  content = content.replace(
    /(\s*)(\/\/ toast\.[a-zA-Z]+\([^)]*\), \{)\n(\s+)(duration: \d+)\n(\s*)\}\);/gm,
    (match, indent1, toastStart, indent2, duration, indent3) => {
      modified = true;
      return `${indent1}${toastStart}\n${indent1}//   ${duration}\n${indent1}// });`;
    }
  );
  
  // Pattern 2: Multi-line toast with duration and style
  content = content.replace(
    /(\s*)(\/\/ toast\.[a-zA-Z]+\([^)]*\), \{)\n(\s+)(duration: \d+,)\n(\s+)(style: \{)/gm,
    (match, indent1, toastStart, indent2, duration, indent3, styleStart) => {
      modified = true;
      return `${indent1}${toastStart}\n${indent1}//   ${duration}\n${indent1}//   ${styleStart}`;
    }
  );
  
  // Pattern 3: Fix style object lines
  content = content.replace(
    /^(\s+)(background: '[^']+',?)$/gm,
    (match, indent, line) => {
      // Check if this is inside a comment
      const lines = content.split('\n');
      const currentLineIndex = lines.findIndex(l => l.includes(line));
      if (currentLineIndex > 0) {
        // Look backward to see if we're in a comment block
        for (let i = currentLineIndex - 1; i >= Math.max(0, currentLineIndex - 10); i--) {
          if (lines[i].includes('// toast.')) {
            modified = true;
            return `${indent}//     ${line}`;
          }
        }
      }
      return match;
    }
  );
  
  // Pattern 4: Fix other style properties
  content = content.replace(
    /^(\s+)(color: '[^']+',?|fontWeight: '[^']+',?|fontSize: '[^']+',?|padding: '[^']+')$/gm,
    (match, indent, line) => {
      // Check if this is inside a comment
      const lines = content.split('\n');
      const currentLineIndex = lines.findIndex(l => l.includes(line));
      if (currentLineIndex > 0) {
        // Look backward to see if we're in a comment block
        for (let i = currentLineIndex - 1; i >= Math.max(0, currentLineIndex - 10); i--) {
          if (lines[i].includes('// toast.')) {
            modified = true;
            return `${indent}//     ${line}`;
          }
        }
      }
      return match;
    }
  );
  
  // Pattern 5: Fix closing braces
  content = content.replace(
    /^(\s+)\}$/gm,
    (match, indent) => {
      // Check if this is inside a comment
      const lines = content.split('\n');
      const currentLineIndex = lines.findIndex(l => l === match);
      if (currentLineIndex > 0) {
        // Look backward to see if we're in a comment block
        for (let i = currentLineIndex - 1; i >= Math.max(0, currentLineIndex - 10); i--) {
          if (lines[i].includes('// toast.') && lines[i + 1].includes('//')) {
            modified = true;
            return `${indent}//   }`;
          }
        }
      }
      return match;
    }
  );
  
  // Pattern 6: Fix closing });
  content = content.replace(
    /^(\s+)\}\);$/gm,
    (match, indent) => {
      // Check if this is inside a comment
      const lines = content.split('\n');
      const currentLineIndex = lines.findIndex(l => l === match);
      if (currentLineIndex > 0) {
        // Look backward to see if we're in a comment block
        for (let i = currentLineIndex - 1; i >= Math.max(0, currentLineIndex - 15); i--) {
          if (lines[i].includes('// toast.')) {
            // Check if the previous line is already commented
            if (currentLineIndex > 0 && lines[currentLineIndex - 1].trim().startsWith('//')) {
              modified = true;
              return `${indent}// });`;
            }
          }
        }
      }
      return match;
    }
  );
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
  
  return modified;
}

// Fix specific files
const files = [
  '/Users/examodels/Desktop/digis-app/frontend/src/components/StreamingDashboard.js',
  '/Users/examodels/Desktop/digis-app/frontend/src/components/VideoCall.js'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    fixToastComments(file);
  } else {
    console.log(`File not found: ${file}`);
  }
});

console.log('Toast comment fixing complete!');