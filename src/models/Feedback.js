import mongoose from 'mongoose'
const { Schema, model } = mongoose

const FeedbackSchema = new Schema(
  {
    studentPackage: { type: Schema.Types.ObjectId, ref: 'StudentPackage', required: true },
    sessionIndex: { type: Number }, // nếu feedback theo buổi; bỏ nếu theo gói
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pt: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // ⭐ Điểm & nhận xét
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' }

  },
  { timestamps: true }
)

FeedbackSchema.index({ student: 1, pt: 1, studentPackage: 1 }, { unique: true })

const Feedback = model('Feedback', FeedbackSchema)
export default Feedback
