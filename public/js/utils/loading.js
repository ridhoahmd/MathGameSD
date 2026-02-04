/**
 * Loading Manager
 * Biar loading gak sepi-sepi banget
 */

class LoadingManager {
  constructor() {
    this.overlay = null;
    this.init();
  }

  init() {
    // Buat overlay kalau belum ada
    if (!document.getElementById("global-loading-overlay")) {
      this.overlay = this.createOverlay();
      document.body.appendChild(this.overlay);
    } else {
      this.overlay = document.getElementById("global-loading-overlay");
    }
  }

  createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "global-loading-overlay";
    overlay.className = "loading-overlay";
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner-dual"></div>
        <div class="loading-text loading-dots">Loading</div>
      </div>
    `;
    return overlay;
  }

  /**
   * Tampilkan overlay dengan pesan
   * @param {string} message - Pesan loading
   */
  show(message = "Loading") {
    if (this.overlay) {
      const textEl = this.overlay.querySelector(".loading-text");
      if (textEl) textEl.textContent = message;

      this.overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  /**
   * Sembunyikan overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  /**
   * Tampilkan loading pakai waktu
   * @param {string} message
   * @param {number} duration - milidetik
   */
  showTimed(message = "Loading", duration = 2000) {
    this.show(message);
    setTimeout(() => this.hide(), duration);
  }

  /**
   * Bikin elemen spinner
   * @param {string} size - 'sm', 'md', 'lg'
   * @returns {HTMLElement}
   */
  createSpinner(size = "md") {
    const spinner = document.createElement("div");
    spinner.className = `spinner ${size === "lg" ? "spinner-lg" : size === "sm" ? "spinner-sm" : ""}`;
    return spinner;
  }

  /**
   * Bikin progress bar
   * @param {number} value - 0 to 100
   * @returns {Object} - { container, update }
   */
  createProgressBar(value = 0) {
    const container = document.createElement("div");
    container.className = "progress-bar-container";

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.style.width = `${value}%`;

    container.appendChild(bar);

    return {
      element: container,
      update: (newValue) => {
        bar.style.width = `${Math.min(100, Math.max(0, newValue))}%`;
      },
      setIndeterminate: () => {
        bar.classList.add("indeterminate");
      },
    };
  }

  /**
   * Create skeleton loader
   * @param {string} type - 'text', 'title', 'avatar', 'card', 'button'
   * @returns {HTMLElement}
   */
  createSkeleton(type = "text") {
    const skeleton = document.createElement("div");
    skeleton.className = `skeleton skeleton-${type}`;
    return skeleton;
  }

  /**
   * Ganti elemen dengan skeleton pas loading
   * @param {HTMLElement} element
   * @param {Function} loadFn - Fungsi promise
   */
  async withSkeleton(element, loadFn) {
    const skeleton = this.createSkeleton("card");
    skeleton.style.height = `${element.offsetHeight}px`;

    element.style.opacity = "0";
    element.after(skeleton);

    try {
      await loadFn();
    } finally {
      skeleton.remove();
      element.style.opacity = "1";
      element.classList.add("animate-fadeIn");
    }
  }

  /**
   * Loading di tombol
   * @param {HTMLElement} button
   */
  buttonLoading(button) {
    button.classList.add("btn-loading");
    button.disabled = true;
  }

  /**
   * Hapus loading di tombol
   * @param {HTMLElement} button
   */
  buttonReady(button) {
    button.classList.remove("btn-loading");
    button.disabled = false;
  }
}

// Create global instance
const LoadingUI = new LoadingManager();

// Export for modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = LoadingUI;
}
