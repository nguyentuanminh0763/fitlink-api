import cloudinary from '~/config/cloudinary'

// Thư mục trên Cloudinary cho tài liệu PT. destroyByUrl chỉ xoá file nằm trong thư mục này.
export const MATERIAL_FOLDER = 'fitlink/pt-materials'

// Đẩy file (đang nằm trong RAM do multer memoryStorage) lên Cloudinary, trả về kết quả upload.
export const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => (error ? reject(error) : resolve(result)))
      .end(buffer)
  })

// URL Cloudinary có dạng .../<image|raw>/upload/v<version>/<public_id>[.<đuôi>]
// - image: đuôi file KHÔNG thuộc public_id (là định dạng hiển thị) → phải cắt đi
// - raw:   đuôi file LÀ một phần của public_id → giữ nguyên
// Trả null nếu URL không phải file trong MATERIAL_FOLDER → không bao giờ xoá nhầm file khác.
export const parseMaterialUrl = (url = '') => {
  const match = url.match(/\/(image|raw)\/upload\/(?:v\d+\/)?([^?#]+)$/)
  if (!match) return null
  const [, resourceType, rawPath] = match
  const path = decodeURIComponent(rawPath)
  if (!path.startsWith(`${MATERIAL_FOLDER}/`)) return null
  const publicId = resourceType === 'image' ? path.replace(/\.[^./]+$/, '') : path
  return { resourceType, publicId }
}

// Xoá file tài liệu trên Cloudinary theo URL đã lưu trong DB. URL không thuộc MATERIAL_FOLDER → bỏ qua.
export const destroyMaterialByUrl = async (url) => {
  const parsed = parseMaterialUrl(url)
  if (!parsed) return null
  // invalidate: xoá luôn bản cache trên CDN, không thì link cũ vẫn tải được thêm một thời gian
  return cloudinary.uploader.destroy(parsed.publicId, { resource_type: parsed.resourceType, invalidate: true })
}
