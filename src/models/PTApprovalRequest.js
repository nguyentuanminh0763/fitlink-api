// models/PTApprovalRequest.js
import mongoose from 'mongoose'
const { Schema, model } = mongoose

// Lưu vết thao tác duyệt / cập nhật
const reviewLogSchema = new Schema(
  {
    action: { type: String, enum: ['submit', 'update', 'approve', 'reject', 'cancel'], required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // PT (submit/update/cancel) hoặc Admin (approve/reject)
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' } // lý do từ chối / ghi chú duyệt
  },
  { _id: false }
)

/**
 * Snapshot dữ liệu gửi duyệt ở thời điểm SUBMIT (để admin xem mà không bị "trôi" theo các lần chỉnh sửa hồ sơ)
 * Bạn có thể mở rộng/thu gọn tuỳ theo PTProfile hiện có.
 */
const profileSnapshotSchema = new Schema(
  {
    primaryGym: {
      name: String,
      address: String,
      location: {                    // GeoJSON Point
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]        // [lng, lat]
      },
      // giữ luôn ảnh tại thời điểm submit
      photos: [String]
    },
    deliveryModes: {
      atPtGym: { type: Boolean, default: true },
      atClient: { type: Boolean, default: false },
      atOtherGym: { type: Boolean, default: false }
    },
    travelPolicy: {
      enabled: { type: Boolean, default: true },
      freeRadiusKm: { type: Number, default: 6 },
      maxTravelKm: { type: Number, default: 20 },
      feePerKm: { type: Number, default: 10000 }
    },

    // marketing/info
    coverImage: String,
    bio: String,
    specialties: [String],
    yearsExperience: Number,
    certificates: [{ name: String, issuer: String, year: Number, url: String }],
    areaNote: String,
    videoIntroUrl: String
  },
  { _id: false }
)

const ptApprovalRequestSchema = new Schema(
  {
    // Chủ đơn
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ptProfile: { type: Schema.Types.ObjectId, ref: 'PTProfile', required: true, index: true },

    // Trạng thái quy trình
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true
    },

    // Lý do từ chối & ghi chú duyệt (khi rejected/approved)
    rejectReason: { type: String, default: '' },
    adminNote: { type: String, default: '' },

    // Người duyệt & thời điểm (set khi approve/reject)
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reviewedAt: { type: Date },

    // Ảnh chụp dữ liệu hồ sơ tại thời điểm SUBMIT (để admin xét duyệt đúng version)
    submittedProfile: { type: profileSnapshotSchema, required: true },

    // Đếm số lần gửi
    submitCount: { type: Number, default: 1, min: 1 },

    // Lịch sử thao tác
    logs: { type: [reviewLogSchema], default: [] },

    aiReview: {
      aiStatus: { type: String, enum: ['pass', 'reject'], default: null },
      score: { type: Number, default: null },
      issues: { type: [String], default: [] },
      rejectReason: { type: String, default: '' }, // lý do AI detect
      suggestedBio: { type: String, default: '' },
      reviewedAt: { type: Date },  // thời điểm AI chạy
      version: { type: Number, default: 1 }, // phòng trường hợp sau này update model hoặc rule
      isReviewed: { type: Boolean, default: false } // PT đã được AI kiểm duyệt hay chưa
    }
  },
  { timestamps: true }
)

/**
 * Ràng buộc: 1 PT chỉ có <tối đa 1 đơn đang pending>.
 * (Cho phép có nhiều đơn lịch sử đã approved/rejected)
 */
ptApprovalRequestSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
)

// Gọn dữ liệu
ptApprovalRequestSchema.pre('validate', function (next) {
  if (this.rejectReason && this.rejectReason.length > 1000) {
    this.rejectReason = this.rejectReason.slice(0, 1000)
  }
  if (this.adminNote && this.adminNote.length > 1000) {
    this.adminNote = this.adminNote.slice(0, 1000)
  }
  next()
})

export default model('PTApprovalRequest', ptApprovalRequestSchema)
