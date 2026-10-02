import Session from '../models/Session.js'
import Notification from '../models/Notification.js'

/**
 * @desc Update session status or PT note
 * @route PUT /api/sessions/:id/status
 * @access Private (PT/Admin)
 */
export const updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, ptNote, attendance } = req.body
    const userId = req.user?._id
    // from auth middleware

    const session = await Session.findById(id)
      .populate('student', 'fullName email')
      .populate('pt', 'fullName')
      .populate('studentPackage', 'totalSessions')
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' })
    }

    // ✅ Authorization check
    const sessionPtId = session.pt?._id
      ? String(session.pt._id)
      : String(session.pt)
    const currentUserId = String(userId)
    if (sessionPtId !== currentUserId && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'You do not have permission to update this session.' })
    }

    // ✅ Update session data
    if (status) session.status = status
    if (ptNote !== undefined) session.ptNote = ptNote
    if (attendance) session.attendance = attendance
    if (status === 'completed') session.completedAt = new Date()

    await session.save()
    // 🆕 Emit realtime khi PT cập nhật buổi tập
    if (global.emitSessionUpdate) {
      global.emitSessionUpdate(session.student._id, {
        sessionId: session._id,
        status: session.status,
        ptNote: session.ptNote,
        attendance: session.attendance,
        startTime: session.startTime,
        endTime: session.endTime
      })
    }

    // ✅ Build notification message dynamically
    let message = `The session "${session.title}" has been updated`
    if (status) message += `: ${status}`
    if (ptNote) message += `. Trainer's note: ${ptNote}`
    if (!message.endsWith('.')) message += '.'

    // ✅ Save notification to database
    await Notification.create({
      user: session.student._id,
      type: 'session',
      title: 'Session Update',
      message,
      meta: { sessionId: session._id, status, ptNote }
    })

    // ✅ Send realtime notification via Socket.IO (if available)
    if (global.sendNotificationToUser) {
      global.sendNotificationToUser(session.student._id, {
        title: 'Session Update',
        message,
        type: 'session',
        createdAt: new Date(),
        meta: { sessionId: session._id, status, ptNote }
      })
    }

    // ✅ If this was the final session in the package
    if (status === 'completed') {
      const totalSessions = session.studentPackage?.totalSessions || 0
      const completedCount = await Session.countDocuments({
        studentPackage: session.studentPackage,
        status: 'completed'
      })

      if (totalSessions > 0 && completedCount >= totalSessions) {
        session.studentPackage.status = 'completed'
        await session.studentPackage.save()

        await Notification.create({
          user: session.student._id,
          type: 'session',
          title: '🎉 Training Package Completed',
          message: `You’ve completed all your training sessions! Please take a moment to rate and provide feedback for your trainer, ${session.pt.fullName}.`,
          meta: {
            ptId: session.pt._id,
            studentPackageId: session.studentPackage._id,
            feedbackRequest: true
          }
        })
      }
    }
    return res.json({
      message: 'Session updated successfully',
      session
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Server error', error: err.message })
  }
}

/**
 * @desc Get all sessions assigned to the current PT
 * @route GET /api/sessions/pt
 * @access Private (PT)
 */
export const getSessionsByPT = async (req, res) => {
  try {
    const ptId = req.user._id

    const sessions = await Session.find({ pt: ptId })
      .populate('studentPackage', 'name totalSessions')
      .populate('student', 'fullName name email phone avatar')
      .select(
        '_id title startTime endTime status attendance ptNote studentNote createdAt updatedAt student studentPackage pt'
      )
      .sort({ startTime: 1 })

    // ✅ Convert to frontend-friendly format
    const mapped = sessions.map((s) => {
      const start = new Date(s.startTime)
      const end = new Date(s.endTime)

      // Server chạy giờ VN (TZ=Asia/Ho_Chi_Minh trong Dockerfile) → getHours/getDate đã là giờ VN.
      // Không dùng toISOString() để lấy ngày: nó luôn theo UTC, buổi trước 07:00 sáng sẽ ra ngày hôm trước.
      const pad = (n) => n.toString().padStart(2, '0')
      const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
      const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`

      return {
        ...s.toObject(),
        date, // e.g. "2025-11-10"
        start: hhmm(start), // e.g. "13:00"
        end: hhmm(end) // e.g. "14:00"
      }
    })

    res.status(200).json({
      success: true,
      data: mapped
    })
  } catch (error) {
    console.error('❌ getSessionsByPT error:', error)
    res.status(500).json({ message: 'Server error while loading sessions' })
  }
}
