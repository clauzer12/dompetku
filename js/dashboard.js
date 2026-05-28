/**
 * DompetKu - Dashboard Module
 * Handles dashboard rendering: total balance, monthly stats,
 * expense chart (Chart.js doughnut), and recent transactions.
 */
const Dashboard = {
  charts: {},

  /**
   * Main render entry point — called when the dashboard page becomes active.
   */
  async render() {
    await this.updateTotalBalance();
    await this.updateMonthlyStats();
    await this.renderCharts();
    await this.renderRecentTransactions();
  },

  /**
   * Animate the total balance counter into #total-balance.
   */
  async updateTotalBalance() {
    const total = await DB.getTotalBalance();
    const el = document.getElementById('total-balance');
    if (el) {
      Utils.animateCounter(el, total);
    }

    // Update specific wallet balances
    const wallets = await DB.getAll('wallets');
    
    // Default to 0 if not found yet
    let prakasCash = 0, prakasRekening = 0;
    let mishelCash = 0, mishelRekening = 0;

    wallets.forEach(w => {
      const name = w.name.toLowerCase();
      // Identify ownership
      if (name.includes('prakas') || w.id === 'wallet-1' || w.id === 'wallet-2') {
        if (name.includes('tunai') || name.includes('cash')) prakasCash += w.currentBalance;
        else prakasRekening += w.currentBalance;
      } else if (name.includes('mishel') || w.id === 'wallet-3' || w.id === 'wallet-4') {
        if (name.includes('tunai') || name.includes('cash')) mishelCash += w.currentBalance;
        else mishelRekening += w.currentBalance;
      }
    });
    
    const pcEl = document.getElementById('prakas-cash');
    const prEl = document.getElementById('prakas-rekening');
    const mcEl = document.getElementById('mishel-cash');
    const mrEl = document.getElementById('mishel-rekening');

    if (pcEl) pcEl.textContent = Utils.formatCurrency(prakasCash);
    if (prEl) prEl.textContent = Utils.formatCurrency(prakasRekening);
    if (mcEl) mcEl.textContent = Utils.formatCurrency(mishelCash);
    if (mrEl) mrEl.textContent = Utils.formatCurrency(mishelRekening);
  },

  /**
   * Calculate and display this month's income and expense totals.
   */
  async updateMonthlyStats() {
    const month = Utils.getCurrentMonth();
    const transactions = await DB.getTransactionsByMonth(month);

    let totalIncome = 0;
    let totalExpense = 0;
    
    let prakasIncome = 0;
    let prakasExpense = 0;
    let mishelIncome = 0;
    let mishelExpense = 0;

    transactions.forEach(tx => {
      const amount = tx.amount;
      const isPrakas = tx.createdBy === 'Clauzer' || tx.createdBy === 'Prakas';
      const isMishel = tx.createdBy === 'Mishel';
      
      if (tx.type === 'income') {
        totalIncome += amount;
        if (isPrakas) prakasIncome += amount;
        if (isMishel) mishelIncome += amount;
      } else {
        totalExpense += amount;
        if (isPrakas) prakasExpense += amount;
        if (isMishel) mishelExpense += amount;
      }
    });

    const incomeEl = document.getElementById('month-income');
    const expenseEl = document.getElementById('month-expense');
    if (incomeEl) incomeEl.textContent = Utils.formatCurrency(totalIncome);
    if (expenseEl) expenseEl.textContent = Utils.formatCurrency(totalExpense);
    
    const piEl = document.getElementById('prakas-month-income');
    const peEl = document.getElementById('prakas-month-expense');
    const miEl = document.getElementById('mishel-month-income');
    const meEl = document.getElementById('mishel-month-expense');
    
    if (piEl) piEl.textContent = Utils.formatCurrency(prakasIncome);
    if (peEl) peEl.textContent = Utils.formatCurrency(prakasExpense);
    if (miEl) miEl.textContent = Utils.formatCurrency(mishelIncome);
    if (meEl) meEl.textContent = Utils.formatCurrency(mishelExpense);
  },

  async renderCharts() {
    const month = Utils.getCurrentMonth();
    const transactions = await DB.getTransactionsByMonth(month);
    const categories = await DB.getAll('categories');

    // Helper to build a single chart
    const buildChart = (chartId, legendId, centerId, emptyMessage, filterFn) => {
      const filtered = transactions.filter(filterFn);
      
      const valueByCategory = {};
      filtered.forEach(tx => {
        if (!valueByCategory[tx.categoryId]) valueByCategory[tx.categoryId] = 0;
        valueByCategory[tx.categoryId] += tx.amount;
      });

      const categoryIds = Object.keys(valueByCategory);

      if (categoryIds.length === 0) {
        const legendEl = document.getElementById(legendId);
        if(legendEl) {
          legendEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p class="empty-text">' + emptyMessage + '</p></div>';
        }
        const centerEl = document.getElementById(centerId);
        if(centerEl) centerEl.innerHTML = '';
        if (this.charts[chartId]) {
          this.charts[chartId].destroy();
          delete this.charts[chartId];
        }
        return;
      }

      const labels = [];
      const data = [];
      const colors = [];
      const total = Object.values(valueByCategory).reduce((a, b) => a + b, 0);

      categoryIds.forEach(catId => {
        const cat = categories.find(c => String(c.id) === String(catId));
        if (cat) {
          labels.push(cat.icon + ' ' + cat.name);
          data.push(valueByCategory[catId]);
          colors.push(cat.color);
        }
      });

      const centerEl = document.getElementById(centerId);
      if (centerEl) {
        centerEl.innerHTML =
          '<div style="font-size:0.7rem;color:#64748B">Total</div>' +
          '<div style="font-size:1rem;font-weight:700;font-family:\'DM Mono\',monospace">' +
            Utils.formatCurrency(total) +
          '</div>';
      }

      const canvasEl = document.getElementById(chartId);
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');

      if (this.charts[chartId]) {
        this.charts[chartId].data.labels = labels;
        this.charts[chartId].data.datasets[0].data = data;
        this.charts[chartId].data.datasets[0].backgroundColor = colors;
        this.charts[chartId].update('active');
      } else {
        this.charts[chartId] = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: colors,
              borderWidth: 4,
              borderColor: '#0F172A',
              hoverBorderWidth: 0,
              cutout: '75%',
              borderRadius: 6
            }]
          },
          plugins: [{
            id: 'neonGlow',
            beforeDraw: (chart) => {
              const cCtx = chart.ctx;
              cCtx.save();
              cCtx.shadowColor = 'rgba(255, 255, 255, 0.15)';
              cCtx.shadowBlur = 20;
              cCtx.shadowOffsetX = 0;
              cCtx.shadowOffsetY = 0;
            },
            afterDraw: (chart) => {
              chart.ctx.restore();
            }
          }],
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { family: "'Plus Jakarta Sans', sans-serif" },
                bodyFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
                padding: 12,
                cornerRadius: 8,
                boxPadding: 6,
                callbacks: {
                  label: function(context) {
                    return ' ' + Utils.formatCurrency(context.raw);
                  }
                }
              }
            },
            animation: { animateRotate: true, animateScale: true, duration: 800, easing: 'easeOutQuart' }
          }
        });
      }

      const legendEl = document.getElementById(legendId);
      if (legendEl) {
        let legendHTML = '';
        labels.forEach((label, i) => {
          const pct = ((data[i] / total) * 100).toFixed(1);
          legendHTML +=
            '<div class="legend-item">' +
              '<span class="legend-dot" style="background:' + colors[i] + '"></span>' +
              '<span>' + label + ' (' + pct + '%)</span>' +
            '</div>';
        });
        legendEl.innerHTML = legendHTML;
      }
    };

    buildChart('prakas-expense-chart', 'chart-legend-prakas-expense', 'chart-center-prakas-expense', 'Belum ada', tx => tx.type === 'expense' && (tx.createdBy === 'Clauzer' || tx.createdBy === 'Prakas'));
    buildChart('prakas-income-chart', 'chart-legend-prakas-income', 'chart-center-prakas-income', 'Belum ada', tx => tx.type === 'income' && (tx.createdBy === 'Clauzer' || tx.createdBy === 'Prakas'));
    buildChart('mishel-expense-chart', 'chart-legend-mishel-expense', 'chart-center-mishel-expense', 'Belum ada', tx => tx.type === 'expense' && tx.createdBy === 'Mishel');
    buildChart('mishel-income-chart', 'chart-legend-mishel-income', 'chart-center-mishel-income', 'Belum ada', tx => tx.type === 'income' && tx.createdBy === 'Mishel');
  },

  /**
   * Render the 10 most recent transactions, grouped by relative date label.
   */
  async renderRecentTransactions() {
    const allTransactions = await DB.getAll('transactions');
    const categories = await DB.getAll('categories');
    const wallets = await DB.getAll('wallets');

    // Sort by date descending, take last 10
    const recent = allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    const container = document.getElementById('recent-transactions');
    if (!container) return;

    if (recent.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">📝</div>' +
          '<p class="empty-text">Belum ada transaksi. Tap + untuk menambah!</p>' +
        '</div>';
      return;
    }

    // Group by relative date
    const groups = {};
    recent.forEach(tx => {
      const label = Utils.getRelativeDateLabel(tx.date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });

    let html = '';
    Object.keys(groups).forEach(dateLabel => {
      html += '<div class="transaction-group-header">' + dateLabel + '</div>';
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

        html +=
          '<div class="transaction-item" data-id="' + tx.id + '">' +
            '<div class="tx-icon" style="background:' + cat.color + '15;color:' + cat.color + '">' + cat.icon + '</div>' +
            '<div class="tx-details">' +
              '<div class="tx-category">' + cat.name + userBadge + '</div>' +
              '<div class="tx-note">' + (tx.note || '') + '</div>' +
            '</div>' +
            '<div class="tx-amount ' + amountClass + '">' +
              '<div class="amount">' + prefix + Utils.formatCurrency(tx.amount) + '</div>' +
              '<div class="tx-wallet">' + walletName + '</div>' +
            '</div>' +
          '</div>';
      });
    });

    container.innerHTML = html;

    // Add click handlers for transaction items -> open edit modal
    container.querySelectorAll('.transaction-item').forEach(item => {
      item.addEventListener('click', () => {
        // use strings for id since SQLite uses string UUIDs
        Transaction.showEditModal(item.dataset.id);
      });
    });
  }
};
