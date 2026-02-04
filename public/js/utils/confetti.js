/**
 * Sistem Confetti - Partikel Keren
 * Buat selebrasi kemenangan atau achievement
 */

class ConfettiSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;
  }

  /**
   * Initialize canvas
   */
  init() {
    if (this.canvas) return;

    this.canvas = document.createElement("canvas");
    this.canvas.id = "confetti-canvas";
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.resize();

    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Confetti Particle Class
   */
  createParticle(options = {}) {
    const {
      x = Math.random() * this.canvas.width,
      y = Math.random() * this.canvas.height * 0.5,
      color = this.randomColor(),
      shape = Math.random() > 0.5 ? "square" : "circle",
    } = options;

    return {
      x,
      y,
      size: Math.random() * 8 + 4,
      color,
      shape,
      velocityX: (Math.random() - 0.5) * 3,
      velocityY: Math.random() * -3 - 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.08,
      opacity: 1,
      life: 1,
    };
  }

  randomColor() {
    const colors = [
      "#00f2ff", // Cyan
      "#ff006e", // Pink
      "#ffbe0b", // Yellow
      "#8338ec", // Purple
      "#3a86ff", // Blue
      "#fb5607", // Orange
      "#06ffa5", // Green
      "#ff006e", // Magenta
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Burst effect - particles from center
   */
  burst(options = {}) {
    this.init();

    const {
      particleCount = 100,
      spread = 60,
      origin = { x: 0.5, y: 0.5 },
      velocity = 10,
      colors = null,
    } = options;

    const centerX = this.canvas.width * origin.x;
    const centerY = this.canvas.height * origin.y;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
      const speed = Math.random() * velocity + velocity * 0.5;

      const particle = this.createParticle({
        x: centerX,
        y: centerY,
        color: colors
          ? colors[Math.floor(Math.random() * colors.length)]
          : undefined,
      });

      particle.velocityX = Math.sin(angle + Math.PI / 2) * speed;
      particle.velocityY = Math.cos(angle + Math.PI / 2) * speed * -1;

      this.particles.push(particle);
    }

    if (!this.isRunning) {
      this.startAnimation();
    }
  }

  /**
   * Cannon effect - particles from sides
   */
  cannon(options = {}) {
    this.init();

    const {
      particleCount = 50,
      angle = 60,
      origin = { x: 0.5, y: 0.8 },
      velocity = 12,
    } = options;

    const startX = this.canvas.width * origin.x;
    const startY = this.canvas.height * origin.y;

    for (let i = 0; i < particleCount; i++) {
      const spread = 40;
      const particleAngle =
        (angle + (Math.random() * spread - spread / 2)) * (Math.PI / 180);
      const speed = Math.random() * velocity + velocity * 0.5;

      const particle = this.createParticle({
        x: startX,
        y: startY,
      });

      particle.velocityX = Math.cos(particleAngle) * speed;
      particle.velocityY = Math.sin(particleAngle) * speed * -1;

      this.particles.push(particle);
    }

    if (!this.isRunning) {
      this.startAnimation();
    }
  }

  /**
   * Shower effect - particles from top
   */
  shower(options = {}) {
    this.init();

    const { particleCount = 80, startVelocity = 20 } = options;

    for (let i = 0; i < particleCount; i++) {
      const particle = this.createParticle({
        x: Math.random() * this.canvas.width,
        y: -20,
      });

      particle.velocityY = Math.random() * startVelocity + 2;
      particle.velocityX = (Math.random() - 0.5) * 4;

      this.particles.push(particle);
    }

    if (!this.isRunning) {
      this.startAnimation();
    }
  }

  /**
   * School Pride - Confetti with specific colors
   */
  schoolPride(colors = ["#00f2ff", "#8338ec", "#ffbe0b"]) {
    this.burst({
      particleCount: 150,
      spread: 120,
      origin: { x: 0.5, y: 0.5 },
      velocity: 15,
      colors,
    });
  }

  /**
   * Victory celebration
   */
  victory() {
    // Double cannon from both sides
    setTimeout(() => {
      this.cannon({
        origin: { x: 0.1, y: 0.9 },
        angle: 60,
        particleCount: 60,
      });
    }, 0);

    setTimeout(() => {
      this.cannon({
        origin: { x: 0.9, y: 0.9 },
        angle: 120,
        particleCount: 60,
      });
    }, 150);

    setTimeout(() => {
      this.burst({
        particleCount: 100,
        spread: 90,
        origin: { x: 0.5, y: 0.4 },
      });
    }, 300);
  }

  /**
   * Update particles
   */
  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.velocityY += p.gravity;
      p.x += p.velocityX;
      p.y += p.velocityY;
      p.rotation += p.rotationSpeed;

      // Fade out
      p.life -= 0.008;
      p.opacity = Math.max(0, p.life);

      // Remove if off-screen or faded
      if (p.y > this.canvas.height || p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw particle
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;

      if (p.shape === "circle") {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      this.ctx.restore();
    }
  }

  /**
   * Start animation loop
   */
  startAnimation() {
    this.isRunning = true;

    const animate = () => {
      this.update();

      if (this.particles.length > 0) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.stopAnimation();
      }
    };

    animate();
  }

  /**
   * Stop animation
   */
  stopAnimation() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
    this.stopAnimation();
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clear();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}

// Create global instance
const confetti = new ConfettiSystem();

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = confetti;
}
