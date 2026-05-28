/**
 * DompetKu - Transaction Module
 * Handles transaction creation, editing, deletion,
 * receipt photo upload/compression, and form validation.
 */
const Transaction = {
  currentType: 'expense',
  selectedWalletId: null,
  selectedDestWalletId: null,
  selectedCategoryId: null,
  editingId: null,
  receiptBlob: null,

  init() {
    const fabBtn = document.getElementById('fab-add');
    if (fabBtn) fabBtn.addEventListener('click', () => this.showModal());

    const toggleExpense = document.getElementById('toggle-expense');
    const toggleIncome = document.getElementById('toggle-income');
    const toggleTransfer = document.getElementById('toggle-transfer');
    
    if (toggleExpense) toggleExpense.addEventListener('click', () => this.setType('expense'));
    if (toggleIncome) toggleIncome.addEventListener('click', () => this.setType('income'));
    if (toggleTransfer) toggleTransfer.addEventListener('click', () => this.setType('transfer'));

    const amountInput = document.getElementById('input-amount');
    if (amountInput) Utils.formatAmountInput(amountInput);

    const saveBtn = document.getElementById('btn-save-transaction');
    if (saveBtn) saveBtn.addEventListener('click', () => this.save());

    const deleteBtn = document.getElementById('btn-delete-transaction');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.delete());

    const cancelBtn = document.getElementById('btn-cancel-transaction');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal());

    const modal = document.getElementById('modal-transaction');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.hideModal();
      });
    }

    const dateInput = document.getElementById('input-date');
    if (dateInput) dateInput.value = Utils.getTodayISO();

    const uploadBtn = document.getElementById('btn-upload-receipt');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('input-receipt');
        if (fileInput) fileInput.click();
      });
    }

    const receiptInput = document.getElementById('input-receipt');
    if (receiptInput) {
      receiptInput.addEventListener('change', (e) => this.handleReceiptUpload(e));
    }

    const removeBtn = document.getElementById('btn-remove-receipt');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => this.removeReceipt());
    }
  },

  setType(type) {
    this.currentType = type;

    const toggleExpense = document.getElementById('toggle-expense');
    const toggleIncome = document.getElementById('toggle-income');
    const toggleTransfer = document.getElementById('toggle-transfer');
    
    if (toggleExpense) toggleExpense.classList.toggle('active', type === 'expense');
    if (toggleIncome) toggleIncome.classList.toggle('active', type === 'income');
    if (toggleTransfer) toggleTransfer.classList.toggle('active', type === 'transfer');

    const groupCategory = document.getElementById('group-category');
    const groupDest = document.getElementById('group-wallet-dest');
    const sourceLabel = document.getElementById('label-wallet-source');

    if (type === 'transfer') {
      if (groupCategory) groupCategory.style.display = 'none';
      if (groupDest) groupDest.style.display = 'block';
      if (sourceLabel) sourceLabel.textContent = 'Dari Dompet';
    } else {
      if (groupCategory) groupCategory.style.display = 'block';
      if (groupDest) groupDest.style.display = 'none';
      if (sourceLabel) sourceLabel.textContent = 'Pilih Dompet';
      this.renderCategorySelector();
    }
  },

  async showModal(editId = null) {
    this.editingId = editId;
    this.receiptBlob = null;

    const amountInput = document.getElementById('input-amount');
    const noteInput = document.getElementById('input-note');
    const dateInput = document.getElementById('input-date');
    const receiptPreview = document.getElementById('receipt-preview');

    if (amountInput) amountInput.value = '';
    if (noteInput) noteInput.value = '';
    if (dateInput) dateInput.value = Utils.getTodayISO();
    if (receiptPreview) receiptPreview.style.display = 'none';

    if (editId) {
      const tx = await DB.get('transactions', editId);
      if (tx) {
        if (amountInput) amountInput.value = Utils.formatNumber(tx.amount);
        if (noteInput) noteInput.value = tx.note || '';
        if (dateInput) dateInput.value = tx.date;

        this.selectedWalletId = tx.walletId;
        this.selectedDestWalletId = tx.toWalletId || null;
        this.selectedCategoryId = tx.categoryId || null;
        
        this.setType(tx.type);

        if (tx.receiptPhoto) {
          this.receiptBlob = tx.receiptPhoto;
          const url = URL.createObjectURL(tx.receiptPhoto);
          const receiptImg = document.getElementById('receipt-img');
          if (receiptImg) receiptImg.src = url;
          if (receiptPreview) receiptPreview.style.display = 'block';
        }

        await this.renderWalletSelectors();
        if (tx.type !== 'transfer') await this.renderCategorySelector();

        const modalTitle = document.querySelector('#modal-transaction .modal-title');
        const saveBtn = document.getElementById('btn-save-transaction');
        const deleteBtn = document.getElementById('btn-delete-transaction');
        
        if (modalTitle) modalTitle.textContent = 'Edit Transaksi';
        if (saveBtn) saveBtn.innerHTML = '<i data-lucide="check"></i> Update Transaksi';
        if (deleteBtn) deleteBtn.style.display = 'flex';
      }
    } else {
      this.selectedWalletId = null;
      this.selectedDestWalletId = null;
      this.selectedCategoryId = null;
      this.setType('expense');
      
      await this.renderWalletSelectors();
      await this.renderCategorySelector();

      const modalTitle = document.querySelector('#modal-transaction .modal-title');
      const saveBtn = document.getElementById('btn-save-transaction');
      const deleteBtn = document.getElementById('btn-delete-transaction');

      if (modalTitle) modalTitle.textContent = 'Tambah Transaksi';
      if (saveBtn) saveBtn.innerHTML = '<i data-lucide="check"></i> Simpan Transaksi';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    const modal = document.getElementById('modal-transaction');
    if (modal) modal.classList.add('active');

    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      if (amountInput) amountInput.focus();
    }, 350);
  },

  hideModal() {
    const modal = document.getElementById('modal-transaction');
    if (modal) modal.classList.remove('active');
    this.editingId = null;
    this.receiptBlob = null;
  },

  async renderWalletSelectors() {
    const wallets = await DB.getAll('wallets');
    
    // Render Source Wallet Selector
    const sourceContainer = document.getElementById('wallet-selector');
    if (sourceContainer) {
      let sourceHtml = '';
      wallets.forEach((w, i) => {
        const isActive = this.selectedWalletId ? w.id === this.selectedWalletId : i === 0;
        if (!this.selectedWalletId && i === 0) this.selectedWalletId = w.id;
        sourceHtml += '<button class="pill ' + (isActive ? 'active' : '') + '" data-id="' + w.id + '">' + w.icon + ' ' + w.name + '</button>';
      });
      sourceContainer.innerHTML = sourceHtml;
      
      sourceContainer.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
          sourceContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.selectedWalletId = parseInt(pill.dataset.id);
        });
      });
    }

    // Render Destination Wallet Selector
    const destContainer = document.getElementById('wallet-dest-selector');
    if (destContainer) {
      let destHtml = '';
      wallets.forEach((w, i) => {
        const isActive = this.selectedDestWalletId ? w.id === this.selectedDestWalletId : (i === 1 ? true : (!this.selectedDestWalletId && i===0));
        if (!this.selectedDestWalletId && i === 1) this.selectedDestWalletId = w.id;
        else if (!this.selectedDestWalletId && wallets.length === 1 && i === 0) this.selectedDestWalletId = w.id;
        destHtml += '<button class="pill ' + (isActive ? 'active' : '') + '" data-id="' + w.id + '">' + w.icon + ' ' + w.name + '</button>';
      });
      destContainer.innerHTML = destHtml;
      
      destContainer.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
          destContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.selectedDestWalletId = parseInt(pill.dataset.id);
        });
      });
    }
  },

  async renderCategorySelector() {
    if (this.currentType === 'transfer') return;
    const categories = await DB.getAll('categories');
    const filtered = categories.filter(c => c.type === this.currentType);
    const container = document.getElementById('category-selector');
    if (!container) return;

    let html = '';
    filtered.forEach(cat => {
      const isActive = this.selectedCategoryId === cat.id;
      html +=
        '<button class="category-item ' + (isActive ? 'active' : '') + '" data-id="' + cat.id + '">' +
          '<span class="cat-icon">' + cat.icon + '</span>' +
          '<span>' + cat.name + '</span>' +
        '</button>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        container.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.selectedCategoryId = parseInt(item.dataset.id);
      });
    });
  },

  handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        this.receiptBlob = blob;
        const url = URL.createObjectURL(blob);
        const receiptImg = document.getElementById('receipt-img');
        const receiptPreview = document.getElementById('receipt-preview');
        if (receiptImg) receiptImg.src = url;
        if (receiptPreview) receiptPreview.style.display = 'block';
      }, 'image/jpeg', 0.7);
    };

    img.src = URL.createObjectURL(file);
  },

  removeReceipt() {
    this.receiptBlob = null;
    const receiptPreview = document.getElementById('receipt-preview');
    const receiptInput = document.getElementById('input-receipt');
    if (receiptPreview) receiptPreview.style.display = 'none';
    if (receiptInput) receiptInput.value = '';
  },

  async save() {
    const amountInput = document.getElementById('input-amount');
    const dateInput = document.getElementById('input-date');
    const noteInput = document.getElementById('input-note');

    const amount = Utils.parseNumber(amountInput ? amountInput.value : '');
    const date = dateInput ? dateInput.value : Utils.getTodayISO();
    const note = noteInput ? noteInput.value.trim() : '';

    if (!amount || amount <= 0) {
      Utils.showToast('Masukkan nominal transaksi!');
      return;
    }
    if (!this.selectedWalletId) {
      Utils.showToast('Pilih dompet sumber!');
      return;
    }
    
    if (this.currentType === 'transfer') {
      if (!this.selectedDestWalletId) {
        Utils.showToast('Pilih dompet tujuan!');
        return;
      }
      if (this.selectedWalletId === this.selectedDestWalletId) {
        Utils.showToast('Dompet tujuan harus berbeda!');
        return;
      }
    } else {
      if (!this.selectedCategoryId) {
        Utils.showToast('Pilih kategori!');
        return;
      }
    }

    const data = {
      date: date,
      type: this.currentType,
      amount: amount,
      walletId: this.selectedWalletId,
      note: note,
      receiptPhoto: this.receiptBlob,
      createdAt: new Date()
    };
    
    if (this.currentType === 'transfer') {
      data.toWalletId = this.selectedDestWalletId;
      data.categoryId = null;
    } else {
      data.categoryId = this.selectedCategoryId;
      data.toWalletId = null;
    }

    try {
      if (this.editingId) {
        data.id = this.editingId;
        await DB.update('transactions', data);
        Utils.showToast('Transaksi berhasil diupdate! ✅');
      } else {
        await DB.add('transactions', data);
        Utils.showToast('Transaksi berhasil disimpan! ✅');
      }

      this.hideModal();
      
      // Re-render dependent views
      Dashboard.render();
      const currentPage = document.querySelector('.bottom-nav .nav-item.active');
      if (currentPage) {
        App.navigate(currentPage.dataset.page);
      }

    } catch (e) {
      alert('Gagal menyimpan transaksi: ' + e.message);
    }
  },

  async delete() {
    if (!this.editingId) return;

    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Saldo dompet akan disesuaikan kembali.')) {
      return;
    }

    try {
      await DB.delete('transactions', this.editingId);
      
      this.hideModal();
      
      // Re-render dependent views
      Dashboard.render();
      const currentPage = document.querySelector('.bottom-nav .nav-item.active');
      if (currentPage) {
        App.navigate(currentPage.dataset.page);
      }
    } catch (e) {
      alert('Gagal menghapus transaksi: ' + e.message);
    }
  },

  /**
   * Convenience method: open the edit modal for a given transaction ID.
   * @param {number} id  Transaction ID.
   */
  async showEditModal(id) {
    await this.showModal(id);
  }
};
