// Catatan: dotenv.config() sudah dipanggil di server.js (entry point).
// Jangan panggil di sini agar tidak ada duplikasi dan race condition.
const logger = require("../utils/logger");

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 detik

// Fungsi bantu buat request ulang kalau gagal
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API Error: ${response.status} - ${errorText}`);
      }

      // FIX: Cek error JSON di 200 OK dari Zhipu API
      // Karena method `.json()` cuma bisa dipanggil sekali, kita cloning stream-nya
      const clonedResponse = response.clone();
      try {
        const data = await clonedResponse.json();
        if (data.error) {
          throw new Error(
            `AI API JSON Error: ${data.error.message || "Unknown error"}`,
          );
        }
      } catch (jsonErr) {
        // Jika gagal di-parse sebagai JSON tapi response-nya OK, abaikan
        if (jsonErr.message.includes("AI API JSON Error")) {
          throw jsonErr;
        }
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);

      const isLastAttempt = attempt === retries;
      const isRetryable =
        err.name === "AbortError" ||
        (err.message && err.message.includes("5")) ||
        (err.message && err.message.includes("AI API JSON Error"));

      if (isLastAttempt || !isRetryable) {
        throw err;
      }

      // Tunggu makin lama (Exponential backoff)
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      logger.info(
        `⏳ AI request cobaan ke-${attempt} gagal, coba lagi dalam ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function askAI(promptText) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    logger.warn("⚠️ Kunci API AI ga ketemu");
    throw new Error("Misconfiguration: API Key Missing");
  }

  try {
    const response = await fetchWithRetry(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4-flash",
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah asisten edukasi ramah untuk anak SD. Jawab dengan ringkas, ceria, dan memotivasi.",
            },
            { role: "user", content: promptText },
          ],
          temperature: 0.7,
        }),
      },
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let content =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;

    if (!content) return "Maaf, AI lagi bingung (Jawaban Kosong).";

    // Bersihin format markdown kalau ada
    if (content.includes("```json")) {
      const match = content.match(/```json([\s\S]*?)```/);
      if (match && match[1]) {
        content = match[1].trim();
      }
    } else if (content.includes("```")) {
      const match = content.match(/```([\s\S]*?)```/);
      if (match && match[1]) {
        content = match[1].trim();
      }
    }

    return content;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("AI lelet banget (Timeout)");
    }
    throw err;
  }
}

module.exports = { askAI };
