# Firebase + Cloudflare R2 setup

Login dan data profil/project/sertifikat tetap memakai Firebase Authentication dan Firestore. File baru disimpan di bucket Cloudflare R2 privat. Vercel menjalankan `/api/files` untuk memeriksa token Firebase dan menerbitkan izin upload/download sementara. Tidak perlu Cloudflare Worker atau Supabase.

Integrasi kode saja belum mengaktifkan R2. Selesaikan konfigurasi berikut sebelum mengubah `VITE_R2_ENABLE_UPLOADS=true`. Firebase Storage/Blaze tidak diperlukan untuk file baru di R2; akses file Firebase lama masih memerlukan layanan Firebase Storage yang aktif.

## 1. Buat bucket R2

1. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/), buka **Storage & databases → R2 → Overview**.
2. Jika belum aktif, selesaikan aktivasi/subscription R2. Cloudflare menyediakan kuota bulanan gratis, tetapi penggunaan di luar kuota dapat ditagihkan. Periksa ketentuan yang ditampilkan sebelum aktivasi.
3. Buat bucket bernama, misalnya, `cybersec-portfolio-files`, dengan storage class **Standard**. Jika bucket menggunakan jurisdiction **European Union**, set `R2_JURISDICTION=eu` di Vercel. Bucket yang terlihat pada URL `/r2/eu/buckets/` memakai jurisdiction EU. Untuk bucket tanpa jurisdiction khusus, gunakan `default`. Tidak perlu membuat ulang bucket EU.
4. Biarkan **Public Development URL (r2.dev)** dinonaktifkan dan jangan pasang public custom domain pada bucket. File draft harus tetap privat.
5. Catat **Account ID** dan nama bucket.

