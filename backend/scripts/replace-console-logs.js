const fs = require('fs');
const path = require('path');

// List of files to update
const filesToUpdate = [
  '../routes/agora.js',
  '../routes/tokens.js',
  '../routes/users.js',
  '../routes/webhook.js',
  '../utils/migrate.js'
];

// Replacements map
const replacements = [
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info('
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn('
  }
];

// Process each file
filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if logger is already imported
    const hasLoggerImport = content.includes("require('../utils/secureLogger')") || 
                           content.includes('require("../utils/secureLogger")');
    
    // Add logger import if not present
    if (!hasLoggerImport && content.includes('console.')) {
      // Find the last require statement
      const requireRegex = /const\s+.*=\s*require\(.*\);/g;
      const matches = content.match(requireRegex);
      
      if (matches && matches.length > 0) {
        const lastRequire = matches[matches.length - 1];
        const importStatement = `${lastRequire}\nconst { logger } = require('../utils/secureLogger');`;
        content = content.replace(lastRequire, importStatement);
      }
    }
    
    // Apply replacements
    let modified = false;
    replacements.forEach(({ pattern, replacement }) => {
      if (content.match(pattern)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`⏭️  Skipped: ${filePath} (no console statements found)`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('\n✨ Console.log replacement complete!');