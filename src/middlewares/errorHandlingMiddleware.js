
/* eslint-disable no-unused-vars */
import { randomBytes } from 'node:crypto'
import { StatusCodes } from 'http-status-codes'
import { env } from '~/config/environment'

export const SERVER_ERROR_MESSAGE = 'Lỗi hệ thống. Vui lòng thử lại sau.'

// Chặn chi tiết lỗi 5xx đi ra client — đăng ký TRƯỚC mọi route trong server.js.
// Lỗi 5xx là lỗi của server: người dùng không sửa được gì, nên chỉ nhận một câu chung;
// body gốc (err.message, error, stack...) được ghi vào log server để debug.
// Lỗi 4xx (nhập sai, không đủ tiền, validate...) giữ nguyên vì thông báo có ích cho người dùng.
// BUILD_MODE=dev: không can thiệp, để dev thấy đủ chi tiết.
// Bao phủ cả các controller tự try/catch rồi res.status(500).json(...) lẫn errorHandlingMiddleware bên dưới.
// Mỗi lỗi có một mã (errorId) hiện cho khách và ghi cùng dòng log → khách báo mã, dev tìm đúng dòng
// trong log Azure (Container App → Log stream / Logs).
export const hideServerErrorDetails = (req, res, next) => {
  if (env.BUILD_MODE === 'dev') return next()
  const originalJson = res.json.bind(res)
  res.json = (body) => {
    if (res.statusCode >= 500) {
      const errorId = randomBytes(4).toString('hex')
      console.error(`❌ [${res.statusCode}] [errorId=${errorId}] ${req.method} ${req.originalUrl}`, body)
      return originalJson({ success: false, message: `${SERVER_ERROR_MESSAGE} (Mã lỗi: ${errorId})`, errorId })
    }
    return originalJson(body)
  }
  next()
}

// Middleware xử lý lỗi tập trung trong ứng dụng Back-end NodeJS (ExpressJS)
export const errorHandlingMiddleware = (err, req, res, next) => {

  // Nếu dev không cẩn thận thiếu statusCode thì mặc định sẽ để code 500 INTERNAL_SERVER_ERROR
  if (!err.statusCode) err.statusCode = StatusCodes.INTERNAL_SERVER_ERROR

  // Tạo ra một biến responseError để kiểm soát những gì muốn trả về
  const responseError = {
    statusCode: err.statusCode,
    message: err.message || StatusCodes[err.statusCode]
  }

  // Chỉ khi môi trường là DEV thì mới trả về Stack Trace để debug dễ dàng hơn
  if (env.BUILD_MODE === 'dev') {
    responseError.stack = err.stack
  }

  // Đoạn này có thể mở rộng nhiều về sau như ghi Error Log vào file, bắn thông báo lỗi vào group Slack, Telegram, Email...vv Hoặc có thể viết riêng Code ra một file Middleware khác tùy dự án.
  // ...
  // console.error(responseError)

  // Trả responseError về phía Front-end
  res.status(responseError.statusCode).json(responseError)
}