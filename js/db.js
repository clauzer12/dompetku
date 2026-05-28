/**
 * DompetKu - API Fetch Layer
 * Handles all database operations for wallets, categories, transactions, and budgets via Node.js Backend
 */

const DB = {
  API_URL: '/api',

  async init() {
    // No initialization needed for Fetch API, backend handles it
    return true;
  },

  // ---------------------------------------------------------------------------
  // Generic CRUD Helpers
  // ---------------------------------------------------------------------------

  async add(storeName, data) {
    const res = await fetch(`${this.API_URL}/${storeName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to add data');
    const result = await res.json();
    return result;
  },

  async get(storeName, id) {
    const all = await this.getAll(storeName);
    return all.find(item => item.id == id);
  },

  async getAll(storeName) {
    const res = await fetch(`${this.API_URL}/${storeName}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${storeName}`);
    return res.json();
  },

  async update(storeName, data) {
    const res = await fetch(`${this.API_URL}/${storeName}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update data');
    return res.json();
  },

  async delete(storeName, id) {
    const res = await fetch(`${this.API_URL}/${storeName}/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete data');
    return res.json();
  },

  // ---------------------------------------------------------------------------
  // Index-Based Query Helpers
  // ---------------------------------------------------------------------------

  async getByIndex(storeName, indexName, value) {
    const all = await this.getAll(storeName);
    return all.filter(item => item[indexName] === value);
  },

  // ---------------------------------------------------------------------------
  // Transaction-Specific Queries
  // ---------------------------------------------------------------------------

  async getTransactionsByMonth(month) {
    const all = await this.getAll('transactions');
    const { start, end } = Utils.getMonthRange(month);
    return all.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // ---------------------------------------------------------------------------
  // Budget-Specific Queries
  // ---------------------------------------------------------------------------

  async getBudgetByCategoryMonth(categoryId, month) {
    const res = await fetch(`${this.API_URL}/budgets?month=${month}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    const budgets = await res.json();
    return budgets.find(b => b.categoryId === categoryId) || null;
  },

  // ---------------------------------------------------------------------------
  // Wallet Balance Calculations
  // ---------------------------------------------------------------------------

  async calculateWalletBalance(walletId) {
    const wallet = await this.get('wallets', walletId);
    if (!wallet) return 0;
    
    // In our SQLite backend, we actually update the wallet.currentBalance directly
    // when saving a transaction. So we can just return it!
    return wallet.currentBalance !== undefined ? wallet.currentBalance : wallet.initialBalance;
  },

  async getTotalBalance() {
    const wallets = await this.getAll('wallets');
    let total = 0;
    for (const wallet of wallets) {
      total += await this.calculateWalletBalance(wallet.id);
    }
    return total;
  },

  // ---------------------------------------------------------------------------
  // Seed / Default Data
  // ---------------------------------------------------------------------------
  // The backend already seeds the default data on startup.
  async seedDefaultCategories() { return; },
  async seedDefaultWallet() { return; }
};
