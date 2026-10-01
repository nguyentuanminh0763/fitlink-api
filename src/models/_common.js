import { Schema } from 'mongoose'

// GeoJSON Point
export const GeoPointSchema = new Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number] } }, // [lng, lat]
  { _id: false }
)

// GeoJSON Polygon (nếu muốn đặt vùng ưu tiên/zones free)
export const GeoPolygonSchema = new Schema(
  { type: { type: String, enum: ['Polygon'], default: 'Polygon' }, coordinates: { type: [[[Number]]] } },
  { _id: false }
)

// Địa chỉ chung
export const AddressSchema = new Schema(
  {
    name: { type: String, default: '' }, // tuỳ chọn: tên địa điểm
    address: { type: String, default: '' },
    location: { type: GeoPointSchema } // bắt buộc khi query theo khoảng cách
  },
  { _id: false }
)
