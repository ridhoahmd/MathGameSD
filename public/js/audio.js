const AudioManager = {
  ctx: null,
  isMuted: false,

  // Siapin Audio Context
  getContext: function () {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  },

  init: function () {
    const ctx = this.getContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  },

  // 1. Bunyi klik tombol
  playClick: function () {
    if (this.isMuted) return;
    const ctx = this.getContext();
    this.init();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  },

  // 2. Bunyi kalo jawab bener
  playCorrect: function () {
    if (this.isMuted) return;
    const ctx = this.getContext();
    this.init();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.1);
    osc.frequency.setValueAtTime(783.99, now + 0.2);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.5);
  },

  // 3. Bunyi kalo jawab salah
  playWrong: function () {
    if (this.isMuted) return;
    const ctx = this.getContext();
    this.init();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.3);
  },

  // 4. Bunyi menang/selesai game
  playWin: function () {
    if (this.isMuted) return;
    this.init();

    this.playTone(523.25, 0, 0.1);
    this.playTone(523.25, 0.15, 0.1);
    this.playTone(783.99, 0.3, 0.4);
  },

  // Fungsi bantu buat mainin nada
  playTone: function (freq, delay, duration) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  },

  // Toggle Mute (Mati/Nyalain suara)
  toggleMute: function () {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  },
};

// Fungsi aman biar ga error kalo audio manager belom keload
window.safePlaySound = function (soundType) {
  try {
    if (typeof AudioManager !== "undefined" && AudioManager[soundType]) {
      AudioManager[soundType]();
    }
  } catch (e) {
    console.warn(`Gagal play audio ${soundType}:`, e.message);
  }
};

// Shortcut biar gampang manggilnya
window.safePlayClick = () => safePlaySound("playClick");
window.safePlayCorrect = () => safePlaySound("playCorrect");
window.safePlayWrong = () => safePlaySound("playWrong");
window.safePlayWin = () => safePlaySound("playWin");
