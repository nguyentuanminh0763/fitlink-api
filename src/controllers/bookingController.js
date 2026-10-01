// controllers/availabilitySimpleController.js
import PTProfile from '~/models/PTProfile'
import StudentPackage from '~/models/StudentPackage'
import PackageModel from '~/models/Package'

// --- tiny helpers ---
const toMin = (s) => { const [h, m]=s.split(':').map(Number); return h*60+m }
const toHHMM = (m) => `${String(m/60|0).padStart(2, '0')}:${String(m%60).padStart(2, '0')}`
const buildBlocks = (intervals, sessionMin, breakMin) => {
  const out=[]; const step=sessionMin+breakMin
  for (const itv of (intervals||[])) {
    const s0=toMin(itv.start), e0=toMin(itv.end)
    for (let s=s0; s+sessionMin<=e0; s+=step) out.push({ start: toHHMM(s), end: toHHMM(s+sessionMin) })
  }
  return out
}
const patternKeyOf = (arr) => ([...arr].sort((a, b) => a-b)).join('-')
const slotKeyOf = (s) => `${s.start}-${s.end}`

// --- core (giản lược, assume workingHours đồng nhất giữa các ngày trong pattern) ---
export async function generateBlocksSimple(ptId, packageId, pattern) {
  if (!ptId || !packageId || !Array.isArray(pattern) || !pattern.length) {
    throw new Error('ptId, packageId, pattern required')
  }

  const [pt, pkg] = await Promise.all([
    PTProfile.findOne({ user: ptId }).lean(),
    PackageModel.findById(packageId).lean()
  ])
  if (!pt || !pkg) throw new Error('PT or Package not found')

  const sessionMin = pkg.sessionDurationMin || 60
  const breakMin = pt.defaultBreakMin ?? 30

  // lấy intervals của ngày đầu tiên trong pattern làm chuẩn (giả định đồng nhất)
  const dow0 = pattern[0]
  const intervals = (pt.workingHours?.find(w => w.dayOfWeek === dow0)?.intervals) || []
  const candidates = buildBlocks(intervals, sessionMin, breakMin) // [{start,end}]

  if (!candidates.length) {
    return { pattern, sessionDurationMin: sessionMin, breakMin, blocks: [] }
  }

  // slot đã bị giữ bởi StudentPackage ACTIVE (cùng pt+package+pattern)
  const used = await StudentPackage.find({
    pt: ptId,
    package: packageId,
    patternKey: patternKeyOf(pattern),
    status: { $in: ['ACTIVE', 'active'] }
  }).select('slotKey').lean()
  const usedSet = new Set(used.map(u => u.slotKey))

  const blocks = candidates.map(s => {
    const k = slotKeyOf(s)
    return usedSet.has(k) ? { ...s, ok: false, reason: 'taken_by_student_package' } : { ...s, ok: true }
  })

  return { pattern, sessionDurationMin: sessionMin, breakMin, blocks }
}

// --- HTTP handler ngắn gọn ---
export async function getBlocksSimple(req, res) {
  try {

    const { ptId } = req.params
    const { packageId } = req.query
    const pattern = String(req.query.pattern||'')
      .split(',').map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n))

    const data = await generateBlocksSimple(ptId, packageId, pattern)
    res.json(data)
  } catch (e) {
    res.status(400).json({ error: e.message || 'bad_request' })
  }
}
