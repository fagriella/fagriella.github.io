/**
 * DIY Notifikasi Logic
 * (doGet sekarang dikelola secara terpusat di autosinkronmateri.gs)
 */

/**
 * Webhook Entry (POST): Tetap dipertahankan jika ada bot lain yang memicu notifikasi
 */
function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'DIY Notifikasi tidak memerlukan POST lagi' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fungsi baru untuk mengambil tugas terbaru dari Sheet
 */
function getLatestTask() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ASSIGNMENTS);
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Header: [Date, Course, Lecturer, Description, Deadline, Note, Format, Link]
  const data = sheet.getRange(lastRow, 1, 1, 8).getValues()[0];
  
  return {
    id: lastRow, // Gunakan nomor baris sebagai ID sederhana
    date: data[0],
    course: data[1],
    lecturer: data[2],
    description: data[3],
    deadline: data[4],
    note: data[5],
    link: data[7]
  };
}

/**
 * Mencatat log subscriber ke tab baru
 * Ditambah kolom Push Subscription untuk background notification
 */
function logSubscription(status, info, pushSubscription) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SUBSCRIBERS);
  
  // Buat sheet jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SUBSCRIBERS);
    sheet.appendRow(['Timestamp', 'Status', 'User Agent / Info', 'Push Subscription']);
  }

  // Cari baris user ini jika sudah ada (berdasarkan Info browser) untuk update saja
  // (Sederhana: Kita append saja atau update baris terakhir jika sama)
  sheet.appendRow([new Date(), status ? 'ON' : 'OFF', info, pushSubscription || '']);
}

/**
 * FUNGSI INTI: Mengirim sinyal Push Native ke HP/Browser (Background)
 * Menggunakan FCM (Firebase Cloud Messaging) Legacy API
 */
function broadcastPush(title, body, targetUrl) {
  if (!FCM_SERVER_KEY || FCM_SERVER_KEY.includes('PASTE')) {
    Logger.log("FCM_SERVER_KEY belum diisi. Lewati broadcast push.");
    return;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUBSCRIBERS);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  // Header: Timestamp, Status, Info, Push Subscription
  const pushCol = 3; 
  const statusCol = 1;

  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[statusCol] !== 'ON') continue;

    const subJson = row[pushCol];
    if (!subJson) continue;

    try {
      const sub = JSON.parse(subJson);
      // Ekstrak token dari endpoint (untuk Chrome/FCM) atau gunakan endpoint langsung
      // FCM Legacy butuh token saja
      const endpointParts = sub.endpoint.split('/');
      const token = endpointParts[endpointParts.length - 1];

      const payload = {
        "to": token,
        "data": {
          "title": title,
          "body": body,
          "url": targetUrl || "https://fagriella.github.io/"
        },
        "notification": {
          "title": title,
          "body": body,
          "icon": "https://fagriella.github.io/images/logo/icon-192.png",
          "click_action": targetUrl || "https://fagriella.github.io/"
        }
      };

      const options = {
        "method": "post",
        "contentType": "application/json",
        "headers": {
          "Authorization": "key=" + FCM_SERVER_KEY
        },
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      };

      const response = UrlFetchApp.fetch("https://fcm.googleapis.com/fcm/send", options);
      const resData = JSON.parse(response.getContentText());
      
      if (resData.success) successCount++;
      else failCount++;

    } catch (e) {
      Logger.log("Gagal push ke baris " + (i+1) + ": " + e.message);
      failCount++;
    }
  }

  Logger.log(`Broadcast selesai. Berhasil: ${successCount}, Gagal: ${failCount}`);
}

/**
 * Fungsi Inti: Sekarang memicu Broadcast Push saat ada trigger
 */
function scheduleDeadlineNotification(course, taskDetail, deadlineStr) {
  const title = "Deadline Besok!";
  const body = `${course}: ${taskDetail}`;
  const url = "https://fagriella.github.io/#tugas";
  
  broadcastPush(title, body, url);
  return "Broadcast Push Terkirim.";
}

/**
 * FUNGSI UTAMA: Cek Tugas yang DL-nya BESOK, Kirim Pengingat HARI INI
 * Jalankan setiap hari via Trigger (jam 7 pagi)
 */
function checkAndSendReminders() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_ASSIGNMENTS);
  if (!sheet) { Logger.log("Sheet '" + SHEET_ASSIGNMENTS + "' tidak ditemukan!"); return; }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) { Logger.log("Tidak ada data tugas."); return; }

  const headers = data[0];
  const deadlineCol = headers.findIndex(h => String(h).toLowerCase().includes('deadline'));
  const courseCol = headers.findIndex(h => String(h).toLowerCase().includes('course'));
  const descCol = headers.findIndex(h => String(h).toLowerCase().includes('description') || String(h).toLowerCase().includes('deskripsi'));

  if (deadlineCol === -1 || courseCol === -1) {
    Logger.log("Kolom 'Deadline' atau 'Course' tidak ditemukan.");
    return;
  }

  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let sentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const deadlineRaw = row[deadlineCol];
    if (!deadlineRaw) continue;

    let dlDate = (deadlineRaw instanceof Date) ? deadlineRaw : parseDeadlineStr(String(deadlineRaw));
    if (!dlDate || isNaN(dlDate.getTime())) continue;

    if (dlDate.getFullYear() === tomorrow.getFullYear() &&
        dlDate.getMonth() === tomorrow.getMonth() &&
        dlDate.getDate() === tomorrow.getDate()) {

      const course = row[courseCol] || "Mata Kuliah";
      const desc = descCol !== -1 ? (row[descCol] || "Ada tugas!") : "Ada tugas!";
      
      scheduleDeadlineNotification(course, desc, dlDate.toISOString());
      sentCount++;
    }
  }
  Logger.log("Selesai. Total pengingat terkirim: " + sentCount);
}

/**
 * Memancarkan notifikasi untuk tugas paling baru (dipanggil saat tambah data baru)
 */
function broadcastNewTask(course, description) {
  broadcastPush("Tugas Baru!", `${course}: ${description}`, "https://fagriella.github.io/#tugas");
}

/**
 * Helper: Parse string deadline "DD-MM-YYYY HH:MM"
 */
function parseDeadlineStr(str) {
  if (!str) return null;
  const [dateStr, timeStr] = str.trim().split(/\s+/);
  const parts = dateStr.replace(/\//g, '-').split('-');
  if (parts.length !== 3) return null;

  let [p1, p2, p3] = parts.map(n => parseInt(n, 10));
  let year = p3 < 100 ? p3 + 2000 : p3;
  let dateObj = new Date(year, p2 - 1, p1);

  if (timeStr) {
    const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
    if (!isNaN(h)) dateObj.setHours(h);
    if (!isNaN(m)) dateObj.setMinutes(m);
  } else {
    dateObj.setHours(23, 59, 0);
  }
  return dateObj;
}

/**
 * Jalankan SEKALI untuk memasang trigger harian jam 7 pagi
 */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'checkAndSendReminders') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased().everyDays(1).atHour(7).nearMinute(0).inTimezone('Asia/Jakarta').create();
  Logger.log("Trigger harian terpasang (07:00 WIB)");
}

/**
 * FUNGSI TESTING
 */
function testPushNotification() {
  broadcastPush("Test Notifikasi DIY", "Muncul kan? Meskipun browser ditutup!", "https://fagriella.github.io/");
}
