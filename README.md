# Panduan Integrasi Google Sheets - Arsip Kuliah

Website ini menggunakan **Google Sheets** sebagai database sederhana. Data diambil secara *real-time* menggunakan format CSV yang dipublikasikan ke web.

## 1. Persiapan Google Sheet

Buatlah sebuah Google Spreadsheet baru, lalu buat **3 Tab (Sheet)** dengan struktur kolom sebagai berikut. Pastikan baris pertama adalah **Header** (judul kolom) dan tulisannya persis (huruf kecil semua).

### Tab 1: `Courses` (Daftar Mata Kuliah)
Digunakan untuk menampilkan kartu mata kuliah di halaman utama.

| Kolom | Deskripsi | Contoh Isi |
| :--- | :--- | :--- |
| `name` | Nama Mata Kuliah | `Pemrograman Web` |
| `dosen` | Nama Dosen (Bisa multi-baris) | `Budi Santoso, M.Kom` |
| `semester` | Semester (Angka) | `2` |
| `pic` | Penanggung Jawab (Opsional, pisahkan koma) | `Yuna, Suci` |

### Tab 2: `Materials` (Arsip Materi/Foto)
Digunakan untuk mengisi konten di dalam modal saat mata kuliah diklik.

| Kolom | Deskripsi | Contoh Isi |
| :--- | :--- | :--- |
| `course` | Nama Mata Kuliah (Harus sama persis dengan Tab 1) | `Pemrograman Web` |
| `filename` | Judul Materi | `Modul 1 - HTML Dasar` |
| `date` | Tanggal Upload (DD-MM-YYYY) | `20-02-2026` |
| `type` | Tipe File (`pdf`, `doc`, `ppt`, `image`) | `pdf` |
| `size` | Ukuran File (Opsional) | `2MB` |
| `link` | Link Download/View (Google Drive/Direct Link) | `https://drive.google.com/...` |

### Tab 3: `Assignments` (Daftar Tugas)
Digunakan untuk menampilkan widget "Tugas Terbaru" dan detail tugas harian.

| Kolom | Deskripsi | Contoh Isi |
| :--- | :--- | :--- |
| `date` | Tanggal Tugas Dibuat (DD-MM-YYYY) | `25-02-2026` |
| `course` | Nama Mata Kuliah | `Pemrograman Web` |
| `lecturer` | Nama Dosen Pemberi Tugas | `Budi Santoso` |
| `description` | Deskripsi Tugas | `Buat halaman profil sederhana` |
| `deadline` | Tenggat Waktu (DD-MM-YYYY) | `02-03-2026` |
| `note` | Catatan Tambahan (Opsional) | `Dikumpulkan di e-learning` |

---
