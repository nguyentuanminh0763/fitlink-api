import Transaction from '../models/Transaction.js'

export const getTransactions = async (req, res) => {
  try {
    const { status = 'paid', page = 1, limit = 10 } = req.query

    const filter = { status }
    const skip = (page - 1) * limit

    // Lấy danh sách giao dịch nhanh + ổn định
    const transactions = await Transaction.find(filter)
      .populate({
        path: 'student',
        select: 'name email',
        strictPopulate: false
      })
      .populate({ path: 'pt', select: 'name email', strictPopulate: false })
      .populate({
        path: 'package',
        select: 'name price',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean() // ⚡ Trả plain JS object (nhanh hơn 2-4 lần)

    // Đếm tổng số
    const total = await Transaction.countDocuments(filter)

    // Summary
    const summary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPlatformFee: { $sum: '$platformFee' },
          totalPTEarning: { $sum: '$ptEarning' },
          count: { $sum: 1 }
        }
      }
    ])

    return res.json({
      success: true,
      summary: summary[0] || {
        totalPlatformFee: 0,
        totalPTEarning: 0,
        count: 0
      },
      data: transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (err) {
    console.error('❌ getTransactions:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
