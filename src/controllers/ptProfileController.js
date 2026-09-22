import mongoose from 'mongoose'
import { StatusCodes } from 'http-status-codes'
import PTProfile from '~/models/PTProfile'
import User from '~/models/User'
import cloudinary from '~/config/cloudinary'
import { slugify } from '~/utils/formatters'
import { cacheService } from '~/services/cacheService'

// helpers/ptProfileSanitizer.js
export function sanitizePTProfile(body = {}) {
  const payload = {}

  // ----- flat fields -----
  if (typeof body.coverImage !== 'undefined') payload.coverImage = String(body.coverImage || '').trim()
  if (typeof body.bio !== 'undefined') payload.bio = String(body.bio || '').trim()
  if (typeof body.videoIntroUrl !== 'undefined')
    payload.videoIntroUrl = String(body.videoIntroUrl || '').trim()
  if (typeof body.availableForNewClients !== 'undefined')
    payload.availableForNewClients = !!body.availableForNewClients
  if (typeof body.areaNote !== 'undefined') payload.areaNote = String(body.areaNote || '').trim()

  // specialties
  if (typeof body.specialties !== 'undefined') {
    payload.specialties = []
      .concat(body.specialties)
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
  }

  // yearsExperience clamp 0..50
  if (typeof body.yearsExperience !== 'undefined') {
    const y = Number(body.yearsExperience)
    payload.yearsExperience = Number.isFinite(y) ? Math.max(0, Math.min(50, Math.trunc(y))) : 0
  }

  // certificates
  if (typeof body.certificates !== 'undefined') {
    payload.certificates = []
      .concat(body.certificates)
      .map(c => ({
        name: (c?.name || '').trim(),
        issuer: (c?.issuer || '').trim(),
        year: Number.isFinite(Number(c?.year)) ? Number(c.year) : undefined,
        url: (c?.url || '').trim()
      }))
      .filter(c => c.name)
  }

  // primaryGym
  if (typeof body.primaryGym !== 'undefined') {
    const pg = body.primaryGym || {}
    const out = {}
    if (typeof pg.name !== 'undefined') out.name = String(pg.name || '').trim()
    if (typeof pg.address !== 'undefined') out.address = String(pg.address || '').trim()

    if (typeof pg.location !== 'undefined') {
      const coords = pg?.location?.coordinates
      const [lng, lat] =
        Array.isArray(coords) && coords.length === 2
          ? [Number(coords[0]) || 0, Number(coords[1]) || 0]
          : [0, 0]
      out.location = { type: 'Point', coordinates: [lng, lat] }
    }

    if (typeof pg.photos !== 'undefined') {
      out.photos = []
        .concat(pg.photos)
        .map(u => (typeof u === 'string' ? u.trim() : ''))
        .filter(Boolean)
    }

    if (Object.keys(out).length) payload.primaryGym = out
  }

  // deliveryModes
  if (typeof body.deliveryModes !== 'undefined') {
    payload.deliveryModes = {
      atPtGym: !!body.deliveryModes?.atPtGym,
      atClient: !!body.deliveryModes?.atClient,
      atOtherGym: !!body.deliveryModes?.atOtherGym
    }
  }

  // travelPolicy
  if (typeof body.travelPolicy !== 'undefined') {
    payload.travelPolicy = {
      enabled: !!body.travelPolicy?.enabled,
      freeRadiusKm: Number(body.travelPolicy?.freeRadiusKm) || 0,
      feePerKm: Number(body.travelPolicy?.feePerKm) || 0,
      maxTravelKm: Number(body.travelPolicy?.maxTravelKm) || 0
    }
  }

  // workingHours
  if (Array.isArray(body.workingHours)) {
    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    payload.workingHours = body.workingHours
      .map(d => ({
        dayOfWeek: Number(d?.dayOfWeek),
        intervals: Array.isArray(d?.intervals)
          ? d.intervals
            .map(i => ({
              start: String(i?.start || '').trim(),
              end: String(i?.end || '').trim()
            }))
            .filter(i => hhmm.test(i.start) && hhmm.test(i.end) && i.start < i.end)
          : []
      }))
      .filter(d => Number.isFinite(d.dayOfWeek) && d.dayOfWeek >= 0 && d.dayOfWeek <= 6 && d.intervals.length > 0);
  }


  // never allow system fields
  delete payload.verified
  delete payload.ratingAvg
  delete payload.ratingCount

  return payload
}

