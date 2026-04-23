/**
 * Particle Effects System
 * Sistem partikel berbasis Canvas untuk visual feedback yang engaging
 */

class ParticleEffects {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
    this.init();
  }

  init() {
    // Buat canvas overlay
    if (!document.getElementById("particle-canvas")) {
      this.canvas = document.createElement("canvas");
      this.canvas.id = "particle-canvas";
      this.canvas.style.position = "fixed";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.pointerEvents = "none";
      this.canvas.style.zIndex = "9998"; // Di bawah combo display
      document.body.appendChild(this.canvas);

      this.ctx = this.canvas.getContext("2d");
      this.resize();

      // Handle resize
      window.addEventListener("resize", () => this.resize());
    } else {
      this.canvas = document.getElementById("particle-canvas");
      this.ctx = this.canvas.getContext("2d");
    }

    // Start animation loop
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Create particle
  createParticle(x, y, options = {}) {
    const defaults = {
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 3,
      gravity: 0.3,
      size: Math.random() * 6 + 3,
      color: `hsl(${Math.random() * 60 + 100}, 100%, 60%)`,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.01,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    };

    return { x, y, ...defaults, ...options };
  }

  // Burst effect (untuk jawaban benar)
  burst(x, y, count = 30, color = null) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 5 + 3;

      const particle = this.createParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color:
          color ||
          `hsl(${Math.random() * 60 + 100}, 100%, ${50 + Math.random() * 30}%)`,
        size: Math.random() * 8 + 4,
      });

      this.particles.push(particle);
    }
  }

  // Combo effect (untuk combo streak)
  comboEffect(x, y, intensity = 1) {
    const count = Math.floor(20 * intensity);
    const colors = [
      "#00e676", // Green
      "#ffd600", // Gold
      "#ff1744", // Red
      "#00f2ff", // Cyan
      "#ff00ff", // Magenta
    ];

    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];

      const particle = this.createParticle(x, y, {
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 5,
        color: color,
        size: Math.random() * 10 + 5,
        gravity: 0.2,
        decay: 0.015,
      });

      this.particles.push(particle);
    }
  }

  // Confetti rain (untuk milestone combo)
  confettiRain(count = 50) {
    const colors = ["#00e676", "#ffd600", "#ff1744", "#00f2ff", "#ff00ff"];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvas.width;
      const y = -20;

      const particle = this.createParticle(x, y, {
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 3 + 2,
        gravity: 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        decay: 0.005,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
      });

      this.particles.push(particle);
    }
  }

  // Update dan render particles
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update physics
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Render
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      // Draw as rounded rectangle (confetti-like)
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

      this.ctx.restore();
    }

    // Continue animation
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  // Get card center position
  getCardPosition() {
    const cardElement = document.getElementById("card");
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // Trigger effect dari kartu
  triggerFromCard(type = "burst", intensity = 1) {
    const pos = this.getCardPosition();

    switch (type) {
      case "burst":
        this.burst(pos.x, pos.y, 30);
        break;
      case "combo":
        this.comboEffect(pos.x, pos.y, intensity);
        break;
      case "confetti":
        this.confettiRain(50);
        break;
    }
  }

  // Cleanup
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.particles = [];
  }
}

// Create global instance
// FIX: Constructor sudah memanggil this.init() secara internal.
// Blok DOMContentLoaded di bawah ini DIHAPUS untuk mencegah:
// 1. Loop requestAnimationFrame ganda (dua rAF loop jalan bersamaan)
// 2. Potensi canvas overlay duplikat jika getElementById gagal race condition
const ParticleManager = new ParticleEffects();
