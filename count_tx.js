const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data/dompetku.sqlite');

db.get('SELECT COUNT(*) as count FROM transactions', (err, row) => {
  console.log('Total transactions:', row.count);
});
