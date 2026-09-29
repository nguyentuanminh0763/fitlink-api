// src/controllers/ptMaterialController.js
import PTMaterial from '~/models/PTMaterial'
import path from 'path'
import { randomBytes } from 'node:crypto'
import { MATERIAL_FOLDER, uploadBuffer, destroyMaterialByUrl } from '~/providers/cloudinaryProvider'
import { slugify } from '~/utils/formatters'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

// multer 2.x không truyền defParamCharset cho busboy → tên file UTF-8 bị đọc thành latin1
// ("tuần" → "tuáº§n"). Đảo lại latin1 → utf8; kết quả không phải UTF-8 hợp lệ thì giữ nguyên.
const decodeFileName = (name) => {
  const decoded = Buffer.from(name, 'latin1').toString('utf8')
  return decoded.includes('�') ? name : decoded
}

// Upload tài liệu lên Cloudinary (không ghi ổ đĩa container: trên Azure Container Apps
// ổ đĩa bị xoá khi tạo revision mới). Loại file + dung lượng đã được materialUpload kiểm tra.
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Ảnh → 'image'. PDF/Office → 'raw': gói Cloudinary miễn phí mặc định chặn phát PDF
    // lưu dạng image, còn raw trả nguyên file gốc.
    const originalName = decodeFileName(req.file.originalname)
    const ext = path.extname(originalName).toLowerCase()
    const isImage = IMAGE_EXTENSIONS.includes(ext)
    // Tự đặt public_id: tên không dấu (slugify xử lý tiếng Việt) + đoạn ngẫu nhiên chống trùng.
    // raw PHẢI có đuôi trong public_id, không thì file tải về không có đuôi (application/octet-stream);
    // image thì không, đuôi là định dạng hiển thị Cloudinary tự thêm.
    const baseName = slugify(path.basename(originalName, ext)) || 'tai-lieu'
    const publicId = `${baseName}-${randomBytes(3).toString('hex')}${isImage ? '' : ext}`
    const result = await uploadBuffer(req.file.buffer, {
      folder: MATERIAL_FOLDER,
      public_id: publicId,
      resource_type: isImage ? 'image' : 'raw'
    })

    return res.json({ url: result.secure_url })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ message: 'Upload failed' })
  }
}

async function getMyMaterials(req, res) {
  try {
    const mats = await PTMaterial.find({ pt: req.user._id })
      .populate('sharedWithPackages', 'name totalSessions durationDays')
      .sort({ updatedAt: -1 })

    return res.json({ data: mats })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Failed to load materials' })
  }
}

async function createMaterial(req, res) {
  try {
    const mat = await PTMaterial.create({ ...req.body, pt: req.user._id })
    return res.json({ data: mat })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ message: 'Failed to create material' })
  }
}

async function updateMaterial(req, res) {
  try {
    const mat = await PTMaterial.findOneAndUpdate(
      { _id: req.params.id, pt: req.user._id },
      req.body,
      { new: true }
    )
    return res.json({ data: mat })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ message: 'Failed to update material' })
  }
}

async function deleteMaterial(req, res) {
  try {
    const mat = await PTMaterial.findOne({ _id: req.params.id, pt: req.user._id })
    if (!mat) return res.status(404).json({ message: 'Material not found' })

    // Xoá file trên Cloudinary nếu là file mình upload (link Drive/YouTube... bị bỏ qua).
    // Lỗi xoá file không chặn việc xoá tài liệu — chỉ để lại file mồ côi trên Cloudinary.
    try {
      await destroyMaterialByUrl(mat.url)
    } catch (err) {
      console.warn('⚠️ [MATERIAL] Không xoá được file trên Cloudinary:', mat.url, err?.message)
    }

    await PTMaterial.deleteOne({ _id: req.params.id })
    return res.json({ message: 'Material deleted' })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ message: 'Failed to delete material' })
  }
}

async function shareMaterial(req, res) {
  try {
    const { packageIds } = req.body
    await PTMaterial.findOneAndUpdate(
      { _id: req.params.id, pt: req.user._id },
      { sharedWithPackages: packageIds }
    )
    return res.json({ message: 'Shared successfully' })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ message: 'Failed to share material' })
  }
}

// 💡 giống mấy controller khác trong project: export object
export const ptMaterialController = {
  uploadFile,
  getMyMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  shareMaterial
}
