require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { dbQuery } = require('./db');
require('./bot'); // Initialize Telegram Bot
require('./cron'); // Initialize Cron Jobs

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../')));

// ==========================================
// REST API ENDPOINTS
// ==========================================

// --- WALLETS ---
app.get('/api/wallets', async (req, res) => {
  try {
    const wallets = await dbQuery.all('SELECT * FROM wallets');
    res.json(wallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallets', async (req, res) => {
  try {
    const { id, name, initialBalance, currentBalance, icon } = req.body;
    await dbQuery.run(
      'INSERT INTO wallets (id, name, initialBalance, currentBalance, icon) VALUES (?, ?, ?, ?, ?)',
      [id, name, initialBalance, currentBalance, icon]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/wallets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, initialBalance, currentBalance, icon } = req.body;
    await dbQuery.run(
      'UPDATE wallets SET name = ?, initialBalance = ?, currentBalance = ?, icon = ? WHERE id = ?',
      [name, initialBalance, currentBalance, icon, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await dbQuery.all('SELECT * FROM categories');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { id, name, type, icon, color } = req.body;
    await dbQuery.run(
      'INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
      [id, name, type, icon, color]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, icon, color } = req.body;
    await dbQuery.run(
      'UPDATE categories SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?',
      [name, type, icon, color, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TRANSACTIONS ---
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await dbQuery.all('SELECT * FROM transactions ORDER BY date DESC, createdAt DESC');
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { id, date, type, amount, categoryId, walletId, toWalletId, note, createdBy } = req.body;
    
    await dbQuery.run('BEGIN TRANSACTION');

    // 1. Insert transaction
    await dbQuery.run(
      'INSERT INTO transactions (id, date, type, amount, categoryId, walletId, toWalletId, note, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, date, type, amount, categoryId, walletId, toWalletId, note, createdBy]
    );

    // 2. Update wallet balances
    if (type === 'income') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance + ? WHERE id = ?', [amount, walletId]);
    } else if (type === 'expense') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance - ? WHERE id = ?', [amount, walletId]);
    } else if (type === 'transfer') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance - ? WHERE id = ?', [amount, walletId]);
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance + ? WHERE id = ?', [amount, toWalletId]);
    }

    await dbQuery.run('COMMIT');

    // Trigger Google Sheets Sync
    const { syncTransactionToSheet } = require('./google');
    syncTransactionToSheet({
      id, date, type, amount, categoryId, walletId, note
    });
    
    res.status(201).json({ success: true });
  } catch (error) {
    await dbQuery.run('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get transaction to revert balance
    const tx = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    await dbQuery.run('BEGIN TRANSACTION');

    // Revert balances
    if (tx.type === 'income') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance - ? WHERE id = ?', [tx.amount, tx.walletId]);
    } else if (tx.type === 'expense') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance + ? WHERE id = ?', [tx.amount, tx.walletId]);
    } else if (tx.type === 'transfer') {
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance + ? WHERE id = ?', [tx.amount, tx.walletId]);
      await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance - ? WHERE id = ?', [tx.amount, tx.toWalletId]);
    }

    // Delete transaction
    await dbQuery.run('DELETE FROM transactions WHERE id = ?', [id]);
    
    await dbQuery.run('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await dbQuery.run('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// --- BUDGETS ---
app.get('/api/budgets', async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    let budgets;
    if (month) {
      budgets = await dbQuery.all('SELECT * FROM budgets WHERE month = ?', [month]);
    } else {
      budgets = await dbQuery.all('SELECT * FROM budgets');
    }
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const { id, categoryId, month, amount } = req.body;
    await dbQuery.run(
      'INSERT INTO budgets (id, categoryId, month, amount) VALUES (?, ?, ?, ?)',
      [id, categoryId, month, amount]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    await dbQuery.run('UPDATE budgets SET amount = ? WHERE id = ?', [amount, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`DompetKu Next-Gen Backend running on http://localhost:${PORT}`);
});
