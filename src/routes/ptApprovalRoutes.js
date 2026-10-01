import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { submitPTApprovalRequest, ptGetMyLatestRequest } from '../controllers/ptApprovalController.js'

const router = express.Router()

router.post(
  '/approval-request',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  submitPTApprovalRequest
)

router.get('/approval-requests/my', authMiddleware.authenTokenCookie, authMiddleware.isPT, ptGetMyLatestRequest)

export default router
