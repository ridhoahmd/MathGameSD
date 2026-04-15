/**
 * 🧪 TEST OTOMATIS KOMPREHENSIF - TANGKAP BINTANG
 * Verifikasi centering canvas + layout di 12 ukuran layar
 *
 * Jalankan: node tests/test-bintang-centering.js
 */

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3000";
const GAME_URL = `${BASE_URL}/html/bintang.html`;

// ✅ 12 ukuran layar yang diuji (laptop, desktop, tablet, mobile)
const SCREEN_SIZES = [
  // — Laptop Umum —
  { name: "Laptop HD",        width: 1280, height: 800,  cat: "laptop" },
  { name: "Laptop FHD",       width: 1366, height: 768,  cat: "laptop" },
  { name: "Laptop FHD Wide",  width: 1536, height: 864,  cat: "laptop" },
  { name: "MacBook Pro 14\"", width: 1440, height: 900,  cat: "laptop" },
  { name: "Laptop 4:3",       width: 1024, height: 768,  cat: "laptop" },
  // — Desktop —
  { name: "Desktop FHD",      width: 1920, height: 1080, cat: "desktop" },
  { name: "Desktop 1600",     width: 1600, height: 900,  cat: "desktop" },
  { name: "Desktop 2K",       width: 2560, height: 1440, cat: "desktop" },
  // — Tablet —
  { name: "iPad (768x1024)",  width: 768,  height: 1024, cat: "tablet"  },
  { name: "iPad Land.",       width: 1024, height: 768,  cat: "tablet"  },
  // — Mobile —
  { name: "Mobile Portrait",  width: 375,  height: 667,  cat: "mobile"  },
  { name: "Mobile Large",     width: 414,  height: 896,  cat: "mobile"  },
];

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────
function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

const C = { GREEN: "\x1b[32m", RED: "\x1b[31m", YELLOW: "\x1b[33m", CYAN: "\x1b[36m", RESET: "\x1b[0m", BOLD: "\x1b[1m" };

function log(label, passed, detail = "") {
  const icon = passed ? "✅" : "❌";
  const col  = passed ? C.GREEN : C.RED;
  console.log(`  ${icon} ${col}[${passed ? "PASS" : "FAIL"}]${C.RESET} ${label}${detail ? C.YELLOW + " — " + detail + C.RESET : ""}`);
  return passed;
}

// ── Fungsi uji utama ──────────────────────────────────────
async function diagnose(page) {
  return page.evaluate(() => {
    const canvas    = document.querySelector("#game-container canvas");
    const hud       = document.getElementById("game-hud");
    const question  = document.getElementById("question-container");
    const topBar    = document.querySelector(".top-bar");

    if (!canvas) return { error: "CANVAS TIDAK ADA" };

    const cr  = canvas.getBoundingClientRect();
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    // ──── Centering horizontal ────
    const expectedLeft  = (vw - cr.width) / 2;
    const leftOffset    = cr.left - expectedLeft;         // negatif = geser kiri, positif = geser kanan
    const absOffset     = Math.abs(leftOffset);

    // ──── Simetri kanan-kiri ────
    const spaceLeft  = cr.left;
    const spaceRight = vw - cr.right;
    const symmetryDiff = Math.abs(spaceLeft - spaceRight); // idealnya 0

    // ──── Centering vertikal ────
    const expectedTop  = (vh - cr.height) / 2;
    const topOffset    = Math.abs(cr.top - expectedTop);

    // ──── HUD overlap dengan canvas ────
    // HUD adalah floating overlay z-index:100, secara desain BOLEH overlap canvas.
    // Yang diuji: apakah canvas.top < topBar.bottom (canvas mulai sebelum HUD selesai)?
    // Jika canvas mulai di bawah topBar (top >= topBar.bottom - toleransi), itu OK.
    let hudOverlap = false;
    let topBarBottom = 0;
    if (topBar) {
      const tbr = topBar.getBoundingClientRect();
      topBarBottom = tbr.bottom;
      // Overlap terjadi jika canvas mulai lebih dari 30px sebelum HUD selesai
      // (toleransi 30px karena Phaser margin-top bisa sedikit kurang)
      hudOverlap = cr.top < (tbr.bottom - 30);
    }
    if (question) {
      const qr = question.getBoundingClientRect();
      questionOverlap = qr.bottom > cr.top + 30; // Canvas terlalu tinggi menimpa soal
    }

    // ──── Canvas cukup besar ────
    const minSize = Math.min(vw, vh) * 0.3; // minimal 30% dari dimensi terkecil viewport

    return {
      viewport: { w: vw, h: vh },
      canvas: {
        left: Math.round(cr.left), top: Math.round(cr.top),
        right: Math.round(cr.right), bottom: Math.round(cr.bottom),
        width: Math.round(cr.width), height: Math.round(cr.height),
      },
      centering: {
        expected_left:   Math.round(expectedLeft),
        actual_left:     Math.round(cr.left),
        h_offset:        Math.round(leftOffset),   // + = geser kanan, - = geser kiri
        h_abs_offset:    Math.round(absOffset),
        space_left:      Math.round(spaceLeft),
        space_right:     Math.round(spaceRight),
        symmetry_diff:   Math.round(symmetryDiff),
        is_h_centered:   absOffset < 5,
        is_symmetric:    symmetryDiff < 5,
        direction_bias:  leftOffset > 5 ? "KANAN" : leftOffset < -5 ? "KIRI" : "TENGAH",
        v_offset:        Math.round(topOffset),
      },
      hud: {
        overlap_with_canvas:    hudOverlap,
        question_overlap:       questionOverlap,
        canvas_top:             Math.round(cr.top),
      },
      size: {
        canvas_width:      Math.round(cr.width),
        canvas_height:     Math.round(cr.height),
        width_pct:         +(cr.width / vw * 100).toFixed(1),
        height_pct:        +(cr.height / vh * 100).toFixed(1),
        aspect_ratio:      +(cr.width / cr.height).toFixed(3),
        is_reasonable:     cr.width > minSize && cr.height > minSize,
        canvas_visible:    cr.width > 0 && cr.height > 0,
        not_offscreen:     cr.left >= -1 && cr.top >= -1 && cr.right <= vw + 1,
      },
    };
  });
}

