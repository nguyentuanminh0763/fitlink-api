import mongoose from 'mongoose'
const { Schema, model } = mongoose
import { AddressSchema } from './_common.js'

const bookingSchema = new Schema({
  // Chủ thể
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pt: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  package: { type: Schema.Types.ObjectId, ref: 'Package', required: true, index: true },

  // Lịch học cố định
  pattern: { type: [Number], default: [] },
  slot: { start: String, end: String },
  patternKey: { type: String, index: true },
  slotKey: { type: String, index: true },
  startDate: { type: Date },
  mode: { type: String, enum: ['atPtGym', 'atClient', 'atOtherGym'] },

  // Snapshot vị trí
  clientAddress: { type: AddressSchema, default: null },
  ptGymAddress: { type: AddressSchema, default: null },
  otherGymAddress: { type: AddressSchema, default: null },

  // Travel snapshot + kết quả tính
  travelPolicy: {
    freeRadiusKm: { type: Number, default: 6, min: 0 },
    maxTravelKm: { type: Number, default: 20, min: 0 },
    feePerKm: { type: Number, default: 10000, min: 0 }
  },
  travelDistanceKm: { type: Number, default: 0, min: 0 }, //Khoảng cách thực tế client–gym (OSRM tính) 7.2
  travelFee: { type: Number, default: 0, min: 0 }, //Phí di chuyển tính từ khoảng cách thực tế 2000
  inRange: { type: Boolean, default: true }, //Học viên có nằm trong vùng phục vụ không true
  exceededByKm: { type: Number, default: 0, min: 0 }, //Nếu quá xa, số km vượt mức tối đa 0

  // Snapshot gói tại thời điểm đặt
  packageSnapshot: {
    name: String,
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'VND' },
    totalSessions: Number,
    sessionDurationMin: Number
  },

  // Pricing tổng hợp (để in hóa đơn & không phải tính lại)
  pricing: {
    base: { type: Number, default: 0, min: 0 }, // thường = packageSnapshot.price
    travel: { type: Number, default: 0, min: 0 }, // = travelFee
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 }
  },

  // Trạng thái đặt chỗ
  status: {
    type: String,
    enum: ['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED', 'EXPIRED'],
    default: 'PENDING_PAYMENT',
    index: true
  },
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },

  // Liên kết thanh toán
  transaction: { type: Schema.Types.ObjectId, ref: 'Transaction' }, // optional: transaction thắng cuộc

  // Kết quả tiền cuối cùng (có thể mirror pricing.total)
  amount: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'VND' },

  notes: String
}, { timestamps: true })

// Chặn user tạo 2 booking pending
bookingSchema.index(
  { student: 1, status: 1 },
  { partialFilterExpression: { status: 'PENDING_PAYMENT' } }
)

bookingSchema.pre('save', function (next) {
  if (Array.isArray(this.pattern) && this.pattern.length) {
    this.patternKey = [...this.pattern].sort((a, b) => a - b).join('-')
  }
  if (this.slot?.start && this.slot?.end) {
    this.slotKey = `${this.slot.start}-${this.slot.end}`
  }

  // đồng bộ amount = pricing.total nếu có
  if (this.pricing?.total != null && this.amount == null) {
    this.amount = this.pricing.total
    this.currency = this.packageSnapshot?.currency || this.currency || 'VND'
  }
  next()
})

export default model('Booking', bookingSchema)
