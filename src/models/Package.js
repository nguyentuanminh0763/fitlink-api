// models/Package.js
import mongoose from 'mongoose'
const { Schema, model } = mongoose
import { PackageTags } from '../domain/enums.js'

const TravelPricingSchema = new Schema(
  {
    enabled: { type: Boolean, default: false }, // bật định giá di chuyển ở cấp gói
    freeRadiusKm: { type: Number, default: 6, min: 0 },
    maxTravelKm: { type: Number, default: 20, min: 0 },
    feePerKm: { type: Number, default: 10000, min: 0 }
  },
  { _id: false }
)

const packageSchema = new Schema(
  {
    pt: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Tên gói: unique trong phạm vi 1 PT
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },

    description: { type: String, trim: true, maxlength: 1000 },

    // Giá mỗi buổi (VND, integer)
    price: { type: Number, default: 0, min: 0, max: 100_000_000 },

    // Lịch lặp cho gói (nếu có)
    recurrence: {
      daysOfWeek: [[{ type: Number, min: 0, max: 6, required: true }]]
    },

    // Quy mô gói
    totalSessions: { type: Number, required: true, min: 1, max: 500 },
    sessionDurationMin: { type: Number, required: true, min: 15, max: 300 },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },

    // Trạng thái
    isActive: { type: Boolean, default: true },

    // Phạm vi hiển thị
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },

    // Gói áp dụng tại đâu (case 1/2/3)
    supports: {
      atPtGym: { type: Boolean, default: true },
      atClient: { type: Boolean, default: true },
      atOtherGym: { type: Boolean, default: true }
    },

    // Override travel policy của PT (nếu bật)
    travelPricing: { type: TravelPricingSchema, default: () => ({}) },


    // Tag để phân loại (ví dụ: giảm cân, tăng cơ,…)
    tags: {
      type: [{ type: String, enum: Object.values(PackageTags) }],
      default: []
    }
  },
  { timestamps: true }
)

// Indexes
packageSchema.index({ pt: 1, name: 1 }, { unique: true }) // unique name per PT
packageSchema.index({ pt: 1, isActive: 1 }) // listing nhanh
packageSchema.index({ tags: 1 }) // filter theo tag
packageSchema.index({ name: 'text', description: 'text' }) // search text

// Làm sạch dữ liệu cơ bản
packageSchema.pre('validate', function (next) {
  if (typeof this.name === 'string') this.name = this.name.trim()
  if (typeof this.description === 'string') this.description = this.description.trim()
  if (typeof this.price === 'number') this.price = Math.round(this.price)
  next()
})

packageSchema.pre('validate', function (next) {
  // clean strings/numbers sẵn có
  if (typeof this.name === 'string') this.name = this.name.trim()
  if (typeof this.description === 'string') this.description = this.description.trim()
  if (typeof this.price === 'number') this.price = Math.round(this.price)

  // normalize recurrence.daysOfWeek
  const r = this.recurrence || {}
  let arr = r.daysOfWeek

  // Nếu người dùng gửi [2,4,6] → chuyển thành [[2,4,6]]
  if (Array.isArray(arr) && arr.length && typeof arr[0] === 'number') {
    arr = [arr]
  }

  // Nếu không phải mảng → đặt rỗng
  if (!Array.isArray(arr)) arr = []

  // Làm sạch từng pattern
  arr = arr
    .map(pat => {
      if (!Array.isArray(pat)) return []
      const cleaned = pat
        .map(Number)
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
      // unique + sort
      return [...new Set(cleaned)].sort((a, b) => a - b)
    })
    .filter(pat => pat.length > 0) // bỏ rỗng

  this.recurrence = { ...(this.recurrence || {}), daysOfWeek: arr }
  next()
})

export default model('Package', packageSchema)