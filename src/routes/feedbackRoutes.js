// src/routes/feedbackRoutes.js
import express from 'express'
import { createFeedback, getFeedbackByPT } from '../controllers/feedbackController.js'
//Thêm middleware xác thực

import { authMiddleware } from '../middlewares/authMiddleware.js'
import { getMine } from '../controllers/ptFeedbackController.js'

import { protect } from '../middlewares/authMiddleware.js'
const router = express.Router()

router.post('/', protect, createFeedback)
router.get('/pt/:ptId', protect, getFeedbackByPT)


router.get('/me', authMiddleware.authenTokenCookie, getMine)

export default router
