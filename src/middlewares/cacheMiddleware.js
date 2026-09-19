import { cacheService } from '../services/cacheService';

/**
 * Middleware tự động Cache phản hồi của API (GET requests)
 * @param {number} ttlSeconds - Thời gian sống của cache (mặc định 300s = 5 phút)
 * @param {function} keyGenerator - Hàm tạo custom cache key (tùy chọn)
 */
export const cacheResponse = (ttlSeconds = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Chỉ cache các request đọc dữ liệu (GET)
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Tạo cache key duy nhất theo URL và Query parameters
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : `api:${req.originalUrl || req.url}`;

      // 1. Kiểm tra trong Cache (Redis hoặc Server RAM)
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedData);
      }

      // 2. Nếu Cache Miss: Đánh dấu Header và đón bắt kết quả để lưu vào Cache
      res.setHeader('X-Cache', 'MISS');

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Chỉ lưu cache khi request thành công (Status 200) và dữ liệu hợp lệ
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success !== false) {
          cacheService.set(cacheKey, body, ttlSeconds);
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn('[CACHE MIDDLEWARE ERROR]:', err.message);
      next(); // Khi có lỗi cache, luôn fallback chạy bình thường, không làm sập request
    }
  };
};

export default cacheResponse;
