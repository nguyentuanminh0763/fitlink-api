// src/routes/scheduleRoutes.js
import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { scheduleController } from '~/controllers/scheduleController'

const router = express.Router()

router.get('/schedule/preview', authMiddleware.authenTokenCookie, scheduleController.previewSchedule)
router.post('/schedule/generate', authMiddleware.authenTokenCookie, scheduleController.generateSchedule)
// src/routes/scheduleRoutes.js
router.post('/schedule/preview-draft', authMiddleware.authenTokenCookie, scheduleController.previewScheduleDraft)

export default router
