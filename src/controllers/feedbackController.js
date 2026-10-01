// src/controllers/feedbackController.js
import Feedback from '../models/Feedback.js'
import PTProfile from '../models/PTProfile.js'
import Notification from '../models/Notification.js'

/**
 * @desc Tạo feedback mới
 * @route POST /api/feedbacks
 */
export const createFeedback = async (req, res) => {
  try {
    // ✅ Lấy dữ liệu chuẩn theo schema mới
    const { studentPackage, pt, rating, comment, notificationId } = req.body
    const student = req.user?._id || req.body.student

    if (!pt || !studentPackage || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc (pt, studentPackage, rating).'
      })
    }

    // ✅ Tạo feedback mới
    const feedback = await Feedback.create({
      studentPackage,
      student,
      pt,
      rating,
      comment
    })

    // ✅ Nếu có notification (meta feedbackRequest) → đánh dấu đã feedback
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        'meta.feedbackSent': true
      })
    }

    // ✅ Cập nhật điểm trung bình cho PTProfile
    const allFeedbacks = await Feedback.find({ pt })
    const avg =
      allFeedbacks.length > 0
        ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length
        : 0

    await PTProfile.findOneAndUpdate(
      { user: pt },
      { ratingAvg: avg.toFixed(1), ratingCount: allFeedbacks.length }
    )

    res.status(201).json({
      success: true,
      message: 'Gửi đánh giá thành công!',
      data: feedback
    })
  } catch (error) {
    console.error('❌ Create feedback error:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Lỗi khi tạo feedback.'
    })
  }
}

/**
 * @desc Lấy tất cả feedback của 1 PT
 * @route GET /api/feedbacks/pt/:ptId
 */
export const getFeedbackByPT = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ pt: req.params.ptId })
      .populate('student', 'fullName avatar')
      .sort({ createdAt: -1 })

    const avgRating =
      feedbacks.length > 0
        ? feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length
        : 0

    res.json({
      success: true,
      avgRating: avgRating.toFixed(1),
      data: feedbacks
    })
  } catch (error) {
    console.error('❌ Get feedback error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy feedback.'
    })
  }
}
