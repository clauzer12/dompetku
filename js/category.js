/**
 * DompetKu - Category Module
 * Handles category CRUD operations, category list rendering
 * grouped by type, and the add category modal with emoji/color pickers.
 */
const Category = {
  currentType: 'expense',

  /**
   * Initialize all event listeners for the category modal.
   */
  init() {
    const addBtn = document.getElementById('btn-add-category');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showModal());
    }

    const saveBtn = document.getElementById('btn-save-category');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }

    const cancelBtn = document.getElementById('btn-cancel-category');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideModal());
    }

    const modal = document.getElementById('modal-category');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.hideModal();
      });
    }

    // Type toggle buttons
    const toggleExpense = document.getElementById('cat-toggle-expense');
    const toggleIncome = document.getElementById('cat-toggle-income');

    if (toggleExpense) {
      toggleExpense.addEventListener('click', () => {
        this.currentType = 'expense';
        toggleExpense.classList.add('active');
        if (toggleIncome) toggleIncome.classList.remove('active');
      });
    }

    if (toggleIncome) {
      toggleIncome.addEventListener('click', () => {
        this.currentType = 'income';
        toggleIncome.classList.add('active');
        if (toggleExpense) toggleExpense.classList.remove('active');
      });
    }

    // Emoji picker
    document.querySelectorAll('#category-emoji-picker .emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#category-emoji-picker .emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Color picker
    document.querySelectorAll('#category-color-picker .color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#category-color-picker .color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  /**
   * Render the category list, grouped by type (Pengeluaran / Pemasukan).
   */
  async render() {
    const categories = await DB.getAll('categories');
    const container = document.getElementById('category-list');
    if (!container) return;

    // Group by type
    const expenses = categories.filter(c => c.type === 'expense');
    const incomes = categories.filter(c => c.type === 'income');

    let html = '<div class="transaction-group-header">Pengeluaran</div>';

    if (expenses.length === 0) {
      html += '<div class="empty-state" style="padding:12px 0"><p class="empty-text">Belum ada kategori pengeluaran</p></div>';
    } else {
      expenses.forEach(cat => {
        html +=
          '<div class="transaction-item" style="cursor:default">' +
            '<div class="tx-icon" style="background:' + cat.color + '15;color:' + cat.color + ';font-size:1.5rem">' + cat.icon + '</div>' +
            '<div class="tx-details">' +
              '<div class="tx-category">' + cat.name + '</div>' +
            '</div>' +
            '<div>' +
              '<button class="btn-icon" onclick="Category.delete(' + cat.id + ')" style="color:#EF4444">' +
                '<i data-lucide="trash-2" style="width:16px;height:16px"></i>' +
              '</button>' +
            '</div>' +
          '</div>';
      });
    }

    html += '<div class="transaction-group-header" style="margin-top:8px">Pemasukan</div>';

    if (incomes.length === 0) {
      html += '<div class="empty-state" style="padding:12px 0"><p class="empty-text">Belum ada kategori pemasukan</p></div>';
    } else {
      incomes.forEach(cat => {
        html +=
          '<div class="transaction-item" style="cursor:default">' +
            '<div class="tx-icon" style="background:' + cat.color + '15;color:' + cat.color + ';font-size:1.5rem">' + cat.icon + '</div>' +
            '<div class="tx-details">' +
              '<div class="tx-category">' + cat.name + '</div>' +
            '</div>' +
            '<div>' +
              '<button class="btn-icon" onclick="Category.delete(' + cat.id + ')" style="color:#EF4444">' +
                '<i data-lucide="trash-2" style="width:16px;height:16px"></i>' +
              '</button>' +
            '</div>' +
          '</div>';
      });
    }

    container.innerHTML = html;

    // Re-create Lucide icons for the dynamically inserted trash icons
    if (window.lucide) lucide.createIcons();
  },

  /**
   * Show the add-category modal with defaults.
   */
  showModal() {
    this.currentType = 'expense';

    const nameInput = document.getElementById('input-category-name');
    if (nameInput) nameInput.value = '';

    const toggleExpense = document.getElementById('cat-toggle-expense');
    const toggleIncome = document.getElementById('cat-toggle-income');
    if (toggleExpense) toggleExpense.classList.add('active');
    if (toggleIncome) toggleIncome.classList.remove('active');

    // Reset emoji picker — select the first emoji by default
    const emojiButtons = document.querySelectorAll('#category-emoji-picker .emoji-btn');
    emojiButtons.forEach(b => b.classList.remove('active'));
    if (emojiButtons.length > 0) {
      emojiButtons[0].classList.add('active');
    }

    // Reset color picker — select the first color by default
    const colorButtons = document.querySelectorAll('#category-color-picker .color-btn');
    colorButtons.forEach(b => b.classList.remove('active'));
    if (colorButtons.length > 0) {
      colorButtons[0].classList.add('active');
    }

    const modal = document.getElementById('modal-category');
    if (modal) modal.classList.add('active');
  },

  /**
   * Hide the category modal.
   */
  hideModal() {
    const modal = document.getElementById('modal-category');
    if (modal) modal.classList.remove('active');
  },

  /**
   * Validate and save a new category.
   */
  async save() {
    const nameInput = document.getElementById('input-category-name');
    const name = nameInput ? nameInput.value.trim() : '';

    const activeEmoji = document.querySelector('#category-emoji-picker .emoji-btn.active');
    const icon = activeEmoji ? activeEmoji.dataset.emoji : '📦';

    const activeColor = document.querySelector('#category-color-picker .color-btn.active');
    const color = activeColor ? activeColor.dataset.color : '#64748B';

    if (!name) {
      Utils.showToast('Masukkan nama kategori!');
      return;
    }

    await DB.add('categories', {
      name: name,
      type: this.currentType,
      icon: icon,
      color: color,
      createdAt: new Date()
    });

    Utils.showToast('Kategori berhasil ditambahkan! ✅');
    this.hideModal();
    await this.render();
  },

  /**
   * Delete a category after user confirmation.
   * @param {number} id  Category ID.
   */
  async delete(id) {
    App.showConfirm('Hapus Kategori', 'Yakin ingin menghapus kategori ini?', async () => {
      await DB.delete('categories', id);
      Utils.showToast('Kategori dihapus! 🗑️');
      await this.render();
    });
  }
};
