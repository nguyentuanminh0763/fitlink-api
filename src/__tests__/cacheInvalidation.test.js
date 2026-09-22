import { describe, it, expect, beforeEach } from 'vitest'
import { cacheService } from '~/services/cacheService'

/**
 * Chốt lại hành vi của cacheService.invalidatePT.
 *
 * Trước đây mọi thao tác ghi đều gọi delByPattern('api:*pt*') — một PT sửa gói
 * tập là xoá sạch cache của toàn bộ PT khác. Test này đảm bảo việc đó không
 * quay lại: cache của PT khác phải sống sót.
 *
 * Chạy trên nhánh in-memory của cacheService (không cần Redis).
 */

const PT_A = '68f0000000000000000000aa'
const PT_B = '68f0000000000000000000bb'
const SLUG_A = 'nguyen-van-hung-11'
const SLUG_B = 'tran-mai-anh-12'

// Mô phỏng đúng các key mà cacheMiddleware sinh ra: `api:${req.originalUrl}`
const keyOf = (url) => `api:${url}`

const seed = async () => {
  await Promise.all([
    // key riêng của PT A
    cacheService.set(keyOf(`/api/pt/public/${PT_A}`), 'A-detail', 600),
    cacheService.set(keyOf(`/api/pt/public/${SLUG_A}`), 'A-detail-slug', 600),
    cacheService.set(keyOf(`/api/pt/${PT_A}/profile`), 'A-profile', 600),
    cacheService.set(keyOf(`/api/pt/${PT_A}/packages`), 'A-packages', 600),
    // key riêng của PT B
    cacheService.set(keyOf(`/api/pt/public/${PT_B}`), 'B-detail', 600),
    cacheService.set(keyOf(`/api/pt/public/${SLUG_B}`), 'B-detail-slug', 600),
    cacheService.set(keyOf(`/api/pt/${PT_B}/profile`), 'B-profile', 600),
    cacheService.set(keyOf(`/api/pt/${PT_B}/packages`), 'B-packages', 600),
    // key danh sách
    cacheService.set(keyOf('/api/search/pts?page=1&limit=12'), 'search-p1', 300),
    cacheService.set(keyOf('/api/pt/public/list'), 'public-list', 300),
  ])
}

describe('cacheService.invalidatePT', () => {
  beforeEach(async () => {
    cacheService.memoryStore.clear()
    await seed()
  })

  it('xoá hết cache riêng của PT được chỉ định, theo cả id lẫn slug', async () => {
    await cacheService.invalidatePT(PT_A, SLUG_A)

    expect(await cacheService.get(keyOf(`/api/pt/public/${PT_A}`))).toBeNull()
    expect(await cacheService.get(keyOf(`/api/pt/public/${SLUG_A}`))).toBeNull()
    expect(await cacheService.get(keyOf(`/api/pt/${PT_A}/profile`))).toBeNull()
    expect(await cacheService.get(keyOf(`/api/pt/${PT_A}/packages`))).toBeNull()
  })

  it('GIỮ NGUYÊN cache của PT khác — đây là lỗi cũ cần chặn tái phát', async () => {
    await cacheService.invalidatePT(PT_A, SLUG_A)

    expect(await cacheService.get(keyOf(`/api/pt/public/${PT_B}`))).toBe('B-detail')
    expect(await cacheService.get(keyOf(`/api/pt/public/${SLUG_B}`))).toBe('B-detail-slug')
    expect(await cacheService.get(keyOf(`/api/pt/${PT_B}/profile`))).toBe('B-profile')
    expect(await cacheService.get(keyOf(`/api/pt/${PT_B}/packages`))).toBe('B-packages')
  })

  it('vẫn xoá cache danh sách, vì kết quả tìm kiếm có nhúng giá và hồ sơ PT', async () => {
    await cacheService.invalidatePT(PT_A, SLUG_A)

    expect(await cacheService.get(keyOf('/api/search/pts?page=1&limit=12'))).toBeNull()
    expect(await cacheService.get(keyOf('/api/pt/public/list'))).toBeNull()
  })

  it('không nổ khi PT chưa có slug', async () => {
    await expect(cacheService.invalidatePT(PT_A, undefined)).resolves.not.toThrow()
    expect(await cacheService.get(keyOf(`/api/pt/public/${PT_A}`))).toBeNull()
    expect(await cacheService.get(keyOf(`/api/pt/public/${PT_B}`))).toBe('B-detail')
  })
})
