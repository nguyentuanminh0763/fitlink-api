import express from 'express'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { ptWalletController } from '~/controllers/ptWalletController'

const router = express.Router()

router.get(
  '/wallet/my',
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  ptWalletController.getMyWallet
)

export default router
