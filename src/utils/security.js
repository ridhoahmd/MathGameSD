const xss = require("xss");

function sanitizeKey(key) {
    return key ? key.replace(/[.#$/\[\]]/g, "_") : "unknown";
}

function sanitizeMessage(message) {
    if (!message || !message.trim()) return "";

    const rawPesan = message.substring(0, 100);
    return xss(rawPesan).replace(
        /(anjing|babi|bodoh|kasar)/gi,
        "***"
    );
}

module.exports = { sanitizeKey, sanitizeMessage };
