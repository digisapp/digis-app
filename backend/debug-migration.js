const fs = require('fs');
const sql = fs.readFileSync('migrations/142_token_system_hardening.sql', 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

statements.forEach((stmt, i) => {
  const preview = stmt.substring(0, 120).replace(/\n/g, ' ');
  console.log(`[${i}] ${preview}`);
});
