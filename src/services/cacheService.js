import { redisClient, checkRedisReady } from '../config/redis';
import { env } from '../config/environment';

class CacheService {
  constructor() {
    this.memoryStore = new Map(); // Fallback in-memory cache: key -> { value, expiresAt }
    this.init();
  }

  get redisClient() {
    return redisClient;
  }

  get isRedisReady() {
    return checkRedisReady();
  }

  init() {
    // Periodic cleanup of expired memory entries every 60 seconds
    setInterval(() => {
      this.cleanupExpiredMemory();
    }, 60000).unref();
  }

  cleanupExpiredMemory() {
    const now = Date.now();
    for (const [key, item] of this.memoryStore.entries()) {
      if (item.expiresAt && item.expiresAt <= now) {
        this.memoryStore.delete(key);
      }
    }
  }

  async get(key) {
    const start = Date.now();
    try {
      if (this.isRedisReady && this.redisClient) {
        const raw = await this.redisClient.get(key);
        if (raw !== null) {
          const duration = Date.now() - start;
          if (env.BUILD_MODE === 'dev') {
            console.log(`⚡ [CACHE HIT - Redis] ${key} (${duration}ms)`);
          }
          return JSON.parse(raw);
        }
      } else {
        const item = this.memoryStore.get(key);
        if (item) {
          if (!item.expiresAt || item.expiresAt > Date.now()) {
            const duration = Date.now() - start;
            if (env.BUILD_MODE === 'dev') {
              console.log(`⚡ [CACHE HIT - In-Memory RAM] ${key} (${duration}ms)`);
            }
            return item.value;
          }
          // Expired
          this.memoryStore.delete(key);
        }
      }
      if (env.BUILD_MODE === 'dev') {
        console.log(`🛒 [CACHE MISS] ${key}`);
      }
      return null;
    } catch (err) {
      console.warn(`[CACHE GET ERROR] ${key}:`, err.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = env.CACHE_DEFAULT_TTL) {
    try {
      const ttl = ttlSeconds > 0 ? ttlSeconds : env.CACHE_DEFAULT_TTL;

      if (this.isRedisReady && this.redisClient) {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', ttl);
      } else {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
        this.memoryStore.set(key, { value, expiresAt });
      }

      if (env.BUILD_MODE === 'dev') {
        console.log(`📦 [CACHE SET] ${key} (TTL: ${ttl}s)`);
      }
      return true;
    } catch (err) {
      console.warn(`[CACHE SET ERROR] ${key}:`, err.message);
      return false;
    }
  }

  async del(key) {
    try {
      if (this.isRedisReady && this.redisClient) {
        await this.redisClient.del(key);
      } else {
        this.memoryStore.delete(key);
      }
      if (env.BUILD_MODE === 'dev') {
        console.log(`🗑️ [CACHE EVICT] ${key}`);
      }
      return true;
    } catch (err) {
      console.warn(`[CACHE DEL ERROR] ${key}:`, err.message);
      return false;
    }
  }

  async delByPattern(pattern) {
    try {
      if (this.isRedisReady && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await this.redisClient.del(...keys);
          if (env.BUILD_MODE === 'dev') {
            console.log(`🗑️ [CACHE EVICT PATTERN - Redis] ${pattern} (${keys.length} keys)`);
          }
        }
      } else {
        // In-memory pattern matching (converts redis-style glob '*' to regex)
        const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexStr);
        let count = 0;
        for (const key of this.memoryStore.keys()) {
          if (regex.test(key)) {
            this.memoryStore.delete(key);
            count++;
          }
        }
        if (env.BUILD_MODE === 'dev') {
          console.log(`🗑️ [CACHE EVICT PATTERN - In-Memory] ${pattern} (${count} keys)`);
        }
      }
      return true;
    } catch (err) {
      console.warn(`[CACHE DEL PATTERN ERROR] ${pattern}:`, err.message);
      return false;
    }
  }

  getStatus() {
    return {
      type: this.isRedisReady ? 'redis' : 'in-memory',
      isRedisReady: this.isRedisReady,
      inMemoryKeys: this.memoryStore.size,
    };
  }
}

export const cacheService = new CacheService();
export default cacheService;
