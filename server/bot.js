const TelegramBot = require('node-telegram-bot-api');
const { dbQuery } = require('./db');
const { v4: uuidv4 } = require('uuid');

// Check if token exists, otherwise mock the bot to prevent crashing
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

if (token) {
  // Use polling for local development, webhook is better for production but requires HTTPS/ngrok
  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram Bot is running (Polling Mode).');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) {
      // Ignore non-text messages for now (like pure photos without captions)
      return;
    }

    if (text.startsWith('/start')) {
      return bot.sendMessage(chatId, "Halo! Saya adalah Bot Asisten DompetKu Anda.\nSilakan ketik transaksi Anda, contoh:\n`Makan siang 25000`\n`Bensin 20000`\n\nKetik `help` untuk melihat panduan lengkap.", { parse_mode: 'Markdown' });
    }

    if (text.toLowerCase() === 'help' || text.toLowerCase() === '/help') {
      const helpMsg = `
📚 *PANDUAN PENGISIAN DOMPETKU*

Catat transaksi dengan mengetikkan nama barang/kegiatan beserta nominal angkanya. Bot akan otomatis mengkategorikannya!

*1. TRANSAKSI STANDAR*
Akan masuk ke dompet utama.
Contoh: \`Makan 25000\`

*2. MENENTUKAN DOMPET (PENTING)*
Tambahkan kata khusus agar saldo dipotong/ditambah dari dompet yang tepat:
- Ketik \`tunai\` untuk Dompet Tunai
- Ketik \`rekening\` untuk Rekening Utama
Contoh Pengeluaran: \`Bakso 20000 tunai\`
Contoh Pemasukan: \`Gaji 10000000 rekening\`

*3. KATA KUNCI KATEGORI OTOMATIS*
Bot mendeteksi kata-kata berikut:
- *Makanan*: makan, kopi
- *Transportasi*: bensin, grab, gojek
- *Pulsa*: pulsa, kuota
- *Belanja*: skincare, relx
- *Tagihan*: kuliah, cicilan
- *Pemasukan*: gaji, bonus, thr

Jika kata tidak cocok, otomatis masuk "Lain-lain" (bisa diubah nanti di aplikasi Desktop).
      `.trim();
      return bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
    }

    try {
      // Extract amount anywhere in the text
      const numMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
      if (!numMatch) {
        return bot.sendMessage(chatId, "❌ *Format tidak dikenali.*\nPastikan Anda memasukkan nominal angka.\nContoh: `Beli kopi 25000` atau `Makan 50000 bca`", { parse_mode: 'Markdown' });
      }

      const amount = parseFloat(numMatch[1]);
      let itemName = text.replace(numMatch[0], '').trim();

      const createdBy = msg.from.first_name || 'Telegram';
      const isMishel = createdBy === 'Mishel';

      // Find Wallet by keyword
      const allWallets = await dbQuery.all('SELECT * FROM wallets');
      
      // Filter wallets based on who sent the message
      const myWallets = allWallets.filter(w => {
        const wName = w.name.toLowerCase();
        if (isMishel) return wName.includes('mishel');
        return wName.includes('prakas');
      });

      // Default wallet fallback is the first of THEIR wallets
      let walletId = myWallets.length > 0 ? myWallets[0].id : null;
      let matchedWalletName = walletId ? myWallets[0].name : 'Default';
      
      for (const w of myWallets) {
        // e.g., 'Rekening Prakas' -> we can match 'rekening', 'utama', but it's better to check if user typed a specific word
        const wNameLower = w.name.toLowerCase();
        // Extract common keywords from wallet name (e.g. "Tunai" -> "tunai")
        if (itemName.toLowerCase().includes(wNameLower) || 
            (wNameLower.includes('bca') && itemName.toLowerCase().includes('bca')) ||
            (wNameLower.includes('tunai') && itemName.toLowerCase().includes('tunai')) ||
            (wNameLower.includes('rekening') && itemName.toLowerCase().includes('rekening')) ||
            (wNameLower.includes('mandiri') && itemName.toLowerCase().includes('mandiri')) ||
            (wNameLower.includes('bri') && itemName.toLowerCase().includes('bri')) ||
            (wNameLower.includes('bni') && itemName.toLowerCase().includes('bni'))) {
          
          walletId = w.id;
          matchedWalletName = w.name;
          
          // Remove wallet keyword from itemName so it doesn't pollute the note
          const wordsToRemove = wNameLower.split(' ').concat(['bca', 'tunai', 'mandiri', 'bri', 'bni', 'rekening', 'prakas', 'mishel']);
          let tempItemName = itemName;
          for(const word of wordsToRemove) {
             if(word.length > 2) {
                const regex = new RegExp(word, 'gi');
                tempItemName = tempItemName.replace(regex, '').trim();
             }
          }
          if (tempItemName.length > 0) {
            itemName = tempItemName;
          }
          break;
        }
      }

      // Auto-categorize based on keywords
      let categoryType = 'expense';
      let categoryId = null;

      const matchedCat = await matchCategory(itemName);
      if (matchedCat) {
        categoryId = matchedCat.id;
        categoryType = matchedCat.type; // can be 'income' or 'expense'
      }

      if (!walletId) {
         return bot.sendMessage(chatId, "⚠️ Anda belum memiliki dompet di database. Silakan buat dompet pertama di aplikasi Desktop.");
      }
      if (!categoryId) {
        // Fallback: If it contains 'gaji' or 'bonus', fallback to income
        if (itemName.toLowerCase().includes('gaji') || itemName.toLowerCase().includes('bonus')) {
          const cat = await dbQuery.get("SELECT id FROM categories WHERE type = 'income' LIMIT 1");
          categoryId = cat ? cat.id : null;
          categoryType = 'income';
        } else {
          const cat = await dbQuery.get("SELECT id FROM categories WHERE type = 'expense' LIMIT 1");
          categoryId = cat ? cat.id : null;
          categoryType = 'expense';
        }
      }

      // Record to SQLite
      const txId = Date.now().toString(); // simple ID generator
      const date = new Date().toISOString().split('T')[0];

      await dbQuery.run('BEGIN TRANSACTION');
      await dbQuery.run(
        'INSERT INTO transactions (id, date, type, amount, categoryId, walletId, note, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, date, categoryType, amount, categoryId, walletId, itemName, createdBy]
      );
      
      if (categoryType === 'income') {
        await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance + ? WHERE id = ?', [amount, walletId]);
      } else {
        await dbQuery.run('UPDATE wallets SET currentBalance = currentBalance - ? WHERE id = ?', [amount, walletId]);
      }
      
      await dbQuery.run('COMMIT');

      // Fetch category name for reply
      const catObj = await dbQuery.get('SELECT name, icon FROM categories WHERE id = ?', [categoryId]);
      const catName = catObj ? `${catObj.icon} ${catObj.name}` : 'Tidak Diketahui';

      const reply = `
=== 📝 TRANSAKSI DICATAT ===
👤 Oleh: ${createdBy}
📅 Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
🏷️ Kategori: ${catName}
🏦 Dompet: ${matchedWalletName}
🛒 Barang: ${itemName}
💰 Nominal: Rp ${amount.toLocaleString('id-ID')}
=========================
*Data otomatis disinkronisasikan ke Laptop & Google Drive.*
      `.trim();

      bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });

      // Trigger Google Sheets Sync Here
      const { syncTransactionToSheet } = require('./google');
      syncTransactionToSheet({
        id: txId,
        date: date,
        type: categoryType,
        amount: amount,
        categoryId: categoryId,
        walletId: walletId,
        note: itemName
      });

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, `Terjadi kesalahan saat mencatat transaksi: ${error.message}`);
    }
  });

} else {
  console.log('TELEGRAM_BOT_TOKEN is not defined in .env. Bot features are disabled.');
}

