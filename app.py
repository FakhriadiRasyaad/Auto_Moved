# -*- coding: utf-8 -*-
import os
import sys

# ── DLL & PYTHON RUNTIME PATH RESOLUTION FOR CLEAN WINDOWS DEVICES ──
import ctypes
if getattr(sys, 'frozen', False):
    exe_dir = os.path.dirname(sys.executable)
    bundle_dir = getattr(sys, '_MEIPASS', exe_dir)
    internal_dir = os.path.join(exe_dir, '_internal')
    pyruntime_dir = os.path.join(internal_dir, 'pythonnet', 'runtime')
    clr_dir = os.path.join(internal_dir, 'clr_loader', 'ffi', 'dlls', 'amd64')

    os.chdir(exe_dir)
    for d in [exe_dir, bundle_dir, internal_dir, pyruntime_dir, clr_dir]:
        if os.path.exists(d):
            os.environ['PATH'] = d + os.path.pathsep + os.environ.get('PATH', '')
            try:
                ctypes.windll.kernel32.SetDllDirectoryW(d)
            except Exception:
                pass
            if hasattr(os, 'add_dll_directory'):
                try:
                    os.add_dll_directory(d)
                except Exception:
                    pass

    os.environ['PYTHONHOME'] = internal_dir if os.path.exists(internal_dir) else bundle_dir
    os.environ['PYTHONPATH'] = internal_dir if os.path.exists(internal_dir) else bundle_dir

import subprocess
import logging
import webview

# Fix encoding untuk terminal Windows yang default cp1252
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Otomatis izinkan kamera & mikrofon pada engine Chromium/Edge WebView2
os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--use-fake-ui-for-media-stream --enable-usermedia-screen-capturing"


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
WINDOW_TITLE = "Axionix Photo"
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 800
FULLSCREEN = False  # Set ke True untuk mode kiosk/layar penuh tanpa border

# Aktifkan DevTools (bisa klik kanan -> Inspect Element / Ctrl+Shift+I)
DEBUG_MODE = False


# ==========================================
# 🤖 KONFIGURASI ESP32 (Gesture → Robot)
# ==========================================
# Aktifkan integrasi ESP32 (kirim angka preset via Serial)
ESP32_ENABLED = True

# Port Serial ESP32:
# Gunakan "auto" untuk deteksi port otomatis adaptif (memindai chip CP210x, CH340, FTDI, dll.)
# Atau tentukan port spesifik jika ingin memaksa, misal: "COM3", "COM4", "/dev/ttyUSB0"
ESP32_PORT = "auto"

# Baud rate — harus sama dengan yang di-set di sketch Arduino/ESP32 (115200 baud)
ESP32_BAUD_RATE = 115200

# Mode debug: cetak output preset ke terminal walau ESP32 tidak terhubung
# Berguna untuk verifikasi deteksi gesture sebelum hardware tersedia
ESP32_DEBUG_PRINT = True

# ==========================================
# KONFIGURASI GESTURE DETECTOR / SCRAPPER
# ==========================================
# Nonaktifkan gesture detector OpenCV Python agar TIDAK mengunci kamera.
# Kamera kini digunakan langsung oleh layer website (Chromium/WebView2).
# Python akan melakukan "scraping" / mendengarkan status preset yang terdeteksi
# di website dan mengirim trigger output (1-10) ke ESP32.
GESTURE_ENABLED = False

# Index kamera untuk gesture detector Python (jika GESTURE_ENABLED = True)
GESTURE_CAMERA_INDEX = 0

