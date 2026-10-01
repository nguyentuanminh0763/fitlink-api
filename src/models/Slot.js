// models/Slot.js
import mongoose from 'mongoose'
const { Schema, model } = mongoose

const slotHoldSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true }, // booking đang giữ chỗ (PENDING_PAYMENT)
    until:   { type: Date } // thời điểm hết hạn giữ (10–15’)
  },
  { _id: false }
)

const slotSchema = new Schema(
  {
    // Ai dạy (mỗi PT không thể dạy 2 slot trùng giờ)
    pt: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // (Tuỳ chọn) gói phát sinh slot recurring
    package: { type: Schema.Types.ObjectId, ref: 'Package', default: null, index: true },

    // Nhóm/series cho lịch cứng (để bật/tắt cả chuỗi)
    seriesId: { type: String, default: null, index: true }, // ví dụ `${packageId}:2-4-6:AM`

    // Phân loại slot
    kind:   { type: String, enum: ['recurring', 'single'], required: true }, // cứng / lẻ
    status: {
      type: String,
      enum: ['OPEN', 'BLOCKED', 'BOOKED', 'RESERVED_FOR_PACKAGE', 'HELD'], // HELD = giữ tạm khi thanh toán
      default: 'BLOCKED',
      index: true
    },

    // Thời gian
    startTime: { type: Date, required: true, index: true },
    endTime:   { type: Date, required: true },

    // Địa điểm học mà slot này hỗ trợ (khớp với supports/deliveryModes)
    modes: {
      atPtGym:    { type: Boolean, default: true },
      atClient:   { type: Boolean, default: false },
      atOtherGym: { type: Boolean, default: false }
    },

    // Sức chứa (mở đường cho semi-PT class), hiện tại =1
    capacity: { type: Number, default: 1, min: 1 },
    notes:    { type: String, default: '', maxlength: 500 },

    // Thông tin giữ chỗ khi booking ở trạng thái PENDING_PAYMENT
    hold: { type: slotHoldSchema, default: () => ({}) },

    // Liên kết khi slot đã được book xong
    bookedByBooking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },

    /** ⬇️ NEW: TTL anchor */
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
)

// ====== VALIDATIONS ======
slotSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    return next(new Error('endTime must be greater than startTime'))
  }
  next()
})

// ====== INDEXES ======
// Tránh double booking: mỗi PT không có 2 slot trùng startTime
slotSchema.index({ pt: 1, startTime: 1 }, { unique: true })

// Lọc nhanh cho listing
slotSchema.index({ pt: 1, status: 1, startTime: 1 })

/** ⬇️ NEW: TTL index — Mongo sẽ xoá doc khi now >= expiresAt */
slotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default model('Slot', slotSchema)
