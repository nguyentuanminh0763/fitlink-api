
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

// Dịch lỗi của thư viện (Mongoose, MongoDB, JWT, body-parser, multer) ra mã HTTP đúng + câu cho người dùng.
// Không dịch được → 500 (hideServerErrorDetails che chi tiết khi không phải dev).
// Chỉ áp dụng cho lỗi ĐẾN được middleware này: lỗi ném ra từ route async (express-async-errors),
// next(err), lỗi của middleware khác. Controller tự try/catch rồi tự res.json thì đi vòng qua đây.
const translateError = (err) => {
  // Lỗi mình chủ động ném: new ApiError(status, message)
  if (err.name === 'ApiError') return { statusCode: err.statusCode, message: err.message }
  // express.json(): body không phải JSON hợp lệ / quá lớn
  if (err.type === 'entity.parse.failed') return { statusCode: StatusCodes.BAD_REQUEST, message: 'Dữ liệu gửi lên không đúng định dạng JSON.' }
  if (err.type === 'entity.too.large') return { statusCode: StatusCodes.REQUEST_TOO_LONG, message: 'Dữ liệu gửi lên quá lớn.' }
  // Mongoose: ID sai định dạng (vd /packages/abc) — lỗi của client, không phải bug server
  if (err.name === 'CastError') return { statusCode: StatusCodes.BAD_REQUEST, message: 'Mã định danh (ID) không hợp lệ.' }
  // Joi (cũng tên ValidationError nhưng có details) — câu thông báo đã viết sẵn trong schema validate
  if (err.isJoi) return { statusCode: StatusCodes.UNPROCESSABLE_ENTITY, message: err.details.map((d) => d.message).join('; ') }
  // Mongoose: vi phạm schema (thiếu field bắt buộc, sai kiểu...)
  if (err.name === 'ValidationError' && err.errors) {
    return { statusCode: StatusCodes.UNPROCESSABLE_ENTITY, message: `Dữ liệu không hợp lệ: ${Object.keys(err.errors).join(', ')}.` }
  }
  // MongoDB E11000: trùng unique index (email/phone đã có, slot đã có người đặt...)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {}).join(', ')
    return { statusCode: StatusCodes.CONFLICT, message: fields ? `Dữ liệu đã tồn tại (${fields}).` : 'Dữ liệu đã tồn tại.' }
  }
  // JWT hết hạn / chữ ký sai → phải đăng nhập lại
  if (err.name === 'TokenExpiredError') return { statusCode: StatusCodes.UNAUTHORIZED, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' }
  if (err.name === 'JsonWebTokenError') return { statusCode: StatusCodes.UNAUTHORIZED, message: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.' }
  // Multer: file quá lớn, sai field...
  if (err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? { statusCode: StatusCodes.REQUEST_TOO_LONG, message: 'File tải lên quá lớn.' }
      : { statusCode: StatusCodes.BAD_REQUEST, message: 'File tải lên không hợp lệ.' }
  }
  // Còn lại coi là bug
  return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, message: err.message || StatusCodes[StatusCodes.INTERNAL_SERVER_ERROR] }
}

// Middleware xử lý lỗi tập trung trong ứng dụng Back-end NodeJS (ExpressJS)
export const errorHandlingMiddleware = (err, req, res, next) => {
  const { statusCode, message } = translateError(err)

  // Tạo ra một biến responseError để kiểm soát những gì muốn trả về
  const responseError = { statusCode, message }

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