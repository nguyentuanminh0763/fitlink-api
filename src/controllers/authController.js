import bcrypt from 'bcrypt'
import User from '~/models/User'
import { StatusCodes } from 'http-status-codes'
import { genarateAccessToken } from '~/utils/genarateTokens'
import { sendResetPasswordEmail } from '../utils/mailer'
import { generateResetToken } from '../utils/genarateTokens'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { OAuth2Client } from 'google-auth-library'
import { env } from '~/config/environment'
import PendingRegistration from '~/models/PendingRegistration'
// controllers/authController.js (bổ sung)
import PTProfile from '~/models/PTProfile'
import PTWallet from '~/models/PTWallet'
import { Roles } from '~/domain/enums' // dùng đúng enum với userSchema:contentReference[oaicite:7]{index=7}

const createPTArtifacts = async (user) => {
  // Tạo PTProfile rỗng (verified=false). Geo location để trống - PT điền sau.
  const existedProfile = await PTProfile.findOne({ user: user._id })
  if (!existedProfile) {
    await PTProfile.create({
      user: user._id,
      deliveryModes: { atPtGym: true, atClient: false, atOtherGym: false },
      availableForNewClients: false,
      verified: false
    })
  }

  // Tạo ví PT nếu chưa có
  const existedWallet = await PTWallet.findOne({ pt: user._id })
  if (!existedWallet) {
    await PTWallet.create({ pt: user._id, available: 0, pending: 0, totalEarned: 0, withdrawn: 0 })
  }
}

const client = new OAuth2Client(env.GG_CLIENT_ID)

const loginWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body
    if (!idToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Thiếu idToken' })
    }

    // Verify token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GG_CLIENT_ID
    })
    const payload = ticket.getPayload()
    console.log('payload: ', payload)

    // payload chứa: email, name, picture, sub (unique Google user id)
    const { email, name, picture, sub } = payload

    // Tìm user trong DB
    let user = await User.findOne({ email })
    if (!user) {
      // Nếu chưa có thì tạo mới
      user = new User({
        email,
        name,
        avatar: picture,
        phone: '', // Google không trả phone
        password: '', // không cần password
        isActive: true,
        role: Roles.STUDENT,
        googleId: sub
      })
      await user.save()
    }

    // Kiểm tra tài khoản bị khóa
    if (!user.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: 'Tài khoản đã bị khóa' })
    }

    // Payload để generate token
    const jwtPayload = {
      _id: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
      avatar: user.avatar
    }

    const accessToken = genarateAccessToken(jwtPayload)

    // Set cookie HttpOnly
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: env.IS_SERCURE_COOKIE, // true nếu deploy https
      sameSite: env.COOKIE_SAMESITE || 'lax',
      maxAge: 24 * 60 * 60 * 1000
    })

    res.json({ message: 'Google login successful', user: jwtPayload })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Google login failed', error: err.message })
  }
}

