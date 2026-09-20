import express from 'express'
import { getPTsByAvailableSlot, getPTById } from '../controllers/searchController.js'
import { cacheResponse } from '../middlewares/cacheMiddleware.js'

const router = express.Router()

// ✅ F4.3 + F4.4 – Tìm PT theo slot & sort (Cache 5 phút)
router.get('/pts', cacheResponse(300), getPTsByAvailableSlot)

// ✅ Chi tiết 1 PT theo id (Cache 10 phút)
router.get('/pts/:id', cacheResponse(600), getPTById)

export default router
