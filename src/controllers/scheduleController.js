// src/controllers/scheduleController.js
import { StatusCodes } from 'http-status-codes'
import PTProfile from '~/models/PTProfile'
import Package from '~/models/Package'
import Slot from '~/models/Slot'

/** ===================== Helpers (DoW 0..6) ===================== **
 * Quy ước: 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
 * Thứ tự tuần Mon-first để lặp pattern: [1,2,3,4,5,6,0]
 */

const getDow0 = (date) => date.getDay() // 0..6

const MON_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0]
const orderIndex = (d) => MON_FIRST_ORDER.indexOf(d)

// ISO theo local (tránh lệch ngày do UTC khi .toISOString())
const toISODateLocal = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const z = new Date(x.getTime() - x.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000)
}
function toHM(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function startOfDayLocal(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function copyTimeOfDay(fromDate, toDateDayOnly) {
  const out = startOfDayLocal(toDateDayOnly)
  out.setHours(fromDate.getHours(), fromDate.getMinutes(), 0, 0)
  return out
}
function nextDateWithDow0After(day, dow0) {
  // Trả về NGÀY (00:00 local) có dow0 kế tiếp sau `day`
  let d = startOfDayLocal(day)
  while (true) {
    d = addMinutes(d, 24 * 60)
    if (getDow0(d) === dow0) return d
  }
}

/**
 * Sinh danh sách NGÀY theo pattern (0..6, Mon-first), giữ nhịp tuần
 * Dừng khi đủ totalSessions (số NGÀY; 1 ngày có thể sinh >1 slot nếu interval dài)
 */
function generateDatesByPattern0(baseDate, pattern0, totalSessions) {
  const result = []
  const normalized = Array.from(new Set(pattern0))
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => orderIndex(a) - orderIndex(b)) // 1..6..0

  if (normalized.length === 0 || totalSessions <= 0) return result

  const start = new Date(baseDate)
  start.setHours(0, 0, 0, 0)
  let cursor = new Date(start)

  while (result.length < totalSessions) {
    for (const dow of normalized) {
      const curDow = getDow0(cursor) // 0..6
      let diff = (dow - curDow + 7) % 7 // nếu âm → sang tuần
      const next = new Date(cursor)
      next.setDate(cursor.getDate() + diff)
      if (next >= start) result.push(new Date(next))
      if (result.length >= totalSessions) break
    }
    // neo theo tuần: nhảy đúng 7 ngày kể từ cursor gốc
    cursor.setDate(cursor.getDate() + 7)
  }

  return result
}

/** Core: build preview slots từ Package + PTProfile + baseDate (chuẩn 0..6) */
async function buildPreviewSlots(pkg, pt, baseDate) {
  const patterns = pkg?.recurrence?.daysOfWeek || [] // ví dụ [[1,3,5],[2,4,6]]
  const preview = []

  for (const pattern0 of patterns) {
    const dates = generateDatesByPattern0(baseDate, pattern0, pkg.totalSessions)

    for (const date of dates) {
      const dow0 = getDow0(date) // 0..6
      // chỉ sinh slot nếu PT làm ngày đó
      const workDay = (pt.workingHours || []).find((wh) => wh.dayOfWeek === dow0)
      if (!workDay) continue

      for (const interval of workDay.intervals || []) {
        const startMin = toMin(interval.start)
        const endMin = toMin(interval.end)
        const duration = pkg.sessionDurationMin
        const breakMin = pt.defaultBreakMin || 0

        let cur = startMin
        while (cur + duration <= endMin) {
          const startTime = new Date(date)
          startTime.setHours(Math.floor(cur / 60), cur % 60, 0, 0)
          const endTime = addMinutes(startTime, duration)

          preview.push({
            date: toISODateLocal(date), // dùng ISO local để FE không bị lệch ngày
            start: toHM(cur),
            end: toHM(cur + duration),
            pattern: pattern0, // ví dụ [1,3,5]
            startTime,
            endTime
          })

          cur = cur + duration + breakMin
        }
      }
    }
  }

  // Sort theo thời gian thực
  preview.sort((a, b) => a.startTime - b.startTime)
  return preview
}

/** ============= Carry-forward (B): dời slot Past & Open ra cuối, giữ đúng thứ/giờ (0..6) ============= */
/**
 * - Past = endTime <= now
 * - Open = !status || status === 'OPEN' || status === 'RESERVED_FOR_PACKAGE'
 * - "Cuối dãy" = sau ngày lớn nhất đang có; mỗi nhóm theo cùng-thứ (dow0) sẽ dồn về
 *   ngày có dow0 kế tiếp sau lastDate. (Nếu muốn giãn mỗi tuần, bật spreadWeekly.)
 */
function carryForwardPastOpenSlots(slots, { now = new Date(), spreadWeekly = false } = {}) {
  if (!Array.isArray(slots) || slots.length === 0) return slots

  const kept = []
  const toCarryByDow = new Map() // dow0 -> Slot[]

  for (const s of slots) {
    const isPast = s.endTime <= now
    const isOpen = !s.status || s.status === 'OPEN' || s.status === 'RESERVED_FOR_PACKAGE'
    if (isPast && isOpen) {
      const k = getDow0(s.startTime) // 0..6
      if (!toCarryByDow.has(k)) toCarryByDow.set(k, [])
      toCarryByDow.get(k).push(s)
    } else {
      kept.push(s)
    }
  }
  if (toCarryByDow.size === 0) return slots

  kept.sort((a, b) => a.startTime - b.startTime)
  const lastDate = kept.length ? startOfDayLocal(kept[kept.length - 1].startTime) : startOfDayLocal(now)

  const result = [...kept]

  for (const [dow0, arr] of toCarryByDow.entries()) {
    // Giữ thứ tự theo giờ trong ngày
    arr.sort((a, b) => a.startTime - b.startTime)

    let targetDate = nextDateWithDow0After(lastDate, dow0)

    for (let i = 0; i < arr.length; i++) {
      const s = arr[i]
      const newStart = copyTimeOfDay(s.startTime, targetDate)
      const durationMin = Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000)
      const newEnd = addMinutes(newStart, durationMin)

      result.push({
        ...s,
        date: toISODateLocal(newStart),
        startTime: newStart,
        endTime: newEnd,
        __carried__: true // flag nếu FE muốn style khác
      })

      if (spreadWeekly) {
        // nhảy sang tuần sau cùng-thứ cho slot kế tiếp
        targetDate = addMinutes(targetDate, 7 * 24 * 60)
      }
      // nếu không spreadWeekly: dồn tất cả slot cùng-thứ vào cùng targetDate, giữ nguyên khung giờ
    }
  }

  result.sort((a, b) => a.startTime - b.startTime)
  return result
}

