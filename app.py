# -*- coding: utf-8 -*-
import os
import sys
import subprocess
import logging
import webview

# Fix encoding untuk terminal Windows yang default cp1252
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ==========================================
# ⚙️ CONFIGURATION / KONFIGURASI
# ==========================================
# Ganti True jika ingin memuat file HTML lokal, False untuk menggunakan URL Vercel
USE_LOCAL_FILES = False

# URL Vercel yang sudah dideploy
REMOTE_URL = "https://axionix.lti.company/"

# Path ke index.html lokal (relatif terhadap script ini)
LOCAL_ENTRY = "index.html"

# Jalankan server Node.js (server-drive.js) di background jika diset ke True
START_DRIVE_SERVER = False
DRIVE_SERVER_PATH = "server-drive.js"

# Pengaturan Window
WINDOW_TITLE = "LTI Photobooth"
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 800
FULLSCREEN = False  # Set ke True untuk mode kiosk/layar penuh tanpa border

# Aktifkan DevTools (bisa klik kanan -> Inspect Element / Ctrl+Shift+I)
DEBUG_MODE = True


# ==========================================
# 🤖 KONFIGURASI ESP32 (Gesture → Robot)
# ==========================================
# Aktifkan integrasi ESP32 (kirim angka preset via Serial)
ESP32_ENABLED = True

# Port Serial ESP32 (cek di Device Manager -> COM & LPT Ports)
# Contoh Windows: "COM3", "COM4" | Linux: "/dev/ttyUSB0"
ESP32_PORT = "COM3"

# Baud rate — harus sama dengan yang di-set di sketch Arduino/ESP32
ESP32_BAUD_RATE = 9600

# Mode debug: cetak output preset ke terminal walau ESP32 tidak terhubung
# Berguna untuk verifikasi deteksi gesture sebelum hardware tersedia
ESP32_DEBUG_PRINT = True

# ==========================================
# KONFIGURASI GESTURE DETECTOR (Python/OpenCV)
# ==========================================
# Aktifkan deteksi gesture via Python (OpenCV + MediaPipe) — TIDAK pakai browser
# Keuntungan: tidak konflik kamera, output langsung di terminal, preview window
GESTURE_ENABLED = True

# Index kamera untuk gesture detector (0 = kamera utama/built-in)
# Jika ada 2 kamera dan kamera 0 dipakai browser, coba ganti ke 1
GESTURE_CAMERA_INDEX = 0

# Tampilkan jendela preview kamera kecil dengan landmark tangan
GESTURE_SHOW_PREVIEW = True

# Logging level untuk ESP32 handler
logging.basicConfig(level=logging.INFO, format="[%(name)s] %(message)s")


# ==========================================
# 🐍 PYTHON API FOR JAVASCRIPT
# ==========================================
class Api:
    """
    Class ini mendefinisikan fungsi Python yang bisa dipanggil
    dari JavaScript di dalam Webview menggunakan window.pywebview.api.namaFungsi()

    Fungsi baru untuk ESP32:
      - trigger_esp32(preset)   → kirim nomor preset ke ESP32 via Serial
      - get_esp32_status()      → cek apakah ESP32 terhubung
      - list_serial_ports()     → daftar semua COM port yang tersedia
    """
    def __init__(self):
        self._window = None
        self._esp32 = None

    def set_window(self, window):
        self._window = window

    def set_esp32(self, esp32_handler):
        """Inject ESP32Handler instance ke dalam Api."""
        self._esp32 = esp32_handler

    def close_app(self):
        print("Closing application...")
        if self._window:
            self._window.destroy()

    def print_page(self):
        # Memicu dialog print bawaan sistem
        if self._window:
            self._window.evaluate_js("window.print();")

    def toggle_fullscreen(self):
        if self._window:
            self._window.toggle_fullscreen()

    # ── ESP32 API (dapat dipanggil dari JavaScript) ────────────

    def trigger_esp32(self, preset: int) -> dict:
        """
        Kirim nomor preset ke ESP32 via Serial.

        Dipanggil dari JavaScript:
            const result = await window.pywebview.api.trigger_esp32(1);
            console.log(result); // {ok: true, message: "Preset 1 berhasil dikirim"}

        Args:
            preset (int): angka 1-10 sesuai jumlah jari yang terdeteksi kamera

        Returns:
            dict: {ok: bool, message: str}
        """
        try:
            preset_num = int(preset)
        except (ValueError, TypeError):
            return {"ok": False, "message": f"Nilai preset tidak valid: {preset}"}

        # ── Selalu cetak ke terminal untuk verifikasi ──
        bar = "█" * preset_num + "░" * (10 - preset_num)
        print(f"[GESTURE] Jari terdeteksi: {preset_num:>2}  [{bar}]")
        print(f"          → Preset {preset_num} aktif | Kirim '{preset_num}\\n' ke ESP32")

        if not self._esp32:
            if ESP32_DEBUG_PRINT:
                print(f"          [DEBUG MODE] ESP32 tidak terhubung — hanya simulasi")
            return {"ok": True, "message": f"[DEBUG] Preset {preset_num} (ESP32 tidak aktif)"}

        result = self._esp32.send_preset(preset_num)
        if result["ok"]:
            print(f"          ✅ Serial OK → {ESP32_PORT}")
        else:
            print(f"          ❌ Serial GAGAL: {result['message']}")
        return result

    def get_esp32_status(self) -> dict:
        """
        Cek status koneksi ESP32.

        Dipanggil dari JavaScript:
            const status = await window.pywebview.api.get_esp32_status();
            console.log(status.connected); // true / false

        Returns:
            dict: {connected: bool, port: str, message: str}
        """
        if not self._esp32:
            return {"connected": False, "port": "", "message": "ESP32 tidak diaktifkan"}

        connected = self._esp32.is_connected
        return {
            "connected": connected,
            "port": self._esp32.port,
            "message": f"ESP32 {'terhubung' if connected else 'tidak terhubung'} di {self._esp32.port}"
        }

    def list_serial_ports(self) -> list:
        """
        Daftar semua COM port yang tersedia di sistem.

        Dipanggil dari JavaScript:
            const ports = await window.pywebview.api.list_serial_ports();
            // [{port: "COM3", description: "USB Serial Device"}, ...]

        Returns:
            list: [{port: str, description: str}]
        """
        if not self._esp32:
            return []
        return self._esp32.list_ports()


