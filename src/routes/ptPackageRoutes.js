import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { packageController } from '~/controllers/packageController'
import { cacheResponse } from '~/middlewares/cacheMiddleware'

const router = express.Router()

// ====== ROUTES CHO PT ====== //
// Tạo gói mới
router.post(
  '/packages',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  packageController.createPackage
)

// Danh sách gói của PT
router.get(
  '/packages',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  packageController.getMyPackages
)

// Xem chi tiết 1 gói (PT hoặc public)
router.get(
  '/packages/:id',
  authMiddleware.authenTokenCookie,
  packageController.getPackageById
)

// Cập nhật gói
router.put(
  '/packages/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  packageController.updatePackage
)

// Ẩn gói (soft delete)
router.delete(
  '/packages/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  packageController.deletePackage
)

// Xoá hẳn gói (hard delete)
router.delete(
  '/packages/:id/hard',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  packageController.hardDeletePackage
)

// ====== PUBLIC ROUTES CHO STUDENT ====== //
// Student xem danh sách gói public của 1 PT (Cache 10 phút)
router.get('/:ptId/packages', cacheResponse(600), packageController.getPackagesByPTPublic)

export default router
