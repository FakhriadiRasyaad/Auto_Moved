# -*- coding: utf-8 -*-
"""
gesture_detector.py
Deteksi gesture jari menggunakan OpenCV + MediaPipe Hands.
Berjalan di thread terpisah - tidak konflik dengan kamera browser.
pip install opencv-python mediapipe
"""

import threading
import time
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


class GestureDetector:
    TIPS = [4, 8, 12, 16, 20]
    PIPS = [3, 6, 10, 14, 18]

    def __init__(self, esp32_handler=None, camera_index=0, debounce_ms=700, show_preview=True):
        self.esp32        = esp32_handler
        self.camera_index = camera_index
        self.debounce_ms  = debounce_ms
        self.show_preview = show_preview
        self._running     = False
        self._thread      = None
        self._last_preset = -1
        self._last_ms     = 0

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._run, daemon=True, name="GestureDetector")
        self._thread.start()
        print("[GESTURE] Thread deteksi dimulai", flush=True)

    def stop(self):
        self._running = False

    def _count_fingers(self, lm):
        count = 0
        is_right = lm[17].x < lm[5].x
        if is_right:
            if lm[self.TIPS[0]].x < lm[self.PIPS[0]].x:
                count += 1
        else:
            if lm[self.TIPS[0]].x > lm[self.PIPS[0]].x:
                count += 1
        for i in range(1, 5):
            if lm[self.TIPS[i]].y < lm[self.PIPS[i]].y:
                count += 1
        return count

    def _send_preset(self, preset):
        now = time.time() * 1000
        if preset == self._last_preset and (now - self._last_ms) < self.debounce_ms:
            return
        self._last_preset = preset
        self._last_ms     = now

        bar = "#" * preset + "." * (10 - preset)
        print(f"\n[GESTURE] Jari: {preset:>2}  [{bar}]", flush=True)
        print(f"          --> PRESET {preset} AKTIF", flush=True)

        if self.esp32 and self.esp32.is_connected:
            result = self.esp32.send_preset(preset)
            print(f"          [SERIAL] {'OK' if result['ok'] else 'GAGAL: ' + result['message']}", flush=True)
        else:
            print(f"          [DEBUG] ESP32 tidak terhubung - simulasi saja", flush=True)

    def _find_camera(self):
        try:
            import cv2
        except ImportError:
            print("[GESTURE] ERROR: opencv-python tidak terinstall!", flush=True)
            print("[GESTURE] Jalankan: py -m pip install opencv-python", flush=True)
            return None

        for idx in ([self.camera_index] + [i for i in range(4) if i != self.camera_index]):
            try:
                cap = cv2.VideoCapture(idx)
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        print(f"[GESTURE] Kamera OpenCV ditemukan di index {idx}", flush=True)
                        self.camera_index = idx
                        return cap
                    cap.release()
            except Exception:
                pass

        print("[GESTURE] Kamera OpenCV tidak dapat dibuka langsung (sedang dipakai Browser).", flush=True)
        print("[GESTURE] → Deteksi gesture & garis-garis di tangan otomatis aktif di Web Overlay Browser.", flush=True)
        return None

    def _run(self):
        try:
            import cv2
            import mediapipe as mp
        except ImportError as e:
            print(f"[GESTURE] ERROR: {e}", flush=True)
            print("[GESTURE] Jalankan: py -m pip install opencv-python mediapipe", flush=True)
            return

        cap = self._find_camera()
        if cap is None:
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        mp_hands = mp.solutions.hands
        mp_draw  = mp.solutions.drawing_utils

        print("[GESTURE] Siap! Tunjukkan jari ke kamera.", flush=True)
        print("[GESTURE] Tekan Q di jendela preview untuk keluar.", flush=True)

        with mp_hands.Hands(
            max_num_hands=1, model_complexity=1,
            min_detection_confidence=0.7, min_tracking_confidence=0.5
        ) as hands:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue

                frame   = cv2.flip(frame, 1)
                rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb)

                label = "Tunjukkan jari..."
                color = (0, 180, 255)

                if results.multi_hand_landmarks:
                    for lm in results.multi_hand_landmarks:
                        mp_draw.draw_landmarks(frame, lm, mp_hands.HAND_CONNECTIONS)
                        n = self._count_fingers(lm.landmark)
                        if 1 <= n <= 10:
                            self._send_preset(n)
                            label = f"PRESET: {n}"
                            color = (0, 255, 0)
                else:
                    if self._last_preset != -1:
                        self._last_preset = -1

                if self.show_preview:
                    cv2.putText(frame, label, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 2.0, color, 4)
                    esp_status = "ESP32: " + ("TERHUBUNG" if (self.esp32 and self.esp32.is_connected) else "DEBUG MODE")
                    cv2.putText(frame, esp_status, (10, frame.shape[0] - 15),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 1)
                    cv2.imshow("Gesture ESP32 [Q=keluar]", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        self._running = False
                        break

        cap.release()
        if self.show_preview:
            cv2.destroyAllWindows()
        print("[GESTURE] Kamera ditutup.", flush=True)
