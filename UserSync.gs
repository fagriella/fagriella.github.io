/**
 * BACKEND LOGIC UNTUK SINKRONISASI PENGGUNA (CROSS-DEVICE SYNC)
 * Disimpan dalam file terpisah agar rapi dalam 1 projek.
 */

/**
 * Mendapatkan data sinkronisasi berdasarkan token dari Google Sheet UserSync.
 */
function getUserSyncData(token) {
  if (!token) return null;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_USER_SYNC);
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(token).toLowerCase()) {
      return values[i][1]; 
    }
  }
  return null;
}

/**
 * Menyimpan atau memperbarui data sinkronisasi ke Google Sheet UserSync.
 */
function saveUserSyncData(token, dataJson) {
  if (!token || !dataJson) return false;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_USER_SYNC);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USER_SYNC);
    sheet.getRange(1, 1, 1, 3).setValues([['token', 'data', 'last_updated']]).setFontWeight('bold');
  }

  const values = sheet.getDataRange().getValues();
  const timestamp = new Date();
  let foundRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(token).toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }

  try {
    if (foundRow !== -1) {
      sheet.getRange(foundRow, 2, 1, 2).setValues([[dataJson, timestamp]]);
    } else {
      sheet.appendRow([token, dataJson, timestamp]);
    }
    return true;
  } catch (e) {
    return false;
  }
}
