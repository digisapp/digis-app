#!/usr/bin/env node

/**
 * Migration Validation Script
 *
 * Validates database migrations for:
 * - Duplicate migration numbers
 * - Missing files in sequence
 * - SQL syntax issues
 * - Idempotency checks
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;
const ARCHIVE_DIR = path.join(MIGRATIONS_DIR, 'archive');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .filter(file => !file.includes('README'))
    .sort();
}

function extractMigrationNumber(filename) {
  const match = filename.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function checkDuplicateNumbers() {
  const files = getMigrationFiles();
  const numberMap = new Map();
  const duplicates = [];

  files.forEach(file => {
    const num = extractMigrationNumber(file);
    if (num !== null) {
      if (!numberMap.has(num)) {
        numberMap.set(num, []);
      }
      numberMap.get(num).push(file);
    }
  });

  numberMap.forEach((fileList, num) => {
    if (fileList.length > 1) {
      duplicates.push({ number: num, files: fileList });
    }
  });

  return duplicates;
}

function checkMissingNumbers() {
  const files = getMigrationFiles();
  const numbers = files
    .map(extractMigrationNumber)
    .filter(n => n !== null && n < 200)
    .sort((a, b) => a - b);

  const missing = [];
  for (let i = 0; i < numbers.length - 1; i++) {
    const current = numbers[i];
    const next = numbers[i + 1];
    const gap = next - current;

    if (gap > 1) {
      for (let j = current + 1; j < next; j++) {
        missing.push(j);
      }
    }
  }

  return missing;
}

function checkIdempotency(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8').toUpperCase();

  // Check for common idempotency patterns
  const hasIfExists = content.includes('IF EXISTS');
  const hasIfNotExists = content.includes('IF NOT EXISTS');
  const hasCreateOrReplace = content.includes('CREATE OR REPLACE');

  // Check for potentially non-idempotent operations
  const hasInsert = content.includes('INSERT INTO') && !content.includes('ON CONFLICT');
  const hasUpdate = content.includes('UPDATE');
  const hasDelete = content.includes('DELETE');
  const hasAlterTable = content.includes('ALTER TABLE');
  const hasDropColumn = content.includes('DROP COLUMN') && !hasIfExists;

  const issues = [];

  if (hasInsert) {
    issues.push('Contains INSERT without ON CONFLICT - may fail on re-run');
  }

  if (hasDropColumn) {
    issues.push('Contains DROP COLUMN without IF EXISTS - may fail on re-run');
  }

  if (hasAlterTable && !hasIfExists && !hasIfNotExists) {
    issues.push('Contains ALTER TABLE without IF EXISTS/IF NOT EXISTS checks');
  }

  return {
    isIdempotent: issues.length === 0,
    issues,
  };
}

function checkSQLSyntax(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');

  const issues = [];

  // Check for common SQL syntax issues
  if (content.trim().length === 0) {
    issues.push('File is empty');
  }

  // Check for BEGIN without COMMIT
  const beginCount = (content.match(/BEGIN;/gi) || []).length;
  const commitCount = (content.match(/COMMIT;/gi) || []).length;
  if (beginCount > commitCount) {
    issues.push('Has BEGIN without matching COMMIT');
  }

  // Check for ROLLBACK in main migration (should only be in Down section)
  const mainContent = content.split('-- Down Migration')[0];
  if (mainContent.includes('ROLLBACK;')) {
    issues.push('Contains ROLLBACK in main migration (use in Down section only)');
  }

  return issues;
}

function checkArchiveStructure() {
  const issues = [];

  if (!fs.existsSync(ARCHIVE_DIR)) {
    issues.push('Archive directory does not exist');
    return issues;
  }

  const expectedDirs = ['emergency-fixes', 'diagnostics', 'duplicates'];
  expectedDirs.forEach(dir => {
    const dirPath = path.join(ARCHIVE_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      issues.push(`Archive subdirectory missing: ${dir}`);
    }
  });

  return issues;
}

function validateAll() {
  log('\n🔍 Migration Validation Report\n', 'cyan');
  log('=' .repeat(60), 'cyan');

  let hasErrors = false;

  // Check 1: Duplicate Numbers
  log('\n1️⃣  Checking for duplicate migration numbers...', 'blue');
  const duplicates = checkDuplicateNumbers();
  if (duplicates.length > 0) {
    log(`   ⚠️  Found ${duplicates.length} duplicate number(s):`, 'yellow');
    duplicates.forEach(({ number, files }) => {
      log(`      ${number}: ${files.join(', ')}`, 'yellow');
    });
    log('   ℹ️  These duplicates are known and documented in README.md', 'cyan');
  } else {
    log('   ✅ No duplicate numbers found', 'green');
  }

  // Check 2: Missing Numbers
  log('\n2️⃣  Checking for missing migration numbers...', 'blue');
  const missing = checkMissingNumbers();
  if (missing.length > 0) {
    log(`   ℹ️  Found ${missing.length} gap(s) in numbering:`, 'cyan');
    log(`      Missing: ${missing.join(', ')}`, 'cyan');
    log('   ℹ️  Gaps are normal due to migration organization strategy', 'cyan');
  } else {
    log('   ✅ No gaps in migration numbering', 'green');
  }

  // Check 3: Idempotency
  log('\n3️⃣  Checking idempotency...', 'blue');
  const files = getMigrationFiles();
  const nonIdempotent = [];

  files.forEach(file => {
    const result = checkIdempotency(file);
    if (!result.isIdempotent) {
      nonIdempotent.push({ file, issues: result.issues });
    }
  });

  if (nonIdempotent.length > 0) {
    log(`   ⚠️  Found ${nonIdempotent.length} potentially non-idempotent migration(s):`, 'yellow');
    nonIdempotent.forEach(({ file, issues }) => {
      log(`\n      ${file}:`, 'yellow');
      issues.forEach(issue => log(`        - ${issue}`, 'yellow'));
    });
    log('\n   ℹ️  Review these migrations to ensure they can be safely re-run', 'cyan');
  } else {
    log('   ✅ All migrations appear to be idempotent', 'green');
  }

  // Check 4: SQL Syntax
  log('\n4️⃣  Checking SQL syntax...', 'blue');
  const syntaxIssues = [];

  files.forEach(file => {
    const issues = checkSQLSyntax(file);
    if (issues.length > 0) {
      syntaxIssues.push({ file, issues });
    }
  });

  if (syntaxIssues.length > 0) {
    log(`   ❌ Found ${syntaxIssues.length} file(s) with syntax issues:`, 'red');
    syntaxIssues.forEach(({ file, issues }) => {
      log(`\n      ${file}:`, 'red');
      issues.forEach(issue => log(`        - ${issue}`, 'red'));
    });
    hasErrors = true;
  } else {
    log('   ✅ No syntax issues found', 'green');
  }

  // Check 5: Archive Structure
  log('\n5️⃣  Checking archive structure...', 'blue');
  const archiveIssues = checkArchiveStructure();
  if (archiveIssues.length > 0) {
    log('   ⚠️  Archive structure issues:', 'yellow');
    archiveIssues.forEach(issue => log(`      - ${issue}`, 'yellow'));
  } else {
    log('   ✅ Archive structure is correct', 'green');
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('\n📊 Summary:', 'cyan');
  log(`   Total migrations: ${files.length}`, 'cyan');
  log(`   Duplicates: ${duplicates.length}`, duplicates.length > 0 ? 'yellow' : 'green');
  log(`   Non-idempotent: ${nonIdempotent.length}`, nonIdempotent.length > 0 ? 'yellow' : 'green');
  log(`   Syntax issues: ${syntaxIssues.length}`, syntaxIssues.length > 0 ? 'red' : 'green');

  if (hasErrors) {
    log('\n❌ Validation failed with errors\n', 'red');
    process.exit(1);
  } else if (duplicates.length > 0 || nonIdempotent.length > 0) {
    log('\n⚠️  Validation passed with warnings\n', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ All validations passed!\n', 'green');
    process.exit(0);
  }
}

// Run validation
if (require.main === module) {
  validateAll();
}

module.exports = {
  checkDuplicateNumbers,
  checkMissingNumbers,
  checkIdempotency,
  checkSQLSyntax,
  checkArchiveStructure,
};
