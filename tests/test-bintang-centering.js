/**
 * 🧪 TEST OTOMATIS - TANGKAP BINTANG
 * Verifikasi centering canvas di berbagai ukuran layar laptop
 *
 * Jalankan: node tests/test-bintang-centering.js
 */

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3000";
const GAME_URL = `${BASE_URL}/html/bintang.html`;

// Ukuran layar laptop yang akan diuji
const SCREEN_SIZES = [
  { name: "Laptop HD (1280x800)", width: 1280, height: 800 },
  { name: "Laptop FHD (1366x768)", width: 1366, height: 768 },
  { name: "MacBook Pro (1440x900)", width: 1440, height: 900 },
  { name: "Laptop 4:3 (1024x768)", width: 1024, height: 768 },
  { name: "Mobile Portrait (375x667)", width: 375, height: 667 },
];

// Direktori simpan screenshot
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// ====== FUNGSI HELPER ======
async function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logResult(label, passed, detail = "") {
  const icon = passed ? "✅" : "❌";
  const status = passed ? "PASS" : "FAIL";
  console.log(`  ${icon} [${status}] ${label}${detail ? " — " + detail : ""}`);
  return passed;
}

// ====== FUNGSI UJI CENTERING ======
async function testCanvasCentering(page, screenName) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas");
    const container = document.getElementById("game-container");

    if (!canvas) return { error: "Canvas tidak ditemukan!" };

    const cr = canvas.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const expectedLeft = (vw - cr.width) / 2;
    const leftOffset = Math.abs(cr.left - expectedLeft);

    return {
      viewport: { width: vw, height: vh },
      canvas: {
        left: Math.round(cr.left),
        top: Math.round(cr.top),
        width: Math.round(cr.width),
        height: Math.round(cr.height),
        right: Math.round(cr.right),
        bottom: Math.round(cr.bottom),
      },
      expected_center_left: Math.round(expectedLeft),
      actual_center_left: Math.round(cr.left),
      offset_from_center: Math.round(leftOffset),
      is_horizontally_centered: leftOffset < 5,
      fills_viewport: cr.width >= vw * 0.8,
      canvas_visible: cr.width > 0 && cr.height > 0,
      canvas_not_offscreen: cr.left >= 0 && cr.top >= 0,
    };
  });

  return result;
}

// ====== FUNGSI CEK HUD VISIBILITY ======
async function testHUDVisibility(page) {
  return await page.evaluate(() => {
    const hud = document.getElementById("game-hud");
    const question = document.getElementById("question-container");
    const scoreEl = document.getElementById("score-display");

    if (!hud || !question || !scoreEl) return { error: "Elemen HUD tidak ditemukan" };

    const hRect = hud.getBoundingClientRect();
    const qRect = question.getBoundingClientRect();

    return {
      hud_visible: hRect.height > 0 && hRect.width > 0,
      hud_top: Math.round(hRect.top),
      question_visible: qRect.height > 0,
      question_top: Math.round(qRect.top),
      hud_overlap_question: hRect.bottom > qRect.top && qRect.top < hRect.bottom,
    };
  });
}

// ====== FUNGSI CEK RESPONSIVITAS ======
async function testGameResponsiveness(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas");
    if (!canvas) return { error: "Canvas not found" };

    const cr = canvas.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
      canvas_width: Math.round(cr.width),
      canvas_height: Math.round(cr.height),
      viewport_width: vw,
      viewport_height: vh,
      width_ratio: +(cr.width / vw).toFixed(2),
      height_ratio: +(cr.height / vh).toFixed(2),
      aspect_ratio: +(cr.width / cr.height).toFixed(2),
      expected_ratio: +(800 / 600).toFixed(2), // 1.33 untuk desktop
      reasonable_size: cr.width > 300 && cr.height > 200,
    };
  });
}

