/**
 * card-tilt.js — Opsi C: 3D Mouse-Tracking Tilt
 * =================================================
 * Menambahkan efek 3D tilt yang mengikuti posisi mouse
 * pada setiap game card (hanya di default theme).
 *
 * PRINSIP KERJA:
 * - mousemove → hitung X/Y offset mouse dari center card
 * - rotateX = berdasarkan posisi vertikal mouse (atas/bawah)
 * - rotateY = berdasarkan posisi horizontal mouse (kiri/kanan)
 * - Glow spotlight mengikuti posisi mouse via CSS custom property
 *
 * KEAMANAN:
 * - Cek tema aktif sebelum apply (body.classList)
 * - Tidak mengubah onclick, href, atau logika apapun
 * - Hanya memanipulasi inline style.transform pada card
 * - Self-cleanup pada mouseleave
 * =================================================
 */

(function () {
  'use strict';

  // Tunggu DOM selesai load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardTilt);
  } else {
    initCardTilt();
  }

  function initCardTilt() {
    // Cek apakah tema aktif — jika ada theme-X, skip efek ini
    function isDefaultTheme() {
      return !document.body.className.includes('theme-');
    }

    // Listen perubahan tema (cycleTheme mengubah body.className)
    const themeObserver = new MutationObserver(() => {
      // Re-apply atau hapus tilt sesuai tema aktif
      applyOrRemoveTilt();
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    function applyOrRemoveTilt() {
      const cards = document.querySelectorAll('.game-card[data-game]');

      if (isDefaultTheme()) {
        cards.forEach(attachTilt);
      } else {
        // Reset semua tilt saat tema non-default aktif
        cards.forEach(detachTilt);
      }
    }

    // Map untuk menyimpan event listener per card (untuk cleanup)
    const listeners = new WeakMap();

    function attachTilt(card) {
      // Skip jika sudah ada listener (hindari duplicate)
      if (listeners.has(card)) return;

      // Tambahkan .card-shine element jika belum ada
      if (!card.querySelector('.card-shine')) {
        const shine = document.createElement('div');
        shine.className = 'card-shine';
        card.appendChild(shine);
      }

      const onMouseMove = (e) => {
        if (!isDefaultTheme()) return;

        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;   // posisi X mouse dalam card (px)
        const y = e.clientY - rect.top;    // posisi Y mouse dalam card (px)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Hitung rotasi: max ±12deg
        const maxTilt = 12;
        const rotateX = -((y - centerY) / centerY) * maxTilt;
        const rotateY = ((x - centerX) / centerX) * maxTilt;

        // Update CSS custom property untuk glow spotlight
        const mouseXPercent = ((x / rect.width) * 100).toFixed(1) + '%';
        const mouseYPercent = ((y / rect.height) * 100).toFixed(1) + '%';
        card.style.setProperty('--mouse-x', mouseXPercent);
        card.style.setProperty('--mouse-y', mouseYPercent);

        // Apply 3D transform
        card.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
        card.style.transform =
          `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale(1.02)`;
      };

      const onMouseEnter = () => {
        if (!isDefaultTheme()) return;
        card.classList.remove('tilt-reset');
        card.style.transition = 'transform 0.1s ease';
      };

      const onMouseLeave = () => {
        // Smooth return ke posisi netral
        card.classList.add('tilt-reset');
        card.style.transform = '';
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');

        // Hapus class reset setelah transisi selesai
        setTimeout(() => card.classList.remove('tilt-reset'), 500);
      };

      card.addEventListener('mousemove', onMouseMove);
      card.addEventListener('mouseenter', onMouseEnter);
      card.addEventListener('mouseleave', onMouseLeave);

      // Simpan referensi listener untuk cleanup
      listeners.set(card, { onMouseMove, onMouseEnter, onMouseLeave });
    }

    function detachTilt(card) {
      const stored = listeners.get(card);
      if (!stored) return;

      card.removeEventListener('mousemove', stored.onMouseMove);
      card.removeEventListener('mouseenter', stored.onMouseEnter);
      card.removeEventListener('mouseleave', stored.onMouseLeave);
      listeners.delete(card);

      // Reset transform
      card.style.transform = '';
      card.style.transition = '';
    }

    // Inisialisasi awal
    applyOrRemoveTilt();
  }
})();
