/**
 * Loading Manager
 * Centralized loading state management for MathGameSD
 */

class LoadingManager {
  constructor() {
    this.overlay = null;
    this.init();
  }

  init() {
    // Create loading overlay if it doesn't exist
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
   * Show loading overlay with optional message
   * @param {string} message - Loading message
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
   * Hide loading overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  /**
   * Show loading with auto-hide after duration
   * @param {string} message
   * @param {number} duration - milliseconds
   */
  showTimed(message = "Loading", duration = 2000) {
    this.show(message);
    setTimeout(() => this.hide(), duration);
  }

  /**
   * Create inline spinner element
   * @param {string} size - 'sm', 'md', 'lg'
   * @returns {HTMLElement}
   */
  createSpinner(size = "md") {
    const spinner = document.createElement("div");
    spinner.className = `spinner ${size === "lg" ? "spinner-lg" : size === "sm" ? "spinner-sm" : ""}`;
    return spinner;
  }

  /**
   * Create progress bar element
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
   * Replace element with skeleton while loading
   * @param {HTMLElement} element
   * @param {Function} loadFn - Function that returns a promise
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
   * Show loading on button
   * @param {HTMLElement} button
   */
  buttonLoading(button) {
    button.classList.add("btn-loading");
    button.disabled = true;
  }

  /**
   * Remove loading from button
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
