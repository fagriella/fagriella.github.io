// ==========================================
// KONFIGURASI GLOBAL - ARSIP KULIAH
// ==========================================

// 1. ID Google Sheet & Folder
const SPREADSHEET_ID = '1DXD3WmzwiOV9spBz0gAaK2l9Tmr4zYsyJ9-fY1RVL78';
const FOLDER_ID = '1lHDnCFVFPZJtXEFa7fLa_jNLj76AnPyg'; 

// 2. Nama-nama Tab Sheet
const SHEET_NAME = 'Materials';      // Data materi sinkronisasi
const SHEET_ASSIGNMENTS = 'Assignments'; // Data tugas/deadline
const SHEET_SUBSCRIBERS = 'Subscribers'; // Log pendaftaran notifikasi
const GITHUB_ARSIPFOTO_SHEET = 'ArsipFoto';

// 3. Konfigurasi GitHub
const GITHUB_OWNER = 'fagriella';
const GITHUB_REPO  = 'fagriella.github.io';
const GITHUB_BRANCH = 'main';

// 4. Konfigurasi Web Push (VAPID)
const VAPID_PUBLIC_KEY = 'BKF4yAYG3ppTj1CEMns_VS20AekWkpZds9Tqjgs3oM5DOSTH0waPtEZUs9Y8sDI_nx-aidZdJQNq6dRkJISUUiE';
const VAPID_PRIVATE_KEY = 'YoVeqlnIJhtTM3cWrzrq3M_RBwFhLXmdtz9VXLQhfDw';
const VAPID_SUBJECT = 'mailto:fagriella@gmail.com';

// 5. Konfigurasi FCM (Firebase Cloud Messaging) - Engine Notifikasi Chrome/Android
// Ambil Legacy Server Key dari: Firebase Console > Project Settings > Cloud Messaging
const FCM_SERVER_KEY = 'PASTE_YOUR_FCM_SERVER_KEY_HERE';
