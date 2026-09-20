import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { ptProfileController } from '~/controllers/ptProfileController'
import { cacheResponse } from '~/middlewares/cacheMiddleware'
import multer from 'multer'
import {
  ptSubmitReview,
  ptListMyRequests,
  ptGetMyLatestRequest,
  ptCancelMyPending
} from '~/controllers/ptApprovalController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// PT tự xem/cập nhật hồ sơ mình
router.get(
  '/profile/me',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptProfileController.getMyProfile
)
router.put(
  '/profile/me',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptProfileController.upsertMyProfile
)
router.delete(
  '/profile/me',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptProfileController.deleteMyProfile
)

router.post(
  '/upload-cover',
  authMiddleware.authenTokenCookie,
  upload.single('coverImage'),
  ptProfileController.uploadCoverImage
)

router.get(
  '/account/me',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptProfileController.getMyAccount
)

router.post('/profile/submit-review', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptSubmitReview)
router.get('/profile/requests', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptListMyRequests)
router.get('/profile/requests/latest', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptGetMyLatestRequest)
router.post('/profile/cancel-pending', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptCancelMyPending)

router.get('/public/list', cacheResponse(300), ptProfileController.getAllPTProfilesPublic)
router.get('/public/:id', cacheResponse(600), ptProfileController.getPTDetailPublic)
// Public: xem hồ sơ 1 PT
router.get('/:ptId/profile', cacheResponse(600), ptProfileController.getPTProfilePublic)

export default router
