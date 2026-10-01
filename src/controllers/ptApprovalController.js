import PTApprovalRequest from '../models/PTApprovalRequest.js'
import PTProfile from '../models/PTProfile.js'
import User from '../models/User.js'
import { createNotification } from '../services/notificationService.js'
import { sendNewPTRequestEmail } from '../utils/mailer.js'
import { StatusCodes } from 'http-status-codes'

// Build immutable snapshot from current PTProfile (keeps Admin view stable)
const buildSnapshot = (p) => ({
  primaryGym: {
    name: p.primaryGym?.name || '',
    address: p.primaryGym?.address || '',
    location: p.primaryGym?.location ? {
      type: 'Point',
      coordinates: p.primaryGym.location.coordinates || []
    } : undefined,
    photos: p.primaryGym?.photos || []
  },
  deliveryModes: {
    atPtGym: !!p.deliveryModes?.atPtGym,
    atClient: !!p.deliveryModes?.atClient,
    atOtherGym: !!p.deliveryModes?.atOtherGym
  },
  travelPolicy: {
    enabled: p.travelPolicy?.enabled ?? true,
    freeRadiusKm: p.travelPolicy?.freeRadiusKm ?? 6,
    maxTravelKm: p.travelPolicy?.maxTravelKm ?? 20,
    feePerKm: p.travelPolicy?.feePerKm ?? 10000
  },
  coverImage: p.coverImage || '',
  bio: p.bio || '',
  specialties: p.specialties || [],
  yearsExperience: p.yearsExperience || 0,
  certificates: p.certificates || [],
  areaNote: p.areaNote || '',
  videoIntroUrl: p.videoIntroUrl || ''
})

/**
 * POST /api/pt/profile/submit-review
 * PT submits a new approval request (idempotent via partial unique index on status=pending)
 */
export const ptSubmitReview = async (req, res) => {
  try {
    const userId = req.user._id

    const profile = await PTProfile.findOne({ user: userId })
    if (!profile) return res.status(StatusCodes.NOT_FOUND).json({ message: 'PT profile not found' })
    if (profile.verified) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Already verified' })

    // Minimal completeness check – tune as you wish
    if (!profile.bio || !profile.primaryGym?.name) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Profile incomplete' })
    }

    // Create new pending (partial unique index prevents duplicate "pending")
    const doc = await PTApprovalRequest.create({
      user: userId,
      ptProfile: profile._id,
      submittedProfile: buildSnapshot(profile),
      logs: [{ action: 'submit', by: userId, note: 'Submit for review' }]
    })


    //--- Notify admins by notification + email

    console.log('✅ Đã tạo yêu cầu duyệt PT:', doc._id)

    // 📬 Gửi notification + mail cho admin
    const admins = await User.find({ role: 'admin' })
    console.log(
      '🧩 Admins tìm thấy:',
      admins.map((a) => a.email)
    )

    for (const admin of admins) {
      console.log(`📨 Gửi thông báo & mail cho admin: ${admin.email}`)

      await createNotification({
        user: admin._id,
        type: 'system',
        title: 'Yêu cầu duyệt hồ sơ PT mới',
        message: `PT ${req.user.name} (${req.user.email}) vừa gửi yêu cầu duyệt hồ sơ.`,
        meta: { requestId: doc._id }
      })

      try {
        await sendNewPTRequestEmail(admin.email, req.user.name, req.user.email)
        console.log(`✅ Đã gửi email tới ${admin.email}`)
      } catch (mailError) {
        console.error(`❌ Lỗi khi gửi email tới ${admin.email}:`, mailError)
      }
    }

    console.log('🎉 Đã hoàn tất gửi yêu cầu duyệt PT')

    //--- Return success


    return res.status(StatusCodes.CREATED).json({
      message: 'Submitted',
      requestId: doc._id
    })
  } catch (err) {
    // If unique index hit: return clearer message
    if (err?.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Already has a pending request' })
    }
    console.error('ptSubmitReview error:', err)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' })
  }
}

/**
 * GET /api/pt/profile/requests
 * List my requests (history). Supports pagination & filter by status.
 * Query: ?status=pending|approved|rejected|cancelled (optional)
 *        ?page=1&limit=10
 */
