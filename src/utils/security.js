const xss = require("xss");

// Daftar Kata Kasar (Sensor)
const BAD_WORDS = [
  "anjing",
  "babi",
  "bodoh",
  "kasar",
  "goblok",
  "tolol",
  "bangsat",
  "kontol",
  "memek",
  "pepek",
  "ngentot",
  "bajingan",
  "asu",
  "kampret",
  "brengsek",
  "sialan",
  "tai",
  "setan",
  "iblis",
  "laknat",
];

// Pola Regex buat deteksi kata yang disamarin
function createBypassPatterns(word) {
  // Peta karakter alay: a=4/@, e=3, dll
  const leetMap = {
    a: "[a4@]",
    e: "[e3]",
    i: "[i1!]",
    o: "[o0]",
    s: "[s5$]",
    t: "[t7]",
  };

  let pattern = "";
  for (const char of word.toLowerCase()) {
    // Bolehin pemisah (. - _)
    if (pattern) pattern += "[.\\s\\-_]*";

    // FIX: Escape regex special characters untuk mencegah Regex Injection Server Panic
    if (/[.*+?^${}()|[\]\\]/.test(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += leetMap[char] || char;
    }
  }
  return new RegExp(pattern, "gi");
}

function sanitizeKey(key) {
  return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

function sanitizeMessage(message) {
  if (!message || !message.trim()) return "";

  // Batasi panjang
  const rawPesan = message.substring(0, 100);

  // Bersihin XSS dulu
  let cleanPesan = xss(rawPesan);

  // Sensor kata kasar
  for (const word of BAD_WORDS) {
    const pattern = createBypassPatterns(word);
    cleanPesan = cleanPesan.replace(pattern, "***");
  }

  // Hapus karakter berulang berlebihan (spam)
  cleanPesan = cleanPesan.replace(/(.)\1{4,}/g, "$1$1$1");

  return cleanPesan;
}

module.exports = { sanitizeKey, sanitizeMessage };
