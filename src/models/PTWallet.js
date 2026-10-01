// models/PTWallet.js
import mongoose from 'mongoose'

const { Schema, model } = mongoose

const ptWalletSchema = new Schema(
  {
    pt: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true,
      index: true
    },

    // 💰 Tổng quan số dư
    available: { type: Number, default: 0 }, // tiền có thể rút ngay
    pending:   { type: Number, default: 0 }, // tiền chờ xác nhận buổi
    totalEarned: { type: Number, default: 0 }, // tổng thu nhập từ trước đến nay
    withdrawn: { type: Number, default: 0 } // tổng tiền đã rút

  },
  { timestamps: true }
)

// Cập nhật thời gian mỗi khi thay đổi ví
ptWalletSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

export default model('PTWallet', ptWalletSchema)
