// controllers/ptPayoutController.js
import PayoutRequest from '~/models/PayoutRequest.js'
import PTWallet from '~/models/PTWallet.js'
import mongoose from 'mongoose'
import User from '~/models/User.js'
import { env } from '~/config/environment.js'
import { sendPTWithdrawRequestEmail } from '~/utils/mailer.js'

export async function createPayoutRequest(req, res) {
  const ptId = req.user._id // assume auth middleware
  const { accountName, accountNumber, bankName, amount } = req.body

  if (!accountName || !accountNumber || !bankName || !amount) {
    return res.status(400).json({ error: 'Thiếu thông tin' })
  }
  if (amount <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })

  // Kiểm tra số dư ví
  const wallet = await PTWallet.findOne({ pt: ptId })
  if (!wallet || wallet.available < amount) {
    return res.status(400).json({ error: 'Không đủ tiền trong ví' })
  }

  // Tạo payout request (vẫn giữ tiền trong ví cho đến khi admin completed)
  const pr = await PayoutRequest.create({
    pt: ptId,
    accountName, accountNumber, bankName, amount,
    status: 'pending'
  })

  // Gửi mail thông báo cho Admin
  try {
    const pt = await User.findById(ptId).select('name email')
    const adminEmail = env.ADMIN_EMAIL || env.EMAIL_USER // fallback nếu chưa set ADMIN_EMAIL

    await sendPTWithdrawRequestEmail(
      adminEmail,
      { name: pt?.name || 'PT', email: pt?.email || '' },
      { bankName, accountName, accountNumber, amount }
    )
  } catch (e) {
    // Không fail request nếu gửi mail lỗi
    console.error('Send admin payout mail error:', e?.message || e)
  }

  return res.status(201).json(pr)
}

/**
 * PT xem danh sách yêu cầu của chính mình (có filter status, phân trang)
 * GET /api/payouts/pt/my-requests?status=pending&page=1&limit=10
 */
export async function getMyPayoutRequests(req, res) {
  const ptId = req.user._id
  const { status, page = 1, limit = 10 } = req.query

  const q = { pt: ptId }
  if (status) q.status = status

  const skip = (Number(page) - 1) * Number(limit)

  const [items, total] = await Promise.all([
    PayoutRequest.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    PayoutRequest.countDocuments(q)
  ])

  return res.json({
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit))
  })
}

export async function getMyWallet(req, res) {
  const ptId = req.user._id
  try {
    let wallet = await PTWallet.findOne({ pt: ptId })
    if (!wallet) {
      // Nếu PT chưa có ví thì tạo mới
      wallet = await PTWallet.create({
        pt: ptId,
        available: 0,
        withdrawn: 0
      })
    }

    console.log(wallet)


    return res.json({
      pt: wallet.pt,
      available: wallet.available,
      withdrawn: wallet.withdrawn,
      pending: wallet.pending || 0,
      updatedAt: wallet.updatedAt
    })
  } catch (err) {
    console.error('Get wallet error:', err)
    return res.status(500).json({ error: 'Không thể lấy thông tin ví' })
  }
}
