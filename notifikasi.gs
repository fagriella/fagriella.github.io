// ================== KONFIGURASI ONESIGNAL ==================
const ONESIGNAL_APP_ID = "7b989f90-3334-4827-a3cd-b9738e971ab3"; 
const ONESIGNAL_REST_API_KEY = "os_v2_app_pomj7ebtgrecpi6nxfzy5fy2wmsi4mp2k6duwcn22rvyyrgbreqc55t4yctweceezr4kjfc5ejewxp3tx43bfmjratdisadeclbzhvy";

/**
 * Webhook Entry/Endpoint:
 * Gunakan fungsi ini jika notifikasi akan dipicu oleh request/URL luar (HTTP POST)
 * Misalnya mengirimkan JSON { "course": "Matematika", "description": "Tugas 1", "deadline": "2024-01-20 14:00" }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Pastikan data yang dibutuhkan tersedia
    if (data.course && data.deadline) {
      const hasil = scheduleDeadlineNotification(data.course, data.description || "Ada tugas baru!", data.deadline);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: hasil }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Data M.K atau Deadline kosong.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi Inti untuk Menjadwalkan Notifikasi (Mendukung pemicu dari dalam Spreadsheet/Bot)
 * 
 * @param {string} course - Nama Mata Kuliah
 * @param {string} taskDetail - Detail Text/Deskripsi Tugas
 * @param {string} deadlineStr - String Deadline waktu: "2024-11-20 14:00" (Y-M-D H:M)
 */
function scheduleDeadlineNotification(course, taskDetail, deadlineStr) {
  const dlDate = new Date(deadlineStr);
  
  // Validasi parsing
  if (isNaN(dlDate.getTime())) {
    throw new Error("Format tanggal deadline tidak sah: " + deadlineStr);
  }

  const dlHour = dlDate.getHours();
  
  // Secara Default, atur waktu pengingat menjadi Jam 7 Pagi di Hari Deadline tersebut.
  let reminderDate = new Date(dlDate.getTime());
  reminderDate.setHours(7, 0, 0, 0);

  // LOGIKA PENGINGAT SESUAI Aturan:
  // - KETIKA DL >= 13:00 s.d 23:59 ---> Ingatkan jam 7 Pagi pada HARI H (Tidak diubah)
  // - KETIKA DL <= 12:59 (00:00 s.d 12:59) ---> Ingatkan jam 7 Pagi pada HARI SEBELUMNYA (H-1)
  if (dlHour < 13) {
    reminderDate.setDate(reminderDate.getDate() - 1);
  }
  
  const now = new Date();
  let sendAfterStr = "";
  
  // Jika waktu pengingat (Jam 7 pagi) MASIH DI MASA DEPAN, Format untuk dijadwalkan OneSignal
  if (reminderDate > now) {
      // Format send_after wajib sesuai dokumentasi OneSignal: "YYYY-MM-DD HH:MM:00 GMT-0700"
      // Kita paksakan konversi output ke zona waktu server/WIB (Asia/Jakarta) => "+0700"
      sendAfterStr = Utilities.formatDate(reminderDate, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss Z").replace("+0700", "GMT+0700");
  } 
  // Info: Jika reminderDate justru < now (Misal tugas dadakan yang diupload jam 9 pagi untuk jam 12 siang ini),
  // sendAfterStr dibiarkan KOSONG, yang artinya notifikasi akan langsung DITEMBAK SEKARANG JUGA.

  // Merakit Beban Pesan (Payload) API OneSignal
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["Subscribed Users"], // Anda bisa mengatur label segmen "Semua Orang" 
    headings: {
      "en": "🔔 Pengingat Tugas: " + course
    },
    contents: {
      "en": "Ada tugas pending: " + taskDetail + "\n⏳ Deadline: " + Utilities.formatDate(dlDate, "Asia/Jakarta", "dd MMM yyyy HH:mm") + " WIB"
    }
  };

  // Tambahkan Penjadwalan jika ada
  if (sendAfterStr) {
    payload.send_after = sendAfterStr;
  }

  // Permintaan HTTP ke OneSignal REST API
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "key " + ONESIGNAL_REST_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch("https://api.onesignal.com/notifications", options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  Logger.log("Notifikasi Response (" + responseCode + "): " + responseText);
  
  if (responseCode !== 200 && responseCode !== 201) {
    throw new Error("OneSignal Error (" + responseCode + "): " + responseText);
  }
  
  return "Scheduled for " + (sendAfterStr || "Immediately (Langsung Keluar)");
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

      Logger.log("📌 Kirim pengingat: " + course + " - " + desc + " (DL: " + deadlineRaw + ")");

      try {
        scheduleDeadlineNotification(course, desc, dlDate.toISOString());
        sentCount++;
      } catch (e) {
        Logger.log("❌ Gagal kirim untuk " + course + ": " + e.message);
      }
    }
  }

  Logger.log("✅ Selesai. Total pengingat terkirim: " + sentCount);
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

  Logger.log("✅ Trigger harian 'checkAndSendReminders' terpasang (07:00 WIB)");
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
