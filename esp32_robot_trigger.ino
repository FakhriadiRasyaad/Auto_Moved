/*
 * esp32_robot_trigger.ino
 * ================================================
 * Sketch Arduino untuk ESP32
 * Menerima angka preset dari Python via Serial USB,
 * lalu mengaktifkan gerakan robot sesuai preset.
 *
 * Protokol dari Python:
 *   - Terima string angka diikuti newline: "1\n", "2\n", dst.
 *   - Preset 1  = 1 jari (gerakkan robot ke posisi A)
 *   - Preset 2  = 2 jari (gerakkan robot ke posisi B)
 *   - dst. sampai preset 10
 *
 * Koneksi Hardware (contoh dengan relay/motor driver):
 *   - Pin OUTPUT_PIN_1  → Trigger gerakan robot preset 1
 *   - Pin OUTPUT_PIN_2  → Trigger gerakan robot preset 2
 *   - (sesuaikan dengan wiring Anda)
 *
 * Upload ke ESP32 dengan:
 *   - Board: ESP32 Dev Module
 *   - Baud Rate: 9600 (harus sama dengan ESP32_BAUD_RATE di app.py)
 * ================================================
 */

// ── Pin Output ke Driver Robot ─────────────────────────────
// Sesuaikan nomor pin dengan wiring ESP32 Anda
const int OUTPUT_PINS[] = {
  -1,   // index 0 (tidak dipakai)
  2,    // Preset 1 → GPIO 2
  4,    // Preset 2 → GPIO 4
  5,    // Preset 3 → GPIO 5
  18,   // Preset 4 → GPIO 18
  19,   // Preset 5 → GPIO 19
  21,   // Preset 6 → GPIO 21
  22,   // Preset 7 → GPIO 22
  23,   // Preset 8 → GPIO 23
  25,   // Preset 9 → GPIO 25
  26,   // Preset 10 → GPIO 26
};
const int NUM_PRESETS = 10;

// Durasi sinyal HIGH dalam milidetik (sesuaikan dengan kebutuhan robot)
const int PULSE_DURATION_MS = 500;

// Variabel untuk buffer Serial
String receivedData = "";
int currentPreset = 0;

// ── Setup ──────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);

  // Set semua pin output ke LOW (idle)
  for (int i = 1; i <= NUM_PRESETS; i++) {
    pinMode(OUTPUT_PINS[i], OUTPUT);
    digitalWrite(OUTPUT_PINS[i], LOW);
  }

  Serial.println("ESP32 Robot Trigger Ready");
  Serial.println("Menunggu perintah preset dari Python...");
}

// ── Loop Utama ─────────────────────────────────────────────
void loop() {
  // Baca data dari Serial (dikirim oleh Python)
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\n') {
      // Proses string yang sudah diterima
      receivedData.trim();
      if (receivedData.length() > 0) {
        int preset = receivedData.toInt();
        if (preset >= 1 && preset <= NUM_PRESETS) {
          activatePreset(preset);
        } else {
          Serial.println("ERROR: Preset tidak valid: " + receivedData);
        }
      }
      receivedData = ""; // Reset buffer
    } else {
      receivedData += c; // Tambah karakter ke buffer
    }
  }
}

// ── Fungsi Aktifkan Preset ─────────────────────────────────
void activatePreset(int preset) {
  // Matikan semua output dulu (reset state)
  for (int i = 1; i <= NUM_PRESETS; i++) {
    digitalWrite(OUTPUT_PINS[i], LOW);
  }

  // Aktifkan output untuk preset yang dipilih
  int pin = OUTPUT_PINS[preset];
  digitalWrite(pin, HIGH);

  Serial.print("Preset ");
  Serial.print(preset);
  Serial.print(" aktif → GPIO ");
  Serial.println(pin);

  // Delay sesuai durasi pulse (bisa dihilangkan jika ingin sinyal terus menyala)
  // Uncomment baris di bawah jika ingin sinyal hanya HIGH sementara:
  // delay(PULSE_DURATION_MS);
  // digitalWrite(pin, LOW);

  currentPreset = preset;
}
