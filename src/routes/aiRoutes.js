// src/routes/aiRoutes.js
import express from 'express'
import { chatAI } from '../controllers/aiController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

const router = express.Router()

// AI chat cho user đã đăng nhập (student hoặc pt đều được)
router.post('/chat', authMiddleware.authenTokenCookie, chatAI)

export default router
