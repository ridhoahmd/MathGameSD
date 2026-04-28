/**
 * gameLogger.js
 * Structured audit-trail helpers for versus/duel game events.
 * Wraps the existing Winston logger so all game events are consistently
 * formatted and easy to grep in production logs.
 */

const logger = require("./logger");

/**
 * Log a generic game event.
 *
 * @param {string} event      - Short event name, e.g. "ANSWER_SUBMITTED"
 * @param {object} [meta={}]  - Arbitrary key/value metadata
 */
function logGameEvent(event, meta = {}) {
  logger.info(`[GAME_EVENT] ${event}`, { ...meta, _source: "gameLogger" });
}

/**
 * Log the start of a versus/duel game session.
 *
 * @param {string} game       - Game slug
 * @param {string} p1Name     - Player 1 username
 * @param {string} p2Name     - Player 2 name (local / guest)
 * @param {string} [roomId]   - Socket room ID (optional)
 */
function logGameStart(game, p1Name, p2Name, roomId) {
  logger.info(
    `[GAME_START] game=${game} p1=${p1Name} p2=${p2Name}${roomId ? ` room=${roomId}` : ""}`,
    { game, p1Name, p2Name, roomId, _source: "gameLogger" },
  );
}

/**
 * Log the end of a versus/duel game session.
 *
 * @param {string} game       - Game slug
 * @param {string} p1Name     - Player 1 username
 * @param {string} p2Name     - Player 2 name
 * @param {string} status     - "Win" | "Lose" | "Draw"
 * @param {number} p1Score    - Final score for P1
 * @param {object} [extra={}] - Additional metadata (e.g. durationMs)
 */
function logGameEnd(game, p1Name, p2Name, status, p1Score, extra = {}) {
  logger.info(
    `[GAME_END] game=${game} p1=${p1Name} p2=${p2Name} status=${status} score=${p1Score}`,
    { game, p1Name, p2Name, status, p1Score, ...extra, _source: "gameLogger" },
  );
}

/**
 * Log a suspicious activity detected during score validation.
 *
 * @param {string} game      - Game slug
 * @param {string} username  - Player username
 * @param {string} reason    - Human-readable description of the anomaly
 * @param {object} [meta={}] - Raw data that triggered the alert
 */
function logSuspiciousActivity(game, username, reason, meta = {}) {
  logger.warn(
    `[SUSPICIOUS] game=${game} user=${username} reason="${reason}"`,
    { game, username, reason, ...meta, _source: "gameLogger" },
  );
}

module.exports = {
  logGameEvent,
  logGameStart,
  logGameEnd,
  logSuspiciousActivity,
};
