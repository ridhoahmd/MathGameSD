/**
 * Animasi Utility
 * Kumpulan fungsi animasi biar smooth
 */

const AnimationUtils = {
  /**
   * Animasi angka (counter)
   * @param {HTMLElement} element - Target elemen
   * @param {number} start - Mulai dari
   * @param {number} end - Sampai ke
   * @param {number} duration - Durasi ms
   * @param {string} prefix - Awalan (opsional)
   * @param {string} suffix - Akhiran (opsional)
   */
  animateCounter(
    element,
    start,
    end,
    duration = 1000,
    prefix = "",
    suffix = "",
  ) {
    if (!element) return;

    const range = end - start;
    const startTime = performance.now();

    const easeOutQuad = (t) => t * (2 - t);

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);

      const current = Math.floor(start + range * easedProgress);
      element.textContent = prefix + current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = prefix + end.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(updateCounter);
  },

  /**
   * Tambah kelas sementara
   * @param {HTMLElement} element
   * @param {string} className
   * @param {number} duration
   */
  addTempClass(element, className, duration = 300) {
    if (!element) return;

    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  },

  /**
   * Tampilkan efek nambah poin (+10)
   * @param {HTMLElement} container - Elemen pembungkus
   * @param {number} points - Jumlah poin
   * @param {object} options - Opsi posisi
   */
  showScoreIncrement(container, points, options = {}) {
    const {
      x = container.offsetWidth / 2,
      y = container.offsetHeight / 2,
      color = "#00ff88",
      duration = 1000,
    } = options;

    const incrementEl = document.createElement("div");
    incrementEl.className = "score-increment";
    incrementEl.textContent = `+${points}`;
    incrementEl.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      color: ${color};
      font-size: 1.5rem;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000;
    `;

    container.style.position = "relative";
    container.appendChild(incrementEl);

    setTimeout(() => {
      incrementEl.remove();
    }, duration);
  },

  /**
   * Efek riak air pas klik
   * @param {Event} event - Event click
   * @param {HTMLElement} element - Target
   */
  createRipple(event, element) {
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ripple = document.createElement("span");
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: ripple-animation 0.6s ease-out;
    `;

    element.style.position = "relative";
    element.style.overflow = "hidden";
    element.appendChild(ripple);

    ripple.addEventListener("animationend", () => {
      ripple.remove();
    });
  },

  /**
   * Scroll halus ke elemen
   * @param {string|HTMLElement} target
   * @param {number} offset
   */
  scrollTo(target, offset = 0) {
    const element =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!element) return;

    const top =
      element.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top,
      behavior: "smooth",
    });
  },

  /**
   * Animasi berurutan (stagger)
   * @param {NodeList|Array} elements
   * @param {string} className
   * @param {number} delay
   */
  staggerAnimation(elements, className, delay = 100) {
    elements.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add(className);
      }, index * delay);
    });
  },

  /**
   * Efek goyang (untuk error)
   * @param {HTMLElement} element
   */
  shake(element) {
    if (!element) return;
    this.addTempClass(element, "shake", 500);
  },

  /**
   * Efek membal
   * @param {HTMLElement} element
   */
  bounce(element) {
    if (!element) return;
    this.addTempClass(element, "bounce", 600);
  },

  /**
   * Efek denyut
   * @param {HTMLElement} element
   * @param {string} type - 'success' or 'error'
   */
  pulse(element, type = "success") {
    if (!element) return;
    const className = type === "success" ? "success-pulse" : "error-pulse";
    this.addTempClass(element, className, 500);
  },

  /**
   * Fade in
   * @param {HTMLElement} element
   * @param {number} duration
   */
  fadeIn(element, duration = 300) {
    if (!element) return;

    element.style.opacity = "0";
    element.style.display = "block";

    let opacity = 0;
    const interval = 16; // ~60fps
    const increment = interval / duration;

    const fade = setInterval(() => {
      opacity += increment;
      element.style.opacity = Math.min(opacity, 1);

      if (opacity >= 1) {
        clearInterval(fade);
      }
    }, interval);
  },

  /**
   * Fade out
   * @param {HTMLElement} element
   * @param {number} duration
   * @param {Function} callback
   */
  fadeOut(element, duration = 300, callback) {
    if (!element) return;

    let opacity = 1;
    const interval = 16;
    const decrement = interval / duration;

    const fade = setInterval(() => {
      opacity -= decrement;
      element.style.opacity = Math.max(opacity, 0);

      if (opacity <= 0) {
        clearInterval(fade);
        element.style.display = "none";
        if (callback) callback();
      }
    }, interval);
  },

  /**
   * Indikator ngetik
   * @returns {HTMLElement}
   */
  createTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";
    return indicator;
  },

  /**
   * Tooltip sederhana
   * @param {HTMLElement} element
   * @param {string} text
   * @param {number} duration
   */
  showTooltip(element, text, duration = 2000) {
    if (!element) return;

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip show";
    tooltip.textContent = text;

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 35}px`;
    tooltip.style.transform = "translateX(-50%)";

    document.body.appendChild(tooltip);

    if (duration > 0) {
      setTimeout(() => {
        tooltip.classList.remove("show");
        setTimeout(() => tooltip.remove(), 150);
      }, duration);
    }

    return tooltip;
  },

  /**
   * Debounce function
   * @param {Function} func
   * @param {number} wait
   * @returns {Function}
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   * @param {Function} func
   * @param {number} limit
   * @returns {Function}
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Cek elemen masuk layar
   * @param {HTMLElement} element
   * @param {number} offset
   * @returns {boolean}
   */
  isInViewport(element, offset = 0) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top >= -offset &&
      rect.left >= -offset &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) +
          offset &&
      rect.right <=
        (window.innerWidth || document.documentElement.clientWidth) + offset
    );
  },

  /**
   * Animasi pas scroll
   * @param {string} selector
   * @param {string} className
   * @param {object} options
   */
  animateOnScroll(selector, className = "animate-fadeInUp", options = {}) {
    const elements = document.querySelectorAll(selector);

    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
      ...options,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(className);
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    elements.forEach((el) => observer.observe(el));

    return observer;
  },
};

// Make it globally available
if (typeof window !== "undefined") {
  window.AnimationUtils = AnimationUtils;
}

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = AnimationUtils;
}
