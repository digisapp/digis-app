/**
 * Bundle analyzer script
 * Run with: node analyze-bundle.js
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting bundle analysis...\n');

// Build with stats
console.log('📦 Building with stats...');
execSync('npm run build -- --mode production', { stdio: 'inherit' });

// Generate bundle report
console.log('\n📊 Generating bundle report...');

const statsPath = path.join(__dirname, 'dist', 'stats.html');

// Bundle size summary
const getDirectorySize = (dir) => {
  const output = execSync(`du -sh ${dir}`).toString();
  return output.split('\t')[0];
};

const distSize = getDirectorySize(path.join(__dirname, 'dist'));
const jsSize = getDirectorySize(path.join(__dirname, 'dist', 'assets'));

console.log('\n📈 Bundle Size Summary:');
console.log('─'.repeat(40));
console.log(`Total build size: ${distSize}`);
console.log(`JavaScript assets: ${jsSize}`);

// Chunk analysis
console.log('\n📦 Chunk Analysis:');
console.log('─'.repeat(40));

const chunks = execSync('find dist/assets -name "*.js" -exec du -h {} \\; | sort -rh | head -20')
  .toString()
  .trim()
  .split('\n');

chunks.forEach((chunk, index) => {
  const [size, file] = chunk.split('\t');
  const filename = path.basename(file || '');
  console.log(`${index + 1}. ${filename}: ${size}`);
});

// Performance metrics
console.log('\n⚡ Performance Metrics:');
console.log('─'.repeat(40));

const performanceConfig = {
  maxBundleSize: 500, // KB
  maxChunkSize: 200, // KB
  maxAssetSize: 100, // KB
};

const warnings = [];
chunks.forEach((chunk) => {
  const [sizeStr] = chunk.split('\t');
  const size = parseFloat(sizeStr);
  const unit = sizeStr.replace(/[0-9.]/g, '');
  
  if (unit === 'M' || (unit === 'K' && size > performanceConfig.maxChunkSize)) {
    warnings.push(`⚠️  Large chunk detected: ${sizeStr}`);
  }
});

if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach(w => console.log(w));
} else {
  console.log('✅ All chunks within size limits');
}

// Optimization suggestions
console.log('\n💡 Optimization Suggestions:');
console.log('─'.repeat(40));

const suggestions = [
  '1. Enable gzip/brotli compression on server',
  '2. Implement service worker for caching',
  '3. Use dynamic imports for route-based code splitting',
  '4. Lazy load heavy components',
  '5. Optimize images with WebP format',
  '6. Use CDN for static assets',
  '7. Implement tree shaking for unused code',
  '8. Minify CSS with PurgeCSS'
];

suggestions.forEach(s => console.log(s));

// Generate detailed report
const report = {
  timestamp: new Date().toISOString(),
  totalSize: distSize,
  jsSize: jsSize,
  chunks: chunks.map(c => {
    const [size, file] = c.split('\t');
    return {
      file: path.basename(file || ''),
      size
    };
  }),
  warnings,
  config: performanceConfig
};

writeFileSync(
  path.join(__dirname, 'dist', 'bundle-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ Analysis complete!');
console.log(`📊 View detailed report: ${statsPath}`);
console.log(`📄 JSON report: dist/bundle-report.json`);

// Open report in browser
if (process.platform === 'darwin') {
  execSync(`open ${statsPath}`);
} else if (process.platform === 'win32') {
  execSync(`start ${statsPath}`);
}