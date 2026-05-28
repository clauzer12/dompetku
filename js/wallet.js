/**
 * DompetKu - Wallet Module
 * Handles wallet CRUD operations, wallet list rendering with
 * calculated balances, and the add/edit wallet modal.
 */
const Wallet = {
  /**
   * Initialize all event listeners for the wallet modal.
   */
  init() {
    const addBtn = document.getElementById('btn-add-wallet');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showModal());
    }

    const saveBtn = document.getElementById('btn-save-wallet');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }

    const cancelBtn = document.getElementById('btn-cancel-wallet');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideModal());
    }

    const modal = document.getElementById('modal-wallet');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.hideModal();
      });
    }

    // Emoji picker for wallet icon
    document.querySelectorAll('#wallet-emoji-picker .emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#wallet-emoji-picker .emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Amount formatting for wallet balance input
    const balanceInput = document.getElementById('input-wallet-balance');
    if (balanceInput) {
      Utils.formatAmountInput(balanceInput);
    }
  },

  /**
   * Render the wallet list with each wallet's calculated balance.
   */
  async render() {
    const wallets = await DB.getAll('wallets');
    const container = document.getElementById('wallet-list');
    if (!container) return;

    if (wallets.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">💳</div>' +
          '<p class="empty-text">Belum ada dompet</p>' +
        '</div>';
      return;
    }

    let html = '';
    for (const wallet of wallets) {
      const balance = await DB.calculateWalletBalance(wallet.id);
      html +=
        '<div class="wallet-card" data-id="' + wallet.id + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div>' +
              '<div class="wallet-icon">' + wallet.icon + '</div>' +
              '<div class="wallet-name">' + wallet.name + '</div>' +
            '</div>' +
            '<div class="wallet-actions">' +
              '<button class="wallet-action-btn" onclick="Wallet.showModal(' + wallet.id + ')">✏️ Edit</button>' +
              '<button class="wallet-action-btn" onclick="Wallet.delete(' + wallet.id + ')">🗑️</button>' +
            '</div>' +
          '</div>' +
          '<div class="wallet-balance">' + Utils.formatCurrency(balance) + '</div>' +
        '</div>';
    }

    container.innerHTML = html;
  },

  /**
   * Show the wallet add/edit modal.
   * @param {number|null} editId  Wallet ID to edit, or null for new.
   */
  async showModal(editId = null) {
    const nameInput = document.getElementById('input-wallet-name');
    const balanceInput = document.getElementById('input-wallet-balance');
    const editIdField = document.getElementById('edit-wallet-id');

    if (nameInput) nameInput.value = '';
    if (balanceInput) balanceInput.value = '';
    if (editIdField) editIdField.value = '';

    // Reset emoji picker — select the first emoji by default
    const emojiButtons = document.querySelectorAll('#wallet-emoji-picker .emoji-btn');
    emojiButtons.forEach(b => b.classList.remove('active'));
    if (emojiButtons.length > 0) {
      emojiButtons[0].classList.add('active');
    }

    if (editId) {
      const wallet = await DB.get('wallets', editId);
      if (wallet) {
        const titleEl = document.getElementById('wallet-modal-title');
        if (titleEl) titleEl.textContent = 'Edit Dompet';
        if (nameInput) nameInput.value = wallet.name;
        if (balanceInput) balanceInput.value = Utils.formatNumber(wallet.initialBalance);
        if (editIdField) editIdField.value = wallet.id;

        // Set the matching emoji as active
        emojiButtons.forEach(b => {
          b.classList.toggle('active', b.dataset.emoji === wallet.icon);
        });
      }
    } else {
      const titleEl = document.getElementById('wallet-modal-title');
      if (titleEl) titleEl.textContent = 'Tambah Dompet';
    }

    const modal = document.getElementById('modal-wallet');
    if (modal) modal.classList.add('active');
  },

  /**
   * Hide the wallet modal.
   */
  hideModal() {
    const modal = document.getElementById('modal-wallet');
    if (modal) modal.classList.remove('active');
  },

  /**
   * Validate and save (create or update) a wallet.
   */
  async save() {
    const nameInput = document.getElementById('input-wallet-name');
    const balanceInput = document.getElementById('input-wallet-balance');
    const editIdField = document.getElementById('edit-wallet-id');

    const name = nameInput ? nameInput.value.trim() : '';
    const balance = Utils.parseNumber(balanceInput ? balanceInput.value : '');
    const editId = editIdField ? editIdField.value : '';
    const activeEmoji = document.querySelector('#wallet-emoji-picker .emoji-btn.active');
    const icon = activeEmoji ? activeEmoji.dataset.emoji : '🏦';

    if (!name) {
      Utils.showToast('Masukkan nama dompet!');
      return;
    }

    const data = {
      name: name,
      initialBalance: balance,
      icon: icon,
      color: '#065F46',
      createdAt: new Date()
    };

    if (editId) {
      data.id = parseInt(editId);
      await DB.update('wallets', data);
      Utils.showToast('Dompet berhasil diupdate! ✅');
    } else {
      await DB.add('wallets', data);
      Utils.showToast('Dompet berhasil ditambahkan! ✅');
    }

    this.hideModal();
    await this.render();
    await Dashboard.render();
  },

  /**
   * Delete a wallet after user confirmation.
   * @param {number} id  Wallet ID.
   */
  async delete(id) {
    App.showConfirm('Hapus Dompet', 'Yakin ingin menghapus dompet ini? Semua transaksi terkait akan tetap ada.', async () => {
      await DB.delete('wallets', id);
      Utils.showToast('Dompet dihapus! 🗑️');
      await this.render();
      await Dashboard.render();
    });
  }
};
