// src/routes/studentRoutes.js
import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { getMyPTs } from '../controllers/studentController.js'
import { studentController } from '~/controllers/studentController.js'
import { getStudentProfile, getDefaultLocationByStudentId, upsertDefaultLocation } from '../controllers/studentController.js'

const router = express.Router()

router.get(
  '/me/pts',
  authMiddleware.authenTokenCookie, // ✅ middleware xác thực
  authMiddleware.isStudent, // ✅ middleware kiểm tra role
  getMyPTs
)

// Cập nhật BMI
router.post(
  '/bmi',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  studentController.updateBMI
)

router.get(
  '/:studentId/profile',
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  getStudentProfile
)

// Lấy toạ độ mặc định theo studentId (GET)
router.get('/:studentId/default-location', authMiddleware.authenTokenCookie, getDefaultLocationByStudentId)

// Cập nhật toạ độ mặc định cho chính user đang đăng nhập (PUT)
router.put('/default-location', authMiddleware.authenTokenCookie, upsertDefaultLocation)

export default router
