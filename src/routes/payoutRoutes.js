// src/routes/aiRoutes.js
import express from 'express'
import { createPayoutRequest, getMyPayoutRequests, getMyWallet } from '~/controllers/ptPayoutController.js'
import { listPayoutRequests, completePayout, rejectPayout } from '~/controllers/adminPayoutController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/pt/create', authMiddleware.authenTokenCookie, createPayoutRequest)

// (tuỳ chọn) PT xem danh sách yêu cầu của chính mình
router.get('/pt/my-requests', authMiddleware.authenTokenCookie, authMiddleware.isPT, getMyPayoutRequests)

router.get('/pt/wallet/my', authMiddleware.authenTokenCookie, authMiddleware.isPT, getMyWallet)
//ROUTES CHO ADMIN
router.get('/admin', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, listPayoutRequests)
router.post('/admin/:id/complete', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, completePayout)

// Admin từ chối yêu cầu
router.post('/admin/:id/reject', authMiddleware.authenTokenCookie, authMiddleware.isAdmin, rejectPayout)

export default router

