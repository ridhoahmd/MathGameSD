require("dotenv").config();

const CURRENT_AI_MODEL = "glm";

async function askAI(promptText) {
    console.log(`🧠 AI Request (Model: ${CURRENT_AI_MODEL})`);

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
        console.warn("⚠️ API Key AI Kosong/Salah");
        return "Error: API Key Missing";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
                                "Kamu adalah server game edukasi. Output HANYA JSON mentah.",
                        },
                        { role: "user", content: promptText },
                    ],
                    temperature: 0.7,
                }),
                signal: controller.signal,
            },
        );

        clearTimeout(timeout);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        return data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "Error: No response content";

    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

module.exports = { askAI };
