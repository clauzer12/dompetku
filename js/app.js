/**
 * DompetKu - Main Application Controller
 * Initializes all modules, handles page navigation,
 * manages the confirmation dialog, and renders filtered
 * transaction lists on the "More" page.
 */
const App = {
  currentPage: 'dashboard',
  confirmCallback: null,

  async init() {
    try {
      // Initialize database
      await DB.init();

      // Seed defaults
      await DB.seedDefaultCategories();
      await DB.seedDefaultWallet();

      // Initialize all modules
      Transaction.init();
      Wallet.init();
      Category.init();
      Budget.init();
      Report.init();

      // Setup navigation
      this.setupNavigation();

      // Setup confirmation dialog
      this.setupConfirmDialog();

      // Render initial page
      await this.navigate('dashboard');

      // Initialize Lucide icons
      if (window.lucide) lucide.createIcons();

      // Auto-refresh the current page every 60 seconds
      setInterval(() => {
        console.log('Auto-refreshing data...');
        this.navigate(this.currentPage, true);
      }, 60000);

      console.log('DompetKu initialized successfully! 🚀');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.navigate(page);
      });
    });
  },

  async navigate(page, isAutoRefresh = false) {
    this.currentPage = page;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Scroll to top only if it's not an auto-refresh
    if (!isAutoRefresh) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Render page content
    switch (page) {
      case 'dashboard':
        await Dashboard.render();
        break;
      case 'budget':
        await Budget.render();
        break;
      case 'report':
        await Report.render();
        break;
      case 'more':
        await Wallet.render();
        await Category.render();
        await this.renderAllTransactions();
        break;
    }

    // Re-init icons after render
    if (window.lucide) lucide.createIcons();
  },

  async renderAllTransactions() {
    // Render all transactions with filters
    const allTransactions = await DB.getAll('transactions');
    const categories = await DB.getAll('categories');
    const wallets = await DB.getAll('wallets');

    // Populate filter dropdowns
    const walletFilter = document.getElementById('filter-wallet');
    const categoryFilter = document.getElementById('filter-category');

    // Only repopulate if empty (first option is the "all" placeholder)
    if (walletFilter.options.length <= 1) {
      wallets.forEach(w => {
        walletFilter.innerHTML += `<option value="${w.id}">${w.icon} ${w.name}</option>`;
      });
    }
    if (categoryFilter.options.length <= 1) {
      categories.forEach(c => {
        categoryFilter.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
      });
    }

    // Set default month filter
    const monthFilter = document.getElementById('filter-month');
    if (!monthFilter.value) {
      monthFilter.value = Utils.getCurrentMonth();
    }

    // Apply filters
    let filtered = [...allTransactions];

    const selectedWallet = walletFilter.value;
    const selectedCategory = categoryFilter.value;
    const selectedMonth = monthFilter.value;

    if (selectedWallet) {
      filtered = filtered.filter(tx => tx.walletId === parseInt(selectedWallet));
    }
    if (selectedCategory) {
      filtered = filtered.filter(tx => tx.categoryId === parseInt(selectedCategory));
    }
    if (selectedMonth) {
      const { start, end } = Utils.getMonthRange(selectedMonth);
      filtered = filtered.filter(tx => {
        const d = new Date(tx.date);
        return d >= start && d <= end;
      });
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const container = document.getElementById('all-transactions');

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p class="empty-text">Tidak ada transaksi</p></div>';
      return;
    }

    // Group by date
    const groups = {};
    filtered.forEach(tx => {
      const label = Utils.getRelativeDateLabel(tx.date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });

    let html = '';
    Object.keys(groups).forEach(dateLabel => {
      html += `<div class="transaction-group-header">${dateLabel}</div>`;
      groups[dateLabel].forEach(tx => {
        let cat, amountClass, prefix, walletName;
        const wallet = wallets.find(w => w.id === tx.walletId) || { name: 'Unknown' };

        if (tx.type === 'transfer') {
          cat = { icon: '🔄', name: 'Transfer', color: '#8B5CF6' };
          amountClass = '';
          prefix = '';
          const toWallet = wallets.find(w => w.id === tx.toWalletId) || { name: '?' };
          walletName = `${wallet.name} ➞ ${toWallet.name}`;
        } else {
          cat = categories.find(c => c.id === tx.categoryId) || { icon: '📦', name: 'Unknown', color: '#64748B' };
          amountClass = tx.type === 'income' ? 'income' : 'expense';
          prefix = tx.type === 'income' ? '+' : '-';
          walletName = wallet.name;
        }

        let userBadge = '';
        if (tx.createdBy && tx.createdBy !== 'Desktop') {
          userBadge = `<span class="badge-user">👤 ${tx.createdBy}</span>`;
        }

        html += `<div class="transaction-item" data-id="${tx.id}">
          <div class="tx-icon" style="background:${cat.color}15;color:${cat.color}">${cat.icon}</div>
          <div class="tx-details">
            <div class="tx-category">${cat.name}${userBadge}</div>
            <div class="tx-note">${tx.note || ''}</div>
          </div>
          <div class="tx-amount ${amountClass}">
            <div class="amount">${prefix}${Utils.formatCurrency(tx.amount)}</div>
            <div class="tx-wallet">${walletName}</div>
          </div>
        </div>`;
      });
    });

    container.innerHTML = html;

    // Add click handlers for edit/delete
    container.querySelectorAll('.transaction-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        Transaction.showEditModal(id);
      });
    });

    // Add filter change listeners (use onchange to avoid stacking)
    walletFilter.onchange = () => this.renderAllTransactions();
    categoryFilter.onchange = () => this.renderAllTransactions();
    monthFilter.onchange = () => this.renderAllTransactions();
  },

  setupConfirmDialog() {
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.remove('active');
      this.confirmCallback = null;
    });
    document.getElementById('btn-confirm-ok').addEventListener('click', async () => {
      document.getElementById('modal-confirm').classList.remove('active');
      if (this.confirmCallback) {
        await this.confirmCallback();
        this.confirmCallback = null;
      }
    });
    document.getElementById('modal-confirm').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-confirm')) {
        document.getElementById('modal-confirm').classList.remove('active');
        this.confirmCallback = null;
      }
    });
  },

  showConfirm(title, message, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    this.confirmCallback = callback;
    document.getElementById('modal-confirm').classList.add('active');
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