/** ===================== Controllers ===================== **/

/** 🔹 PREVIEW (chưa lưu DB) */
const previewSchedule = async (req, res) => {
  try {
    const { packageId, startDate, carryForward, spreadWeekly } = req.query
    if (!packageId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Missing packageId' })

    const pkg = await Package.findById(packageId)
    if (!pkg)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Package not found' })

    const pt = await PTProfile.findOne({ user: pkg.pt })
    if (!pt)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'PTProfile not found' })

    const baseDate = startDate ? new Date(startDate) : new Date()
    baseDate.setHours(0, 0, 0, 0)

    let slots = await buildPreviewSlots(pkg, pt, baseDate)

    // Carry-forward mặc định BẬT (có thể tắt bằng carryForward=0|false)
    const shouldCarry = !(carryForward === '0' || carryForward === 'false')
    if (shouldCarry) {
      slots = carryForwardPastOpenSlots(slots, {
        now: new Date(),
        spreadWeekly: spreadWeekly === '1' || spreadWeekly === 'true'
      })
    }

    // chống 304
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(StatusCodes.OK).json({ success: true, slots })
  } catch (error) {
    console.error('previewSchedule error:', error)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    })
  }
}

/** 🔹 GENERATE (lưu Slot vào DB) */
const generateSchedule = async (req, res) => {
  try {
    const { packageId, startDate, carryForward, spreadWeekly } = req.body
    if (!packageId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Missing packageId' })

    const pkg = await Package.findById(packageId)
    if (!pkg)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Package not found' })

    const pt = await PTProfile.findOne({ user: pkg.pt })
    if (!pt)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'PTProfile not found' })

    const baseDate = startDate ? new Date(startDate) : new Date()
    baseDate.setHours(0, 0, 0, 0)

    let slots = await buildPreviewSlots(pkg, pt, baseDate)

    // Carry-forward mặc định BẬT khi generate (có thể tắt bằng carryForward=false)
    const shouldCarry = carryForward !== false // undefined -> true
    if (shouldCarry) {
      slots = carryForwardPastOpenSlots(slots, {
        now: new Date(),
        spreadWeekly: !!spreadWeekly
      })
    }

    if (slots.length === 0)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'No slots generated' })

    const toInsert = slots.map((s) => ({
      pt: pkg.pt,
      package: pkg._id,
      seriesId: `${pkg._id}:${s.pattern.join('-')}`, // pattern giờ là 0..6
      kind: 'recurring',
      status: 'OPEN',
      startTime: s.startTime,
      endTime: s.endTime,
      modes: pt.deliveryModes || { atPtGym: true },
      capacity: 1,
      // TTL auto delete sau khi endTime qua 1h
      expiresAt: new Date(s.endTime.getTime() + 60 * 60 * 1000)
    }))

    const inserted = await Slot.insertMany(toInsert, { ordered: false })

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: `Đã tạo ${inserted.length} slot.`,
      inserted: inserted.length
    })
  } catch (error) {
    console.error('generateSchedule error:', error)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    })
  }
}

