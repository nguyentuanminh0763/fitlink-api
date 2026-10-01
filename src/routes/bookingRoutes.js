import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { getBlocksSimple } from '../controllers/bookingController.js'
import { createBookingAndGenerateSlots } from '~/controllers/bookingSimpleController.js'

const router = express.Router()

router.get(
  '/:ptId/blocks-simple',
  authMiddleware.authenTokenCookie,
  getBlocksSimple
)

// FE đẩy full payload ở body
router.post('/create-slots', createBookingAndGenerateSlots)

export default router
