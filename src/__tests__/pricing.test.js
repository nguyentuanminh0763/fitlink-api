import { describe, it, expect } from 'vitest'
import { calcBookingPricing } from '~/utils/pricingUtils'

describe('Domain Logic - calcBookingPricing (Booking Engine)', () => {
  it('should calculate base price correctly for session at PT gym without travel fee', () => {
    const pricing = calcBookingPricing({
      mode: 'atPtGym',
      base: 500000,
      tax: 0,
      discount: 0,
      travelDistanceKm: 15, // Dù khoảng cách 15km nhưng tập tại PT Gym thì không tính phí đi lại
      travelPolicy: { freeRadiusKm: 5, feePerKm: 10000 }
    })

    expect(pricing.base).toBe(500000)
    expect(pricing.travel).toBe(0)
    expect(pricing.subtotal).toBe(500000)
    expect(pricing.total).toBe(500000)
  })

  it('should not add travel fee if distance is within free radius when training at client location', () => {
    const pricing = calcBookingPricing({
      mode: 'atClient',
      base: 1000000,
      tax: 0,
      discount: 0,
      travelDistanceKm: 4, // Trong bán kính miễn phí 5km
      travelPolicy: { freeRadiusKm: 5, feePerKm: 10000 }
    })

    expect(pricing.travel).toBe(0)
    expect(pricing.total).toBe(1000000)
  })

  it('should accurately calculate travel fee when exceeding free radius', () => {
    const pricing = calcBookingPricing({
      mode: 'atClient',
      base: 1000000,
      tax: 0,
      discount: 0,
      travelDistanceKm: 12, // Vượt 7km so với freeRadius 5km
      travelPolicy: { freeRadiusKm: 5, feePerKm: 10000 }
    })

    // Phụ phí di chuyển: (12 - 5) * 10000 = 70,000 VND
    expect(pricing.travel).toBe(70000)
    expect(pricing.subtotal).toBe(1070000)
    expect(pricing.total).toBe(1070000)
  })

  it('should correctly apply discount and taxes to final total', () => {
    const pricing = calcBookingPricing({
      mode: 'atOtherGym',
      base: 2000000,
      tax: 50000,
      discount: 200000,
      travelDistanceKm: 10,
      travelPolicy: { freeRadiusKm: 6, feePerKm: 5000 }
    })

    // Phụ phí: (10 - 6) * 5000 = 20,000 VND
    // subtotal = 2,000,000 + 50,000 + 20,000 = 2,070,000 VND
    // total = subtotal - 200,000 = 1,870,000 VND
    expect(pricing.travel).toBe(20000)
    expect(pricing.subtotal).toBe(2070000)
    expect(pricing.total).toBe(1870000)
  })
})
