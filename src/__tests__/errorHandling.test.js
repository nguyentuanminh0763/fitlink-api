import { describe, it, expect } from 'vitest'
import { errorHandlingMiddleware } from '~/middlewares/errorHandlingMiddleware'
import ApiError from '~/utils/ApiError'

// Gọi middleware với res giả, trả về { status, body } nó gửi đi
const run = (err) => {
  const out = {}
  const res = {
    status(code) { out.status = code; return this },
    json(body) { out.body = body; return this }
  }
  errorHandlingMiddleware(err, {}, res, () => {})
  return out
}

const named = (name, props = {}) => Object.assign(new Error('internal detail'), { name }, props)

describe('errorHandlingMiddleware - dịch lỗi thư viện ra mã HTTP', () => {
  it('giữ nguyên status + message của ApiError', () => {
    const { status, body } = run(new ApiError(404, 'Không tìm thấy gói tập'))
    expect(status).toBe(404)
    expect(body.message).toBe('Không tìm thấy gói tập')
  })

  it('JSON sai cú pháp → 400, không lộ câu của parser', () => {
    const { status, body } = run(Object.assign(new SyntaxError('Expected property name or \'}\''), { type: 'entity.parse.failed', statusCode: 400 }))
    expect(status).toBe(400)
    expect(body.message).not.toContain('Expected property')
  })

  it('Mongoose CastError (ID sai) → 400', () => {
    expect(run(named('CastError')).status).toBe(400)
  })

  it('MongoDB E11000 (trùng unique) → 409 kèm tên field', () => {
    const { status, body } = run(Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: 'a@b.c' } }))
    expect(status).toBe(409)
    expect(body.message).toContain('email')
    expect(body.message).not.toContain('a@b.c')
  })

  it('JWT hết hạn / sai chữ ký → 401', () => {
    expect(run(named('TokenExpiredError')).status).toBe(401)
    expect(run(named('JsonWebTokenError')).status).toBe(401)
  })

  it('Mongoose ValidationError → 422 kèm tên field', () => {
    const { status, body } = run(named('ValidationError', { errors: { name: {}, price: {} } }))
    expect(status).toBe(422)
    expect(body.message).toContain('name, price')
  })

  it('Multer file quá lớn → 413', () => {
    expect(run(named('MulterError', { code: 'LIMIT_FILE_SIZE' })).status).toBe(413)
  })

  it('lỗi không nhận ra (bug) → 500', () => {
    expect(run(new TypeError('Cannot read properties of undefined')).status).toBe(500)
  })
})
