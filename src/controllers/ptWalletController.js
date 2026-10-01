import PTWallet from '~/models/PTWallet'

const getMyWallet = async (req, res) => {
  try {
    console.log('req.user =', req.user) // debug
    const wallet = await PTWallet.findOne({ pt: req.user._id })
    return res.json({ success: true, data: { available: wallet?.available || 0 } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}


export const ptWalletController = {
  getMyWallet
}