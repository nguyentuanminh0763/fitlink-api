import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '~/config/environment.js'
import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import { createNotification } from '../services/notificationService.js'

// Helper tách cookie string từ header handshake
const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((cookies, item) => {
    const [name, value] = item.trim().split('=')
    if (name && value) cookies[name] = decodeURIComponent(value)
    return cookies
  }, {})
}

export const initChatSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        const allowed = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:8080'];
        if (!origin || allowed.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true
    }
  })

  // ✅ Middleware xác thực danh tính qua JWT HttpOnly cookie (P0-1 Fix)
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || ''
      const cookies = parseCookies(cookieHeader)
      const token = cookies.token || socket.handshake.auth?.token

      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      jwt.verify(token, env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return next(new Error('Authentication error: Invalid or expired token'))
        }
        // Gắn thông tin người dùng đã xác thực vào socket.data
        socket.data.user = decoded
        socket.data.userId = String(decoded._id)
        next()
      })
    } catch (error) {
      return next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket) => {
    console.log('⚡ Client connected:', socket.id)

    const authenticatedUserId = socket.data.userId

    // Tự động join room cá nhân của chính user đã xác thực
    if (authenticatedUserId) {
      socket.join(authenticatedUserId)
      console.log(`👤 ${socket.id} joined user room ${authenticatedUserId} (authenticated)`)
    }

    // Fallback registerUser: chỉ cho phép join room nếu đúng là ID của chính mình
    socket.on('registerUser', (uid) => {
      if (!uid) return
      if (String(uid) === authenticatedUserId) {
        socket.join(authenticatedUserId)
      } else {
        console.warn(`⚠️ Blocked impersonation attempt by ${authenticatedUserId} trying to register ${uid}`)
      }
    })

    // Tham gia / rời room hội thoại (chỉ cho phép nếu user thuộc room id1-id2)
    socket.on('joinRoom', (roomId) => {
      if (!roomId) return
      const participants = roomId.split('-')
      if (participants.includes(authenticatedUserId)) {
        socket.join(roomId)
        console.log(`✅ ${socket.id} (${authenticatedUserId}) joined room ${roomId}`)
      } else {
        console.warn(`⚠️ Blocked unauthorized joinRoom attempt: ${authenticatedUserId} tried to join ${roomId}`)
      }
    })

    socket.on('leaveRoom', (roomId) => {
      if (!roomId) return
      socket.leave(roomId)
      console.log(`🚪 ${socket.id} left room ${roomId}`)
    })

    // Gửi tin nhắn + tạo/emit notification
    socket.on('sendMessage', async (message) => {
      try {
        const { room, text, attachments = [] } = message
        // Bắt buộc sender là user đã xác thực qua JWT, không tin sender client gửi
        const sender = authenticatedUserId
        if (!room || !text) {
          console.warn('⚠️ Missing message data:', message)
          return
        }

        const [id1, id2] = room.split('-')
        if (![id1, id2].includes(authenticatedUserId)) {
          console.warn(`⚠️ Blocked unauthorized sendMessage to room ${room} from user ${authenticatedUserId}`)
          return
        }
        let chatDoc = await Chat.findOne({ participants: { $all: [id1, id2] } })
        if (!chatDoc) chatDoc = await Chat.create({ participants: [id1, id2] })

        const newMsg = await Message.create({
          chat: chatDoc._id,
          sender,
          text,
          attachments
        })
        chatDoc.lastMessage = { sender, text, timestamp: new Date() }
        await chatDoc.save()

        const populatedMsg = await newMsg.populate(
          'sender',
          'fullName avatar role'
        )
        const payload = { ...populatedMsg.toObject(), room }

        io.to(room).emit('receiveMessage', payload)

        const receiverId = String(sender) === String(id1) ? id2 : id1
        const noti = await createNotification({
          user: receiverId,
          type: 'message',
          title: 'Tin nhắn mới',
          message: text.slice(0, 120),
          meta: { room, senderId: sender }
        })

        io.to(String(receiverId)).emit('notification', {
          id: noti._id,
          type: noti.type,
          title: noti.title,
          message: noti.message,
          data: noti.meta,
          createdAt: noti.createdAt
        })

        console.log('💬 Message sent + saved:', room)
      } catch (err) {
        console.error('❌ Socket sendMessage error:', err)
      }
    })

    socket.on('typing', (roomId) => {
      if (!roomId) return
      socket.to(roomId).emit('userTyping', { roomId })
    })

    socket.on('stopTyping', (roomId) => {
      if (!roomId) return
      socket.to(roomId).emit('userStopTyping', { roomId })
    })

    socket.on('markAsRead', ({ roomId, userId }) => {
      if (!roomId) return
      io.to(roomId).emit('messagesRead', { roomId, userId })
    })

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id)
    })
  })

  // ✅ Cho phép các controller khác gọi emit notification realtime
  global.sendNotificationToUser = (userId, payload) => {
    io.to(String(userId)).emit('notification', payload)
    console.log(`📩 [Realtime] Sent notification to user ${userId}`)
  }
  // Emit realtime khi buổi tập được cập nhật
  global.emitSessionUpdate = (studentId, payload) => {
    io.to(String(studentId)).emit('session_updated', payload)
    console.log(`📩 [Realtime] Sent session update to student ${studentId}`)
  }
}
