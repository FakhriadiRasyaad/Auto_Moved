# -*- coding: utf-8 -*-
"""
test_move.py — Script Pengujian Serial ESP32 Robot Arm via Terminal
===================================================================
Script ini digunakan untuk menguji pergerakan robot ESP32 secara langsung 
tanpa perlu membuka website/pywebview.

Cara Pakai di Terminal:
    py test_move.py
"""

import sys
import time
import logging

# Fix encoding terminal Windows (cp1252 -> utf-8)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

logging.basicConfig(level=logging.INFO, format="[ESP32] %(message)s")

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("❌ Error: pyserial belum terinstall. Jalankan: pip install pyserial")
    sys.exit(1)

from esp32_handler import ESP32Handler


def print_menu():
    print("\n" + "=" * 55)
    print(" 🤖 ESP32 ROBOT ARM TEST BENCH (Serial Command Tester)")
    print("=" * 55)
    print(" Perintah Instan:")
    print("   [1 - 10]  : Kirim Preset 1-10 (contoh: ketik 1)")
    print("   J1 <deg>  : Gerakkan Joint 1 (contoh: J1 45.0)")
    print("   J2 <deg>  : Gerakkan Joint 2 (contoh: J2 30.0)")
    print("   SAVE <1-10>: Simpan posisi robot saat ini ke Preset (contoh: SAVE 1)")
    print("   SHOW <1-10>: Tampilkan sudut tersimpan di Preset (contoh: SHOW 1)")
    print("   LIST      : Lihat daftar preset yang ada di memori ESP32")
    print("   HOME      : Kembalikan semua joint robot ke posisi 0 (HOME)")
    print("   POS       : Lihat posisi sudut joint robot saat ini")
    print("   STATUS    : Cek status robot (IDLE / BUSY)")
    print("   HELP      : Tampilkan bantuan perintah dari ESP32")
    print("   Q / exit  : Keluar dari program pengujian")
    print("=" * 55)


def send_and_read(esp32, cmd_str):
    """Kirim perintah serial ke ESP32 dan baca balasannya secara real-time."""
    if not esp32.is_connected:
        print("❌ ESP32 tidak terhubung!")
        return

    with esp32._lock:
        try:
            # Bersihkan buffer sisa jika ada
            if hasattr(esp32._serial, "reset_output_buffer"):
                esp32._serial.reset_output_buffer()
            
            # Kirim data dengan newline \n
            raw_bytes = f"{cmd_str.strip()}\n".encode("utf-8")
            esp32._serial.write(raw_bytes)
            esp32._serial.flush()

            print(f"📤 Terkirim ke ESP32: repr({raw_bytes})")
            
            # Beri jeda sejenak agar ESP32 sempat merespon
            time.sleep(0.3)

            # Baca semua respon balasan dari ESP32
            response_lines = []
            while esp32._serial.in_waiting > 0:
                line = esp32._serial.readline().decode("utf-8", errors="ignore").strip()
                if line:
                    response_lines.append(line)
                time.sleep(0.05)

            if response_lines:
                print("📥 Balasan ESP32:")
                for l in response_lines:
                    print(f"    🤖 {l}")
            else:
                print("⚠️ (Tidak ada balasan teks dari ESP32)")

        except Exception as e:
            print(f"❌ Error kirim Serial: {e}")


def main():
    print("🔍 Mencari koneksi ESP32 di Port Serial (115200 baud)...")
    
    # Inisialisasi handler
    esp32 = ESP32Handler(port="auto", baud_rate=115200, timeout=1.0)
    
    if not esp32.connect():
        print("❌ Gagal terhubung ke ESP32!")
        print("💡 Pastikan:")
        print("   1. Kabel USB ESP32 sudah terpasang ke laptop/PC.")
        print("   2. Serial Monitor Arduino IDE / PuTTY / Cura SUDAH DITUTUP.")
        sys.exit(1)

    print(f"\n✅ BERHASIL Terhubung ke ESP32 pada Port: {esp32.port} (115200 Baud)")
    
    # Tunggu dan baca pesan boot awal ESP32
    time.sleep(0.5)
    with esp32._lock:
        if esp32._serial and esp32._serial.in_waiting > 0:
            boot_msg = esp32._serial.read(esp32._serial.in_waiting).decode("utf-8", errors="ignore").strip()
            if boot_msg:
                print("📥 Pesan Boot Initial ESP32:")
                for l in boot_msg.splitlines():
                    print(f"    🤖 {l}")

    print_menu()

    while True:
        try:
            user_input = input("\n👉 Masukkan Perintah > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nKeluar...")
            break

        if not user_input:
            continue

        cmd_upper = user_input.upper()

        if cmd_upper in ["Q", "EXIT", "QUIT"]:
            print("👋 Menutup program pengujian...")
            break

        if cmd_upper == "MENU":
            print_menu()
            continue

        if user_input.isdigit() and 1 <= int(user_input) <= 10:
            pid = int(user_input)
            res = esp32.send_preset(pid)
            print(f"ℹ️ {res['message']}")
            continue

        # Eksekusi perintah custom ke ESP32
        send_and_read(esp32, user_input)

    esp32.disconnect()
    print("✅ Koneksi Serial ditutup cleanly.")


if __name__ == "__main__":
    main()
