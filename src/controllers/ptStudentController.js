// src/controllers/ptStudentController.js
import { StatusCodes } from 'http-status-codes'
import StudentPackage from '~/models/StudentPackage'
import Session from '~/models/Session'

/**
 * GET /api/pt/students?packageId=&status=active&page=1&limit=10
 * Trả về danh sách học viên thuộc PT (từ StudentPackage),
 * có thể lọc theo package đang dùng.
 */
const listMyStudents = async (req, res) => {
  try {
    const ptId = req.user._id
    const { packageId, status = 'active', page = 1, limit = 10, q } = req.query

    const filter = { pt: ptId }
    if (status) filter.status = status // active/completed/expired/paused
    if (packageId) filter.package = packageId

    // tìm các StudentPackage thỏa filter
    const [items, total] = await Promise.all([
      StudentPackage.find(filter)
        .populate('student', 'name avatar email phone')
        .populate('package', 'name totalSessions durationDays')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      StudentPackage.countDocuments(filter)
    ])

    // search q (tên/email) phía FE hoặc lọc nhẹ phía BE
    const data = q
      ? items.filter(sp =>
        (sp.student?.name || '').toLowerCase().includes(q.toLowerCase()) ||
          (sp.student?.email || '').toLowerCase().includes(q.toLowerCase())
      )
      : items

    return res.status(StatusCodes.OK).json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

/**
 * GET /api/pt/students/:studentPackageId/sessions
 */
const listSessionsByStudentPackage = async (req, res) => {
  try {
    const { studentPackageId } = req.params
    const sessions = await Session.find({ studentPackage: studentPackageId })
      .sort({ startTime: 1 })
    return res.status(StatusCodes.OK).json({ success: true, data: sessions })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

/**
 * POST /api/pt/students/:studentPackageId/sessions
 * body: { title, startTime, endTime, ptNote }
 * chỉ PT sở hữu StudentPackage mới tạo được
 */
const createSessionForStudentPackage = async (req, res) => {
  try {
    const { studentPackageId } = req.params
    const { title, startTime, endTime, ptNote } = req.body

    if (!title || !startTime || !endTime) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Thiếu title / startTime / endTime'
      })
    }

    const sp = await StudentPackage.findById(studentPackageId).populate('student pt')
    if (!sp) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Không tìm thấy student package' })

    // quyền PT
    if (String(sp.pt._id) !== String(req.user._id)) {
      return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: 'Không có quyền tạo lịch cho học viên này' })
    }

    // (tuỳ chọn) chặn trùng giờ cho cùng 1 PT
    const overlap = await Session.findOne({
      pt: sp.pt._id,
      startTime: { $lt: new Date(endTime) },
      endTime: { $gt: new Date(startTime) },
      status: { $ne: 'cancelled' }
    })
    if (overlap) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'PT đã có lịch trùng thời gian' })
    }

    const session = await Session.create({
      studentPackage: sp._id,
      pt: sp.pt._id,
      student: sp.student._id,
      title,
      startTime,
      endTime,
      status: 'scheduled',
      attendance: 'pending',
      ptNote
    })

    return res.status(StatusCodes.CREATED).json({ success: true, data: session })
  } catch (e) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: e.message })
  }
}

export const ptStudentController = {
  listMyStudents,
  listSessionsByStudentPackage,
  createSessionForStudentPackage
}
