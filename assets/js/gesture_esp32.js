/**
 * gesture_esp32.js (v4 — Canvas Landmark Drawing Overlay + Multi-hand Finger Count)
 * =========================================================================
 * Deteksi jari & visualisasi garis-garis di tangan (hand landmarks) via MediaPipe.
 * Mengirim preset (1-10) ke Python/ESP32 via pywebview.api.trigger_esp32(n).
 */
(function () {
  'use strict';

  if (window.__gestureESP32Running) return;
  window.__gestureESP32Running = true;

  var CFG = {
    sendDebounceMs: 600,
    statusId: 'gesture-esp32-status',
    pollIntervalMs: 400,
    pollMaxMs: 15000,
  };

  var lastSentPreset = -1;
  var lastSendTime = 0;

  var TIPS = [4, 8, 12, 16, 20];
  var PIPS = [3, 6, 10, 14, 18];

  var HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],        // Ibu jari
    [0, 5], [5, 6], [6, 7], [7, 8],        // Telunjuk
    [5, 9], [9, 10], [10, 11], [11, 12],   // Jari tengah
    [9, 13], [13, 14], [14, 15], [15, 16], // Jari manis
    [13, 17], [17, 18], [18, 19], [19, 20],// Kelingking
    [0, 17], [5, 9], [9, 13], [13, 17]     // Telapak tangan
  ];

  /* ── Load MediaPipe Script CDN jika belum ada ────────────────────────────── */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureMediaPipeLoaded() {
    if (typeof window.Hands === 'function') return true;
    try {
      console.log('[GestureESP32] Memuat MediaPipe Hands dari CDN...');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      return typeof window.Hands === 'function';
    } catch (e) {
      console.error('[GestureESP32] Gagal memuat script MediaPipe CDN:', e);
      return false;
    }
  }

  /* ── Status Overlay Box ─────────────────────────────────────────────────── */
  function ensureStatus() {
    var el = document.getElementById(CFG.statusId);
    if (!el) {
      el = document.createElement('div');
      el.id = CFG.statusId;
      el.style.cssText = [
        'position:fixed', 'bottom:14px', 'right:14px',
        'background:rgba(15,23,42,0.92)', 'color:#fff',
        'font:bold 12px/1.4 system-ui, -apple-system, sans-serif',
        'padding:8px 14px', 'border-radius:10px', 'z-index:2147483647',
        'pointer-events:none', 'max-width:280px', 'text-align:center',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
        'border:1px solid rgba(255,255,255,0.15)',
        'backdrop-filter:blur(6px)'
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  function setStatus(text, color) {
    var el = ensureStatus();
    el.textContent = text;
    el.style.color = color || '#fff';
  }

  /* ── Hitung Jari ────────────────────────────────────────────────────────── */
  function countFingersSingleHand(lm) {
    var count = 0;
    var isRight = lm[17].x < lm[5].x;
    if (isRight ? lm[TIPS[0]].x < lm[PIPS[0]].x : lm[TIPS[0]].x > lm[PIPS[0]].x) count++;
    for (var i = 1; i < 5; i++) {
      if (lm[TIPS[i]].y < lm[PIPS[i]].y) count++;
    }
    return count;
  }

  /* ── Kirim Preset ke Python ─────────────────────────────────────────────── */
  async function sendPreset(n) {
    var now = Date.now();
    if (n === lastSentPreset && (now - lastSendTime) < CFG.sendDebounceMs) return;
    lastSentPreset = n;
    lastSendTime = now;

    setStatus('🖐️ Jari: ' + n + ' → Kirim Preset ' + n, '#ffd700');

    if (!window.pywebview || !window.pywebview.api) {
      setStatus('🖐️ Preset ' + n + ' (pywebview tidak ada)', '#aaa');
      return;
    }
    try {
      var r = await window.pywebview.api.trigger_esp32(n);
      setStatus(
        r && r.ok ? '✅ Preset ' + n + ' Aktif di ESP32' : '❌ Gagal: ' + (r ? r.message : 'Error'),
        r && r.ok ? '#00e676' : '#ff4d4d'
      );
    } catch (e) {
      console.error('[GestureESP32] Error trigger:', e);
    }
  }

  /* ── Overlay Canvas & Visualisasi Garis-Garis Tangan ───────────────────── */
  var canvasEl = null;
  var ctx = null;

  function ensureCanvas(videoEl) {
    if (!canvasEl || !document.body.contains(canvasEl)) {
      canvasEl = document.createElement('canvas');
      canvasEl.id = 'gesture-landmark-canvas';
      canvasEl.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:9999999',
        'top:0',
        'left:0'
      ].join(';');
      document.body.appendChild(canvasEl);
      ctx = canvasEl.getContext('2d');
    }

    var rect = videoEl.getBoundingClientRect();
    if (canvasEl.width !== rect.width || canvasEl.height !== rect.height) {
      canvasEl.width = rect.width;
      canvasEl.height = rect.height;
    }
    canvasEl.style.top = rect.top + 'px';
    canvasEl.style.left = rect.left + 'px';
    canvasEl.style.width = rect.width + 'px';
    canvasEl.style.height = rect.height + 'px';

    return { ctx: ctx, rect: rect, width: rect.width, height: rect.height };
  }

  function drawLandmarksAndConnections(multiLandmarks, videoEl, totalFingers) {
    var cInfo = ensureCanvas(videoEl);
    if (!cInfo) return;
    var c = cInfo.ctx;
    var w = cInfo.width;
    var h = cInfo.height;

    c.clearRect(0, 0, w, h);

    if (!multiLandmarks || !multiLandmarks.length) return;

    for (var hIdx = 0; hIdx < multiLandmarks.length; hIdx++) {
      var landmarks = multiLandmarks[hIdx];

      // 1. Gambar Garis-garis Sendi Tangan (Bones)
      c.strokeStyle = '#00FF88';
      c.lineWidth = 3.5;
      c.lineCap = 'round';
      c.lineJoin = 'round';

      for (var i = 0; i < HAND_CONNECTIONS.length; i++) {
        var pair = HAND_CONNECTIONS[i];
        var p1 = landmarks[pair[0]];
        var p2 = landmarks[pair[1]];

        c.beginPath();
        c.moveTo(p1.x * w, p1.y * h);
        c.lineTo(p2.x * w, p2.y * h);
        c.stroke();
      }

      // 2. Gambar Titik Landmark Sendi (Joints)
      for (var j = 0; j < landmarks.length; j++) {
        var lm = landmarks[j];
        var isTip = (j === 4 || j === 8 || j === 12 || j === 16 || j === 20);

        c.beginPath();
        c.arc(lm.x * w, lm.y * h, isTip ? 6 : 4, 0, 2 * Math.PI);
        c.fillStyle = isTip ? '#FFD700' : '#FF3366';
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = '#FFFFFF';
        c.stroke();
      }
    }

    // 3. Gambar Badge Informasi Deteksi Jari di Pojok Kiri Atas Video
    c.fillStyle = 'rgba(15, 23, 42, 0.85)';
    if (typeof c.roundRect === 'function') {
      c.beginPath();
      c.roundRect(14, 14, 210, 44, 10);
      c.fill();
    } else {
      c.fillRect(14, 14, 210, 44);
    }
    c.strokeStyle = '#00FF88';
    c.lineWidth = 1.5;
    c.stroke();

    c.fillStyle = '#00FF88';
    c.font = 'bold 16px system-ui, sans-serif';
    c.fillText('🖐️ Jari: ' + totalFingers + ' (Preset ' + totalFingers + ')', 26, 42);
  }

  /* ── Cari <video> Aktif di Halaman Web ──────────────────────────────────── */
  function findActiveVideo(root) {
    root = root || document;
    var videos = root.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.srcObject && v.srcObject instanceof MediaStream && v.srcObject.active) {
        var tracks = v.srcObject.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          return v;
        }
      }
      if (v.readyState >= 2 && !v.paused && v.videoWidth > 0) {
        return v;
      }
    }
    var frames = root.querySelectorAll('iframe');
    for (var j = 0; j < frames.length; j++) {
      try {
        var found = findActiveVideo(frames[j].contentDocument);
        if (found) return found;
      } catch (e) {}
    }
    return null;
  }

  function pollForVideo(timeoutMs) {
    return new Promise(function (resolve) {
      var elapsed = 0;
      var interval = setInterval(function () {
        var v = findActiveVideo();
        if (v) {
          clearInterval(interval);
          resolve(v);
          return;
        }
        elapsed += CFG.pollIntervalMs;
        if (elapsed >= timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, CFG.pollIntervalMs);
    });
  }

  async function openOwnCamera() {
    var constraints = [
      { video: { width: 640, height: 480 }, audio: false },
      { video: true, audio: false }
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
        v.style.cssText = 'position:fixed;width:320px;height:240px;bottom:10px;left:10px;z-index:9999;border:2px solid #00ff88;border-radius:8px;';
        document.body.appendChild(v);
        await new Promise(function (res) {
          v.onloadedmetadata = res;
          setTimeout(res, 3000);
        });
        return v;
      } catch (e) {}
    }
    return null;
  }

  function startDetectionLoop(videoEl, hands) {
    var isProcessing = false;
    async function loop() {
      if (!isProcessing && videoEl.readyState >= 2 && !videoEl.paused && !videoEl.ended) {
        isProcessing = true;
        try {
          await hands.send({ image: videoEl });
        } catch (e) {}
        isProcessing = false;
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    console.log('[GestureESP32] Loop deteksi & garis tangan aktif!');
  }

  async function init() {
    setStatus('⏳ Memuat gesture AI & MediaPipe...', '#aaa');

    var loaded = await ensureMediaPipeLoaded();
    if (!loaded) {
      setStatus('❌ Gagal memuat MediaPipe AI', '#ff4d4d');
      return;
    }

    setStatus('🔍 Mencari kamera...', '#aaa');
    var videoEl = findActiveVideo();
    if (!videoEl) {
      videoEl = await pollForVideo(CFG.pollMaxMs);
    }
    if (!videoEl) {
      setStatus('📷 Membuka kamera gesture...', '#69f0ae');
      videoEl = await openOwnCamera();
    }
    if (!videoEl) {
      setStatus('❌ Kamera tidak ditemukan', '#ff4d4d');
      return;
    }

    setStatus('🤖 Inisialisasi MediaPipe Hands...', '#69f0ae');
    var hands = new window.Hands({
      locateFile: function (f) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + f;
      }
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.5
    });

    hands.onResults(function (results) {
      if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
        if (lastSentPreset !== -1) {
          lastSentPreset = -1;
          setStatus('🤚 Arahkan tangan ke kamera...', '#aaa');
        }
        if (canvasEl && ctx) {
          var rect = videoEl.getBoundingClientRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
        return;
      }

      var totalFingers = 0;
      for (var h = 0; h < results.multiHandLandmarks.length; h++) {
        totalFingers += countFingersSingleHand(results.multiHandLandmarks[h]);
      }

      // 1. Visualisasikan garis-garis di tangan ke canvas overlay
      drawLandmarksAndConnections(results.multiHandLandmarks, videoEl, totalFingers);

      // 2. Kirim sinyal preset ke Python & ESP32 jika 1-10
      if (totalFingers >= 1 && totalFingers <= 10) {
        sendPreset(totalFingers);
      }
    });

    startDetectionLoop(videoEl, hands);
    setStatus('🎥 Siap! Tunjukkan jari ke kamera', '#00e676');
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
