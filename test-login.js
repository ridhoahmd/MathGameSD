const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.fakeFirebaseResult = { user: { displayName: "Bot Admin Tester" } };
  });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    if (typeof auth !== 'undefined') {
      auth.signInWithPopup = function() { return Promise.resolve(window.fakeFirebaseResult); };
    }
  });
  await page.evaluate(() => toggleInputGuru());
  await page.type('#input-kode-guru', '4M0#Ij%u1@eNOmF!');
  await page.click('#btn-login');
  
  console.log("-> Menunggu bypass (Timeout max 3 detik)...");
  await new Promise(r => setTimeout(r, 6000));
  
  const display = await page.evaluate(() => {
    const el = document.getElementById('admin-panel');
    return el ? window.getComputedStyle(el).display : 'null';
  });
  console.log("Hasil Panel Admin:", display);
  await browser.close();
})();
