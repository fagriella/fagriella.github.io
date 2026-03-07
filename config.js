/**
 * F.AGRIELLA - FRONTEND CONFIGURATION
 * 
 * Semua URL Google Sheets, Google Apps Script, dan ntfy.sh
 * dipusatkan di sini agar script.js lebih bersih.
 */

// 1. Google Sheets CSV Endpoints (File > Share > Publish to Web > CSV)
const COURSES_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=188724190&single=true&output=csv';
const MATERIALS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=1308771559&single=true&output=csv';
const ASSIGNMENTS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=1992582246&single=true&output=csv';
const ARSIP_FOTO_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=474587746&single=true&output=csv';
const MAHASISWA_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=1814680259&single=true&output=csv';
const INFO_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAg3iZc-gW93aYLpM8qqdDXtIL4vg4wdWykWo62bdRFuUzRWEMbmxnzOQXqVKCjPhUTyMCyrSRDDy/pub?gid=1266085536&single=true&output=csv';

// 2. Google Apps Script Web App URL (Utama)
// Gunakan link Web App yang sudah dideploy dari autosinkronmateri.gs (Satu Projek)
const SYNC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhZkLgXDqLVi80_NY7cbIx8UwZVBONgvwBnJIik4EqHfThHq2iU0EuPGzlBxa-OQpd/exec';

// 3. IFrame Upload URL (Biasanya sama dengan SYNC_SCRIPT_URL jika satu projek)
const UPLOAD_IFRAME_URL = 'https://script.google.com/macros/s/AKfycbzhZkLgXDqLVi80_NY7cbIx8UwZVBONgvwBnJIik4EqHfThHq2iU0EuPGzlBxa-OQpd/exec';

// 5. Ntfy.sh Configuration (Topic 'fagriella')
const NTFY_TOPIC = 'fagriella';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;
const NTFY_GATEWAY_URL = 'https://ntfy.sh/v1/webpush';
const NTFY_VAPID_PUBLIC_KEY = 'BEMjM0sNxh41x0a6Lz3YaqkJ7AUhZefxsOQgw-at69i0fM1CybVBcj7-QQXf4N_tPCgFnOXdRbQ5jrSrr9Yg9Lc';
