const xss = require("xss");

// 🛡️ Enhanced bad word list (dapat ditambah sesuai kebutuhan)
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

// Regex patterns untuk deteksi obfuscation
function createBypassPatterns(word) {
  // Handle leet speak: a=4/@, e=3, i=1/!, o=0, s=5/$, t=7
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
    // Allow separator characters between letters (periods, spaces, dashes)
    if (pattern) pattern += "[.\\s\\-_]*";
    pattern += leetMap[char] || char;
  }
  return new RegExp(pattern, "gi");
}

function sanitizeKey(key) {
  return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

function sanitizeMessage(message) {
  if (!message || !message.trim()) return "";

  // Limit length
  const rawPesan = message.substring(0, 100);

  // XSS sanitization first
  let cleanPesan = xss(rawPesan);

  // Apply bad word filter with bypass detection
  for (const word of BAD_WORDS) {
    const pattern = createBypassPatterns(word);
    cleanPesan = cleanPesan.replace(pattern, "***");
  }

  // Remove excessive repeated characters (spam prevention)
  cleanPesan = cleanPesan.replace(/(.)\1{4,}/g, "$1$1$1");

  return cleanPesan;
}

module.exports = { sanitizeKey, sanitizeMessage };
