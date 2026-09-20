import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { creditPTWalletIdempotent } from '~/controllers/checkoutPTController'
import PTWallet from '~/models/PTWallet'
import PTWalletTransaction from '~/models/PTWalletTransaction'

// Kết nối trực tiếp vào MongoDB Replica Set rs0 local đang chạy trên cổng 27017
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/fitlink_test_db?replicaSet=rs0&directConnection=true'

describe('ACID Transactions & Idempotency - creditPTWalletIdempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_MONGO_URI)
    // Đảm bảo các unique index đã được tạo hoàn chỉnh
    await PTWalletTransaction.init()
    await PTWallet.init()
  })

  afterAll(async () => {
    // Dọn dẹp test database sau khi chạy xong
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase()
    }
    await mongoose.disconnect()
  })

  beforeEach(async () => {
    await PTWallet.deleteMany({})
    await PTWalletTransaction.deleteMany({})
  })

  it('should credit wallet and create transaction history atomically on first attempt', async () => {
    const ptId = new mongoose.Types.ObjectId()
    const transactionId = new mongoose.Types.ObjectId()
    const amount = 500000

    const result = await creditPTWalletIdempotent({
      ptId,
      amount,
      transactionId,
      refType: 'Transaction'
    })

    expect(result.ok).toBe(true)
    expect(result.duplicated).toBe(false)
    expect(result.walletTxn.amount).toBe(amount)

    // Kiểm tra ví tiền PT được cập nhật
    const wallet = await PTWallet.findOne({ pt: ptId })
    expect(wallet.available).toBe(amount)
    expect(wallet.totalEarned).toBe(amount)
  })

  it('should be IDEMPOTENT: repeated calls with same transactionId must NOT credit duplicate money', async () => {
    const ptId = new mongoose.Types.ObjectId()
    const transactionId = new mongoose.Types.ObjectId()
    const amount = 500000

    // Lần gọi 1: Khách hàng thanh toán lần đầu
    const firstCall = await creditPTWalletIdempotent({
      ptId,
      amount,
      transactionId,
      refType: 'Transaction'
    })
    expect(firstCall.ok).toBe(true)
    expect(firstCall.duplicated).toBe(false)

    // Lần gọi 2: Client rớt mạng hoặc user spam F5 trang xác nhận
    const secondCall = await creditPTWalletIdempotent({
      ptId,
      amount,
      transactionId,
      refType: 'Transaction'
    })

    // Kỳ vọng: Hệ thống nhận diện giao dịch đã xử lý, duplicated = true
    expect(secondCall.ok).toBe(true)
    expect(secondCall.duplicated).toBe(true)

    // Số dư ví PT vẫn CHỈ là 500,000 VND (chống cộng tiền trùng lặp tuyệt đối)
    const wallet = await PTWallet.findOne({ pt: ptId })
    expect(wallet.available).toBe(amount)
    expect(wallet.totalEarned).toBe(amount)

    // Bản ghi lịch sử ví chỉ duy nhất 1 giao dịch
    const count = await PTWalletTransaction.countDocuments({ refId: transactionId })
    expect(count).toBe(1)
  })

  it('should rollback transaction completely if an unexpected error occurs during execution', async () => {
    const ptId = new mongoose.Types.ObjectId()
    const session = await mongoose.startSession()

    try {
      await session.withTransaction(async () => {
        // Tạo ví
        await PTWallet.create([{ pt: ptId, available: 100000 }], { session })
        
        // Giả lập lỗi runtime giữa chừng giao dịch
        throw new Error('Simulated Database/Network Crash')
      })
    } catch (err) {
      expect(err.message).toBe('Simulated Database/Network Crash')
    } finally {
      session.endSession()
    }

    // Sau khi abortTransaction: Ví tiền hoàn toàn không được lưu vào DB (Rollback sạch sẽ)
    const walletAfterRollback = await PTWallet.findOne({ pt: ptId })
    expect(walletAfterRollback).toBeNull()
  })
})
