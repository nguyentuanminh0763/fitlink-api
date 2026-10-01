// models/PTWalletTransaction.js
import mongoose from 'mongoose'

const { Schema, model } = mongoose

const walletTxnSchema = new Schema(
  {
    pt: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Loại giao dịch
    type: {
      type: String,
      enum: ['earning', 'withdraw', 'adjustment'],
      required: true
    },

    // Dòng tiền
    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    }, // credit: tiền vào, debit: tiền ra

    amount: { type: Number, required: true, min: 0 },

    // Tham chiếu tới Transaction / Session / PayoutRequest / AdminAdjust...
    refId: { type: Schema.Types.ObjectId },
    refType: { type: String, trim: true },

    // pending: chờ hoàn tất (VD: học viên chưa xác nhận buổi)
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'completed'
    },

    // Số dư sau khi ghi nhận (để show lịch sử ví)
    balanceAfter: { type: Number, default: 0 }
  },
  { timestamps: true }
)

// Index để truy vấn nhanh lịch sử
walletTxnSchema.index({ pt: 1, createdAt: -1 })
// models/PTWalletTransaction.js
walletTxnSchema.index({ refId: 1, refType: 1 }, { unique: true, sparse: true })

walletTxnSchema.index({ type: 1, status: 1 })

export default model('PTWalletTransaction', walletTxnSchema)
