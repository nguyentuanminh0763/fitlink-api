import multer from 'multer'
import path from 'path'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

// Cấu hình upload dùng chung cho mọi route — giới hạn dung lượng + loại file kiểm tra Ở SERVER
// (accept="..." / dòng gợi ý trên frontend ai cũng bỏ qua được).
// File sai loại → ApiError 400; quá dung lượng → MulterError LIMIT_FILE_SIZE → 413
// (cả hai do translateError trong errorHandlingMiddleware trả về).

const MB = 1024 * 1024

// Ảnh (avatar, ảnh bìa PT): giữ trong RAM rồi đẩy lên Cloudinary.
// Giới hạn bắt buộc: memoryStorage đọc cả file vào RAM — không giới hạn thì một file vài GB làm sập server.
// Không nhận SVG: SVG có thể chứa script.
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(StatusCodes.BAD_REQUEST, 'Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF, HEIC), tối đa 10MB.'))
    }
    cb(null, true)
  }
})

// Tài liệu PT: giữ trong RAM rồi controller đẩy lên Cloudinary — không ghi ổ đĩa container
// (trên Azure Container Apps ổ đĩa bị xoá khi tạo revision mới).
// Chỉ nhận PDF, ảnh và Office — không nhận .html/.svg/.js vì file được phát công khai.
// Video chia sẻ bằng link (YouTube/Drive).
const MATERIAL_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']

export const materialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * MB, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MATERIAL_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new ApiError(StatusCodes.BAD_REQUEST, 'Chỉ chấp nhận PDF, ảnh (JPG, PNG, WEBP) và file Word, Excel, PowerPoint, tối đa 20MB.'))
    }
    cb(null, true)
  }
})
