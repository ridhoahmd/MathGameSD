/**
 * gameValidator.js
 * Server-side validation utilities for versus/duel game results.
 * Prevents score manipulation and enforces per-game limits.
 */

// Maximum achievable scores per game in versus/local mode
const MAX_SCORES = {
  nabi:   100, // 10 questions × 10 pts each
  ayat:   100, // 10 questions × 10 pts each
  tajwid: 600, // 60 s × up to 10 pts/card, minus penalties — generous ceiling
  math:   300, // duel mode, question-based
};

// Minimum realistic time (ms) to complete a versus game
const MIN_GAME_DURATION_MS = {
  nabi:   10000, // 10 s minimum for 10 questions
  ayat:   10000,
  tajwid: 5000,  // timer-based, at least 5 s
  math:   5000,
};

/**
 * Validate a versus score before persisting it.
 *
 * @param {string} game   - Game slug (nabi | ayat | tajwid | math)
 * @param {number} score  - Score submitted by the client
 * @param {object} [opts] - Optional metadata
 * @param {number} [opts.questionCount] - Number of questions answered (nabi/ayat)
 * @param {number} [opts.durationMs]    - Elapsed game time in milliseconds
 * @returns {{ valid: boolean, score: number, reason?: string }}
 */
function validateScore(game, score, opts = {}) {
  let s = parseInt(score, 10);
  if (isNaN(s) || s < 0) s = 0;

  const maxScore = MAX_SCORES[game];

  // Cap to per-game maximum when defined
  if (maxScore !== undefined && s > maxScore) {
    return {
      valid: false,
      score: maxScore,
      reason: `Score ${s} exceeds maximum ${maxScore} for game "${game}". Capped.`,
    };
  }

  // Speedhack guard: score > 0 but game finished suspiciously fast
  const minDuration = MIN_GAME_DURATION_MS[game];
  if (
    minDuration !== undefined &&
    opts.durationMs !== undefined &&
    opts.durationMs < minDuration &&
    s > 0
  ) {
    return {
      valid: false,
      score: 0,
      reason: `Game "${game}" completed in ${opts.durationMs}ms — below minimum ${minDuration}ms. Score rejected.`,
    };
  }

  // Sanity check: score cannot exceed questions × 10 pts for quiz games
  if (
    (game === "nabi" || game === "ayat") &&
    opts.questionCount !== undefined &&
    opts.questionCount > 0
  ) {
    const theoreticalMax = opts.questionCount * 10;
    if (s > theoreticalMax) {
      return {
        valid: false,
        score: theoreticalMax,
        reason: `Score ${s} exceeds theoretical max ${theoreticalMax} for ${opts.questionCount} questions. Capped.`,
      };
    }
  }

  return { valid: true, score: s };
}

/**
 * Validate a full game result object before saving to the database.
 *
 * @param {object} result
 * @param {string} result.game
 * @param {string} result.status  - "Win" | "Lose" | "Draw"
 * @param {number} result.score
 * @param {string} [result.p2Name]
 * @param {number} [result.questionCount]
 * @param {number} [result.durationMs]
 * @returns {{ valid: boolean, result?: object, reason?: string }}
 */
function validateGameResult(result) {
  if (!result || typeof result !== "object") {
    return { valid: false, reason: "Invalid result object." };
  }

  const { game, status, score, p2Name, questionCount, durationMs } = result;

  const validGames = ["nabi", "ayat", "tajwid", "math"];
  if (!validGames.includes(game)) {
    return { valid: false, reason: `Unknown game slug: "${game}".` };
  }

  const validStatuses = ["Win", "Lose", "Draw"];
  if (!validStatuses.includes(status)) {
    return { valid: false, reason: `Invalid status: "${status}".` };
  }

  const scoreResult = validateScore(game, score, { questionCount, durationMs });

  return {
    valid: scoreResult.valid || scoreResult.score >= 0, // always return a usable result
    result: {
      game,
      status,
      score: scoreResult.score,
      p2Name: (p2Name || "Guest").trim().slice(0, 50), // sanitise name length
      questionCount: questionCount || null,
      durationMs: durationMs || null,
    },
    reason: scoreResult.reason || null,
  };
}

module.exports = { validateScore, validateGameResult, MAX_SCORES };
