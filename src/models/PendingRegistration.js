// models/PendingRegistration.js
import mongoose from 'mongoose'
import { Roles } from '~/domain/enums.js'

const PendingRegistrationSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  phone: { type: String }, // tuỳ chọn: đăng ký bằng email
  email: { type: String, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: [Roles.STUDENT, Roles.PT], required: true },
  // TTL: Mongo sẽ tự xoá doc sau thời điểm này (~background mỗi ~60s)
  expireAt: { type: Date, required: true, index: { expires: 0 } },
  // tránh double-create nếu user bấm link 2 lần
  consumed: { type: Boolean, default: false }
}, { timestamps: true })

const PendingRegistration = mongoose.model('PendingRegistration', PendingRegistrationSchema)
export default PendingRegistration
