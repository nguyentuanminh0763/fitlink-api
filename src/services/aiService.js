import { env } from '~/config/environment'

const CHATBOT_GPT_N8N_API = env.CHATBOT_GPT_N8N_API || "";

const normalizeText = (str = "") => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * messages: [{ role: 'system'|'user'|'assistant', content: '...' }]
 * return: { role: 'assistant', content: '...' }
 */
export const chatWithAI = async (messages) => {
  const last = messages[messages.length - 1];
  const rawQuestion = last?.content || "";
  const q = normalizeText(rawQuestion);

  console.log("🤖 AI received question:", rawQuestion);

  // --- 1. Chào hỏi / xã giao ---
  if (
    q === "hi" ||
    q === "hello" ||
    q === "alo" ||
    q.startsWith("chao") ||
    q.includes("xin chao")
  ) {
    return {
      role: "assistant",
      content:
        "Chào bạn 👋 Mình là trợ lý AI của FitLink. Bạn đang quan tâm đến **lịch tập**, **dinh dưỡng** hay **giảm mỡ / tăng cơ**?",
    };
  }

  // --- 2. Gửi qua n8n webhook ---
  if (!CHATBOT_GPT_N8N_API) {
    return { role: "assistant", content: "❌ Thiếu biến môi trường CHATBOT_GPT_N8N_API" };
  }

  try {
    const res = await fetch(CHATBOT_GPT_N8N_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: rawQuestion // hoặc chỉ gửi câu cuối
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`n8n error ${res.status}: ${text}`);
    }

    const data = await res.json();

    // ✅ Tùy workflow, n8n có thể trả về:
    // - { answer: "..." }
    // - { content: "..." }
    // - hoặc [{ json: { answer: "..." } }] (khi trả kiểu array item)
    const answer =
      data?.output ||
      data?.content ||
      data?.data?.output ||
      (Array.isArray(data) ? (data[0]?.json?.answer || data[0]?.json?.content) : "") ||
      "";

    return {
      role: "assistant",
      content: answer || "⚠️ n8n đã phản hồi nhưng không thấy field answer/content.",
    };
  } catch (err) {
    console.error("❌ Call n8n failed:", err);
    return {
      role: "assistant",
      content: "❌ Lỗi gọi n8n webhook. Kiểm tra URL / CORS / network / response format.",
    };
  }
};
