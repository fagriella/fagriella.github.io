// ================== KONFIGURASI ONESIGNAL ==================
const ONESIGNAL_APP_ID = "7b989f90-3334-4827-a3cd-b9738e971ab3"; 
const ONESIGNAL_REST_API_KEY = "os_v2_app_pomj7ebtgrecpi6nxfzy5fy2wmdgamp7srbexk4lixvfzcwakwhgpuoszdlpixxco5uxqcljaaynn2iz4jamlnfpaibjynckwz5ybti";

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
      "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch("https://onesignal.com/api/v1/notifications", options);
  Logger.log("Notifikasi Terjadwal: " + response.getContentText());
  
  return "Scheduled for " + (sendAfterStr || "Immediately (Lagsung Keluar)");
}

/**
 * FUNGSI TESTING (Bisa diklik "Jalankan" langsung dari editor)
 */
function testNotification() {
  // Misal DL Besok Siang jam 14:00 (Harusnya pengingat dikirim BESOK jam 07:00 Pagi)
  const tgs1 = new Date();
  tgs1.setDate(tgs1.getDate() + 1);
  tgs1.setHours(14, 0, 0, 0); 
  
  scheduleDeadlineNotification("MK Simulasi", "Tugas Praktek Jarkom", tgs1.toISOString());
}
