/**
 * Tính tổng tiền booking dựa vào mode & travel distance.
 * @param {Object} params
 * @param {String} params.mode - 'atPtGym' | 'atClient' | 'atOtherGym'
 * @param {Number} params.base - giá gói cơ bản (VND)
 * @param {Number} [params.tax=0]
 * @param {Number} [params.discount=0]
 * @param {Number} [params.travelDistanceKm=0]
 * @param {Object} [params.travelPolicy] - { freeRadiusKm, feePerKm }
 * @returns {Object} pricing - breakdown chi tiết
 */
export function calcBookingPricing({
  mode,
  base,
  tax = 0,
  discount = 0,
  travelDistanceKm = 0,
  travelPolicy = { freeRadiusKm: 0, feePerKm: 0 }
}) {
  const { freeRadiusKm = 0, feePerKm = 0 } = travelPolicy

  let travel = 0
  if (mode === 'atClient' || mode === 'atOtherGym') {
    if (travelDistanceKm > freeRadiusKm) {
      const exceed = travelDistanceKm - freeRadiusKm
      travel = exceed * feePerKm
    }
  }

  const subtotal = base + tax + travel // tổng trước giảm giá
  const total = subtotal - discount // tổng cuối sau giảm giá

  return {
    base,
    tax,
    discount,
    travel,
    subtotal,
    total
  }
}