// src/controllers/scheduleController.js
const previewScheduleDraft = async (req, res) => {
  try {
    const { startDate, draft, carryForward, spreadWeekly } = req.body
    // draft gồm: totalSessions, sessionDurationMin, recurrence.daysOfWeek (0..6), supports (optional)

    if (!draft?.totalSessions || !draft?.sessionDurationMin) {
      return res.status(400).json({ success: false, message: 'Thiếu totalSessions / sessionDurationMin' })
    }

    // PT hiện tại (người tạo gói)
    const pt = await PTProfile.findOne({ user: req.user?._id })
    if (!pt) return res.status(400).json({ success: false, message: 'PTProfile not found' })

    // "giả lập" một Package object từ draft
    const pkgLike = {
      _id: 'draft',
      pt: req.user?._id,
      totalSessions: Number(draft.totalSessions),
      sessionDurationMin: Number(draft.sessionDurationMin),
      recurrence: {
        daysOfWeek: Array.isArray(draft?.recurrence?.daysOfWeek) ? draft.recurrence.daysOfWeek : []
      },
      supports: draft.supports || { atPtGym: true }
    }

    const baseDate = startDate ? new Date(startDate) : new Date()
    baseDate.setHours(0, 0, 0, 0)

    // 1) build lịch thô
    let slots = await buildPreviewSlots(pkgLike, pt, baseDate)

    // 2) carry-forward (bật mặc định, có thể tắt bằng carryForward=false|0)
    const shouldCarry = !(carryForward === false || carryForward === '0' || carryForward === 'false')
    if (shouldCarry) {
      slots = carryForwardPastOpenSlots(slots, {
        now: new Date(),
        spreadWeekly: spreadWeekly === true || spreadWeekly === '1' || spreadWeekly === 'true'
      })
    }

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Pragma', 'no-cache'); res.set('Expires', '0')
    return res.status(200).json({ success: true, slots })
  } catch (e) {
    console.error('previewScheduleDraft error:', e)
    return res.status(500).json({ success: false, message: 'Lỗi server', error: e.message })
  }
}


export const scheduleController = {
  previewSchedule,
  generateSchedule,
  previewScheduleDraft
}
