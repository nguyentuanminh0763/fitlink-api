import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { ptController } from '~/controllers/ptController'

const router = express.Router()

router.get('/me/verification-status', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptController.isPTVerified);

// ✅ Lấy danh sách học viên của PT (đang đăng nhập)
router.get("/me/students", authMiddleware.authenTokenCookie, authMiddleware.isPT, ptController.getMyStudents);

router.get(
    "/me/packages",
    authMiddleware.authenTokenCookie,
    authMiddleware.isPT,
    ptController.getMyPackages
);

router.get(
  '/me/dashboard',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptController.getDashboardStats
);
export default router
