# Panduan Upload Arsip & Materi Kuliah

Sistem F.AGRIELLA dirancang untuk memudahkan PJ Mata Kuliah dalam mendistribusikan arsip kuliah secara efisien. Terdapat **tiga cara** utama untuk mengunggah data: melalui **Formulir Web**, **Manual Google Drive**, dan **Manual GitHub**.

---

## CARA 1: Melalui Formulir Web (Rekomendasi)
Ini adalah metode utama yang paling sering digunakan. File akan disimpan secara aman di **Google Drive** kelas dan data akan langsung muncul di website.

### Prosedur Unggah
1. **Pilih Jenis Interaksi:**
   - **Materi Perkuliahan:** Untuk file PDF, PPT, Word, atau Gambar Materi.
   - **Foto Dokumentasi:** Untuk foto papan tulis atau kegiatan (Sistem akan mengompres file agar web tetap ringan).
   - **Tugas Kuliah:** Memberikan pengumuman tugas. **Otomatis mengirimkan Push Notification ke seluruh mahasiswa!**
   - **Hapus Arsip:** Untuk menghapus catatan yang salah upload.
2. **Pilih Semester & Mata Kuliah/Album:** Pilih sesuai tujuan arsip Anda.
3. **Nama File atau Link (Opsional):** 
   - Anda bisa mengosongkan ini untuk menggunakan nama file asli.
   - **Tips:** Anda bisa memasukkan **Link Google Drive / YouTube** di kolom ini tanpa harus mengunggah file fisik.
4. **Lampirkan File:** Seret file ke area upload (Maksimal 50MB per file).
5. **Konfirmasi Token:** Masukkan kembali token Anda sebagai langkah keamanan terakhir.
6. Klik **"Kirim Arsip"**. Data akan langsung terupdate di web dalam hitungan detik.

---

## CARA 2: Unggah Manual ke Google Drive (Khusus Materi)
Gunakan metode ini jika Anda ingin mengunggah banyak file materi sekaligus (bulk upload) tanpa melalui formulir web.

### Syarat
Anda harus memiliki akses editor ke folder Google Drive utama **"Arsip Kuliah"**. Hubungi Admin untuk mendapatkan akses.

### Struktur Folder di Google Drive
Pastikan Anda menaruh file di dalam folder tersebut dengan struktur berikut agar terdeteksi:
- **`Semester X / Nama Mata Kuliah /`**
- Contoh: `Semester 1 / Pengantar Agribisnis / Modul_1.pdf`

---

## CARA 3: Unggah Manual ke GitHub (Alternatif & Foto)
Gunakan metode ini jika Anda perlu mengunggah **Foto Dokumentasi** 

### Syarat
Anda harus memiliki akun GitHub yang sudah diberikan akses kolaborator ke repository `fagriella/fagriella.github.io`.

### Struktur Folder di GitHub
Pastikan Anda menaruh file di folder yang tepat:

**1. Untuk Foto Dokumentasi:**
Lokasi: `arsipfoto / Nama Album /`
- Contoh: `arsipfoto/Dokumentasi Makrab 2026/foto1.jpg`

---

### Sinkronisasi Otomatis (Cara 2 & 3)
File yang diunggah secara manual ke Google Drive atau GitHub **tidak akan langsung muncul** saat itu juga.
- **Jadwal Sync:** Sistem melakukan pemindaian otomatis setiap **30 Menit** di belakang layar.
- **Sync Manual:** Jika ingin file langsung muncul, buka Google Spreadsheet database, klik menu **"Arsip Kuliah Sync" > "Sinkronisasi Ulang Materi"** di barisan menu atas.

---

## Perbandingan Metode

| Fitur | Cara 1 (Form Web) | Cara 2 (Manual GDrive) | Cara 3 (Manual GitHub) |
|---|---|---|---|
| **Kemudahan** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Batas Ukuran** | Maks 50MB | Kuota Drive | Maks 100MB (GitHub) |
| **Jenis File** | Materi, Foto, Tugas | Khusus Materi | Materi & Foto |
| **Kecepatan** | Langsung (1-3 dtk) | Tunggu Sync (30 mnt) | Tunggu Sync (30 mnt) |

---

## Troubleshooting (Penyelesaian Masalah)
1. **Token Salah:** Pastikan nama/token PJ yang Anda ketik di Form (Cara 1) sudah sesuai.
2. **File Tidak Muncul:** Periksa apakah nama folder Semester dan Mata Kuliah sudah sesuai format (Cara 2 & 3). Tunggu jadwal sinkronisasi atau lakukan Sinkronisasi Manual.
3. **Error "File too large":** Gunakan Google Drive biasa lalu salin link-nya ke formulir tipe "Materi", atau gunakan Cara 3 (GitHub).
