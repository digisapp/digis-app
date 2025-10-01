const express = require('express');
const app = express();

console.log('Starting test server...');

app.get('/', (req, res) => {
  res.json({ message: 'Test server working\!' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
