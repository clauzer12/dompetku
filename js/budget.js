/**
 * DompetKu - Budget Module
 * Manages monthly budget allocation per expense category,
 * tracks spending against limits, and displays progress bars.
 */
const Budget = {
  currentMonth: null,

  init() {
    this.currentMonth = Utils.getCurrentMonth();

    document.getElementById('btn-add-budget').addEventListener('click', () => this.showModal());
    document.getElementById('btn-save-budget').addEventListener('click', () => this.save());
    document.getElementById('btn-cancel-budget').addEventListener('click', () => this.hideModal());
    document.getElementById('modal-budget').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-budget')) this.hideModal();
    });

    // Month navigation
    document.getElementById('budget-prev-month').addEventListener('click', () => {
      this.currentMonth = Utils.getPrevMonth(this.currentMonth);
      this.render();
    });
    document.getElementById('budget-next-month').addEventListener('click', () => {
      this.currentMonth = Utils.getNextMonth(this.currentMonth);
      this.render();
    });
  },

  async render() {
    if (!this.currentMonth) this.currentMonth = Utils.getCurrentMonth();

    document.getElementById('budget-month-label').textContent = Utils.getMonthLabel(this.currentMonth);

    const budgets = await DB.getAll('budgets');
    const categories = await DB.getAll('categories');
    const transactions = await DB.getTransactionsByMonth(this.currentMonth);

    // Filter budgets for current month
    const monthBudgets = budgets.filter(b => b.month === this.currentMonth);

    let totalBudget = 0;
    let totalUsed = 0;

    const container = document.getElementById('budget-list');

    if (monthBudgets.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p class="empty-text">Belum ada budget yang diatur untuk bulan ini</p></div>';
      document.getElementById('total-budget').textContent = Utils.formatCurrency(0);
      document.getElementById('used-budget').textContent = Utils.formatCurrency(0);
      document.getElementById('remaining-budget').textContent = Utils.formatCurrency(0);
      return;
    }

    let html = '';

    monthBudgets.forEach(budget => {
      const cat = categories.find(c => c.id === budget.categoryId);
      if (!cat) return;

      // Calculate spent for this category
      const spent = transactions
        .filter(tx => tx.type === 'expense' && tx.categoryId === budget.categoryId)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const percentage = budget.limit > 0 ? Math.min((spent / budget.limit) * 100, 100) : 0;
      let barClass = 'safe';
      if (percentage >= 85) barClass = 'danger';
      else if (percentage >= 60) barClass = 'warning';

      totalBudget += budget.limit;
      totalUsed += spent;

      html += `<div class="budget-item">
        <div class="budget-header">
          <div class="budget-category">
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
          </div>
          <div class="budget-amount">${Utils.formatCurrency(spent)} / ${Utils.formatCurrency(budget.limit)}</div>
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill ${barClass}" style="width:${percentage}%"></div>
        </div>
        <div class="budget-percentage" style="display:flex;justify-content:space-between">
          <span>${percentage.toFixed(0)}% terpakai</span>
          <span>Sisa: ${Utils.formatCurrency(Math.max(budget.limit - spent, 0))}</span>
        </div>
      </div>`;
    });

    container.innerHTML = html;

    // Update summary
    document.getElementById('total-budget').textContent = Utils.formatCurrency(totalBudget);
    document.getElementById('used-budget').textContent = Utils.formatCurrency(totalUsed);
    document.getElementById('remaining-budget').textContent = Utils.formatCurrency(Math.max(totalBudget - totalUsed, 0));
  },

  async showModal() {
    // Populate category dropdown with expense categories
    const categories = await DB.getAll('categories');
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const select = document.getElementById('input-budget-category');

    select.innerHTML = '<option value="">Pilih Kategori</option>';
    expenseCategories.forEach(cat => {
      select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    document.getElementById('input-budget-limit').value = '';
    Utils.formatAmountInput(document.getElementById('input-budget-limit'));

    document.getElementById('modal-budget').classList.add('active');
  },

  hideModal() {
    document.getElementById('modal-budget').classList.remove('active');
  },

  async save() {
    const categoryId = parseInt(document.getElementById('input-budget-category').value);
    const limit = Utils.parseNumber(document.getElementById('input-budget-limit').value);

    if (!categoryId) {
      Utils.showToast('Pilih kategori!');
      return;
    }
    if (!limit || limit <= 0) {
      Utils.showToast('Masukkan nominal budget!');
      return;
    }

    // Check if budget already exists for this category and month
    const existing = await DB.getBudgetByCategoryMonth(categoryId, this.currentMonth);

    if (existing) {
      existing.limit = limit;
      await DB.update('budgets', existing);
      Utils.showToast('Budget berhasil diupdate! ✅');
    } else {
      await DB.add('budgets', {
        categoryId: categoryId,
        month: this.currentMonth,
        limit: limit,
        createdAt: new Date()
      });
      Utils.showToast('Budget berhasil ditambahkan! ✅');
    }

    this.hideModal();
    await this.render();
  }
};
