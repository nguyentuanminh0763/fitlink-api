// src/services/booking/generateFromBooking.js
import Booking from '~/models/Booking'
import Package from '~/models/Package'
import Slot from '~/models/Slot'
import Session from '~/models/Session'

// utils thời gian
const startOfDayLocal = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => new Date(d.getTime() + n*86400000)
const makeDateTime = (dateOnly, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(dateOnly)
  d.setHours(h, m, 0, 0)
  return d
}

export async function createSlotsAndSessionsForBooking(bookingId, studentPackageId=null) {
  // 1) Đọc booking
  const booking = await Booking.findById(bookingId).lean()
  if (!booking) throw new Error('Booking not found')
  if (!booking.pattern?.length || !booking.slot?.start || !booking.startDate) {
    throw new Error('Booking missing pattern/slot/startDate')
  }
  if (booking.slotsGenerated) {
    return { createdSlots: 0, createdSessions: 0, skipped: true }
  }

  // 2) Lấy package cho totalSessions/duration
  const pkg = await Package.findById(booking.package).lean()
  if (!pkg) throw new Error('Package not found')

  const totalSessions = pkg.totalSessions ?? booking?.packageSnapshot?.totalSessions ?? 9
  const sessionDurMin = pkg.sessionDurationMin ?? booking?.packageSnapshot?.sessionDurationMin ?? 60

  const { pattern, slot } = booking
  const startDate = startOfDayLocal(booking.startDate)

  // 3) Build các mốc thời gian cần tạo
  const items = []
  let d = new Date(startDate)
  while (items.length < totalSessions) {
    if (pattern.includes(d.getDay())) {
      const startTime = makeDateTime(d, slot.start)
      const endTime = slot.end
        ? makeDateTime(d, slot.end)
        : new Date(startTime.getTime() + sessionDurMin * 60000)
      items.push({ startTime, endTime })
    }
    d = addDays(d, 1)
  }

  // 4) Chia 2 nhóm: slot đã có & slot cần chèn
  const startTimes = items.map(i => i.startTime)

  const existingSlots = await Slot.find({
    pt: booking.pt,
    startTime: { $in: startTimes }
  }).lean()

  const existingKey = new Set(
    existingSlots.map(s => new Date(s.startTime).getTime())
  )

  const toCreate = items.filter(i => !existingKey.has(i.startTime.getTime()))

  // 5) Tạo slot còn thiếu (nếu có)
  let createdSlots = []
  if (toCreate.length) {
    const docs = toCreate.map(it => ({
      pt: booking.pt,
      package: booking.package,
      seriesId: `${booking._id}:${pattern.join('-')}`,
      kind: 'recurring',
      status: 'OPEN',
      startTime: it.startTime,
      endTime: it.endTime,
      capacity: 1,
      expiresAt: new Date(it.endTime.getTime() + 60 * 60 * 1000),
      bookedByBooking: booking._id
    }))

    try {
      createdSlots = await Slot.insertMany(docs, { ordered: false })
    } catch (err) {
      // Nếu có trùng do race condition, bỏ qua lỗi, sẽ fetch lại ở bước dưới
      // console.warn('insertMany slots warning:', err?.code || err?.message);
    }
  }

  // 6) Lấy lại FULL danh sách slot (cũ + vừa tạo) cho các startTimes
  const allSlots = await Slot.find({
    pt: booking.pt,
    startTime: { $in: startTimes }
  }).lean()

  // Map theo startTime để lập session
  const slotByStartTs = new Map(
    allSlots.map(s => [new Date(s.startTime).getTime(), s])
  )

  // 7) Lọc ra các slot chưa có session
  const slotIds = allSlots.map(s => s._id)
  const existingSessions = await Session.find({
    pt: booking.pt,
    slot: { $in: slotIds }
  }).select('slot').lean()

  const slotWithSession = new Set(existingSessions.map(es => String(es.slot)))

  const sessionDocs = []
  for (const it of items) {
    const s = slotByStartTs.get(it.startTime.getTime())
    if (!s) continue
    if (slotWithSession.has(String(s._id))) continue

    sessionDocs.push({
      student: booking.student,
      pt: booking.pt,
      package: booking.package,
      booking: booking._id,
      slot: s._id,
      startTime: s.startTime,
      endTime: s.endTime,
      status: 'scheduled',
      studentPackage: studentPackageId
      // studentPackage: ... (gán sau khi bạn tạo StudentPackage nếu muốn)
    })
  }

  let insertedSessions = []
  if (sessionDocs.length) {
    try {
      insertedSessions = await Session.insertMany(sessionDocs, { ordered: false })
    } catch (err) {
      // trường hợp race/dup, có thể fetch lại nếu cần
      // console.warn('insertMany sessions warning:', err?.code || err?.message);
    }
  }

  // 8) Cập nhật Booking (idempotent flag + link ids)
  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        slotsGenerated: true,
        slotIds: allSlots.map(s => s._id),
        sessionIds: insertedSessions.map(s => s._id)
      }
    }
  )

  return {
    createdSlots: toCreate.length, // số cố gắng tạo mới (không phải số thực sự insert được)
    createdSessions: insertedSessions.length,
    skipped: false
  }
}