# Tampilkan jendela preview kamera kecil dengan landmark tangan (jika GESTURE_ENABLED = True)
GESTURE_SHOW_PREVIEW = False

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
            print(f"          ✅ Serial OK → {self._esp32.port}")
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
            print(f"[ESP32] ✅ Terhubung ke ESP32 di {esp32.port}")
        else:
            print(f"[ESP32] ⚠️  Belum terhubung ke ESP32 pada startup — akan coba hubungkan otomatis saat trigger")
            available = ESP32Handler.list_ports()
            if available:
                print(f"[ESP32] Port terdeteksi di sistem: {[p['port'] + ' (' + p['description'] + ')' for p in available]}")
            else:
                print(f"[ESP32] Tidak ada COM port terdeteksi. Pastikan kabel USB & driver USB-Serial ter-install.")

    # 4. Inisialisasi Gesture Detector Python (OpenCV + MediaPipe)
    gesture_detector = None
    if GESTURE_ENABLED and esp32:
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
    if ESP32_ENABLED:
        api.set_esp32(esp32)

    # WebView settings
    base_dir = os.path.dirname(os.path.abspath(__file__))
    icon_path = os.path.join(base_dir, 'app_icon.ico')
    if not os.path.exists(icon_path):
        icon_path = os.path.join(base_dir, 'img', 'Logo_photobooth_LTI.png')

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

    # 🤖 WEB SCRAPER LISTENER (Mendengarkan preset aktif di website -> Kirim ke ESP32)
    SCRAPER_JS = """
    (function() {
        if (!String.prototype.replaceAll) {
            String.prototype.replaceAll = function(str, newStr) {
                if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') return this.replace(str, newStr);
                return this.replace(new RegExp(String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newStr);
            };
        }
        if (!Promise.allSettled) {
            Promise.allSettled = function(promises) {
                return Promise.all(Array.from(promises).map(function(p) {
                    return Promise.resolve(p).then(
                        function(value) { return { status: 'fulfilled', value: value }; },
                        function(reason) { return { status: 'rejected', reason: reason }; }
                    );
                }));
            };
        }
        if (!Object.hasOwn) {
            Object.hasOwn = function(obj, prop) {
                return Object.prototype.hasOwnProperty.call(obj, prop);
            };
        }

        if (window.__esp32ScraperInjected) return;
        window.__esp32ScraperInjected = true;
        console.log('[ESP32 Scraper] Injected JS Scraper for preset detection');

        var lastSentPreset = null;
        var lastSentTime = 0;

        function notifyPython(presetId, force) {
            var pid = parseInt(presetId, 10);
            if (isNaN(pid) || pid <= 0 || pid > 10) return;
            var now = Date.now();
            if (!force && lastSentPreset === pid && (now - lastSentTime) < 800) return;
            lastSentPreset = pid;
            lastSentTime = now;
            console.log('[ESP32 Scraper] Preset ' + pid + ' aktif → Kirim ke ESP32');
            if (window.pywebview && window.pywebview.api && window.pywebview.api.trigger_esp32) {
                window.pywebview.api.trigger_esp32(pid);
            }
        }

        function hookTriggerPreset() {
            if (window.triggerPreset && !window.__esp32TriggerHooked) {
                window.__esp32TriggerHooked = true;
                var orig = window.triggerPreset;
                window.triggerPreset = function(id, src) {
                    notifyPython(id, true);
                    return orig.apply(this, arguments);
                };
                console.log('[ESP32 Scraper] window.triggerPreset hooked!');
            }
        }

        var lastCamRetry = 0;
        function autoInitCameraIfNeeded() {
            var now = Date.now();
            if (now - lastCamRetry < 3000) return;
            var camSel = document.querySelector('#camSel, select.camera-select, select[id*="cam"]');
            if (camSel && (camSel.options.length <= 1 || camSel.value === '')) {
                lastCamRetry = now;
                console.log('[ESP32 Scraper] Retrying camera initialization...');
                if (typeof enumCameras === 'function') {
                    enumCameras();
                } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function(stream) {
                        console.log('[ESP32 Scraper] Camera access granted!');
                        stream.getTracks().forEach(function(t) { t.stop(); });
                        if (typeof enumCameras === 'function') enumCameras();
                    }).catch(function(err) {
                        console.warn('[ESP32 Scraper] Camera request err:', err);
                    });
                }
            }
        }

        hookTriggerPreset();
        autoInitCameraIfNeeded();

        setInterval(function() {
            hookTriggerPreset();
            autoInitCameraIfNeeded();
        }, 500);
    })();
    """

    def inject_scraper():
        try:
            # Inject Scraper pendukung (hanya mendengarkan event/DOM di website -> ESP32)
            window.evaluate_js(SCRAPER_JS)
        except Exception as e:
            pass

    window.events.loaded += inject_scraper

    # Thread periodik untuk memastikan scraper tetap aktif jika ada navigasi halaman SPA
    import threading
    import time
    def scraper_loop():
        time.sleep(3)
        while True:
            try:
                inject_scraper()
            except Exception:
                break
            time.sleep(2)

    t_scraper = threading.Thread(target=scraper_loop, daemon=True)
    t_scraper.start()

    def on_start():
        from permissions import setup_permissions
        setup_permissions(webview_window)

        try:
            from PyQt5.QtWidgets import QApplication
            from PyQt5.QtGui import QIcon
            app = QApplication.instance()
            if app and os.path.exists(icon_path):
                app.setWindowIcon(QIcon(icon_path))
        except Exception:
            pass

    # 6. Start webview (blocking sampai window ditutup)
    try:
        try:
            webview.start(
                on_start,
                gui='qt',
                http_server=USE_LOCAL_FILES,
                debug=DEBUG_MODE
            )
        except Exception as ex_qt:
            logging.warning(f"Qt backend start fallback: {ex_qt}")
            webview.start(
                on_start,
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
