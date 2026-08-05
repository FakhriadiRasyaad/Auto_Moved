"""
esp32_handler.py
Modul untuk komunikasi Serial ke ESP32.
Mengirim angka preset (1-10) ke ESP32 via USB/COM port.

Protokol:
  - Format: "{angka}\n" agar ESP32 bisa membaca dengan Serial.readStringUntil('\n')
"""

import threading
import time
import logging

logger = logging.getLogger("ESP32Handler")

# Coba import pyserial; jika tidak ada, beri peringatan
try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False
    logger.warning("pyserial tidak terinstall. Jalankan: pip install pyserial")


class ESP32Handler:
    """
    Mengelola koneksi Serial ke ESP32 untuk trigger gerakan robot.
    Thread-safe: bisa dipanggil dari thread manapun.
    Mendukung deteksi port adaptif / otomatis.
    """

    def __init__(self, port: str = "auto", baud_rate: int = 115200, timeout: float = 1.0):
        self.port = port
        self.baud_rate = baud_rate
        self.timeout = timeout
        self._serial = None
        self._lock = threading.Lock()
        self._connected = False

    @staticmethod
    def get_candidate_ports() -> list:
        """
        Mendapatkan daftar kandidat COM port yang terdeteksi di sistem,
        diurutkan berdasarkan prioritas chip USB Serial (ESP32, CP210x, CH340, FTDI, dll).
        """
        if not SERIAL_AVAILABLE:
            return []

        ports = serial.tools.list_ports.comports()
        candidates = []

        # Keyword chip USB Serial yang umum digunakan pada ESP32/Arduino
        esp32_keywords = [
            "cp210", "ch340", "ch341", "ft232", "usb serial", "usb-to-uart",
            "esp32", "espressif", "silicon labs", "qinheng", "arduino", "uart"
        ]
        # Vendor ID umum: 0x10c4 (Silicon Labs), 0x1a86 (WCH CH340), 0x0403 (FTDI), 0x303a (Espressif)
        known_vids = {0x10c4, 0x1a86, 0x0403, 0x303a}

        for p in ports:
            desc_lower = (p.description or "").lower()
            mfg_lower = (p.manufacturer or "").lower()
            vid = p.vid

            score = 0
            if vid in known_vids:
                score += 10

            for kw in esp32_keywords:
                if kw in desc_lower or kw in mfg_lower:
                    score += 5

            candidates.append({
                "port": p.device,
                "description": p.description or p.device,
                "score": score
            })

        # Urutkan kandidat berdasarkan skor tertinggi
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates

    def connect(self, target_port: str = None) -> bool:
        """
        Buka koneksi Serial ke ESP32.
        Adaptif: Jika port yang dituju gagal atau diset 'auto', 
        otomatis memindai dan mencoba port lain yang tersedia.
        """
        if not SERIAL_AVAILABLE:
            logger.error("pyserial tidak tersedia. Install dengan: pip install pyserial")
            return False

        with self._lock:
            if self._connected and self._serial and self._serial.is_open:
                logger.info(f"Sudah terhubung ke {self.port}")
                return True

            port_to_try = target_port or self.port
            ports_to_attempt = []

            # 1. Jika port spesifik ditentukan dan bukan 'auto', coba port itu terlebih dahulu
            if port_to_try and str(port_to_try).lower() != "auto":
                ports_to_attempt.append(port_to_try)

            # 2. Ambil daftar kandidat port terdeteksi
            candidates = self.get_candidate_ports()
            for cand in candidates:
                p_name = cand["port"]
                if p_name not in ports_to_attempt:
                    ports_to_attempt.append(p_name)

            if not ports_to_attempt:
                logger.warning("Tidak ada COM port yang terdeteksi di sistem.")
                return False

            # 3. Coba buka koneksi ke masing-masing port
            for p_name in ports_to_attempt:
                logger.info(f"Mencoba koneksi Serial ke {p_name}...")
                try:
                    ser = serial.Serial(
                        port=p_name,
                        baudrate=self.baud_rate,
                        timeout=self.timeout
                    )
                    # Lepas sinyal DTR & RTS agar ESP32 tidak tertahan di mode reset / bootloader
                    ser.dtr = False
                    ser.rts = False
                    time.sleep(2.0)  # Tunggu ESP32 selesai booting setup() setelah reset serial
                    self._serial = ser
                    self.port = p_name
                    self._connected = True
                    logger.info(f"✅ Terhubung ke ESP32 di {self.port} ({self.baud_rate} baud)")
                    return True
                except Exception as e:
                    logger.warning(f"Gagal membuka port {p_name}: {e}")

            self._connected = False
            logger.error("Gagal terhubung ke ESP32 di semua port yang dicoba.")
            return False

    def disconnect(self):
        """Tutup koneksi Serial."""
        with self._lock:
            if self._serial and self._serial.is_open:
                self._serial.close()
            self._connected = False
            logger.info(f"Koneksi ke {self.port} ditutup")

    @property
    def is_connected(self) -> bool:
        """Cek apakah koneksi aktif."""
        with self._lock:
            return self._connected and self._serial is not None and self._serial.is_open

    def send_preset(self, preset_number: int) -> dict:
        """
        Kirim nomor preset ke ESP32.
        """
        if preset_number < 1 or preset_number > 10:
            return {"ok": False, "message": f"Preset {preset_number} tidak valid. Harus antara 1-10."}

        if not self.is_connected:
            logger.warning(f"Belum terhubung ke ESP32, mencoba auto-connect...")
            if not self.connect():
                return {"ok": False, "message": f"Gagal terhubung ke ESP32 di semua port yang ada"}

        with self._lock:
            try:
                # Kirim Perintah Preset Utama (misal "1\n")
                data = f"{preset_number}\n".encode("utf-8")
                if hasattr(self._serial, "reset_output_buffer"):
                    self._serial.reset_output_buffer()
                self._serial.write(data)
                self._serial.flush()
                time.sleep(0.1)

                if hasattr(self._serial, "in_waiting") and self._serial.in_waiting:
                    resp = self._serial.read(self._serial.in_waiting).decode("utf-8", errors="ignore").strip()
                    if resp:
                        print(f"          🤖 Balasan ESP32: {resp}")

                logger.info(f"Kirim Preset {preset_number} ke ESP32 ({self.port})")
                return {"ok": True, "message": f"Preset {preset_number} berhasil dikirim"}
            except Exception as e:
                self._connected = False
                logger.error(f"Gagal kirim data ke ESP32 ({self.port}): {e}")
                return {"ok": False, "message": f"Gagal kirim ke ESP32 ({self.port}): {str(e)}"}

    def send_raw(self, data: str) -> dict:
        """Kirim string mentah ke ESP32 (untuk debugging)."""
        if not self.is_connected:
            if not self.connect():
                return {"ok": False, "message": "Tidak terhubung ke ESP32"}
        with self._lock:
            try:
                self._serial.write(data.encode("utf-8"))
                self._serial.flush()
                return {"ok": True, "message": f"Terkirim: {repr(data)}"}
            except Exception as e:
                self._connected = False
                return {"ok": False, "message": str(e)}

    @staticmethod
    def list_ports() -> list:
        """Tampilkan semua COM port yang tersedia."""
        if not SERIAL_AVAILABLE:
            return []
        ports = serial.tools.list_ports.comports()
        return [{"port": p.device, "description": p.description or p.device} for p in ports]

    def __repr__(self):
        status = "connected" if self.is_connected else "disconnected"
        return f"<ESP32Handler port={self.port} baud={self.baud_rate} status={status}>"