Rujukan: [Mulai menggunakan R2](https://developers.cloudflare.com/r2/get-started/).

## 2. Buat kredensial R2

Di halaman R2, buka **Manage R2 API tokens** dan buat token dengan izin **Object Read & Write**, dibatasi hanya ke bucket tadi. Simpan **Access Key ID** dan **Secret Access Key** di pengaturan server Vercel. Secret hanya ditampilkan saat pembuatan. Token API umum Cloudflare bukan pengganti pasangan kredensial S3 ini.

Rujukan: [R2 API credentials](https://developers.cloudflare.com/r2/api/tokens/).

## 3. Atur CORS bucket

Buka bucket → **Settings → CORS policy**, lalu gunakan isi `r2.cors.json`. Sesuaikan `AllowedOrigins` dengan domain produksi sebenarnya. Domain yang sudah tercantum adalah `https://portofolio-theta-ten-80.vercel.app` dan origin pengembangan lokal. Tambahkan setiap URL preview yang ingin dipakai; jangan memakai wildcard untuk semua origin.

File diunggah langsung dari browser ke R2. CORS diperlukan untuk PUT dan GET, termasuk header Content-Type, Cache-Control, dan Content-Disposition. CORS bukan pengganti izin akses: bucket tetap privat dan setiap operasi memerlukan URL bertanda tangan.

Rujukan: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## 4. Siapkan identitas server Firebase

Buka **Firebase Console → Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. File JSON berisi `project_id`, `client_email`, dan `private_key`. Gunakan identitas dari project Firebase yang sama dengan frontend. Akun layanan harus dapat membaca Firestore dan pengguna Firebase Authentication; migrasi juga memerlukan akses baca bucket Firebase asal.

Jangan commit JSON tersebut, memasukkannya ke `src`/`public`, atau mengirimkannya lewat chat. Masukkan nilai langsung ke Environment Variables Vercel. Untuk lokal, simpan hanya di `.env.local` yang diabaikan Git. `FIREBASE_PRIVATE_KEY` menerima newline asli atau pemisah literal `\n`.

Rujukan: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

## 5. Konfigurasi Vercel dan deploy

Di project Vercel → **Settings → Environment Variables**, pertahankan konfigurasi `VITE_FIREBASE_*` yang sudah ada, lalu tambahkan:

| Variabel | Nilai |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` dari JSON Firebase; sama dengan `VITE_FIREBASE_PROJECT_ID` |
| `FIREBASE_ADMIN_UID` | UID admin yang sama dengan `VITE_FIREBASE_ADMIN_UID` dan `firestore.rules` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` dari JSON Firebase |
| `FIREBASE_PRIVATE_KEY` | `private_key` dari JSON Firebase |
| `R2_ACCOUNT_ID` | Account ID Cloudflare, 32 karakter hex |
| `R2_BUCKET_NAME` | Nama bucket, misalnya `cybersec-portfolio-files` |
| `R2_JURISDICTION` | `eu` untuk bucket EU milikmu; `default` untuk bucket tanpa jurisdiction khusus |
| `R2_ACCESS_KEY_ID` | Access Key ID token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key token R2 |
| `VITE_R2_ENABLE_UPLOADS` | `true` setelah semua konfigurasi selesai |

Variabel server tidak boleh diberi awalan `VITE_`: Vite mengekspos variabel berawalan tersebut ke browser. `VITE_FIREBASE_ENABLE_STORAGE` lama tidak dipakai lagi. Bucket Firebase lama (`VITE_FIREBASE_STORAGE_BUCKET`) hanya diperlukan jika ada file lama; default-nya adalah `PROJECT_ID.firebasestorage.app`.

Deploy versi kode ini dan pilih Node.js 24.x (atau 22.12+). `api/files.js` harus tersedia sebagai Vercel Function; perubahan routing sudah mengecualikan `/api/` dari fallback HTML. File binernya langsung ke R2, sehingga tidak melewati batas ukuran body function Vercel. Tidak perlu mengubah domain hosting atau memindahkan database.

## 6. Jalankan lokal

```sh
npm install
npm run dev:full
```

Isi `.env.local` dengan konfigurasi yang sama. Buka `http://127.0.0.1:5173` dan pastikan origin ini diizinkan di Firebase Auth dan R2 CORS. `npm run dev` dan `npm run preview` hanya menjalankan frontend; gunakan `dev:full` untuk operasi R2 lokal.

## 7. Verifikasi sebelum dipakai

1. Masuk sebagai admin. Upload PDF, DOC/DOCX, dan ZIP ke project atau sertifikat. Maksimum 5 lampiran per record, 10 MB per file.
2. Unduh file yang dipublikasikan dari browser tanpa login.
3. Jadikan record draft; permintaan URL download baru harus ditolak untuk pengunjung. Admin masih dapat mengunduh lampiran draft.
4. Hapus/ganti lampiran dan hapus sebuah record uji; pastikan objek R2 ikut terhapus.
5. Pastikan akun selain admin tidak bisa upload/delete, serta file kosong, lebih dari 10 MB, HTML, dan EXE ditolak.

URL unduh yang sudah diterbitkan tetap dapat digunakan sampai kedaluwarsa, maksimum 60 detik. Unpublish mencegah penerbitan URL baru. Salinan yang sudah diunduh tidak dapat ditarik kembali. Izin upload berlaku 5 menit dan mengikat path, ukuran, tipe konten, serta header file. Validasi format memakai ekstensi/MIME, bukan pemindaian antivirus; uploader hanya admin.

## 8. Migrasi file Firebase yang sudah ada

Lakukan setelah deployment R2 berhasil diuji. Jika selama ini hanya memakai tautan eksternal dan tidak pernah upload ke Firebase Storage, tidak ada lampiran biner Firebase yang perlu dipindahkan. URL Drive atau situs eksternal tidak otomatis disalin.

Tambahkan ke `.env.local` untuk migrasi:

```dotenv
FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
```

Gunakan nama bucket sebenarnya (bucket lama bisa berakhiran `.appspot.com`). Kredensial Firebase dan R2 server dari tabel di atas juga diperlukan.

Preview inventaris tanpa mengubah apa pun:

```sh
npm run migrate:files
```

Setelah hasil inventaris sesuai, salin, verifikasi, dan ubah referensi:

```sh
npm run migrate:files -- --apply
```

Script memindahkan lampiran Firebase yang direferensikan oleh collection `projects` dan `certificates`. Prosesnya:

- Memeriksa path dan ukuran semua file sumber sebelum mulai menulis.
- Menyimpan backup referensi lampiran ke `migration-backups/` (diabaikan Git).
- Menyalin objek dengan path yang sama, kemudian membaca kembali objek R2 dan membandingkan SHA-256.
- Mengubah `provider` ke `r2` hanya setelah semua lampiran record itu terverifikasi. Database, login, ID record, dan field lain tetap sama.
- Menolak penimpaan objek tujuan yang berbeda dan menolak update record yang berubah selama migrasi. Record yang sudah berhasil bisa dilewati saat rerun; record lainnya tetap menggunakan Firebase.
- Tidak menghapus file asli Firebase. Objek yang tidak direferensikan dilaporkan dan dibiarkan untuk ditinjau terpisah.

Hentikan pengeditan dashboard selama migrasi. Jika proses berhenti, baca error, perbaiki penyebabnya, dan jalankan ulang. Backup referensi digunakan untuk rollback manual per record; pulihkan field lampiran setelah memastikan file sumber masih ada dan jangan menimpa perubahan dashboard yang lebih baru. Pertahankan file asal sampai hasil migrasi diverifikasi di website.

## Pemecahan masalah

- **File service is not ready**: cek variabel server, izin akun layanan Firebase, izin token R2, dan deployment Function. Pastikan `R2_JURISDICTION` cocok dengan bucket. API sengaja tidak mengirim detail secret/error SDK ke browser.
- **Upload failed / CORS**: cek origin yang persis sama, header yang diizinkan, Account ID, bucket, serta waktu perangkat. Coba ulang untuk mendapatkan signature baru.
- **File not found or not published**: cek `published`, `attachments[].provider = r2`, path objek, dan `attachment_paths` di Firestore.
- **Lampiran Firebase lama gagal**: akses masih memakai Firebase Storage SDK/rules/CORS sampai lampiran itu dimigrasikan. Konfigurasi legacy `storage.rules` dan `storage.cors.json` tetap disimpan.
