require("dotenv").config();

const CURRENT_AI_MODEL = "glm";
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

// 🔧 FIX: Helper function with retry logic
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

      return response;
    } catch (err) {
      clearTimeout(timeout);

      const isLastAttempt = attempt === retries;
      const isRetryable =
        err.name === "AbortError" || (err.message && err.message.includes("5")); // 5xx errors

      if (isLastAttempt || !isRetryable) {
        throw err;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      console.log(
        `⏳ AI request attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function askAI(promptText) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ API Key AI Kosong/Salah");
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

    if (!content)
      return "Maaf, AI sedang tidak dapat menjawab (Empty Response).";

    // Sanitizer: If response contains markdown ```json ... ```, extract it
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
      throw new Error("AI Service Timeout (15s) - semua retry gagal");
    }
    throw err;
  }
}

module.exports = { askAI };
