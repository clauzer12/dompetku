const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'dompetku.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database.');
    db.serialize(() => {
      // 1. Wallets Table
      db.run(`CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        initialBalance REAL DEFAULT 0,
        currentBalance REAL DEFAULT 0,
        icon TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 2. Categories Table
      db.run(`CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        icon TEXT,
        color TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 3. Transactions Table
      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
        amount REAL NOT NULL,
        categoryId TEXT,
        walletId TEXT,
        toWalletId TEXT,
        note TEXT,
        receiptUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES categories(id),
        FOREIGN KEY (walletId) REFERENCES wallets(id),
        FOREIGN KEY (toWalletId) REFERENCES wallets(id)
      )`);

      // 4. Budgets Table
      db.run(`CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        categoryId TEXT NOT NULL,
        month TEXT NOT NULL,
        amount REAL NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      )`);

      // 5. Migrations
      db.all("PRAGMA table_info(transactions)", (err, columns) => {
        if (columns) {
          const hasCreatedBy = columns.some(col => col.name === 'createdBy');
          if (!hasCreatedBy) {
            db.run("ALTER TABLE transactions ADD COLUMN createdBy TEXT DEFAULT 'Desktop'", (alterErr) => {
              if (alterErr) console.error("Migration error (createdBy):", alterErr);
              else console.log("Migration successful: Added createdBy to transactions.");
            });
          }
        }
      });

      // Initialize default data if empty
      initializeDefaultData();
    });
  }
});

function initializeDefaultData() {
  db.get("SELECT COUNT(*) as count FROM wallets", (err, row) => {
    if (row.count === 0) {
      console.log('Initializing default wallets and categories...');
      
      // Insert default wallets
      const walletStmt = db.prepare("INSERT INTO wallets (id, name, initialBalance, currentBalance, icon) VALUES (?, ?, ?, ?, ?)");
      walletStmt.run('wallet-1', 'Rekening Prakas', 0, 0, '🏦');
      walletStmt.run('wallet-2', 'Tunai Prakas', 0, 0, '💵');
      walletStmt.run('wallet-3', 'Rekening Mishel', 0, 0, '🏦');
      walletStmt.run('wallet-4', 'Tunai Mishel', 0, 0, '💵');
      walletStmt.finalize();

      // Insert default categories
      const catStmt = db.prepare("INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)");
      const defaultCategories = [
        { id: 'cat-inc-1', name: 'Gaji', type: 'income', icon: '💰', color: '#10B981' },
        { id: 'cat-inc-2', name: 'Bonus', type: 'income', icon: '🎁', color: '#3B82F6' },
        { id: 'cat-exp-1', name: 'Makanan', type: 'expense', icon: '🍔', color: '#F43F5E' },
        { id: 'cat-exp-2', name: 'Transportasi', type: 'expense', icon: '🚗', color: '#F59E0B' },
        { id: 'cat-exp-3', name: 'Belanja', type: 'expense', icon: '🛒', color: '#8B5CF6' },
        { id: 'cat-exp-4', name: 'Tagihan', type: 'expense', icon: '📄', color: '#EF4444' }
      ];
      
      defaultCategories.forEach(cat => {
        catStmt.run(cat.id, cat.name, cat.type, cat.icon, cat.color);
      });
      catStmt.finalize();
    }
  });
}

// Helper wrappers for Promisified DB queries
const dbQuery = {
  all: (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  }),
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  }),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this);
    });
  })
};

module.exports = { db, dbQuery };
