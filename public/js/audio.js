const AudioManager = {
  ctx: new (window.AudioContext || window.webkitAudioContext)(),
  isMuted: false,

  //inisialisasi
  init: function () {
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  // 1.suaro klik
  playClick: function () {
    if (this.isMuted) return;
    this.init();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  },

  // 2suara kalo bener
  playCorrect: function () {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.1);
    osc.frequency.setValueAtTime(783.99, now + 0.2);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.5);
  },

  // 3suara klo salah
  playWrong: function () {
    if (this.isMuted) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.3);
  },

  // 4.surara menang/selesai
  playWin: function () {
    if (this.isMuted) return;
    this.init();

    this.playTone(523.25, 0, 0.1);
    this.playTone(523.25, 0.15, 0.1);
    this.playTone(783.99, 0.3, 0.4);
  },

  // Helper untuk nada kustom
  playTone: function (freq, delay, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(
      0,
      this.ctx.currentTime + delay + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration);
  },

  // Toggle Mute
  toggleMute: function () {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  },
};
