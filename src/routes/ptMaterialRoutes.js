// src/routes/ptMaterialRoutes.js
import express from 'express'

import { authMiddleware } from '~/middlewares/authMiddleware'
import { materialUpload } from '~/middlewares/upload'
import { ptMaterialController } from '~/controllers/ptMaterialController'

const router = express.Router()

/* --------------------------- ROUTES --------------------------- */
/**
 * Tất cả đều bắt đầu bằng /materials ...
 * vì ở server.js ta sẽ mount: app.use("/api/pt", ptMaterialRoutes)
 */

// POST /api/pt/materials/upload
router.post(
  '/materials/upload',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  materialUpload.single('file'),
  ptMaterialController.uploadFile
)

// GET /api/pt/materials
router.get(
  '/materials',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptMaterialController.getMyMaterials
)

// POST /api/pt/materials
router.post(
  '/materials',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptMaterialController.createMaterial
)

// PUT /api/pt/materials/:id
router.put(
  '/materials/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptMaterialController.updateMaterial
)

// DELETE /api/pt/materials/:id
router.delete(
  '/materials/:id',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptMaterialController.deleteMaterial
)

// POST /api/pt/materials/:id/share
router.post(
  '/materials/:id/share',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptMaterialController.shareMaterial
)

export default router
