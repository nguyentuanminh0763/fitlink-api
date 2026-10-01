// utils/scheduleFromBooking.js
const addMinutes = (d, m) => new Date(d.getTime() + m * 60000)

// Gen đúng từ startDate (Date object), giữ nhịp theo pattern (0..6, 0=CN)
function generateDatesByPatternFromDate(startDate, pattern, total) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const days = [...new Set(pattern)].sort((a, b) => a-b) // 0..6
  const out = []
  let cursor = new Date(start)

  while (out.length < total) {
    for (const dow of days) {
      const diff = (dow - cursor.getDay() + 7) % 7
      const next = new Date(cursor)
      next.setDate(cursor.getDate() + diff)
      if (next >= start) out.push(new Date(next))
      if (out.length >= total) break
    }
    cursor.setDate(cursor.getDate() + 7)
  }
  return out
}

export { generateDatesByPatternFromDate, addMinutes }
