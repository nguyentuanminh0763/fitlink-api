import Redis from 'ioredis'
import { env } from './environment'

let redisClient = null
let isRedisReady = false

/**
 * ================================================================
 * CẤU HÌNH CHỌN LOẠI REDIS — đổi DUY NHẤT qua biến REDIS_MODE trong env:
 * ================================================================
 *   - 'local'  : Redis trong docker compose (REDIS_LOCAL_URI, mặc định 127.0.0.1:6379)
 *   - 'cloud'  : Upstash Cloud Redis (REDIS_CLOUD_URI)
 *   - 'memory' : Tắt hẳn Redis, dùng In-Memory RAM của Node.js
 * Giá trị khác: không kết nối Redis, checkEnv() dừng server và báo lỗi.
 * Redis không kết nối được thì cacheService tự rơi về In-Memory.
 */
const activeMode = env.REDIS_MODE

let targetUri = null
let modeDescription = ''

if (activeMode === 'cloud') {
  targetUri = env.REDIS_CLOUD_URI
  modeDescription = 'Cloud Redis (REDIS_CLOUD_URI)'
} else if (activeMode === 'local') {
  targetUri = env.REDIS_LOCAL_URI
  modeDescription = 'Local Redis (REDIS_LOCAL_URI)'
} else if (activeMode === 'memory') {
  targetUri = null
  modeDescription = 'Node.js Server In-Memory RAM'
} else {
  // Giá trị lạ (vd gõ nhầm "clould"): không kết nối — checkEnv() sẽ dừng server và báo lỗi
  modeDescription = `REDIS_MODE không hợp lệ ("${activeMode}")`
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
        console.info(`⚡ [CACHE] Connected to ${modeDescription} successfully.`)
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
  console.info(`ℹ️ [CACHE] Operating with ${modeDescription} (No external Redis).`)
}

export const getRedisClient = () => redisClient
export const checkRedisReady = () => isRedisReady && redisClient?.status === 'ready'
export const getActiveRedisMode = () => activeMode

export { redisClient }
export default redisClient
