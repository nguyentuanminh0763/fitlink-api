// src/routes/messageRoutes.js
import express from 'express'
import {
  getMessagesByChat,
  createMessage,
  getMyPTs
} from '../controllers/messageController.js'
import { authMiddleware } from '~/middlewares/authMiddleware'

const router = express.Router()

// 🆕 Lấy danh sách PT của user hiện tại
router.get(
  '/my-pts',
  authMiddleware.authenTokenCookie,
  getMyPTs
)

// Lấy messages theo chatId
router.get(
  '/:chatId',
  authMiddleware.authenTokenCookie,
  getMessagesByChat
)

// Gửi message
router.post(
  '/',
  authMiddleware.authenTokenCookie,
  createMessage
)

export default router
