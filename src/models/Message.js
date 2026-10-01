import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },

  // Tùy chọn: đính kèm file (ảnh, video...)
  attachments: [{
    url: String,
    type: {
      type: String,
      enum: ['image', 'video', 'document']
    },
    filename: String
  }],

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  read: {
    type: Boolean,
    default: false
  },

  readAt: Date
}, { timestamps: true })

// ✅ INDEXES
messageSchema.index({ chat: 1, createdAt: -1 })
messageSchema.index({ sender: 1, createdAt: -1 })

export default mongoose.model('Message', messageSchema)