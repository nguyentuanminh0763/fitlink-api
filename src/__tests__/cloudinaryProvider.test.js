import { describe, it, expect } from 'vitest'
import { parseMaterialUrl } from '~/providers/cloudinaryProvider'

// parseMaterialUrl quyết định file nào được xoá trên Cloudinary → phải chặt: sai là xoá nhầm file.
describe('parseMaterialUrl - chỉ nhận file trong fitlink/pt-materials', () => {
  it('raw (PDF/Office): public_id giữ nguyên đuôi file', () => {
    expect(parseMaterialUrl('https://res.cloudinary.com/demo/raw/upload/v1727000000/fitlink/pt-materials/giao_an_abc123.pdf'))
      .toEqual({ resourceType: 'raw', publicId: 'fitlink/pt-materials/giao_an_abc123.pdf' })
  })

  it('image: public_id bỏ đuôi file (đuôi là định dạng hiển thị)', () => {
    expect(parseMaterialUrl('https://res.cloudinary.com/demo/image/upload/v1727000000/fitlink/pt-materials/anh_xyz.png'))
      .toEqual({ resourceType: 'image', publicId: 'fitlink/pt-materials/anh_xyz' })
  })

  it('giải mã ký tự đã encode trong URL', () => {
    expect(parseMaterialUrl('https://res.cloudinary.com/demo/raw/upload/v1/fitlink/pt-materials/b%C3%A0i%201.pdf').publicId)
      .toBe('fitlink/pt-materials/bài 1.pdf')
  })

  it('bỏ qua file Cloudinary ngoài thư mục tài liệu (avatar, ảnh bìa PT)', () => {
    expect(parseMaterialUrl('https://res.cloudinary.com/demo/image/upload/v1/fitlink/pt-covers/cover.jpg')).toBeNull()
    expect(parseMaterialUrl('https://res.cloudinary.com/demo/image/upload/v1/avatar_abc.jpg')).toBeNull()
  })

  it('bỏ qua link ngoài và giá trị rỗng', () => {
    expect(parseMaterialUrl('https://drive.google.com/file/d/abc/view')).toBeNull()
    expect(parseMaterialUrl('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(parseMaterialUrl('')).toBeNull()
    expect(parseMaterialUrl(undefined)).toBeNull()
  })
})
