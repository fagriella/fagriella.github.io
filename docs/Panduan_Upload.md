# Panduan Upload Arsip & Materi Kuliah

Sistem F.AGRIELLA mendukung **dua cara** untuk mengunggah materi, foto, dan tugas. Silakan pilih cara yang paling sesuai dengan kebutuhan dan ukuran file Anda.

---

## CARA 1: Melalui Form Upload Web (Rekomendasi)
Ini adalah cara termudah dan paling direkomendasikan untuk pemakaian sehari-hari. File akan otomatis disimpan ke **Google Drive** kelas dan didata ke sistem.

### 📝 Cara Upload
1. **Pilih Jenis Interaksi:**
   - **Materi Perkuliahan:** Untuk file PPT, PDF, Makalah, foto materi.
   - **Foto Dokumentasi:** Untuk foto kegiatan / kenangan(file akan otomatis dikompres agar web tetap ringan).
   - **Tugas Kuliah:** Untuk memberikan pengumuman tugas (akan mengirim notifikasi ke semua mahasiswa).
   - **Hapus Arsip:** Untuk menghapus file yang salah upload.
2. **Isi Detail Form:** Pilih Semester dan Mata Kuliah / Nama Album.
3. **Nama File / Link:** 
   - Anda bisa mengosongkan bagian ini untuk menggunakan nama file asli.
   - Anda juga bisa memasukkan **Link Google Drive / Link YouTube** ke kotak ini tanpa harus melampirkan file.
4. **Lampirkan File:** Seret file ke area putus-putus atau klik untuk memilih file (maksimal 50MB per file).
5. **Masukkan Token:** Masukkan token rahasia untuk konfirmasi keamanan.
6. Klik **Kirim Arsip**. 
   - *Data akan otomatis tersimpan ke Sheet dan Web akan langsung memperbarui tampilannya dalam hitungan detik.*

---

## CARA 2: Upload Langsung via GitHub (Alternatif)
Gunakan cara ini jika Anda ingin mengunggah foto yang ukurannya **sangat besar (di atas 100MB)** yang seringkali gagal jika diupload lewat web form, atau jika Anda ingin merapikan folder arsip secara manual beramai-ramai.

### 🔑 Syarat
Anda harus memiliki akun GitHub dan sudah diberikan akses kolaborator ke repository `fagriella/fagriella.github.io`.

### 📝 Cara Upload Materi
1. Buka halaman GitHub Repository: `https://github.com/fagriella/fagriella.github.io`
2. Buka folder `materi/`
3. Buka folder `Semester (N)/` (contoh: `Semester 1`)
4. Buka folder Mata Kuliah yang dituju (contoh: `Pengantar Agribisnis`)
   - *Jika belum ada, Anda bisa menekan tombol **Add file > Create new file**, ketik `Nama Matkul/placeholder.txt` lalu di-commit untuk membuat folder baru.*
5. Di dalam folder Matkul, klik **Add file > Upload files**.
6. Pilih file materi Anda, lalu klik **Commit changes**.

### 📸 Cara Upload Foto Dokumentasi
1. Buka folder `Images/arsipfoto/` di GitHub.
2. Buka atau buat folder dengan format nama Album (contoh: `Dokumentasi Makrab 2026`).
3. Klik **Add file > Upload files**, pilih foto Anda, dan **Commit changes**.

### 🔄 Sinkronisasi (PENTING!)
File yang diunggah langsung ke GitHub **tidak akan langsung muncul di halaman web**. File tersebut perlu didaftarkan dulu ke Google Sheets.
- Jangan khawatir, sistem akan melakukan scan otomatis ke folder GitHub **setiap 30 Menit** di belakang layar, lalu mendaftarkannya ke web.
- Jika Anda tidak ingin menunggu 30 menit, Anda bisa menghubungi admin/PJ pemegang akses **Google Apps Script** untuk menekan tombol *Run Manual* pada script `autosinkronmateri.gs`.

---

## ❓ Kapan harus pakai cara mana?

| Kriteria | Cara 1 (Web Form) | Cara 2 (GitHub) |
|---|---|---|
| **Kemudahan** | ⭐⭐⭐⭐⭐ Sangat Mudah | ⭐⭐⭐ Perlu paham GitHub |
| **Ukuran File** | Maks <= 50 MB / file | Maks <= 100 MB / file |
| **Penyimpanan** | Masuk ke Google Drive | Masuk ke server GitHub |
| **Kecepatan Tampil** | Instan (1-3 detik) | Menunggu jadwal sync (30 menit) |
| **Fitur** | Bisa sebar Info Tugas & Notifikasi | Hanya file biasa (Foto/Materi) |
| **Akses** | Hanya butuh Token PJ | Butuh Akun GitHub kolaborator |

*Gunakan **Cara 1** untuk 95% aktivitas perkuliahan normal. Gunakan **Cara 2** hanya saat menemui file video/materi raksasa.*
