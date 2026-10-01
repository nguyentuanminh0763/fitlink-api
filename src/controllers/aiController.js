// src/controllers/aiController.js
import { StatusCodes } from 'http-status-codes'
import { chatWithAI, AI_UNAVAILABLE_REPLY } from '../services/aiService.js'

/**
 * POST /api/ai/chat
 * body: { message: string, history?: [{ role, content }] }
 */
export const chatAI = async (req, res) => {
  try {
    const { message, history } = req.body || {}

    if (!message || !message.trim()) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'Message is required' })
    }

    // Build context cho AI
    const messages = [
      {
        role: 'system',
        content:
          'Bạn là trợ lý AI của nền tảng FitLink, chuyên tư vấn lịch tập luyện, dinh dưỡng, phục hồi cho người dùng Việt Nam. ' +
          'Hãy giải thích ngắn gọn, dễ hiểu, không nói về việc bạn là mô hình ngôn ngữ, không đề cập đến OpenAI. ' +
          'Nếu được hỏi ngoài phạm vi sức khỏe - thể hình, hãy trả lời lịch sự nhưng vẫn cố gắng giúp trong khả năng.'
      }
    ]

    // nếu FE có gửi history cũ thì nối vào
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg?.role && msg?.content) {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // câu hỏi hiện tại
    messages.push({ role: 'user', content: message })

    const aiReply = await chatWithAI(messages)

    return res.status(StatusCodes.OK).json({
      reply: aiReply.content
    })
  } catch (err) {
    // Chi tiết lỗi chỉ ghi log server, không trả err.message cho client
    console.error('❌ AI chat error:', err)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: AI_UNAVAILABLE_REPLY
    })
  }
}
