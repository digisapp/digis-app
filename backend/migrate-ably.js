#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const files = [
  'routes/streaming.js',
  'routes/stream-chat.js',
  'routes/tokens.js',
  'routes/recording.js',
  'routes/enhanced-subscriptions.js',
  'routes/polls.js',
  'routes/questions.js',
  'routes/goals.js',
  'routes/live-shopping.js',
  'routes/shop.js',
  'routes/loyalty.js'
];

function migrateFile(filePath) {
  console.log(`\nProcessing ${filePath}...`);

  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has Ably import
  const hasAblyImport = content.includes("require('../utils/ably-adapter')");

  if (!hasAblyImport) {
    // Find the last require statement in the imports section
    const requirePattern = /^const .+ = require\([^)]+\);$/gm;
    const matches = [...content.matchAll(requirePattern)];

    if (matches.length > 0) {
      const lastRequire = matches[matches.length - 1];
      const insertPosition = lastRequire.index + lastRequire[0].length;

      const ablyImport = "\nconst { publishToChannel } = require('../utils/ably-adapter');";
      content = content.slice(0, insertPosition) + ablyImport + content.slice(insertPosition);
      console.log('  ✓ Added Ably import');
    }
  } else {
    console.log('  ✓ Ably import already exists');
  }

  // Replace TODO comments with actual Ably calls
  let replacements = 0;

  // Pattern to match the TODO block
  const todoPattern = /\/\/ TODO: Replace with Ably publish\n\/\/\s+io\.to\((`[^`]+`|'[^']+'|"[^"]+")\)\.emit\('([^']+)',\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\s*\/\/\s*\}\);/g;

  content = content.replace(todoPattern, (match, channel, event, payload) => {
    replacements++;

    // Clean up the channel string - remove leading/trailing slashes if present
    let cleanChannel = channel.trim();

    // Clean up the payload - remove comment markers
    let cleanPayload = payload
      .split('\n')
      .map(line => line.replace(/^\s*\/\/\s*/, '').trim())
      .filter(line => line && !line.startsWith('//'))
      .join('\n      ');

    return `try {
      await publishToChannel(${cleanChannel}, '${event}', {
      ${cleanPayload}
      });
    } catch (ablyError) {
      logger.error('Failed to publish ${event} to Ably:', ablyError.message);
    }`;
  });

  // Handle simpler patterns without nested objects
  const simplePattern = /\/\/ TODO: Replace with Ably publish\n\/\/\s+io\.to\((`[^`]+`|'[^']+'|"[^"]+")\)\.emit\('([^']+)',\s*\{([^}]+)\s*\/\/\s*\}\);/g;

  content = content.replace(simplePattern, (match, channel, event, payload) => {
    replacements++;

    let cleanChannel = channel.trim();
    let cleanPayload = payload
      .split('\n')
      .map(line => line.replace(/^\s*\/\/\s*/, '').trim())
      .filter(line => line && !line.startsWith('//'))
      .join('\n      ');

    return `try {
      await publishToChannel(${cleanChannel}, '${event}', {
      ${cleanPayload}
      });
    } catch (ablyError) {
      logger.error('Failed to publish ${event} to Ably:', ablyError.message);
    }`;
  });

  if (replacements > 0) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✓ Replaced ${replacements} TODO comment(s)`);
    return true;
  } else {
    console.log('  ! No TODO comments found to replace');
    return false;
  }
}

console.log('Starting Ably migration for remaining files...\n');

let migratedCount = 0;
for (const file of files) {
  try {
    if (migrateFile(file)) {
      migratedCount++;
    }
  } catch (error) {
    console.error(`  ✗ Error processing ${file}:`, error.message);
  }
}

console.log(`\n✓ Migration complete! Migrated ${migratedCount} of ${files.length} files.`);
