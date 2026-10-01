// src/controllers/bookingSimpleController.js
import mongoose from 'mongoose'
import Booking from '~/models/Booking.js'
import Slot from '~/models/Slot.js'
import Session from '~/models/Session.js'

// ===== Helpers =====
const addMinutes = (d, mins) => new Date(d.getTime() + mins * 60000)

function buildOccurrences({ pattern, slot, startDate, totalSessions, sessionDurationMin }) {
  if (!Array.isArray(pattern) || !slot?.start || !slot?.end || !startDate) return []
  const total = Number(totalSessions || 0)
  const dur = Number(sessionDurationMin || 60)

  const items = []
  let d = new Date(`${startDate}T00:00:00`)
  while (items.length < total) {
    if (pattern.includes(d.getDay())) {
      const st = new Date(d)
      const [h1, m1] = slot.start.split(':').map(Number)
      st.setHours(h1, m1, 0, 0)
      const et = addMinutes(st, dur)
      items.push({
        index: items.length + 1,
        startTime: st,
        endTime: et
      })
    }
    d.setDate(d.getDate() + 1)
  }
  return items
}

export async function createBookingAndGenerateSlots(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    // FE gửi đủ tất cả —> KHÔNG CHECK
    const {
      // định danh
      student, pt, package: packageId,

      // lịch
      mode, pattern, slot, startDate,

      // số buổi + thời lượng (FE gửi để không cần đọc Package)
      totalSessions, // ví dụ 9 hoặc 12
      sessionDurationMin, // ví dụ 60

      // snapshot (tuỳ bạn muốn gửi gì thì gửi)
      clientAddress,
      ptGymAddress,
      otherGymAddress,

      // travel/policy/price snapshot (nếu muốn)
      travelPolicy,
      travelDistanceKm,
      travelFee,
      inRange,
      exceededByKm,
      packageSnapshot,
      pricing,
      amount,
      currency,

      // status tuỳ chọn (mặc định pending)
      status = 'PENDING_PAYMENT',
      expiresAt,
      notes
    } = req.body

    // 1) Tạo Booking (no validate)
    const bookingDoc = await Booking.create([{
      student,
      pt,
      package: packageId,

      pattern,
      slot,
      startDate: startDate ? new Date(startDate) : undefined,
      mode,

      clientAddress: clientAddress || null,
      ptGymAddress: ptGymAddress || null,
      otherGymAddress: otherGymAddress || null,

      travelPolicy: travelPolicy || undefined,
      travelDistanceKm: travelDistanceKm ?? 0,
      travelFee: travelFee ?? 0,
      inRange: inRange ?? true,
      exceededByKm: exceededByKm ?? 0,

      packageSnapshot: packageSnapshot || undefined,
      pricing: pricing || undefined,
      amount: amount ?? (pricing?.total ?? 0),
      currency: currency || packageSnapshot?.currency || 'VND',

      status,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      notes: notes || undefined
    }], { session })

    const booking = bookingDoc[0]

    // 2) Sinh occurrences (không check)
    const occurrences = buildOccurrences({
      pattern, slot, startDate,
      totalSessions, sessionDurationMin
    })

    // 3) Tạo Slot (no check)
    const slotCreates = occurrences.map(o => ({
      pt,
      package: packageId,
      // có thể gắn bookingId để truy ngược
      booking: booking._id,
      kind: 'recurring', // tuỳ enum của bạn
      status: 'BOOKED', // hoặc "OPEN/RESERVED" tuỳ bạn
      startTime: o.startTime,
      endTime: o.endTime,
      capacity: 1,
      // expiresAt: optional TTL dọn rác sau khi kết thúc 1h
      expiresAt: new Date(o.endTime.getTime() + 60 * 60 * 1000)
    }))
    const slotDocs = await Slot.insertMany(slotCreates, { session })

    // 4) (tuỳ chọn) Tạo Session (no check)
    const sessionCreates = slotDocs.map((s, idx) => ({
      student,
      pt,
      package: packageId,
      booking: booking._id,
      slot: s._id,
      startTime: s.startTime,
      endTime: s.endTime,
      status: 'SCHEDULED', // tuỳ enum của bạn
      order: idx + 1 // thứ tự buổi
    }))
    const sessionDocs = await Session.insertMany(sessionCreates, { session })

    await session.commitTransaction()
    session.endSession()

    return res.json({
      ok: true,
      bookingId: booking._id,
      createdSlots: slotDocs.length,
      createdSessions: sessionDocs.length,
      items: occurrences.map((o, i) => ({
        index: i + 1,
        startTime: o.startTime.toISOString(),
        endTime: o.endTime.toISOString(),
        slotId: slotDocs[i]?._id,
        sessionId: sessionDocs[i]?._id
      }))
    })
  } catch (e) {
    await session.abortTransaction()
    session.endSession()
    console.error(e)
    return res.status(400).json({ ok: false, error: e.message || 'create_failed' })
  }
}
