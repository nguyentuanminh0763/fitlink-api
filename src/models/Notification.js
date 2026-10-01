import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['session', 'package', 'payout', 'system', 'message'],
    default: 'system'
  },
  title: String,
  message: String,
  read: {
    type: Boolean,
    default: false
  },
  meta: mongoose.Schema.Types.Mixed
}, { timestamps: true })

// ✅ INDEXES
notificationSchema.index({ user: 1, read: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)