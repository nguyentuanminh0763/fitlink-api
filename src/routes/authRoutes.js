import express from 'express'
import { authController } from '~/controllers/authController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { authValidation } from '~/validations/authValidation'
import { userController } from '~/controllers/userController'
import { imageUpload } from '~/middlewares/upload'

const router = express.Router()

router.post('/register', authValidation.registerByPhone, authController.registerByPhone)
router.post('/login', authValidation.login, authController.login)
router.post('/logout', authController.logout)
router.get('/me', authMiddleware.authenTokenCookie, userController.getProfile)
router.get('/user-profile', authMiddleware.authenTokenCookie, userController.getUserProfile)
router.put('/profile', authMiddleware.authenTokenCookie, imageUpload.single('avatar'), authValidation.updateProfile, userController.updateProfile)
router.post('/upload-avatar', authMiddleware.authenTokenCookie, imageUpload.single('avatar'), userController.uploadAvatar)
router.put('/change-password', authValidation.changePassword, authMiddleware.authenTokenCookie, userController.changePassword)
router.post('/forgot-password', authValidation.forgotPassword, authController.forgotPassword)
router.post('/reset-password/:token', authValidation.resetPassword, authController.resetPassword)
router.post('/google', authController.loginWithGoogle)
router.post('/register/start', authController.registerByPhoneStart)
router.get('/register/confirm', authController.registerByPhoneConfirm)

export default router