// GET /api/pt/account/me  → trả thông tin account đầy đủ cho PT
const getMyAccount = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId)
      .select('name avatar gender dob address email phone role verified')

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    return res.status(200).json({ success: true, data: user })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

/// GET /api/pt/profile/me
const getMyProfile = async (req, res) => {
  try {
    const ptId = req.user._id

    let profile = await PTProfile.findOne({ user: ptId })
    if (!profile) {
      // auto-create hồ sơ rỗng hợp lệ với GeoJSON mặc định
      profile = await PTProfile.create({
        user: ptId,
        coverImage: '',
        bio: '',
        specialties: [],
        yearsExperience: 0,
        certificates: [],
        gymLocation: '',
        availableForNewClients: true,
        socials: { facebook: '', instagram: '', tiktok: '' },
        videoIntroUrl: '',
        location: {
          address: '',
          coords: { type: 'Point', coordinates: [0, 0] }
        }
      })
    }

    res.status(StatusCodes.OK).json({ success: true, data: profile })
  } catch (err) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: err.message })
  }
}

// PUT /api/pt/profile/me  (upsert)
export const upsertMyProfile = async (req, res) => {
  try {
    const ptId = req.user?._id

    // Chỉ PT mới được cập nhật hồ sơ PT
    const user = await User.findById(ptId).select('role')
    if (!user || user.role !== 'pt') {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: 'Only PT can update PT profile' })
    }

    // Làm sạch payload theo model mới (không có socials)
    const payload = sanitizePTProfile(req.body)

    // Không cho client set các field hệ thống
    delete payload.verified
    delete payload.ratingAvg
    delete payload.ratingCount
    delete payload.user

    const doc = await PTProfile.findOneAndUpdate(
      { user: ptId },
      { $set: { user: ptId, ...payload } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    ).lean()

    // Xoá cache của riêng PT này (kèm danh sách) để học viên thấy ngay cập nhật
    await cacheService.invalidatePT(ptId, doc?.slug)

    return res
      .status(StatusCodes.OK)
      .json({ success: true, message: 'PT profile saved', data: doc })
  } catch (error) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Server error', error: error.message })
  }
}

// GET /api/pt/:ptId/profile  (public)
const getPTProfilePublic = async (req, res) => {
  try {
    const { ptId } = req.params
    const profile = await PTProfile.findOne({ user: ptId })
      // ẩn bớt trường nội bộ (nếu có); ở đây mình chỉ để nguyên các field public
      .select('-__v -updatedAt -createdAt') // tuỳ bạn
      .lean()

    if (!profile) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: 'PT chưa có hồ sơ' })
    }
    return res.status(StatusCodes.OK).json({ success: true, data: profile })
  } catch (error) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Lỗi server', error: error.message })
  }
}

// DELETE /api/pt/profile/me  (tuỳ chọn)
const deleteMyProfile = async (req, res) => {
  try {
    const ptId = req.user?._id
    // Lấy slug TRƯỚC khi xoá, vì sau đó không còn tra được để dọn cache theo slug
    const profile = await PTProfile.findOne({ user: ptId }).select('slug').lean()
    const r = await PTProfile.deleteOne({ user: ptId })
    if (r.deletedCount === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Không tìm thấy hồ sơ để xoá' })
    }

    await cacheService.invalidatePT(ptId, profile?.slug)

    return res
      .status(StatusCodes.OK)
      .json({ success: true, message: 'Đã xoá hồ sơ PT' })
  } catch (error) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Lỗi server', error: error.message })
  }
}


const uploadCoverImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'fitlink/pt-covers' },
      async (error, result) => {
        if (error) return res.status(500).json({ error })

        // cập nhật link vào PTProfile
        await PTProfile.updateOne(
          { user: req.user._id },
          { $set: { coverImage: result.secure_url } },
          { upsert: true }
        )

        const profile = await PTProfile.findOne({ user: req.user._id }).select('slug').lean()
        await cacheService.invalidatePT(req.user._id, profile?.slug)

        res.json({ success: true, url: result.secure_url })
      }
    ).end(req.file.buffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
/* =========================================================
   🆕 1️⃣ LẤY DANH SÁCH TẤT CẢ PT (PUBLIC)
   GET /api/pt/public/list
========================================================= */
const getAllPTProfilesPublic = async (req, res) => {
  try {
    const { keyword, specialty, available } = req.query
    const filter = {}

    // lọc theo chuyên môn nếu có
    if (specialty) {
      filter.specialties = { $regex: specialty, $options: 'i' }
    }

    // chỉ lấy PT đang mở nhận học viên mới
    if (available === 'true') {
      filter.availableForNewClients = true
    }

    // lấy danh sách PT
    const profiles = await PTProfile.find(filter)
      .populate('user', 'name email avatar phone role')
      .select(
        'coverImage bio specialties yearsExperience gymLocation ratingAvg location availableForNewClients socials videoIntroUrl'
      )
      .lean()

    // chỉ giữ user có role là 'pt' và có keyword (nếu có)
    const list = profiles
      .filter(
        (p) =>
          p.user &&
          p.user.role === 'pt' &&
          (!keyword ||
            p.user.name.toLowerCase().includes(keyword.toLowerCase()) ||
            (p.bio && p.bio.toLowerCase().includes(keyword.toLowerCase())))
      )
      .map(p => ({
        ...p,
        slug: p.slug || slugify(p.user?.name)
      }))

    return res.status(StatusCodes.OK).json({
      success: true,
      total: list.length,
      data: list
    })
  } catch (error) {
    console.error('getAllPTProfilesPublic error:', error)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi khi lấy danh sách PT',
      error: error.message
    })
  }
}

/* =========================================================
   🆕 2️⃣ LẤY CHI TIẾT PT CỤ THỂ (PUBLIC)
   GET /api/pt/public/:id
   Hỗ trợ cả MongoDB ObjectId lẫn URL slug (ví dụ: 'tran-mai-anh')
========================================================= */
const getPTDetailPublic = async (req, res) => {
  try {
    const { id } = req.params

    let profile = null

    if (mongoose.isValidObjectId(id)) {
      profile = await PTProfile.findOne({ user: id })
        .populate('user', 'name email avatar phone role')
        .select('-__v -updatedAt -createdAt')
        .lean()

      if (!profile) {
        profile = await PTProfile.findById(id)
          .populate('user', 'name email avatar phone role')
          .select('-__v -updatedAt -createdAt')
          .lean()
      }
    }

    // Nếu không tìm thấy bằng ObjectId hoặc id là slug (ví dụ: 'tran-mai-anh')
    if (!profile) {
      profile = await PTProfile.findOne({ slug: id })
        .populate('user', 'name email avatar phone role')
        .select('-__v -updatedAt -createdAt')
        .lean()
    }

    if (!profile) {
      // Tìm PT có slug tương ứng với tên
      const allProfiles = await PTProfile.find({})
        .populate('user', 'name email avatar phone role')
        .select('-__v -updatedAt -createdAt')
        .lean()

      profile = allProfiles.find(p => {
        if (!p.user) return false
        const s = p.slug || slugify(p.user.name)
        return s.toLowerCase() === String(id).toLowerCase()
      })
    }

    if (!profile || profile.user?.role !== 'pt') {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Không tìm thấy PT' })
    }

    // Đảm bảo slug luôn có trong kết quả
    if (!profile.slug && profile.user?.name) {
      profile.slug = slugify(profile.user.name)
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: profile
    })
  } catch (error) {
    console.error('getPTDetailPublic error:', error)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết PT',
      error: error.message
    })
  }
}
export const ptProfileController = {
  getMyProfile,
  upsertMyProfile,
  getPTProfilePublic,
  deleteMyProfile,
  uploadCoverImage,
  getMyAccount,
  getAllPTProfilesPublic,
  getPTDetailPublic
}
