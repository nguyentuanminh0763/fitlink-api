import Redis from 'ioredis'
import { env } from './environment'

let redisClient = null
let isRedisReady = false

if (env.REDIS_URI) {
  try {
    redisClient = new Redis(env.REDIS_URI, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️ [CACHE] Redis connection failed multiple times. Using In-Memory fallback.')
          return null
        }
        return Math.min(times * 500, 2000)
      }
    })

    redisClient.connect()
      .then(() => {
        isRedisReady = true
        console.log('⚡ [CACHE] Connected to Redis Cache Server successfully.')
      })
      .catch((err) => {
        isRedisReady = false
        console.warn(`ℹ️ [CACHE] Redis not reachable (${err.message}). Defaulting to Server In-Memory Cache.`)
      })

    redisClient.on('error', () => {
      isRedisReady = false
    })

    redisClient.on('close', () => {
      isRedisReady = false
    })
  } catch (err) {
    isRedisReady = false
    console.warn('ℹ️ [CACHE] Could not initialize Redis client. Using Server In-Memory Cache.')
  }
} else {
  console.log('ℹ️ [CACHE] REDIS_URI not configured. Operating with high-speed Server In-Memory RAM Cache.')
}

export const getRedisClient = () => redisClient
export const checkRedisReady = () => isRedisReady && redisClient?.status === 'ready'

export { redisClient }
export default redisClient
