/**
 * Google Integration using Google Apps Script (Webhook)
 * No Service Account or Credit Card required.
 */

const WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

async function syncTransactionToSheet(transaction) {
  if (!WEBHOOK_URL) {
    console.log('GOOGLE_APPS_SCRIPT_URL not found in .env. Sync disabled.');
    return;
  }

  try {
    const payload = {
      action: 'add_transaction',
      data: {
        id: transaction.id,
        date: transaction.date,
        type: transaction.type,
        amount: transaction.amount,
        categoryId: transaction.categoryId,
        walletId: transaction.walletId,
        note: transaction.note || '',
        createdBy: transaction.createdBy || 'Desktop'
      }
    };

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      console.log('Transaction synced to Google Sheets via Webhook.');
    } else {
      console.error('Webhook returned error:', result);
    }
  } catch (error) {
    console.error('Error syncing to Google Sheets via Webhook:', error);
  }
}

// Stub for future Drive upload via webhook
async function uploadReceiptToDrive(filePath, fileName) {
  console.log('Drive upload via webhook not implemented yet.');
  return null;
}

module.exports = {
  syncTransactionToSheet,
  uploadReceiptToDrive
};
