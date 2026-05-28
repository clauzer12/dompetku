const cron = require('node-cron');
const { dbQuery } = require('./db');
const bot = require('./bot');
const nodemailer = require('nodemailer');

// Schedule job to run on the last day of every month at 21:00
// Note: "0 21 28-31 * *" runs on the 28th-31st. We check if tomorrow is the 1st.
cron.schedule('0 21 28-31 * *', async () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (tomorrow.getDate() === 1) {
    console.log('Running monthly report job...');
    await generateMonthlyReport();
  }
});

async function generateMonthlyReport() {
  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Fetch expenses
    const expenses = await dbQuery.all(`
      SELECT t.amount, c.name, c.icon 
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.type = 'expense' AND t.date LIKE ?
    `, [`${month}%`]);

    let totalExpense = 0;
    const expenseByCategory = {};

    expenses.forEach(tx => {
      totalExpense += tx.amount;
      const catKey = `${tx.icon} ${tx.name}`;
      if (!expenseByCategory[catKey]) expenseByCategory[catKey] = 0;
      expenseByCategory[catKey] += tx.amount;
    });

    // Sort top 3 categories
    const sortedCategories = Object.entries(expenseByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    let topExpensesText = '';
    sortedCategories.forEach(([cat, amount], index) => {
      const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : 0;
      topExpensesText += `${index + 1}. ${cat} - Rp ${amount.toLocaleString('id-ID')} (${percentage}%)\n`;
    });

    const monthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const reportMessage = `
📊 === LAPORAN KEUANGAN BULANAN ===
Halo! Berikut adalah rangkuman pengeluaran kalian di bulan ${monthName}:

💰 TOTAL PENGELUARAN: Rp ${totalExpense.toLocaleString('id-ID')}

🚨 TOP 3 PENGELUARAN TERBESAR:
${topExpensesText || '- Belum ada pengeluaran bulan ini -'}

Detail grafik lengkap sudah siap diakses via Laptop dan Google Drive!
    `.trim();

    // Send to Telegram (Broadcast to a saved chat ID or configured group)
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    if (bot && TELEGRAM_CHAT_ID) {
      bot.sendMessage(TELEGRAM_CHAT_ID, reportMessage);
      console.log('Monthly report sent to Telegram.');
    }

    // TODO: Generate PDF and send via nodemailer using GMAIL_APP_PASSWORD

  } catch (error) {
    console.error('Error generating monthly report:', error);
  }
}

module.exports = {
  generateMonthlyReport
};
