require("dotenv").config();

const CURRENT_AI_MODEL = "glm";

async function askAI(promptText) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ API Key AI Kosong/Salah");
    throw new Error("Misconfiguration: API Key Missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(
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
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "Maaf, AI sedang tidak dapat menjawab (Empty Response).";
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("AI Service Timeout (15s)");
    }
    throw err;
  }
}

module.exports = { askAI };
