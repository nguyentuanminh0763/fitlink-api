import mongoose from 'mongoose'
const { Schema, model } = mongoose

const PTMaterialSchema = new Schema(
  {
    // Chủ sở hữu tài liệu
    pt: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Nội dung tài liệu
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 1000 },
    url: { type: String, trim: true, default: '' }, // link đến Drive/PDF/Video/Ảnh...
    type: { type: String, trim: true, default: 'document' }, // document | video | image | sheet ...

    // Phân loại nhanh
    tags: { type: [String], default: [] },

    // Chia sẻ cho gói nào (nhiều-nhiều): chọn nhiều package để “đính kèm”
    sharedWithPackages: [{ type: Schema.Types.ObjectId, ref: 'Package', index: true }],

    // Optional: quyền hiển thị (nếu sau này bạn muốn public/private)
    visibility: { type: String, enum: ['private', 'public'], default: 'private' }
  },
  { timestamps: true }
)

// Index phổ biến
PTMaterialSchema.index({ pt: 1, 'sharedWithPackages': 1 })
PTMaterialSchema.index({ tags: 1 })
PTMaterialSchema.index({ title: 'text', description: 'text' })

// Làm sạch dữ liệu cơ bản
PTMaterialSchema.pre('validate', function (next) {
  if (typeof this.title === 'string') this.title = this.title.trim()
  if (typeof this.description === 'string') this.description = this.description.trim()
  next()
})

export default model('PTMaterial', PTMaterialSchema)
