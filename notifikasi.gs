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
 */
function logSubscription(status, info) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SUBSCRIBERS);
  
  // Buat sheet jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SUBSCRIBERS);
    sheet.appendRow(['Timestamp', 'Status', 'User Agent / Info']);
  }

  sheet.appendRow([new Date(), status ? 'ON' : 'OFF', info]);
}

/**
 * Fungsi Inti (Legacy Cleanup): Sekarang tidak lagi menembak OneSignal
 */
function scheduleDeadlineNotification(course, taskDetail, deadlineStr) {
  Logger.log("Sistem DIY: Melewati OneSignal. Notifikasi akan diambil via Polling oleh Browser.");
  return "Sistem beralih ke DIY Polling.";
}

/**
 * FUNGSI UTAMA: Cek Tugas yang DL-nya BESOK, Kirim Pengingat HARI INI
 * Jalankan setiap hari via Trigger (jam 7 pagi)
 */
function checkAndSendReminders() {
  const SPREADSHEET_ID = '1DXD3WmzwiOV9spBz0gAaK2l9Tmr4zYsyJ9-fY1RVL78';
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Assignments');
  if (!sheet) { Logger.log("Sheet 'Assignments' tidak ditemukan!"); return; }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) { Logger.log("Tidak ada data tugas."); return; }

  // Header: [Date, Course, Lecturer, Description, Deadline, Note, Format, Link]
  // Index:   0      1       2         3            4         5     6       7
  const headers = data[0];
  const deadlineCol = headers.findIndex(h => String(h).toLowerCase().includes('deadline'));
  const courseCol = headers.findIndex(h => String(h).toLowerCase().includes('course'));
  const descCol = headers.findIndex(h => String(h).toLowerCase().includes('description') || String(h).toLowerCase().includes('deskripsi'));

  if (deadlineCol === -1 || courseCol === -1) {
    Logger.log("Kolom 'Deadline' atau 'Course' tidak ditemukan. Headers: " + headers.join(", "));
    return;
  }

  // "Besok" dari perspektif hari ini
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  let sentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const deadlineRaw = row[deadlineCol];
    if (!deadlineRaw) continue;

    // Parse deadline (bisa Date object dari Sheets, atau string "DD-MM-YYYY HH:MM")
    let dlDate;
    if (deadlineRaw instanceof Date) {
      dlDate = deadlineRaw;
    } else {
      dlDate = parseDeadlineStr(String(deadlineRaw));
    }
    if (!dlDate || isNaN(dlDate.getTime())) continue;

    // Cek apakah deadline-nya BESOK (tanggal sama)
    if (dlDate.getFullYear() === tomorrow.getFullYear() &&
        dlDate.getMonth() === tomorrow.getMonth() &&
        dlDate.getDate() === tomorrow.getDate()) {

      const course = row[courseCol] || "Mata Kuliah";
      const desc = descCol !== -1 ? (row[descCol] || "Ada tugas!") : "Ada tugas!";

      Logger.log("Kirim pengingat: " + course + " - " + desc + " (DL: " + deadlineRaw + ")");

      try {
        scheduleDeadlineNotification(course, desc, dlDate.toISOString());
        sentCount++;
      } catch (e) {
        Logger.log("Gagal kirim untuk " + course + ": " + e.message);
      }
    }
  }

  Logger.log("Selesai. Total pengingat terkirim: " + sentCount);
}

/**
 * Helper: Parse string deadline "DD-MM-YYYY HH:MM" atau "DD/MM/YYYY"
 */
function parseDeadlineStr(str) {
  if (!str) return null;
  const [dateStr, timeStr] = str.trim().split(/\s+/);
  const cleanD = dateStr.replace(/\//g, '-');
  const parts = cleanD.split('-');
  if (parts.length !== 3) return null;

  let [p1, p2, p3] = parts.map(n => parseInt(n, 10));
  if (isNaN(p1) || isNaN(p2) || isNaN(p3)) return null;

  let dateObj;
  if (p1 > 31) { // YYYY-MM-DD
    dateObj = new Date(p1, p2 - 1, p3);
  } else { // DD-MM-YYYY
    let year = p3;
    if (year < 100) year += 2000;
    dateObj = new Date(year, p2 - 1, p1);
  }

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
  // Hapus trigger lama (jika ada) agar tidak ganda
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'checkAndSendReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Pasang trigger baru: setiap hari jam 7-8 pagi WIB
  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(0)
    .inTimezone('Asia/Jakarta')
    .create();

  Logger.log("Trigger harian 'checkAndSendReminders' terpasang (07:00 WIB)");
}

/**
 * FUNGSI TESTING (Bisa diklik "Jalankan" langsung dari editor)
 */
function testNotification() {
  // Test langsung kirim pengingat untuk tugas fiktif yang DL-nya besok
  const tgs1 = new Date();
  tgs1.setDate(tgs1.getDate() + 1);
  tgs1.setHours(14, 0, 0, 0);

  scheduleDeadlineNotification("MK Simulasi", "Tugas Praktek Jarkom", tgs1.toISOString());
}
