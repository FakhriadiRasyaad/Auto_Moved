/**
 * gesture_esp32.js  (v3 — robust polling + shared stream)
 * ================================================
 * Deteksi jumlah jari via MediaPipe Hands, kirim ke ESP32 via pywebview.
 *
 * Strategi kamera (urutan prioritas):
 *   1. Cari <video> yang sudah punya stream aktif di halaman (photobooth)
 *   2. Poll setiap 500ms selama 10 detik menunggu video aktif muncul
 *   3. Jika tetap tidak ada, buka stream sendiri via getUserMedia
 *      (WebView2/Chromium izinkan beberapa stream ke kamera yang sama)
 * ================================================
 */
(function () {
  'use strict';

  if (window.__gestureESP32Running) {
    console.log('[GestureESP32] Sudah berjalan, skip.');
    return;
  }
  window.__gestureESP32Running = true;

  /* ── Konfigurasi ────────────────────────────────────── */
  var CFG = {
    sendDebounceMs   : 700,
    statusId         : 'gesture-esp32-status',
    pollIntervalMs   : 500,    // Cek video aktif setiap 500ms
    pollMaxMs        : 12000,  // Coba selama 12 detik
  };

  /* ── State ──────────────────────────────────────────── */
  var lastSentPreset = -1;
  var lastSendTime   = 0;
  var TIPS = [4, 8, 12, 16, 20];
  var PIPS = [3, 6, 10, 14, 18];

  /* ── Hitung jari ────────────────────────────────────── */
  function countFingers(lm) {
    var count = 0;
    var isRight = lm[17].x < lm[5].x;
    if (isRight ? lm[TIPS[0]].x < lm[PIPS[0]].x : lm[TIPS[0]].x > lm[PIPS[0]].x) count++;
    for (var i = 1; i < 5; i++) {
      if (lm[TIPS[i]].y < lm[PIPS[i]].y) count++;
    }
    return count;
  }

  /* ── Status overlay ─────────────────────────────────── */
  function ensureStatus() {
    var el = document.getElementById(CFG.statusId);
    if (!el) {
      el = document.createElement('div');
      el.id = CFG.statusId;
      el.style.cssText = [
        'position:fixed', 'bottom:12px', 'right:12px',
        'background:rgba(0,0,0,0.85)', 'color:#fff',
        'font:bold 11px monospace', 'padding:6px 10px',
        'border-radius:8px', 'z-index:2147483647',
        'pointer-events:none', 'max-width:260px',
        'text-align:center', 'line-height:1.5',
        'box-shadow:0 2px 12px rgba(0,0,0,.6)',
        'border:1px solid rgba(255,255,255,.12)',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  function setStatus(text, color) {
    ensureStatus().textContent = text;
    ensureStatus().style.color = color || '#fff';
    console.log('[GestureESP32]', text);
  }

  /* ── Kirim preset ke Python ─────────────────────────── */
  async function sendPreset(n) {
    var now = Date.now();
    if (n === lastSentPreset && (now - lastSendTime) < CFG.sendDebounceMs) return;
    lastSentPreset = n;
    lastSendTime   = now;

    setStatus('Jari: ' + n + ' → Kirim Preset ' + n, '#ffd700');

    if (!window.pywebview || !window.pywebview.api) {
      setStatus('[DEBUG] Preset ' + n + ' (no pywebview)', '#aaa');
      return;
    }
    try {
      var r = await window.pywebview.api.trigger_esp32(n);
      setStatus(
        r && r.ok ? '✅ Preset ' + n + ' aktif' : '❌ ' + (r ? r.message : 'Gagal'),
        r && r.ok ? '#00e676' : '#ff4d4d'
      );
    } catch (e) {
      console.error('[GestureESP32]', e);
    }
  }

  /* ── Cari <video> aktif (rekursif ke shadow/iframe) ─── */
  function findActiveVideo(root) {
    root = root || document;
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      // Cek srcObject aktif
      if (v.srcObject && v.srcObject instanceof MediaStream && v.srcObject.active) {
        // Pastikan ada video track aktif
        var tracks = v.srcObject.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          console.log('[GestureESP32] Video aktif ditemukan:', v.id || v.className || '(no-id)');
          return v;
        }
      }
    }
    // Cek iframe juga (same-origin saja)
    var frames = root.querySelectorAll('iframe');
    for (var j = 0; j < frames.length; j++) {
      try {
        var found = findActiveVideo(frames[j].contentDocument);
        if (found) return found;
      } catch(e) { /* cross-origin iframe, skip */ }
    }
    return null;
  }

  /* ── Poll sampai ada video aktif, atau timeout ──────── */
  function pollForVideo(timeoutMs) {
    return new Promise(function(resolve) {
      var elapsed = 0;
      var interval = setInterval(function() {
        var v = findActiveVideo();
        if (v) {
          clearInterval(interval);
          resolve(v);
          return;
        }
        elapsed += CFG.pollIntervalMs;
        if (elapsed >= timeoutMs) {
          clearInterval(interval);
          resolve(null);  // timeout — tidak ditemukan
        }
      }, CFG.pollIntervalMs);
    });
  }

  /* ── Buat video sendiri via getUserMedia ────────────── */
  async function openOwnCamera() {
    // Coba dengan constraint minimal dulu
    var constraints = [
      { video: { width: 640, height: 480 }, audio: false },
      { video: true, audio: false },
    ];
    for (var i = 0; i < constraints.length; i++) {
      try {
        var stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        var v = document.createElement('video');
        v.id = 'gesture-hidden-video';
        v.srcObject = stream;
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        // Sembunyikan tapi tetap bisa diproses (opacity 0.01 agar browser tidak pause)
        v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;top:0;left:0;z-index:-1;';
        document.body.appendChild(v);
        await new Promise(function(res, rej) {
          v.onloadedmetadata = res;
          setTimeout(rej, 5000);  // timeout 5 detik
        });
        console.log('[GestureESP32] Berhasil buka kamera sendiri');
        return v;
      } catch (e) {
        console.warn('[GestureESP32] getUserMedia gagal (' + i + '):', e.name, e.message);
      }
    }
    return null;
  }

  /* ── Loop deteksi dengan rAF (tanpa Camera utility) ─── */
  function startDetectionLoop(videoEl, hands) {
    async function loop() {
      if (videoEl.readyState >= 2 && !videoEl.paused && !videoEl.ended) {
        try {
          await hands.send({ image: videoEl });
        } catch (e) { /* skip frame */ }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    console.log('[GestureESP32] Loop deteksi dimulai pada:', videoEl.id || '(no-id)');
  }

  /* ── Inisialisasi utama ─────────────────────────────── */
  async function init() {
    setStatus('⏳ Menginisialisasi gesture...', '#aaa');

    /* 1. Tunggu sebentar agar halaman dan kamera photobooth siap */
    await new Promise(function(r) { setTimeout(r, 1000); });

    /* 2. Cari video yang sudah aktif, atau tunggu sampai 12 detik */
    setStatus('🔍 Mencari stream kamera aktif...', '#aaa');
    var videoEl = findActiveVideo();

    if (!videoEl) {
      setStatus('⏳ Menunggu kamera photobooth aktif...', '#aaa');
      videoEl = await pollForVideo(CFG.pollMaxMs);
    }

    /* 3. Jika masih tidak ada, buat stream sendiri */
    if (!videoEl) {
      setStatus('📷 Membuka kamera untuk gesture...', '#69f0ae');
      videoEl = await openOwnCamera();
    }

    /* 4. Jika benar-benar gagal */
    if (!videoEl) {
      setStatus('❌ Gagal akses kamera. Coba refresh.', '#ff4d4d');
      console.error('[GestureESP32] Tidak bisa mendapatkan sumber video apapun.');
      return;
    }

    /* 5. Inisialisasi MediaPipe Hands */
    setStatus('🤖 Memuat AI gesture...', '#69f0ae');

    var hands = new Hands({
      locateFile: function(f) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + f;
      },
    });

    hands.setOptions({
      maxNumHands            : 1,
      modelComplexity        : 1,
      minDetectionConfidence : 0.7,
      minTrackingConfidence  : 0.5,
    });

    hands.onResults(function(results) {
      if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
        if (lastSentPreset !== -1) {
          lastSentPreset = -1;
          setStatus('🤚 Tidak ada tangan...', '#888');
        }
        return;
      }
      var n = countFingers(results.multiHandLandmarks[0]);
      if (n >= 1 && n <= 10) sendPreset(n);
    });

    /* 6. Mulai loop deteksi */
    startDetectionLoop(videoEl, hands);
    setStatus('🎥 Siap! Tunjukkan jari ke kamera...', '#69f0ae');
  }

  /* ── Start ──────────────────────────────────────────── */
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
