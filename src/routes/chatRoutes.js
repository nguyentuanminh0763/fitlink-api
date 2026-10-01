// routes/chatRoutes.js
import express from 'express'
import StudentPackage from '../models/StudentPackage.js'

const router = express.Router()

// Lấy danh sách học viên của PT
router.get('/students', async (req, res) => {
  try {
    const ptId = req.user._id // lấy từ token (sau khi đăng nhập với role=pt)
    const packages = await StudentPackage.find({ pt: ptId, status: 'active' })
      .populate('student', 'name avatar email')

    const students = packages.map((p) => p.student)
    res.json(students)
  } catch (err) {
    console.error('Lỗi lấy danh sách học viên:', err)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

export default router
