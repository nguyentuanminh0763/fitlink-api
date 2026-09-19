import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import { env } from '~/config/environment'

// const authenToken = (req, res, next) => {
//   // 'Beaer [token]'
//   const authorizationHeader = req.headers['authorization']

//   if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
//     return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing or malformed token' })
//   }

//   const token = authorizationHeader.split(' ')[1]
//   if (!token) {
//     res.status(StatusCodes.UNAUTHORIZED).json({ message: 'NO token' })
//   }

//   jwt.verify(token, env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(StatusCodes.FORBIDDEN).json({ message: 'Invalid or expired token' })
//     }

//     req.user = decoded // lưu payload vào req.user để dùng ở controller
//     next()
//   })
// }

const authenTokenCookie = (req, res, next) => {
  const token = req.cookies.token

  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'No token provided' })
  }

  jwt.verify(token, env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid or expired token' })
    }

    req.user = decoded
    next()
  })
}

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'Admin access only' })
  }
  next()
}

const isStudent = (req, res, next) => {
  if (req.user?.role !== 'student') {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'Student access only' })
  }
  next()
}

const isPT = (req, res, next) => {
  if (req.user?.role !== 'pt') {
    return res.status(StatusCodes.FORBIDDEN).json({ message: 'PT access only' })
  }
  next()
}

export const authMiddleware = {
  authenTokenCookie,
  isAdmin,
  isStudent,
  isPT
}

export const protect = authenTokenCookie