import { env } from '~/config/environment'

const CHATBOT_GPT_N8N_API = env.CHATBOT_GPT_N8N_API || ''

// Câu trả cho người dùng khi AI không dùng được — chi tiết kỹ thuật chỉ ghi vào log server,
// không bao giờ hiện tên biến, URL hay lỗi n8n trong khung chat.
export const AI_UNAVAILABLE_REPLY = 'Xin lỗi, trợ lý AI đang tạm thời không phản hồi. Bạn vui lòng thử lại sau nhé.'

const normalizeText = (str = '') => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * messages: [{ role: 'system'|'user'|'assistant', content: '...' }]
 * return: { role: 'assistant', content: '...' }
 */
export const chatWithAI = async (messages) => {
  const last = messages[messages.length - 1]
  const rawQuestion = last?.content || ''
  const q = normalizeText(rawQuestion)

  console.log('🤖 AI received question:', rawQuestion)

  // --- 1. Chào hỏi / xã giao ---
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'alo' ||
    q.startsWith('chao') ||
    q.includes('xin chao')
  ) {
    return {
      role: 'assistant',
      content:
        'Chào bạn 👋 Mình là trợ lý AI của FitLink. Bạn đang quan tâm đến **lịch tập**, **dinh dưỡng** hay **giảm mỡ / tăng cơ**?'
    }
  }

  // --- 2. Gửi qua n8n webhook ---
  if (!CHATBOT_GPT_N8N_API) {
    console.warn('⚠️ [AI] CHATBOT_GPT_N8N_API chưa cấu hình — không gọi được n8n')
    return { role: 'assistant', content: AI_UNAVAILABLE_REPLY }
  }

  try {
    const res = await fetch(CHATBOT_GPT_N8N_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: rawQuestion // hoặc chỉ gửi câu cuối
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`n8n error ${res.status}: ${text}`)
    }

    const data = await res.json()

    // ✅ Tùy workflow, n8n có thể trả về:
    // - { answer: "..." }
    // - { content: "..." }
    // - hoặc [{ json: { answer: "..." } }] (khi trả kiểu array item)
    const answer =
      data?.output ||
      data?.content ||
      data?.data?.output ||
      (Array.isArray(data) ? (data[0]?.json?.answer || data[0]?.json?.content) : '') ||
      ''

    if (!answer) {
      console.warn('⚠️ [AI] n8n phản hồi nhưng không có field output/content. Keys:', Object.keys(data || {}))
      return { role: 'assistant', content: AI_UNAVAILABLE_REPLY }
    }

    return { role: 'assistant', content: answer }
  } catch (err) {
    console.error('❌ Call n8n failed:', err)
    return { role: 'assistant', content: AI_UNAVAILABLE_REPLY }
  }
}