export const ptListMyRequests = async (req, res) => {
  try {
    const userId = req.user._id
    const {
      status, // optional
      page = 1,
      limit = 10
    } = req.query

    const q = { user: userId }
    if (status) q.status = status

    const p = Math.max(parseInt(page, 10) || 1, 1)
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const [items, total] = await Promise.all([
      PTApprovalRequest
        .find(q)
        .select('-submittedProfile.certificates.url') // example: hide long urls if you want
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      PTApprovalRequest.countDocuments(q)
    ])

    return res.json({
      page: p,
      limit: l,
      total,
      items
    })
  } catch (err) {
    console.error('ptListMyRequests error:', err)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' })
  }
}

/**
 * GET /api/pt/profile/requests/latest
 * Get the latest request (useful for showing current state on Profile page)
 */
export const ptGetMyLatestRequest = async (req, res) => {
  try {
    const userId = req.user._id
    const doc = await PTApprovalRequest
      .findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean()

    return res.json({ request: doc || null })
  } catch (err) {
    console.error('ptGetMyLatestRequest error:', err)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' })
  }
}

/**
 * POST /api/pt/profile/cancel-pending
 * Allow PT to cancel own pending request (optional but useful)
 */
export const ptCancelMyPending = async (req, res) => {
  try {
    const userId = req.user._id
    const doc = await PTApprovalRequest.findOne({ user: userId, status: 'pending' })
    if (!doc) return res.status(StatusCodes.NOT_FOUND).json({ message: 'No pending request' })

    doc.status = 'cancelled'
    doc.logs.push({ action: 'cancel', by: userId, note: 'Cancel by PT' })
    await doc.save()

    return res.json({ message: 'Cancelled' })
  } catch (err) {
    console.error('ptCancelMyPending error:', err)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' })
  }
}

/**
 * 📨 PT gửi yêu cầu duyệt hồ sơ
 */
export const submitPTApprovalRequest = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id // ✅ fix để lấy đúng id từ cookie-based auth
    console.log('👤 PT gửi yêu cầu:', req.user)

    // 🔍 Kiểm tra có hồ sơ PT chưa
    const ptProfile = await PTProfile.findOne({ user: userId })
    if (!ptProfile) {
      console.log('❌ Không tìm thấy hồ sơ PT cho userId:', userId)
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ PT' })
    }

    // ⚠️ Kiểm tra đã gửi yêu cầu trước đó chưa
    const existing = await PTApprovalRequest.findOne({
      user: userId,
      status: 'pending'
    })
    if (existing) {
      console.log('⚠️ PT đã có yêu cầu pending:', existing._id)
      return res
        .status(400)
        .json({ message: 'Bạn đã có yêu cầu đang chờ duyệt' })
    }

    // ✅ Tạo yêu cầu duyệt mới
    const newRequest = await PTApprovalRequest.create({
      user: userId,
      ptProfile: ptProfile._id,
      submittedProfile: ptProfile.toObject(),
      logs: [{ action: 'submit', by: userId }]
    })

    console.log('✅ Đã tạo yêu cầu duyệt PT:', newRequest._id)

    // 📬 Gửi notification + mail cho admin
    const admins = await User.find({ role: 'admin' })
    console.log(
      '🧩 Admins tìm thấy:',
      admins.map((a) => a.email)
    )

    for (const admin of admins) {
      console.log(`📨 Gửi thông báo & mail cho admin: ${admin.email}`)

      await createNotification({
        user: admin._id,
        type: 'system',
        title: 'Yêu cầu duyệt hồ sơ PT mới',
        message: `PT ${req.user.name} (${req.user.email}) vừa gửi yêu cầu duyệt hồ sơ.`,
        meta: { requestId: newRequest._id }
      })

      try {
        await sendNewPTRequestEmail(admin.email, req.user.name, req.user.email)
        console.log(`✅ Đã gửi email tới ${admin.email}`)
      } catch (mailError) {
        console.error(`❌ Lỗi khi gửi email tới ${admin.email}:`, mailError)
      }
    }

    console.log('🎉 Đã hoàn tất gửi yêu cầu duyệt PT')

    res.status(201).json({
      message: 'Đã gửi yêu cầu duyệt hồ sơ PT',
      request: newRequest
    })
  } catch (error) {
    console.error('💥 Lỗi trong submitPTApprovalRequest:', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

export const ptApprovalController = {
  ptSubmitReview,
  ptListMyRequests,
  ptGetMyLatestRequest,
  ptCancelMyPending,
  submitPTApprovalRequest
}
