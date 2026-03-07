/**
 * BACKEND LOGIC UNTUK SINKRONISASI PENGGUNA (CROSS-DEVICE SYNC)
 * Disimpan dalam file terpisah agar rapi dalam 1 projek.
 */

/**
 * Mendapatkan data sinkronisasi berdasarkan token dari Google Sheet UserSync.
 * @param {string} token Token unik (kata/kode)
 * @return {string|null} Data dalam format JSON string atau null jika tidak ditemukan
 */
function getUserSyncData(token) {
  if (!token) return null;
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_USER_SYNC);
  
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  // Loop mulai dari baris 2 (index 1) untuk mencari token
  for (let i = 1; i < values.length; i++) {
    // Case-insensitive comparison
    if (String(values[i][0]).toLowerCase() === String(token).toLowerCase()) {
      return values[i][1]; // return JSON string yang tersimpan di kolom B
    }
  }
  
  return null;
}

/**
 * Menyimpan atau memperbarui data sinkronisasi ke Google Sheet UserSync.
 * @param {string} token Token unik (kata/kode)
 * @param {string} dataJson Data yang akan disimpan dalam format JSON string
 * @return {boolean} Status keberhasilan
 */
function saveUserSyncData(token, dataJson) {
  if (!token || !dataJson) return false;
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_USER_SYNC);
  
  // Jika sheet belum ada, buat baru dengan header
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USER_SYNC);
    sheet.getRange(1, 1, 1, 3).setValues([['token', 'data', 'last_updated']]).setFontWeight('bold');
  }

  const values = sheet.getDataRange().getValues();
  const timestamp = new Date();
  let foundRow = -1;

  // Cari apakah token sudah ada
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(token).toLowerCase()) {
      foundRow = i + 1; // Baris di sheet adalah index + 1
      break;
    }
  }

  try {
    if (foundRow !== -1) {
      // Perbarui data yang sudah ada
      sheet.getRange(foundRow, 2, 1, 2).setValues([[dataJson, timestamp]]);
    } else {
      // Tambah baris baru jika token belum ada
      sheet.appendRow([token, dataJson, timestamp]);
    }
    return true;
  } catch (e) {
    Logger.log("Error saveUserSyncData: " + e.toString());
    return false;
  }
}