async function matchCategory(itemName) {
  const itemLower = itemName.toLowerCase();
  const categories = await dbQuery.all('SELECT * FROM categories'); // get all categories
  
  // 1. Direct match with category name
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    if (itemLower.includes(catLower)) {
      return cat;
    }
  }

  // 2. Common keywords mapping
  const keywordMap = {
    'makan': 'Makanan', 'kopi': 'Makanan', 'bensin': 'Transportasi', 
    'grab': 'Transportasi', 'gojek': 'Transportasi', 'pulsa': 'Pulsa', 'kuota': 'Pulsa',
    'skincare': 'Belanja', 'relx': 'Belanja', 'gaji': 'Gaji', 'bonus': 'Gaji', 'thr': 'Gaji',
    'kuliah': 'Tagihan', 'cicilan': 'Tagihan'
  };

  for (const [key, catName] of Object.entries(keywordMap)) {
    if (itemLower.includes(key)) {
      const match = categories.find(c => c.name.toLowerCase().includes(catName.toLowerCase()));
      if (match) return match;
    }
  }

  return null;
}

async function getDefaultWallet() {
  const wallet = await dbQuery.get('SELECT id FROM wallets ORDER BY createdAt ASC LIMIT 1');
  return wallet ? wallet.id : null;
}

module.exports = bot;
