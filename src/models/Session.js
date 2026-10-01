import mongoose from 'mongoose'

const { Schema, model } = mongoose

const sessionSchema = new Schema({
  studentPackage: {
    type: Schema.Types.ObjectId,
    ref: 'StudentPackage',
    required: true
  },
  pt: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ✅ liên kết slot (giúp trace & UI)
  slot: { type: Schema.Types.ObjectId, ref: 'Slot', default: null },

  title: { type: String, default: 'Buổi tập' },

  startTime: { type: Date, required: true },
  endTime:   { type: Date, required: true },

  status: {
    type: String,
    enum: ['scheduled', 'completed', 'missed', 'rescheduled', 'cancelled'],
    default: 'scheduled'
  },

  attendance: {
    type: String,
    enum: ['present', 'absent', 'pending'],
    default: 'pending'
  },

  ptNote: { type: String, default: '' },
  studentNote: { type: String, default: '' },

  // (tùy chọn, dùng sau nếu cần payout/auto-confirm)
  completedAt: Date,
  studentConfirmedAt: Date
}, { timestamps: true })

// ✅ Validate nhẹ: start < end
sessionSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    return next(new Error('endTime must be greater than startTime'))
  }
  next()
})

// ✅ INDEXES
// sessionSchema.index({ pt: 1, startTime: 1 })                 // truy vấn lịch PT
sessionSchema.index({ student: 1, startTime: 1 }) // lịch của học viên
sessionSchema.index({ studentPackage: 1, status: 1 }) // theo dõi gói
sessionSchema.index ({ slot: 1 }, { unique: true, sparse: true }) // tránh 2 session trùng giờ cho 1 PT

export default model('Session', sessionSchema)
