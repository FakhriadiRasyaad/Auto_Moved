/**
 * server-drive.js
 * ════════════════════════════════════════════════════════
 *  Backend Node.js OPSIONAL untuk upload Google Drive.
 *  Jalankan dengan: node server-drive.js
 *  Berjalan di: http://localhost:3000
 *
 *  Diperlukan jika ingin fitur QR Code dari Google Drive
 *  (jika tidak ada backend, sistem fallback ke Supabase URL).
 *
 *  SETUP:
 *  1. npm install express cors googleapis qrcode
 *  2. Buat credentials.json dari Google Cloud Console
 *     (Service Account dengan akses Google Drive)
 *  3. Set GOOGLE_DRIVE_FOLDER_ID di bawah
 *  4. node server-drive.js
 * ════════════════════════════════════════════════════════
 */

const express    = require("express");
const cors       = require("cors");
const { google } = require("googleapis");
const QRCode     = require("qrcode");
const path       = require("path");
const { Readable } = require("stream");

// ── Konfigurasi ──────────────────────────────────────
const PORT                  = 3000;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GDRIVE_FOLDER_ID || "YOUR_FOLDER_ID_HERE";
const CREDENTIALS_PATH       = path.join(__dirname, "credentials.json");

const app = express();

// Izinkan request dari localhost (Live Server VS Code / browser lokal)
app.use(cors({ origin: ["http://localhost", "http://127.0.0.1", /^http:\/\/127\.0\.0\.1:\d+$/] }));

// Body parser — terima JSON besar (foto base64 bisa 2-5MB)
app.use(express.json({ limit: "15mb" }));

// ── Google Drive Auth ────────────────────────────────
let driveClient = null;

async function getDriveClient() {
  if (driveClient) return driveClient;

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    driveClient = google.drive({ version: "v3", auth });
    console.log("✅ Google Drive auth berhasil");
    return driveClient;
  } catch (err) {
    console.warn("⚠️  Google Drive auth gagal:", err.message);
    return null;
  }
}

// ── Helper: base64 → Readable Stream ────────────────
function base64ToStream(base64) {
  const buf = Buffer.from(base64, "base64");
  const stream = new Readable();
  stream.push(buf);
  stream.push(null);
  return stream;
}

// ════════════════════════════════════════════════════
//  GET /api/ping — cek apakah server aktif
// ════════════════════════════════════════════════════
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "Photobooth Drive Server aktif 🎉" });
});

// ════════════════════════════════════════════════════
//  POST /api/upload-photo
//  Body: { imageBase64: string, sessionId: string, guestNama: string }
//  Response: { driveLink: string, qrDataUrl: string }
// ════════════════════════════════════════════════════
app.post("/api/upload-photo", async (req, res) => {
  const { imageBase64, sessionId, guestNama } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 wajib diisi" });
  }

  const drive = await getDriveClient();

  if (!drive) {
    return res.status(503).json({
      error: "Google Drive tidak tersedia. Pastikan credentials.json ada dan valid."
    });
  }

  try {
    // ── Nama file dengan timestamp ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeName  = (guestNama ?? "guest").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName  = `photobooth_${safeName}_${timestamp}.jpg`;

    console.log(`📤 Mengupload: ${fileName}`);

    // ── Upload ke Google Drive ──
    const response = await drive.files.create({
      requestBody: {
        name:    fileName,
        mimeType:"image/jpeg",
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "image/jpeg",
        body:     base64ToStream(imageBase64),
      },
      fields: "id, webViewLink, webContentLink",
    });

    const fileId      = response.data.id;
    const webViewLink = response.data.webViewLink;

    // ── Set permission: anyone with link can view ──
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // ── Buat link download langsung ──
    const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

    console.log(`✅ Upload sukses: ${webViewLink}`);

    // ── Generate QR Code dari link download ──
    const qrDataUrl = await QRCode.toDataURL(downloadLink, {
      width: 400, margin: 2,
      color: { dark: "#2c1810", light: "#ffffff" }
    });

    res.json({
      ok:          true,
      fileId,
      driveLink:   downloadLink,    // link download langsung
      webViewLink,                  // link view di browser
      qrDataUrl,                    // QR code sebagai data URL (image/png base64)
    });

  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).json({ error: "Gagal upload ke Google Drive: " + err.message });
  }
});

// ════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  📸 Photobooth Drive Server          ║
║  Berjalan di http://localhost:${PORT}  ║
╚══════════════════════════════════════╝

Endpoint tersedia:
  GET  /api/ping          — cek status server
  POST /api/upload-photo  — upload foto ke Google Drive

Pastikan:
  • credentials.json ada di folder yang sama
  • GDRIVE_FOLDER_ID sudah diisi
  • npm install express cors googleapis qrcode
  `);
});
