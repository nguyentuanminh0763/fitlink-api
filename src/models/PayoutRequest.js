// models/PayoutRequest.js
import mongoose from 'mongoose'
const { Schema, model } = mongoose

const payoutRequestSchema = new Schema({
  pt: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Thông tin ngân hàng bên PT cung cấp
  accountName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },

  // Trạng thái xử lý
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
    index: true
  },

  // Ghi chú admin (ví dụ: lý do rejected hoặc ghi chú chuyển khoản)
  adminNote: { type: String, default: '' },

  // Ai xử lý (admin user id), thời gian xử lý
  processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  processedAt: { type: Date, default: null },

  // (tuỳ chọn) tham chiếu tới wallet txn khi completed
  walletTxn: { type: Schema.Types.ObjectId, ref: 'PTWalletTransaction', default: null }

}, { timestamps: true })

export default model('PayoutRequest', payoutRequestSchema)
