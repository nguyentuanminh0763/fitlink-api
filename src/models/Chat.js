import mongoose from 'mongoose'

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  lastMessage: {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    timestamp: Date
  },

  // Lưu số tin chưa đọc của từng người
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true })

// ✅ INDEXES
chatSchema.index({ participants: 1 })
chatSchema.index({ 'lastMessage.timestamp': -1 })

export default mongoose.model('Chat', chatSchema)