import 'dotenv/config'

export const env = {
  MONGODB_URI: process.env.MONGODB_URI,
  DATABASE_NAME: process.env.DATABASE_NAME,
  APP_HOST: process.env.APP_HOST,
  APP_PORT: process.env.APP_PORT,
  AUTHOR: process.env.AUTHOR,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  PAYOS_CLIENT_ID: process.env.PAYOS_CLIENT_ID,
  PAYOS_API_KEY: process.env.PAYOS_API_KEY,
  PAYOS_CHECKSUM_KEY: process.env.PAYOS_CHECKSUM_KEY,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  IS_SERCURE_COOKIE: process.env.IS_SERCURE_COOKIE === 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'lax',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT || 20,
  CHATBOT_GPT_N8N_API: process.env.CHATBOT_GPT_N8N_API || "",
  BUILD_MODE: process.env.BUILD_MODE || "dev",
  GG_CLIENT_ID: process.env.GG_CLIENT_ID || "",
  GG_CLIENT_SECRET: process.env.GG_CLIENT_SECRET || "",
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER || "",
  REDIS_MODE: process.env.REDIS_MODE || 'local',
  REDIS_LOCAL_URI: process.env.REDIS_LOCAL_URI || 'redis://127.0.0.1:6379',
  REDIS_CLOUD_URI: process.env.REDIS_CLOUD_URI || '',
  REDIS_URI: process.env.REDIS_URI || '',
  CACHE_DEFAULT_TTL: Number(process.env.CACHE_DEFAULT_TTL) || 300
}

// Kiểm tra cấu hình lúc server khởi động (gọi trong server.js, KHÔNG chạy lúc import
// để test và script seed không bị chặn oan).
// - Thiếu biến bắt buộc → in rõ thiếu biến nào rồi dừng, thay vì chạy âm thầm với giá trị sai.
// - Thiếu key dịch vụ bên thứ ba → chỉ cảnh báo tính năng nào đang tắt.
// - Cấu hình nguy hiểm (https nhưng cookie không Secure, dev mode trên https) → cảnh báo.
// Không bao giờ in giá trị secret.
export const checkEnv = () => {
  const required = ['MONGODB_URI', 'APP_PORT', 'CLIENT_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) {
    console.error(`❌ [ENV] Thiếu biến môi trường bắt buộc: ${missing.join(', ')} — xem .env.example`)
    process.exit(1)
  }

  const optionalFeatures = {
    'Email (đăng ký, quên mật khẩu)': ['EMAIL_USER', 'EMAIL_PASS'],
    'Cloudinary (upload ảnh)': ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    'PayOS (thanh toán)': ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'],
    'Google login': ['GG_CLIENT_ID'],
    'AI chat (n8n)': ['CHATBOT_GPT_N8N_API']
  }
  const disabled = Object.entries(optionalFeatures)
    .filter(([, keys]) => keys.some((key) => !process.env[key]))
    .map(([feature]) => feature)

  console.log(`⚙️  [ENV] BUILD_MODE=${env.BUILD_MODE} · APP_PORT=${env.APP_PORT} · REDIS_MODE=${env.REDIS_MODE} · CLIENT_URL=${env.CLIENT_URL}`)
  if (disabled.length) console.warn(`⚠️  [ENV] Tắt do thiếu key: ${disabled.join(', ')}`)
  if (env.CLIENT_URL.startsWith('https://')) {
    if (!env.IS_SERCURE_COOKIE) console.warn('⚠️  [ENV] CLIENT_URL là https nhưng IS_SERCURE_COOKIE không phải "true" → cookie đăng nhập thiếu cờ Secure')
    if (env.BUILD_MODE === 'dev') console.warn('⚠️  [ENV] CLIENT_URL là https nhưng BUILD_MODE=dev → lỗi trả stack trace cho client')
  }
}