const registerByPhone = async (req, res) => {
  try {
    const { phone, password, name, email } = req.body

    const existingUser = await User.findOne({ phone })
    if (existingUser) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Số điện thoại đã được đăng ký' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = new User({ phone, password: hashedPassword, name, email })
    await newUser.save()

    res.status(201).json({ message: 'Tạo tài khoản thành công' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
}

export const registerByPhoneStart = async (req, res) => {
  try {
    const { phone, password, name, email, role } = req.body;

    if (!phone || !password || !name || !email) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing fields' });
    }

    // normalize + validate role
    const normalizedRole = String(role || '').toLowerCase();
    const allowedRoles = [Roles.STUDENT, Roles.PT].map(r => String(r).toLowerCase());
    const finalRole = allowedRoles.includes(normalizedRole) ? normalizedRole : String(Roles.STUDENT).toLowerCase();

    // ❌ disallow reuse of phone/email (no upgrade Student -> PT)
    const existed = await User.findOne({ $or: [{ phone }, { email }] });
    if (existed) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'Phone or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expireAt = new Date(Date.now() + 3 * 60 * 1000);

    await PendingRegistration.deleteMany({ $or: [{ phone }, { email }] });
    await PendingRegistration.create({
      token, phone, email, name, passwordHash, expireAt, role: finalRole
    });

    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: env.EMAIL_FROM || env.EMAIL_USER,
      to: email,
      subject: `Verify your ${finalRole.toUpperCase()} account`,
      html: `
        <p>Hello ${name},</p>
        <p>You have 3 minutes to confirm your ${finalRole.toUpperCase()} registration.</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `
    });

    return res.status(StatusCodes.CREATED).json({ message: 'Verification email sent' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// B2: click link xác nhận → tạo User thật
// controllers/authController.js
export const registerByPhoneConfirm = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Missing token' });

    const pending = await PendingRegistration.findOneAndUpdate(
      { token, expireAt: { $gt: new Date() }, consumed: false },
      { $set: { consumed: true } },
      { new: true }
    );

    if (!pending) {
      const maybe = await PendingRegistration.findOne({ token });
      const existedUser = await User.findOne({
        $or: [{ phone: maybe?.phone }, { email: maybe?.email }]
      });
      if (existedUser) {
        return res.status(200).json({ message: 'Account already created. You can sign in.' });
      }
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const existed = await User.findOne({
      $or: [{ phone: pending.phone }, { email: pending.email }]
    });
    if (existed) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(200).json({ message: 'Account already created. You can sign in.' });
    }

    // role from pending (default to student if somehow missing)
    const roleFromPending = (pending.role || Roles.STUDENT).toString().toLowerCase();

    const newUser = await User.create({
      phone: pending.phone,
      email: pending.email,
      name: pending.name,
      password: pending.passwordHash,
      isActive: true,
      role: roleFromPending // 👈 create with selected role
    });

    // If PT, bootstrap profile & wallet
    if (roleFromPending === String(Roles.PT).toLowerCase()) {
      await createPTArtifacts(newUser);
    }

    await PendingRegistration.deleteOne({ _id: pending._id });
    return res.status(200).json({ message: 'Account created', userId: newUser._id, role: roleFromPending });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};



const login = async (req, res) => {
  const { phone, password, email, account } = req.body
  const identifier = (phone || email || account || '').trim()
  const isEmail = identifier.includes('@')
  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier }

  const currentUser = await User.findOne(query)

  if (!currentUser) {
    return res.status(StatusCodes.NOT_FOUND).json({
      message: isEmail ? 'Email chưa được đăng ký' : 'Số điện thoại chưa được đăng ký'
    })
  }
  if (!currentUser.isActive) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'Tài khoản của bạn đã bị khóa' })
  }

  if (!(await bcrypt.compare(password, currentUser.password))) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Mật khẩu không chính xác' })
  }

  const payload = {
    _id: currentUser._id,
    role: currentUser.role,
    phone: currentUser.phone,
    name: currentUser.name,
    avatar: currentUser.avatar,
    email: currentUser.email
  }

  const accessToken = genarateAccessToken(payload)

  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: env.IS_SERCURE_COOKIE, // nếu dùng HTTPS thì để true
    sameSite: env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 ngày
  })
  res.json({ message: 'Login successful' })
}

const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE || 'lax',
    secure: env.IS_SERCURE_COOKIE // nếu dùng HTTPS thì để true
  })

  res.status(200).json({ message: 'Logged out successfully' })

}

const forgotPassword = async (req, res) => {
  const { phone } = req.body

  try {
    const user = await User.findOne({ phone })

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    if (!user.email) {
      return res.status(404).json({ message: 'Không tìm thấy email của người dùng' })
    }

    const { token, expires } = generateResetToken()
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    user.resetPasswordToken = hashedToken
    user.resetTokenExpires = expires
    await user.save()

    const resetLink = `${env.CLIENT_URL}/reset-password/${token}`
    console.log(`Reset link: ${resetLink}`)

    await sendResetPasswordEmail(user.email, user.name || 'bạn', resetLink)

    return res.status(200).json({ message: 'Đã gửi link đặt lại mật khẩu đến email!' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Lỗi server' })
  }
}

const resetPassword = async (req, res) => {
  const { token } = req.params
  const { password, confirmPassword } = req.body

  // 1. Kiểm tra đầy đủ thông tin
  if (!password || !confirmPassword) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ thông tin.' })
  }

  // 2. Kiểm tra 2 password có giống nhau không
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Mật khẩu không khớp.' })
  }

  // 3. Tìm user theo hashed token và kiểm tra thời hạn
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetTokenExpires: { $gt: Date.now() }
  })

  if (!user) {
    return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  // 4. Lưu mật khẩu mới (hash nếu cần)
  user.password = hashedPassword
  user.resetPasswordToken = undefined
  user.resetTokenExpires = undefined
  await user.save()

  return res.json({ message: 'Mật khẩu đã được cập nhật thành công!' })
}

// Test

export const authController = {
  registerByPhone,
  login,
  logout,
  forgotPassword,
  resetPassword,
  loginWithGoogle,
  registerByPhoneStart,
  registerByPhoneConfirm
}
