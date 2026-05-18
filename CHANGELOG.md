# 📝 Changelog — AutoMoved Update

## Fitur Baru yang Ditambahkan

---

### 1. 📸 Split Screen — `foto.html`
**Sebelum:** Satu kolom tunggal, preview foto kecil di grid bawah.  
**Sesudah:** Layout dua panel penuh layar:
- **Kiri (65%)** — Live webcam ukuran besar + overlay countdown + badge status + toast notifikasi
- **Kanan (35%)** — Galeri scroll vertikal yang **update real-time** setiap kali foto diambil
  - Foto terbaru selalu muncul **di paling atas** dengan badge pink "✨ TERBARU"
  - Hover foto → muncul tombol hapus (✕)
  - Nomor urut foto di pojok kanan bawah
  - Auto scroll ke atas setiap ada foto baru

---

### 2. 👤 Face Detection + Suara Sambutan — `tutorial.html` & `foto.html`

**Di `tutorial.html`:**
- Kamera kecil tersembunyi di pojok kanan bawah sebagai sensor kehadiran
- Menggunakan `face-api.js` (TinyFaceDetector — ringan, akurat)
- Jika **tidak ada wajah selama 5 detik** → status berubah jadi **"Idle"**
- Begitu **wajah terdeteksi kembali** → otomatis memutar suara sambutan via Web Speech TTS:
  > *"Selamat datang di Photobooth! Silakan isi nama dan nomor HP kamu..."*
- Toast sambutan muncul di bagian atas halaman

**Di `foto.html`:**
- Face detection berjalan di background (tidak memblokir UI)
- Status badge **Active/Idle** ditampilkan di pojok kiri atas video
- Indikator mic **🎙️ Mic Aktif** di pojok kanan atas video

---

### 3. 🎙️ Preset Interaktif + Kontrol Suara — `foto.html`

10 preset pose yang bisa dipicu dengan:
- **Klik** chip di panel bawah kamera
- **Ucapkan** nama pose (Speech Recognition bahasa Indonesia `id-ID`)

| Preset | Label       | Kata Kunci Suara              |
|--------|-------------|-------------------------------|
| 1      | Senyum 😊  | "senyum", "satu", "1"         |
| 2      | V-Sign ✌️  | "v sign", "dua", "2"          |
| 3      | Merapat 🤝 | "merapat", "tiga", "3"        |
| 4      | Lompat 🏃  | "loncat", "lompat", "empat"   |
| 5      | Cool 😎    | "keren", "cool", "lima"       |
| 6      | Tangan ✋  | "tangan atas", "enam"         |
| 7      | Selfie 🤳  | "selfie", "tujuh"             |
| 8      | Santai 🧘  | "duduk", "santai", "delapan"  |
| 9      | Berpose 💃 | "pose", "berpose", "sembilan" |
| 10     | Tertawa 😂 | "tertawa", "ketawa", "sepuluh"|

Alur setelah preset dipicu:
1. TTS mengucapkan instruksi pose
2. Toast notifikasi muncul
3. Countdown otomatis 3..2..1 dimulai
4. Foto diambil → galeri kanan diperbarui

---

### 4. 📱 QR Code Download Google Drive — `cetak.html`

**Alur upload:**
1. Setelah preview foto berhasil dimuat, sistem otomatis upload foto ke Google Drive
2. Mencoba backend Node.js (`server-drive.js`) di `http://localhost:3000` terlebih dahulu
3. Jika backend tidak aktif → **fallback ke Supabase Storage** (buat signed URL 7 hari)
4. QR Code digenerate dari link tersebut menggunakan library `qrcode`
5. Pengguna bisa scan QR dengan HP untuk download foto langsung

**Setup backend Google Drive (opsional tapi direkomendasikan):**
```bash
npm install express cors googleapis qrcode
node server-drive.js
```
Buat `credentials.json` dari Google Cloud Console (Service Account).

---

### 5. 📍 Auto-Detect Branch — `guest-select-branch.html`

**Tiga cara auto-detect:**

1. **URL Parameter** (untuk QR Code di pintu masuk / shortcut):
   ```
   guest-select-branch.html?branch=UUID_BRANCH
   guest-select-branch.html?code=KODE_CABANG
   ```
   → Jika via URL param: langsung redirect otomatis dengan overlay + animasi loading bar

2. **Admin Login** (jika device photobooth dipakai admin yang sudah login):
   - Membaca `localStorage.currentAdmin.branch_id`
   - Menampilkan banner "📍 Kamu di: [Nama Cabang]" di atas halaman
   - Cabang yang terdeteksi muncul pertama dengan badge "📍 Lokasi Kamu"
   - Tetap bisa ganti cabang via tombol "Ganti Cabang"

3. **Manual** (fallback): Pilih dari daftar seperti sebelumnya

**Fitur tambahan:**
- Kotak search cabang (filter nama/kode secara real-time)
- Urutan: cabang terdeteksi selalu tampil pertama

---

## File yang Dimodifikasi
| File | Perubahan |
|------|-----------|
| `foto.html` | Rebuild total — split screen, face detection, voice preset, galeri live |
| `tutorial.html` | Tambah face detection + suara sambutan di background |
| `cetak.html` | Tambah QR Code section + auto-upload ke Drive/Supabase |
| `guest-select-branch.html` | Auto-detect branch via URL param / admin session + search |

## File Baru
| File | Fungsi |
|------|--------|
| `server-drive.js` | Backend Node.js opsional untuk upload Google Drive |

## Dependensi Eksternal (CDN — tidak perlu install)
- `face-api.js` v0.22.2 — deteksi wajah
- `qrcode` (cdn.jsdelivr.net) — generate QR Code
- `Web Speech API` — built-in browser (tidak perlu library)