# ==========================================
# 🚀 MAIN APPLICATION
# ==========================================
def main():
    drive_process = None
    esp32 = None

    # 1. Jalankan Node.js backend jika dikonfigurasi
    if START_DRIVE_SERVER:
        server_full_path = os.path.abspath(DRIVE_SERVER_PATH)
        if os.path.exists(server_full_path):
            print(f"Starting Node.js backend: {server_full_path}")
            try:
                # Menggunakan shell=True agar berjalan dengan baik di Windows
                drive_process = subprocess.Popen(
                    ["node", server_full_path],
                    cwd=os.path.dirname(server_full_path),
                    shell=True
                )
                print("Node.js server started in background.")
            except Exception as e:
                print(f"Gagal menjalankan server Node.js: {e}")
        else:
            print(f"Peringatan: File backend tidak ditemukan di {server_full_path}")

    # 2. Tentukan target URL/File
    if USE_LOCAL_FILES:
        target = os.path.abspath(LOCAL_ENTRY)
        if not os.path.exists(target):
            print(f"Error: File HTML lokal tidak ditemukan di: {target}")
            sys.exit(1)
        print(f"Memuat file lokal: {target}")
    else:
        target = REMOTE_URL
        print(f"Memuat URL Remote: {target}")

    # 3. Inisialisasi ESP32 handler (jika diaktifkan)
    if ESP32_ENABLED:
        from esp32_handler import ESP32Handler
        esp32 = ESP32Handler(port=ESP32_PORT, baud_rate=ESP32_BAUD_RATE)
        ok = esp32.connect()
        if ok:
            print(f"[ESP32] ✅ Terhubung ke ESP32 di {ESP32_PORT}")
        else:
            print(f"[ESP32] ⚠️  Tidak terhubung ke {ESP32_PORT} — berjalan dalam DEBUG MODE")
            available = ESP32Handler.list_ports()
            if available:
                print(f"[ESP32] Port tersedia: {[p['port'] + ' (' + p['description'] + ')' for p in available]}")
            else:
                print(f"[ESP32] Tidak ada COM port terdeteksi. Pastikan driver USB-Serial ter-install.")
            esp32 = None  # Reset agar API tahu tidak ada hardware

    # 4. Inisialisasi Gesture Detector Python (OpenCV + MediaPipe)
    gesture_detector = None
    if GESTURE_ENABLED:
        from gesture_detector import GestureDetector
        gesture_detector = GestureDetector(
            esp32_handler  = esp32,
            camera_index   = GESTURE_CAMERA_INDEX,
            show_preview   = GESTURE_SHOW_PREVIEW,
        )
        gesture_detector.start()
        print("[GESTURE] Gesture detector Python dimulai (OpenCV + MediaPipe)", flush=True)
        print("[GESTURE] Lihat jendela 'Gesture ESP32 [Q=keluar]' untuk preview kamera", flush=True)

    # 5. Inisialisasi API dan buat window
    api = Api()
    if esp32:
        api.set_esp32(esp32)

    # WebView settings
    window = webview.create_window(
        title=WINDOW_TITLE,
        url=target,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        fullscreen=FULLSCREEN,
        js_api=api
    )
    webview_window = window
    api.set_window(webview_window)

    # Setup hardware permissions (camera & mic untuk photobooth)
    from permissions import setup_permissions
    setup_permissions(webview_window)

    # 6. Start webview (blocking sampai window ditutup)
    try:
        webview.start(
            http_server=USE_LOCAL_FILES,
            debug=DEBUG_MODE
        )
    finally:
        # 7. Cleanup: Pastikan semua resource dilepas saat window ditutup

        # Hentikan gesture detector
        if gesture_detector:
            print("[GESTURE] Menghentikan gesture detector...", flush=True)
            gesture_detector.stop()

        # Tutup koneksi ESP32
        if esp32:
            print("[ESP32] Menutup koneksi Serial...", flush=True)
            esp32.disconnect()

        # Hentikan Node.js backend
        if drive_process:
            print("Stopping Node.js backend...")
            drive_process.terminate()
            if os.name == 'nt':
                try:
                    subprocess.run(f"taskkill /F /T /PID {drive_process.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            print("Cleanup done.")

if __name__ == "__main__":
    main()
