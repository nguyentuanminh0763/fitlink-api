import mongoose from 'mongoose'
import { Roles, Genders } from '../domain/enums.js'

const { Schema, model } = mongoose

// Sub-schema GeoJSON (tùy chọn cho Student để tìm PT gần nhà sau này)
const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] } // [lng, lat]
  },
  { _id: false }
)

const userSchema = new Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true
      // unique -> tạo index ở dưới bằng partialFilterExpression (ổn định hơn sparse)
    },
    phone: {
      type: String,
      trim: true,
      match: [/^0[0-9]{9}$/, 'Invalid Phone Number']
      // unique -> tạo index ở dưới bằng partialFilterExpression
    },

    password: {
      type: String
      // select: false // không trả ra mặc định; nhớ hash ở pre('save')
      // không required để hỗ trợ đăng nhập Google
    },

    googleId: {
      type: String
      // unique -> tạo index ở dưới bằng partialFilterExpression
    },

    role: {
      type: String,
      enum: Object.values(Roles),
      default: Roles.STUDENT
    },

    name: {
      type: String,
      minlength: 2,
      maxlength: 30
    },

    avatar: {
      type: String,
      default: '' // URL ảnh
    },

    gender: {
      type: String,
      enum: Object.values(Genders),
      default: Genders.OTHER
    },

    // Tùy chọn: lưu nơi cư trú + toạ độ (không bắt buộc)
    home: {
      address: { type: String, default: '' },
      location: { type: GeoPointSchema } // GeoJSON Point [lng, lat]
    },

    dob: { type: Date },

    isActive: { type: Boolean, default: true },

    refreshToken: { type: String, select: false, default: '' },

    resetPasswordToken: { type: String, select: false },
    resetTokenExpires: { type: Date }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Virtual 1-1 tới PTProfile
userSchema.virtual('ptProfile', {
  ref: 'PTProfile',
  localField: '_id',
  foreignField: 'user',
  justOne: true
})

// Virtual 1-1 tới StudentProfile (thêm mới)
userSchema.virtual('studentProfile', {
  ref: 'StudentProfile',
  localField: '_id',
  foreignField: 'user',
  justOne: true
})

// Indexes
// 1) Geo index cho home.location (an toàn dù field trống)
userSchema.index({ 'home.location': '2dsphere' })
// 2) Unique với partialFilterExpression (ổn định hơn 'sparse' khi null)
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
)
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
)

const User = model('User', userSchema)
export default User
