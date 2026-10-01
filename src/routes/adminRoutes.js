import express from 'express'
import { userAdminController } from '../controllers/userAdminController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import PTProfile from '../models/PTProfile.js'
import StudentProfile from '../models/StudentProfile.js'
import Booking from '../models/Booking.js'
import User from '../models/User.js'
import { getAllStudents } from '../controllers/studentController.js'
import { getAllPTs } from '../controllers/ptController.js'


const router = express.Router()

// USER
// Lấy danh sách user
router.get(
  '/users',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getAllUsers
)
// Block user
router.patch(
  '/users/:id/block',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.blockUser
)
// Unlock user
router.patch(
  '/users/:id/unlock',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.unlockUser
)
// Đếm số lượng khách hàng (role customer)
router.get('/users/count', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, userAdminController.countCustomers)
// ADMIN OVERVIEW ROUTE
router.get('/overview', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, async (req, res) => {
  try {
    // Tổng số PT (tất cả)
    const totalPTs = await PTProfile.countDocuments()

    // Tổng số học viên (tất cả user có role student)
    const totalStudents = await User.countDocuments({ role: 'student' })

    // Tổng số booking
    const totalBookings = await Booking.countDocuments()

    // Danh sách PT (tất cả)
    const approvedPTs = await PTProfile.find()

    res.json({
      totalPTs,
      totalStudents,
      totalBookings,
      approvedPTs
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
})
router.get('/students', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, getAllStudents)
router.get('/pts', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, getAllPTs)
router.get(
  '/users/count',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.countCustomers
)

// ✅ Thêm mới các route duyệt PT
router.get(
  '/pt-requests',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getAllPTRequests
)
router.get(
  '/pt-requests/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.getPTRequestDetail
)
router.post(
  '/pt-requests/:id/review',
  authMiddleware.authenTokenCookie,
  authMiddleware.isAdmin,
  userAdminController.reviewPTRequest
)
export default router
