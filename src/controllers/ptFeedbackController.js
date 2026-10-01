import Feedback from '../models/Feedback.js'

export const getMine = async (req, res) => {
  try {
    const ptId = req.user?._id || req.user?.id

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100)

    const filter = { pt: ptId }

    const [data, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        // populate user và studentPackage (deep populate package name nếu có)
        .populate('student', 'name avatar email')
        .populate('pt', 'name email')
        .populate({
          path: 'studentPackage',
          select: 'code package student totalSessions',
          populate: { path: 'package', select: 'name' } // nếu StudentPackage có ref 'package'
        }),
      Feedback.countDocuments(filter)
    ])

    const pages = Math.max(Math.ceil(total / limit), 1)

    return res.json({
      data,
      pagination: { page, pages, total, limit }
    })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load feedbacks' })
  }
}
