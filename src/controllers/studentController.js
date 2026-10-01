// src/controllers/studentController.js
import StudentPackage from '../models/StudentPackage.js'
import { StatusCodes } from 'http-status-codes'
import StudentProfile from '../models/StudentProfile.js'
import User from '../models/User.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)
const isValidCoordinates = (lng, lat) => {
  if (typeof lng !== 'number' || typeof lat !== 'number') return false
  if (Number.isNaN(lng) || Number.isNaN(lat)) return false
  // Giới hạn hợp lệ theo WGS84
  if (lng < -180 || lng > 180) return false
  if (lat < -90 || lat > 90) return false
  return true
}

export const getDefaultLocationByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params

    if (!studentId || !isValidObjectId(studentId)) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: 'studentId không hợp lệ' })
    }

    const profile = await StudentProfile.findOne(
      { user: studentId },
      { defaultLocation: 1, _id: 0 }
    ).lean()

    // Không tự tạo profile khi chỉ GET — tránh side-effect
    if (!profile) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: 'Chưa có StudentProfile hoặc chưa thiết lập defaultLocation' })
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      data: profile.defaultLocation ?? null
    })
  } catch (err) {
    console.error('❌ getDefaultLocationByStudentId error:', err)
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'Lỗi server khi lấy defaultLocation' })
  }
}

/** ---------------------------------------------------------
 * PUT /students/default-location
 * hoặc  PUT /students/:studentId/default-location
 * Cập nhật defaultLocation
 * - Ưu tiên :studentId từ params (dùng cho admin), nếu không có
 *   sẽ dùng user hiện tại từ req.user._id
 * - Upsert: true => tạo mới StudentProfile nếu chưa tồn tại
 * --------------------------------------------------------- */
export const upsertDefaultLocation = async (req, res) => {
  try {
    // Cho phép truyền:
    // 1) { lng, lat }
    // 2) { defaultLocation: { type: 'Point', coordinates: [lng, lat] } }
    const { lng, lat, defaultLocation } = req.body

    let targetUserId = req.params.studentId || req.user?._id
    if (!targetUserId || !isValidObjectId(targetUserId)) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: 'Không xác định được user hợp lệ để cập nhật' })
    }

    let point
    if (defaultLocation?.type === 'Point' && Array.isArray(defaultLocation.coordinates)) {
      const [lngIn, latIn] = defaultLocation.coordinates.map(Number)
      if (!isValidCoordinates(lngIn, latIn)) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Toạ độ không hợp lệ. Cần dạng [lng, lat]' })
      }
      point = { type: 'Point', coordinates: [lngIn, latIn] }
    } else {
      const lngNum = Number(lng)
      const latNum = Number(lat)
      if (!isValidCoordinates(lngNum, latNum)) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Thiếu hoặc sai định dạng lng/lat' })
      }
      point = { type: 'Point', coordinates: [lngNum, latNum] }
    }

    // Upsert: tạo mới nếu chưa có profile
    const updated = await StudentProfile.findOneAndUpdate(
      { user: targetUserId },
      {
        $set: { defaultLocation: point },
        $setOnInsert: { user: targetUserId } // đảm bảo field user khi tạo mới
      },
      { new: true, upsert: true }
    )
      .populate('user', 'name email phone avatar')
      .lean()

    return res.status(StatusCodes.OK).json({
      success: true,
      message: '✅ Đã cập nhật defaultLocation thành công',
      data: {
        user: updated.user,
        defaultLocation: updated.defaultLocation
      }
    })
  } catch (err) {
    console.error('❌ upsertDefaultLocation error:', err)
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Dữ liệu gửi lên không đúng định dạng.',
        details: err.message
      })
    }
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'Lỗi server khi cập nhật defaultLocation' })
  }
}

export const getMyPTs = async (req, res) => {
  try {
    const studentId = req.user._id

    const packages = await StudentPackage.find({
      student: studentId,
      status: 'active'
    })
      .populate('pt', 'name avatar email phone')
      .populate({
        path: 'package',
        select: 'name totalSessions durationDays'
      })
      .lean()

    const pts = packages
      .filter(pkg => pkg.pt)
      .map(pkg => ({
        _id: pkg.pt._id,
        name: pkg.pt.name,
        avatar: pkg.pt.avatar,
        email: pkg.pt.email,
        phone: pkg.pt.phone,
        packageId: pkg._id,
        packageName: pkg.package?.name,
        totalSessions: pkg.package?.totalSessions,
        durationDays: pkg.package?.durationDays,
        startDate: pkg.startDate,
        endDate: pkg.endDate,
        remainingSessions: pkg.remainingSessions,
        status: pkg.status
      }))

    return res.status(StatusCodes.OK).json({
      success: true,
      data: pts
    })
  } catch (err) {
    console.error('❌ getMyPTs error:', err)
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'Server error' })
  }
}


export const getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .lean()

    res.status(StatusCodes.OK).json(students)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách student:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

export const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.params.studentId
    const profile = await StudentProfile.findOne({ user: studentId })
      .populate('user', 'name email phone avatar')
      .lean()
    if (!profile) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Không tìm thấy hồ sơ học viên' })
    }
    res.status(StatusCodes.OK).json(profile)
  } catch (error) {
    console.error('Lỗi khi lấy hồ sơ học viên:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

/** -------------------------------
 * Hàm xác định phân loại BMI
 * ------------------------------- */
const getBmiCategory = (bmi) => {
  if (bmi < 18.5) return 'Gầy (Ectomorph)'
  if (bmi >= 18.5 && bmi < 25) return 'Bình thường (Mesomorph)'
  if (bmi >= 25 && bmi < 30) return 'Hơi béo (Endomorph)'
  return 'Béo phì (Endomorph)'
}

/** -------------------------------
 * Controller cập nhật BMI cho Student
 * ------------------------------- */
export const studentController = {
  updateBMI: async (req, res) => {
    try {
      const { heightCm, weightKg } = req.body
      const userId = req.user?._id

      // --- 1. KIỂM TRA DỮ LIỆU ---
      if (!userId) {
        return res.status(401).json({ message: 'User chưa đăng nhập' })
      }
      if (!heightCm || !weightKg) {
        return res.status(400).json({ message: 'Thiếu dữ liệu chiều cao hoặc cân nặng' })
      }

      // --- 2. TÍNH BMI ---
      const bmiValue = weightKg / ((heightCm / 100) ** 2)
      const bmi = bmiValue.toFixed(2) // ✅ Đảm bảo BMI là string khi trả về
      const bmiCategory = getBmiCategory(bmiValue)

      // --- 3. CẬP NHẬT HOẶC TẠO MỚI PROFILE ---
      const updatedProfile = await StudentProfile.findOneAndUpdate(
        { user: userId },
        {
          heightCm,
          weightKg,
          bmi, // lưu dạng string
          bmiCategory
        },
        { new: true, upsert: true }
      )

      // --- 4. PHẢN HỒI VỀ CLIENT ---
      res.status(200).json({
        success: true,
        message: '✅ Đã cập nhật BMI thành công',
        data: updatedProfile
      })
    } catch (err) {
      console.error('❌ Lỗi lưu BMI:', err)
      if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({
          message: 'Dữ liệu gửi lên không đúng định dạng.',
          details: err.message
        })
      }
      res.status(500).json({ message: 'Lỗi server khi lưu BMI' })
    }
  }
}
