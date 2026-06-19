import os
import sys
import subprocess
import webview

# ==========================================
# ⚙️ CONFIGURATION / KONFIGURASI
# ==========================================
# Ganti True jika ingin memuat file HTML lokal, False untuk menggunakan URL Vercel
USE_LOCAL_FILES = False

# URL Vercel yang sudah dideploy
REMOTE_URL = "https://axionix-two.vercel.app/"

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
# 🐍 PYTHON API FOR JAVASCRIPT
# ==========================================
class Api:
    """
    Class ini mendefinisikan fungsi Python yang bisa dipanggil
    dari JavaScript di dalam Webview menggunakan window.pywebview.api.namaFungsi()
    """
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

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


# ==========================================
# 🚀 MAIN APPLICATION
# ==========================================
def main():
    drive_process = None

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

    # 3. Inisialisasi API dan buat window
    api = Api()
    
    # WebView settings
    window = webview.create_window(
        title=WINDOW_TITLE,
        url=target,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        fullscreen=FULLSCREEN,
        js_api=api
    )
    api.set_window(window)

    # Setup hardware permissions (camera & mic)
    from permissions import setup_permissions
    setup_permissions(window)

    # 4. Start webview
    # Jika memuat file lokal, http_server=True sangat penting agar ES Modules (type="module") bisa dimuat
    try:
        webview.start(
            http_server=USE_LOCAL_FILES,
            debug=DEBUG_MODE
        )
    finally:
        # 5. Cleanup: Pastikan proses Node.js dihentikan saat window ditutup
        if drive_process:
            print("Stopping Node.js backend...")
            drive_process.terminate()
            # Khusus Windows, kadang perlu taskkill jika process group tidak merespon terminate
            if os.name == 'nt':
                try:
                    subprocess.run(f"taskkill /F /T /PID {drive_process.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            print("Cleanup done.")

if __name__ == "__main__":
    main()