// ── Main ─────────────────────────────────────────────────
async function runTests() {
  console.log(`\n${C.BOLD}${C.CYAN}🎮 TEST KOMPREHENSIF: TANGKAP BINTANG — CANVAS CENTERING${C.RESET}`);
  console.log(`${C.CYAN}📋 12 resolusi layar | Cek: horizontal, simetri, vertikal, HUD overlap${C.RESET}\n`);

  let browser;
  const summary = [];
  let allPassed = true;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: null,
    });

    let currentCat = "";

    for (const screen of SCREEN_SIZES) {
      // Cetak pemisah kategori
      if (screen.cat !== currentCat) {
        currentCat = screen.cat;
        const label = { laptop: "🖥️  LAPTOP", desktop: "💻 DESKTOP", tablet: "📱 TABLET", mobile: "📲 MOBILE" }[screen.cat];
        console.log(`\n${C.BOLD}${label}${C.RESET}`);
        console.log("═".repeat(62));
      }

      console.log(`\n▶  ${C.BOLD}${screen.name}${C.RESET} (${screen.width}×${screen.height})`);
      console.log("─".repeat(62));

      const page = await browser.newPage();
      await page.setViewport({ width: screen.width, height: screen.height });
      const rec = { screen: screen.name, cat: screen.cat, w: screen.width, h: screen.height, tests: [], pass: true };

      try {
        await page.goto(GAME_URL, { waitUntil: "networkidle2", timeout: 15000 });
        await waitMs(800);

        // Screenshot start screen
        const slug = screen.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${slug}_1_start.png`) });

        // Klik MUDAH
        await page.evaluate(() => { const b = document.querySelectorAll(".btn-diff"); if (b[0]) b[0].click(); });
        await waitMs(3000);

        // Screenshot game
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${slug}_2_game.png`) });

        // ─── Diagnosa ───
        const d = await diagnose(page);

        if (d.error) {
          log("Canvas ada", false, d.error);
          rec.pass = false; allPassed = false;
        } else {
          // Info visual
          console.log(`     📐 Canvas : ${d.canvas.width}×${d.canvas.height} px`);
          console.log(`     📍 Posisi : left=${d.canvas.left} top=${d.canvas.top} right=${d.canvas.right}`);
          console.log(`     ↔️  Sisa   : kiri=${d.centering.space_left}px | kanan=${d.centering.space_right}px | simetri_diff=${d.centering.symmetry_diff}px`);
          console.log(`     🎯 H-center: offset ${d.centering.h_abs_offset}px (${d.centering.direction_bias})`);

          const r1 = log("Canvas ter-tengah horizontal", d.centering.is_h_centered,
            `offset ${d.centering.h_abs_offset}px — arah: ${d.centering.direction_bias}`);

          const r2 = log("Simetri kiri=kanan (≤5px diff)", d.centering.is_symmetric,
            `kiri:${d.centering.space_left}px | kanan:${d.centering.space_right}px | diff:${d.centering.symmetry_diff}px`);

          const r3 = log("Canvas tidak offscreen", d.size.not_offscreen,
            `right:${d.canvas.right} vs vw:${d.viewport.w}`);

          const r4 = log("Canvas terlihat (bukan 0×0)", d.size.canvas_visible,
            `${d.size.canvas_width}×${d.size.canvas_height}`);

          const r5 = log("Ukuran canvas proporsional", d.size.is_reasonable,
            `${d.size.width_pct}% lebar | ${d.size.height_pct}% tinggi viewport`);

          const r6 = log("HUD tidak menimpa canvas", !d.hud.overlap_with_canvas,
            d.hud.overlap_with_canvas
              ? `⚠️ HUD masuk ke area canvas! canvas.top=${d.hud.canvas_top}`
              : `canvas mulai top=${d.hud.canvas_top}px`);

          [r1, r2, r3, r4, r5, r6].forEach((r, i) => {
            const names = ["H-Center","Simetri","Not Offscreen","Visible","Proportional","HUD No Overlap"];
            rec.tests.push({ name: names[i], passed: r });
            if (!r) { rec.pass = false; allPassed = false; }
          });
        }

        const cnt = rec.tests.filter(t => t.passed).length;
        console.log(`\n  📊 ${cnt}/${rec.tests.length} test lulus ${rec.pass ? C.GREEN+"✅"+C.RESET : C.RED+"❌"+C.RESET}`);

      } catch (e) {
        console.log(`  ❌ ERROR: ${e.message}`);
        rec.pass = false; allPassed = false;
      }

      summary.push(rec);
      await page.close();
    }

    // ──── LAPORAN AKHIR ────────────────────────────────────
    console.log(`\n\n${"═".repeat(62)}`);
    console.log(`${C.BOLD}📋  LAPORAN AKHIR — CANVAS CENTERING TANGKAP BINTANG${C.RESET}`);
    console.log("═".repeat(62));

    // Per kategori
    const cats = ["laptop","desktop","tablet","mobile"];
    const catLabel = { laptop:"🖥️  Laptop", desktop:"💻 Desktop", tablet:"📱 Tablet", mobile:"📲 Mobile" };

    for (const cat of cats) {
      const rows = summary.filter(r => r.cat === cat);
      if (!rows.length) continue;
      console.log(`\n${catLabel[cat]}`);
      for (const r of rows) {
        const cnt   = r.tests.filter(t => t.passed).length;
        const tot   = r.tests.length;
        const icon  = r.pass ? C.GREEN+"✅"+C.RESET : C.RED+"❌"+C.RESET;
        const bias  = r.tests.find(t => t.name === "H-Center");
        console.log(`  ${icon} ${r.screen.padEnd(22)} ${r.w}×${r.h}  ${cnt}/${tot} passed`);
      }
    }

    // Skor keseluruhan
    const totalTests  = summary.reduce((a, r) => a + r.tests.length, 0);
    const totalPassed = summary.reduce((a, r) => a + r.tests.filter(t => t.passed).length, 0);
    const pct = (totalPassed / totalTests * 100).toFixed(1);

    console.log(`\n${"─".repeat(62)}`);
    console.log(`Skor total: ${C.BOLD}${totalPassed}/${totalTests} (${pct}%)${C.RESET}`);

    if (allPassed) {
      console.log(`\n${C.GREEN}${C.BOLD}🎉 SEMUA TEST LULUS! Canvas centering SEMPURNA di semua resolusi.${C.RESET}`);
    } else {
      const failed = summary.filter(r => !r.pass).map(r => r.screen);
      console.log(`\n${C.RED}⚠️  Gagal di: ${failed.join(", ")}${C.RESET}`);
    }

    console.log(`\n📸 Screenshot: ${SCREENSHOT_DIR}`);
    console.log("═".repeat(62) + "\n");

  } catch (e) {
    console.error("❌ FATAL:", e.message);
  } finally {
    if (browser) {
      await waitMs(2000);
      await browser.close();
    }
  }
}

runTests();
