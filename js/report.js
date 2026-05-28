/**
 * DompetKu - Report Module
 * Renders financial reports with Chart.js bar charts,
 * category breakdowns, and export to PDF / Excel.
 */
const Report = {
  currentMonth: null,
  barChart: null,

  init() {
    this.currentMonth = Utils.getCurrentMonth();

    // Month navigation
    document.getElementById('report-prev-month').addEventListener('click', () => {
      this.currentMonth = Utils.getPrevMonth(this.currentMonth);
      this.render();
    });
    document.getElementById('report-next-month').addEventListener('click', () => {
      this.currentMonth = Utils.getNextMonth(this.currentMonth);
      this.render();
    });

    // Export buttons
    document.getElementById('btn-export-excel').addEventListener('click', () => this.exportExcel());
  },

  async render() {
    if (!this.currentMonth) this.currentMonth = Utils.getCurrentMonth();

    document.getElementById('report-month-label').textContent = Utils.getMonthLabel(this.currentMonth);

    const transactions = await DB.getTransactionsByMonth(this.currentMonth);
    const categories = await DB.getAll('categories');

    // Calculate totals
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

    const netAmount = totalIncome - totalExpense;
    const netPrakas = prakasIncome - prakasExpense;
    const netMishel = mishelIncome - mishelExpense;

    // Update Gabungan
    document.getElementById('report-income-total').textContent = Utils.formatCurrency(totalIncome);
    document.getElementById('report-expense-total').textContent = Utils.formatCurrency(totalExpense);
    const netElTotal = document.getElementById('report-net-total');
    netElTotal.textContent = Utils.formatCurrency(netAmount);
    netElTotal.style.color = netAmount >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    // Update Prakas
    document.getElementById('report-income-prakas').textContent = Utils.formatCurrency(prakasIncome);
    document.getElementById('report-expense-prakas').textContent = Utils.formatCurrency(prakasExpense);
    const netElPrakas = document.getElementById('report-net-prakas');
    netElPrakas.textContent = Utils.formatCurrency(netPrakas);
    netElPrakas.style.color = netPrakas >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    // Update Mishel
    document.getElementById('report-income-mishel').textContent = Utils.formatCurrency(mishelIncome);
    document.getElementById('report-expense-mishel').textContent = Utils.formatCurrency(mishelExpense);
    const netElMishel = document.getElementById('report-net-mishel');
    netElMishel.textContent = Utils.formatCurrency(netMishel);
    netElMishel.style.color = netMishel >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    // Render bar chart (last 6 months)
    await this.renderBarChart();

    // Render category breakdown
    await this.renderCategoryBreakdown(transactions, categories);
  },

  async renderBarChart() {
    const months = [];
    const incomeData = [];
    const expenseData = [];

    // Get data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const targetMonth = this.getMonthOffset(this.currentMonth, -i);
      months.push(Utils.getMonthLabel(targetMonth).split(' ')[0].substring(0, 3)); // Short month name

      const txs = await DB.getTransactionsByMonth(targetMonth);
      let inc = 0, exp = 0;
      txs.forEach(tx => {
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      });
      incomeData.push(inc);
      expenseData.push(exp);
    }

    const ctx = document.getElementById('report-bar-chart').getContext('2d');

    if (this.barChart) {
      this.barChart.data.labels = months;
      this.barChart.data.datasets[0].data = incomeData;
      this.barChart.data.datasets[1].data = expenseData;
      this.barChart.update('active');
    } else {
      this.barChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Pemasukan',
              data: incomeData,
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderRadius: 6,
              borderSkipped: false,
              barPercentage: 0.7,
              categoryPercentage: 0.6
            },
            {
              label: 'Pengeluaran',
              data: expenseData,
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              borderRadius: 6,
              borderSkipped: false,
              barPercentage: 0.7,
              categoryPercentage: 0.6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyle: 'rectRounded',
                padding: 20,
                color: '#94A3B8',
                font: { family: "'Plus Jakarta Sans'", size: 11 }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#FFFFFF',
              bodyColor: '#94A3B8',
              titleFont: { family: "'Plus Jakarta Sans'", weight: '600' },
              bodyFont: { family: "'DM Mono'" },
              padding: 12,
              cornerRadius: 12,
              callbacks: {
                label: (context) => ` ${context.dataset.label}: ${Utils.formatCurrency(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94A3B8', font: { family: "'Plus Jakarta Sans'", size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: {
                color: '#94A3B8',
                font: { family: "'DM Mono'", size: 10 },
                callback: (value) => {
                  if (value >= 1000000) return (value / 1000000).toFixed(0) + 'jt';
                  if (value >= 1000) return (value / 1000).toFixed(0) + 'rb';
                  return value;
                }
              }
            }
          },
          animation: { duration: 800, easing: 'easeOutQuart' }
        }
      });
    }
  },

  async renderCategoryBreakdown(transactions, categories) {
    const container = document.getElementById('report-category-breakdown');

    // Group expenses by category
    const expenseByCategory = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
      if (!expenseByCategory[tx.categoryId]) expenseByCategory[tx.categoryId] = 0;
      expenseByCategory[tx.categoryId] += tx.amount;
    });

    const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);

    if (totalExpense === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p class="empty-text">Belum ada data pengeluaran</p></div>';
      return;
    }

    // Sort by amount descending
    const sorted = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

    let html = '';
    sorted.forEach(([catId, amount]) => {
      const cat = categories.find(c => String(c.id) === String(catId));
      if (!cat) return;
      const percentage = (amount / totalExpense) * 100;

      html += `<div class="breakdown-item">
        <div class="breakdown-icon">${cat.icon}</div>
        <div class="breakdown-details">
          <div class="breakdown-name">${cat.name}</div>
          <div class="breakdown-bar">
            <div class="breakdown-bar-fill" style="width:${percentage}%;background:${cat.color}"></div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="breakdown-amount">${Utils.formatCurrency(amount)}</div>
          <div class="breakdown-percent">${percentage.toFixed(1)}%</div>
        </div>
      </div>`;
    });

    container.innerHTML = html;
  },

  getMonthOffset(monthStr, offset) {
    const [year, month] = monthStr.split('-').map(Number);
    const d = new Date(year, month - 1 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  async exportExcel() {
    try {
      const transactions = await DB.getTransactionsByMonth(this.currentMonth);
      const categories = await DB.getAll('categories');
      const wallets = await DB.getAll('wallets');

      let totalIncome = 0;
      let totalExpense = 0;
      let prakasIncome = 0;
      let prakasExpense = 0;
      let mishelIncome = 0;
      let mishelExpense = 0;
      const expenseByCategory = {};

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
          
          if (!expenseByCategory[tx.categoryId]) expenseByCategory[tx.categoryId] = 0;
          expenseByCategory[tx.categoryId] += amount;
        }
      });

      // Sheet 1: Summary (AOA - Array of Arrays)
      const summaryAOA = [
        ['RINGKASAN KEUANGAN GABUNGAN', ''],
        ['Bulan', Utils.getMonthLabel(this.currentMonth)],
        ['', ''],
        ['Total Pemasukan Gabungan', totalIncome],
        ['Total Pengeluaran Gabungan', totalExpense],
        ['Sisa Saldo Bersih', totalIncome - totalExpense],
        ['', ''],
        ['RINCIAN PER ORANG', ''],
        ['Pemasukan Prakas', prakasIncome],
        ['Pemasukan Mishel', mishelIncome],
        ['Pengeluaran Prakas', prakasExpense],
        ['Pengeluaran Mishel', mishelExpense],
        ['', ''],
        ['RINCIAN PENGELUARAN PER KATEGORI', '']
      ];

      Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).forEach(([catId, amount]) => {
        const cat = categories.find(c => String(c.id) === String(catId));
        if (cat) {
          summaryAOA.push([`${cat.icon} ${cat.name}`, amount]);
        }
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];

      // Sheet 2: Transactions (JSON to Sheet)
      const txData = transactions.map(tx => {
        const cat = categories.find(c => c.id === tx.categoryId);
        const wallet = wallets.find(w => w.id === tx.walletId);
        
        let dateStr = tx.date;
        try {
          const d = new Date(tx.date);
          dateStr = d.toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch(e) {}

        return {
          'Tanggal & Waktu': dateStr,
          'Dibuat Oleh': tx.createdBy || 'Unknown',
          'Tipe': tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
          'Kategori': cat ? `${cat.icon} ${cat.name}` : 'Unknown',
          'Sumber Dana': wallet ? wallet.name : 'Unknown',
          'Jumlah (Rp)': tx.amount,
          'Catatan': tx.note || ''
        };
      });

      const wsTx = XLSX.utils.json_to_sheet(txData);
      wsTx['!cols'] = [
        { wch: 20 }, // Tanggal
        { wch: 15 }, // Dibuat Oleh
        { wch: 15 }, // Tipe
        { wch: 20 }, // Kategori
        { wch: 20 }, // Sumber Dana
        { wch: 15 }, // Jumlah
        { wch: 30 }, // Catatan
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
      XLSX.utils.book_append_sheet(wb, wsTx, 'Daftar Transaksi');
      XLSX.writeFile(wb, `DompetKu-${this.currentMonth}.xlsx`);

      Utils.showToast('Excel berhasil di-export! 📊');
    } catch (error) {
      console.error('Excel export error:', error);
      Utils.showToast('Gagal export Excel. Coba lagi.');
    }
  }
};
