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
    """

    def __init__(self, port: str = "COM3", baud_rate: int = 9600, timeout: float = 1.0):
        self.port = port
        self.baud_rate = baud_rate
        self.timeout = timeout
        self._serial = None
        self._lock = threading.Lock()
        self._connected = False

    def connect(self) -> bool:
        """Buka koneksi Serial ke ESP32. Return True jika berhasil."""
        if not SERIAL_AVAILABLE:
            logger.error("pyserial tidak tersedia. Install dengan: pip install pyserial")
            return False

        with self._lock:
            if self._connected and self._serial and self._serial.is_open:
                logger.info(f"Sudah terhubung ke {self.port}")
                return True
            try:
                self._serial = serial.Serial(
                    port=self.port,
                    baudrate=self.baud_rate,
                    timeout=self.timeout
                )
                time.sleep(1.5)  # Tunggu ESP32 reset setelah koneksi
                self._connected = True
                logger.info(f"Terhubung ke ESP32 di {self.port} ({self.baud_rate} baud)")
                return True
            except Exception as e:
                self._connected = False
                logger.error(f"Gagal terhubung ke {self.port}: {e}")
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
        Args:
            preset_number: angka 1-10 (sesuai jumlah jari yang terdeteksi)
        Returns:
            dict {'ok': bool, 'message': str}
        """
        if preset_number < 1 or preset_number > 10:
            return {"ok": False, "message": f"Preset {preset_number} tidak valid. Harus antara 1-10."}

        if not self.is_connected:
            logger.warning(f"Tidak terhubung, mencoba reconnect ke {self.port}...")
            if not self.connect():
                return {"ok": False, "message": f"Gagal terhubung ke ESP32 di port {self.port}"}

        with self._lock:
            try:
                data = f"{preset_number}\n".encode("utf-8")
                self._serial.write(data)
                self._serial.flush()
                logger.info(f"Kirim Preset {preset_number} ke ESP32 ({self.port})")
                return {"ok": True, "message": f"Preset {preset_number} berhasil dikirim ke ESP32"}
            except Exception as e:
                self._connected = False
                logger.error(f"Gagal kirim data ke ESP32: {e}")
                return {"ok": False, "message": f"Gagal kirim ke ESP32: {str(e)}"}

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
        return [{"port": p.device, "description": p.description} for p in ports]

    def __repr__(self):
        status = "connected" if self.is_connected else "disconnected"
        return f"<ESP32Handler port={self.port} baud={self.baud_rate} status={status}>"
