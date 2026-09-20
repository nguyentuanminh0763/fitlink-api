import { StatusCodes } from 'http-status-codes'
import User from '~/models/User'
import bcrypt from 'bcrypt'
import cloudinary from '~/config/cloudinary'
import { genarateAccessToken } from '~/utils/genarateTokens'
import { env } from '~/config/environment'

const resolveUserFromRequest = async (req) => {
  const userId = req.user?._id
  let user = null
  if (userId) {
    user = await User.findById(userId).select('-password -refreshToken')
  }
  // Fallback: nếu _id trong token cũ (do re-seed db), tìm bằng phone hoặc email
  if (!user && (req.user?.phone || req.user?.email)) {
    const orList = []
    if (req.user.phone) orList.push({ phone: req.user.phone })
    if (req.user.email) orList.push({ email: req.user.email })
    if (orList.length > 0) {
      user = await User.findOne({ $or: orList }).select('-password -refreshToken')
    }
  }
  return user
}

const refreshCookieIfNeeded = (res, req, user) => {
  if (user && req.user && String(user._id) !== String(req.user._id)) {
    const newPayload = {
      _id: user._id,
      role: user.role,
      phone: user.phone,
      name: user.name,
      avatar: user.avatar,
      email: user.email
    }
    const newAccessToken = genarateAccessToken(newPayload)
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: env.IS_SERCURE_COOKIE,
      sameSite: env.COOKIE_SAMESITE || 'lax',
      maxAge: 24 * 60 * 60 * 1000
    })
    req.user = newPayload
  }
}

const getProfile = async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req)
    if (!user) {
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: env.COOKIE_SAMESITE || 'lax',
        secure: env.IS_SERCURE_COOKIE
      })
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Người dùng không tồn tại' })
    }
    refreshCookieIfNeeded(res, req, user)
    res.status(StatusCodes.ACCEPTED).json(user)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Lỗi server' })
  }
}

const getUserProfile = async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Không tìm thấy người dùng'
      })
    }
    refreshCookieIfNeeded(res, req, user)
    res.status(StatusCodes.OK).json(user)
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

// Upload avatar to Cloudinary
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
    cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (error, result) => {
        if (error) return res.status(500).json({ error })
        res.json({ url: result.secure_url })
      }
    ).end(req.file.buffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const updateProfile = async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Không tìm thấy người dùng'
      })
    }
    refreshCookieIfNeeded(res, req, user)
    const userId = user._id
    const { name, email, gender, address, dob, avatar } = req.body

    // Handle avatar upload if file is provided
    let avatarUrl = avatar
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: 'image' },
            (error, result) => {
              if (error) reject(error)
              else resolve(result)
            }
          ).end(req.file.buffer)
        })
        avatarUrl = uploadResult.secure_url
      } catch (uploadError) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          message: 'Lỗi upload ảnh',
          error: uploadError.message
        })
      }
    }

    // Build update object with only provided fields
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (gender !== undefined) updateData.gender = gender
    if (address !== undefined) updateData.address = address
    if (dob !== undefined) updateData.dob = dob
    if (avatarUrl !== undefined) updateData.avatar = avatarUrl

    // Validate name length if provided
    if (name && (name.length < 2 || name.length > 30)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Tên phải từ 2-30 ký tự'
      })
    }

    // Validate gender if provided
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Giới tính không hợp lệ'
      })
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken')

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Không tìm thấy người dùng'
      })
    }

    res.status(StatusCodes.OK).json({
      message: 'Cập nhật thông tin thành công',
      user: updatedUser
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

const changePassword = async (req, res) => {
  try {
    const userId = req.user._id
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới'
      })
    }

    if (newPassword.length < 6) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Mật khẩu mới phải ít nhất 6 ký tự'
      })
    }

    // Get user with password
    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Không tìm thấy người dùng'
      })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Mật khẩu hiện tại không đúng'
      })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword })

    res.status(StatusCodes.OK).json({
      message: 'Đổi mật khẩu thành công'
    })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi server',
      error: error.message
    })
  }
}

export const userController = {
  getProfile,
  getUserProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
}