// ====== MAIN TEST RUNNER ======
async function runTests() {
  console.log("\n🎮 === TEST OTOMATIS: TANGKAP BINTANG ===");
  console.log("📋 Menguji centering canvas di berbagai resolusi laptop\n");

  let browser;
  const allResults = [];
  let globalPass = true;

  try {
    browser = await puppeteer.launch({
      headless: false, // Mode tampil biar bisa lihat
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
      defaultViewport: null, // Biar bisa resize bebas
    });

    for (const screen of SCREEN_SIZES) {
      console.log(`\n📱 TEST: ${screen.name} (${screen.width}x${screen.height})`);
      console.log("─".repeat(55));

      const page = await browser.newPage();
      await page.setViewport({ width: screen.width, height: screen.height });
      const screenResults = { screen: screen.name, tests: [], passed: true };

      try {
        // === Navigasi ke game ===
        await page.goto(GAME_URL, { waitUntil: "networkidle2", timeout: 15000 });
        await waitMs(1000);

        // Screenshot: Layar awal
        const ssName = screen.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${ssName}_1_start.png`),
          fullPage: false,
        });

        // === Cek start screen muncul ===
        const startScreenVisible = await page.evaluate(() => {
          const el = document.getElementById("start-screen");
          return el && !el.classList.contains("hidden");
        });
        const t1 = logResult(
          "Start screen tampil",
          startScreenVisible,
          startScreenVisible ? "OK" : "Start screen tidak muncul"
        );
        screenResults.tests.push({ name: "Start Screen", passed: t1 });

        // === Klik MUDAH ===
        await page.evaluate(() => {
          const btns = document.querySelectorAll(".btn-diff");
          if (btns[0]) btns[0].click();
        });
        await waitMs(3000); // Tunggu Phaser initialize

        // Screenshot: Setelah game start
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${ssName}_2_game.png`),
          fullPage: false,
        });

        // === Cek canvas ada ===
        const canvasExists = await page.evaluate(
          () => !!document.querySelector("#game-container canvas")
        );
        const t2 = logResult(
          "Canvas game ada",
          canvasExists,
          canvasExists ? "Canvas terdeteksi" : "CANVAS TIDAK DITEMUKAN!"
        );
        screenResults.tests.push({ name: "Canvas Exists", passed: t2 });

        if (!canvasExists) {
          screenResults.passed = false;
          globalPass = false;
          allResults.push(screenResults);
          await page.close();
          continue;
        }

        // === TEST CENTERING ===
        const centerData = await testCanvasCentering(page, screen.name);

        if (centerData.error) {
          logResult("Centering check", false, centerData.error);
          screenResults.tests.push({ name: "Centering", passed: false });
        } else {
          console.log(
            `     📐 Canvas: ${centerData.canvas.width}x${centerData.canvas.height} @ (${centerData.canvas.left}, ${centerData.canvas.top})`
          );
          console.log(
            `     🎯 Expected center-left: ${centerData.expected_center_left}px | Actual: ${centerData.actual_center_left}px | Offset: ${centerData.offset_from_center}px`
          );

          const t3 = logResult(
            "Canvas ter-tengah (horizontal)",
            centerData.is_horizontally_centered,
            `offset ${centerData.offset_from_center}px ${centerData.is_horizontally_centered ? "< 5px ✓" : "> 5px — GESER!"}`
          );
          const t4 = logResult(
            "Canvas terlihat (bukan 0x0)",
            centerData.canvas_visible,
            `${centerData.canvas.width}x${centerData.canvas.height}`
          );
          const t5 = logResult(
            "Canvas tidak keluar layar",
            centerData.canvas_not_offscreen,
            `left: ${centerData.canvas.left}, top: ${centerData.canvas.top}`
          );

          screenResults.tests.push({ name: "Centering Horizontal", passed: t3 });
          screenResults.tests.push({ name: "Canvas Visible", passed: t4 });
          screenResults.tests.push({ name: "Canvas In Viewport", passed: t5 });

          if (!t3 || !t4 || !t5) {
            screenResults.passed = false;
            globalPass = false;
          }
        }

        // === TEST HUD ===
        const hudData = await testHUDVisibility(page);
        if (!hudData.error) {
          const t6 = logResult(
            "HUD (skor/nyawa) terlihat",
            hudData.hud_visible,
            `top: ${hudData.hud_top}px`
          );
          const t7 = logResult(
            "Soal matematika terlihat",
            hudData.question_visible,
            `top: ${hudData.question_top}px`
          );
          screenResults.tests.push({ name: "HUD Visible", passed: t6 });
          screenResults.tests.push({ name: "Question Visible", passed: t7 });
          if (!t6 || !t7) { screenResults.passed = false; globalPass = false; }
        }

        // === TEST RESPONSIVITAS ===
        const respData = await testGameResponsiveness(page);
        if (!respData.error) {
          const t8 = logResult(
            "Canvas ukuran proporsional",
            respData.reasonable_size,
            `${respData.canvas_width}x${respData.canvas_height} (${Math.round(respData.width_ratio * 100)}% lebar viewport)`
          );
          screenResults.tests.push({ name: "Canvas Responsive", passed: t8 });
          if (!t8) { screenResults.passed = false; globalPass = false; }
        }

        // Ringkasan per-ukuran layar
        const passCount = screenResults.tests.filter((t) => t.passed).length;
        const totalTests = screenResults.tests.length;
        console.log(
          `\n  📊 Hasil: ${passCount}/${totalTests} test lulus ${screenResults.passed ? "✅" : "❌"}`
        );

      } catch (err) {
        console.log(`  ❌ ERROR pada test ini: ${err.message}`);
        screenResults.passed = false;
        globalPass = false;
      }

      allResults.push(screenResults);
      await page.close();
    }

    // ====== LAPORAN AKHIR ======
    console.log("\n" + "═".repeat(55));
    console.log("📋 LAPORAN AKHIR TEST");
    console.log("═".repeat(55));

    for (const r of allResults) {
      const passCount = r.tests.filter((t) => t.passed).length;
      const icon = r.passed ? "✅" : "❌";
      console.log(`  ${icon} ${r.screen}: ${passCount}/${r.tests.length} passed`);
    }

    console.log("\n" + "─".repeat(55));
    if (globalPass) {
      console.log("🎉 SEMUA TEST LULUS! Canvas centering sudah benar.");
    } else {
      console.log("⚠️  ADA TEST YANG GAGAL! Periksa detail di atas.");
    }
    console.log(`\n📸 Screenshot tersimpan di: ${SCREENSHOT_DIR}`);
    console.log("═".repeat(55) + "\n");

  } catch (err) {
    console.error("❌ FATAL ERROR:", err.message);
  } finally {
    if (browser) {
      await waitMs(2000); // Biar bisa lihat browser sebentar
      await browser.close();
    }
  }
}

runTests();
