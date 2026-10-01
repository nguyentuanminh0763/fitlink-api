// controllers/adminPayoutController.js
import mongoose from 'mongoose'
import PayoutRequest from '~/models/PayoutRequest.js'
import PTWallet from '~/models/PTWallet.js'
import PTWalletTransaction from '~/models/PTWalletTransaction.js'
import { sendPTWithdrawCompletedEmail } from '~/utils/mailer.js'

export async function completePayout(req, res) {
  const payoutId = req.params.id
  const adminId = req.user._id

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // populate pt để lấy email / name
    const payout = await PayoutRequest.findById(payoutId)
      .populate('pt', 'name email')
      .session(session)

    if (!payout) throw new Error('Payout request not found')
    if (payout.status !== 'pending' && payout.status !== 'approved') {
      throw new Error('Payout already processed')
    }

    const wallet = await PTWallet.findOne({ pt: payout.pt._id }).session(session)
    if (!wallet) throw new Error('PT wallet not found')

    if (wallet.available < payout.amount) {
      throw new Error('Insufficient PT wallet balance')
    }

    // Trừ tiền (giả lập chuyển khoản thành công)
    wallet.available -= payout.amount
    wallet.withdrawn = (wallet.withdrawn || 0) + payout.amount
    await wallet.save({ session })

    // Ghi lịch sử giao dịch ví
    const [txn] = await PTWalletTransaction.create([{
      pt: payout.pt._id,
      type: 'withdraw',
      direction: 'debit',
      amount: payout.amount,
      status: 'completed',
      refId: payout._id,
      refType: 'PayoutRequest',
      balanceAfter: wallet.available
    }], { session })

    // Cập nhật payout
    payout.status = 'completed'
    payout.processedBy = adminId
    payout.processedAt = new Date()
    payout.walletTxn = txn._id
    await payout.save({ session })

    // Gửi email xác nhận cho PT (không làm fail nếu lỗi)
    try {
      await sendPTWithdrawCompletedEmail(
        payout.pt.email,
        payout.pt.name || 'bạn',
        {
          bankName: payout.bankName,
          accountNumber: payout.accountNumber,
          amount: payout.amount
        }
      )
    } catch (e) {
      console.error('Send PT completed mail error:', e?.message || e)
    }

    await session.commitTransaction()
    session.endSession()

    return res.json({ success: true, payout, txn })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(400).json({ error: err.message })
  }
}

/**
 * Admin xem tất cả yêu cầu rút tiền (filter theo status, pt, phân trang)
 * GET /api/payouts/admin?status=pending&pt=<userId>&page=1&limit=10
 */
export async function listPayoutRequests(req, res) {
  const { status, pt, page = 1, limit = 10 } = req.query

  const q = {}
  if (status) q.status = status
  if (pt) q.pt = pt

  const skip = (Number(page) - 1) * Number(limit)

  const [items, total] = await Promise.all([
    PayoutRequest.find(q)
      .populate('pt', 'name email')
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

/**
 * Admin từ chối yêu cầu rút tiền
 * POST /api/payouts/admin/:id/reject  { reason }
 * (Flow hiện tại không hold tiền khi tạo request, nên reject không cần trả lại tiền)
 */
export async function rejectPayout(req, res) {
  const payoutId = req.params.id
  const adminId = req.user._id
  const { reason } = req.body || {}

  const payout = await PayoutRequest.findById(payoutId).populate('pt', 'name email')
  if (!payout) return res.status(404).json({ error: 'Payout request not found' })

  if (['completed', 'rejected'].includes(payout.status)) {
    return res.status(400).json({ error: 'Payout already processed' })
  }

  payout.status = 'rejected'
  payout.processedBy = adminId
  payout.processedAt = new Date()
  payout.adminNote = reason || 'Rejected'
  await payout.save()

  // (tuỳ chọn) gửi mail báo bị từ chối cho PT — nếu cần, tạo hàm mail tương tự:
  // try {
  //   await sendPTWithdrawRejectedEmail(payout.pt.email, payout.pt.name, {
  //     bankName: payout.bankName,
  //     accountNumber: payout.accountNumber,
  //     amount: payout.amount,
  //     reason
  //   });
  // } catch (e) { console.error('Send PT rejected mail error:', e?.message || e); }

  return res.json({ success: true, payout })
}
