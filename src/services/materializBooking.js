// services/materializeBooking.js
import Booking from '~/models/Booking'
import Package from '~/models/Package'
import Slot from '~/models/Slot'
import Session from '~/models/Session'
import { generateDatesByPatternFromDate, addMinutes } from '~/utils/scheduleFromBooking'

export async function materializeBooking(bookingId) {
  const booking = await Booking.findById(bookingId).lean()
  if (!booking) throw new Error('Booking not found')

  const pkg = await Package.findById(booking.package).lean()
  if (!pkg) throw new Error('Package not found')

  const total = pkg.totalSessions || 9
  const durationMin = pkg.sessionDurationMin || 60

  // ✅ GEN TỪ NGÀY booking.startDate TRỞ ĐI
  const dates = generateDatesByPatternFromDate(booking.startDate, booking.pattern, total)

  const [h, m] = booking.slot.start.split(':').map(Number)
  const slotDocs = dates.map((d) => {
    const startTime = new Date(d)
    startTime.setHours(h, m, 0, 0)
    const endTime = addMinutes(startTime, durationMin)
    return {
      pt: booking.pt,
      package: booking.package,
      seriesId: `${booking.package}:${booking.pattern.join('-')}`,
      kind: 'recurring',
      status: 'OPEN',
      startTime,
      endTime,
      modes: { atPtGym: true, atClient: true, atOtherGym: true },
      capacity: 1,
      expiresAt: new Date(endTime.getTime() + 60*60*1000)
    }
  })

  // Idempotent: bỏ qua slot trùng (cần index unique { pt:1, startTime:1 } ở Slot)
  try { await Slot.insertMany(slotDocs, { ordered: false }) } catch {}

  const startTimes = slotDocs.map(s => s.startTime)
  const slots = await Slot.find({ pt: booking.pt, startTime: { $in: startTimes } })
    .sort({ startTime: 1 }).lean()

  // Tạo Session theo slot (cần index unique { slot:1 } ở Session)
  const sessionDocs = slots.map(s => ({
    student: booking.student,
    pt: booking.pt,
    package: booking.package,
    slot: s._id,
    startTime: s.startTime,
    endTime: s.endTime,
    status: 'SCHEDULED',
    booking: booking._id
  }))
  try { await Session.insertMany(sessionDocs, { ordered: false }) } catch {}

  return { insertedSlots: slots.length, createdSessions: sessionDocs.length, totalPlanned: total }
}
