import Redis from 'ioredis'
import { env } from './environment'

let redisClient = null
let isRedisReady = false

/**
 * ================================================================
 * CẤU HÌNH CHỌN LOẠI REDIS (DUAL-MODE SWITCH):
 * ================================================================
 * Bạn có thể đổi trong .env qua biến REDIS_MODE: 'local' | 'cloud' | 'memory'
 * HOẶC nếu thích đổi trực tiếp tại file config này, hãy gán vào biến OVERRIDE_MODE bên dưới:
 *   - 'local'  : Dùng Docker Redis cục bộ (127.0.0.1:6379 - tốc độ 0ms)
 *   - 'cloud'  : Dùng Upstash Cloud Redis (Singapore - tốc độ ~50ms)
 *   - 'memory' : Tắt hoàn toàn Redis, dùng In-Memory RAM của Node.js
 *   - null     : Mặc định đọc theo biến REDIS_MODE trong file .env
 */
const OVERRIDE_MODE = null

const activeMode = OVERRIDE_MODE || env.REDIS_MODE || 'local'

let targetUri = null
let modeDescription = ''

if (activeMode === 'cloud') {
  targetUri = env.REDIS_CLOUD_URI
  modeDescription = 'Upstash Cloud Redis (Singapore)'
} else if (activeMode === 'local') {
  targetUri = env.REDIS_LOCAL_URI
  modeDescription = 'Local Docker Redis (127.0.0.1:6379)'
} else if (activeMode === 'memory') {
  targetUri = null
  modeDescription = 'Node.js Server In-Memory RAM'
} else {
  targetUri = env.REDIS_URI || env.REDIS_LOCAL_URI
  modeDescription = 'Custom Redis'
}

if (targetUri) {
  try {
    redisClient = new Redis(targetUri, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn(`⚠️ [CACHE] ${modeDescription} connection failed multiple times. Using In-Memory fallback.`)
          return null
        }
        return Math.min(times * 500, 2000)
      }
    })

    redisClient.connect()
      .then(() => {
        isRedisReady = true
        console.log(`⚡ [CACHE] Connected to ${modeDescription} successfully.`)
      })
      .catch((err) => {
        isRedisReady = false
        console.warn(`ℹ️ [CACHE] ${modeDescription} not reachable (${err.message}). Defaulting to Server In-Memory Cache.`)
      })

    redisClient.on('error', () => {
      isRedisReady = false
    })

    redisClient.on('close', () => {
      isRedisReady = false
    })
  } catch (err) {
    isRedisReady = false
    console.warn(`ℹ️ [CACHE] Could not initialize ${modeDescription} client. Using Server In-Memory Cache.`)
  }
} else {
  console.log(`ℹ️ [CACHE] Operating with ${modeDescription} (No external Redis).`)
}

export const getRedisClient = () => redisClient
export const checkRedisReady = () => isRedisReady && redisClient?.status === 'ready'
export const getActiveRedisMode = () => activeMode

export { redisClient }
export default redisClient
