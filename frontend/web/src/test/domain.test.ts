import { describe, expect, it } from 'vitest'
import { cycleProgress, monthlyEquivalent } from '@shared/domain/billing'
import { formatMoney, parseMoneyToMinor, splitMoney } from '@shared/domain/money'

describe('billing domain', () => {
  it('normalizes recurring prices to monthly equivalents', () => {
    expect(monthlyEquivalent(12000, 1, 'year')).toBe(1000)
    expect(monthlyEquivalent(1000, 2, 'month')).toBe(500)
    expect(monthlyEquivalent(1000, 1, 'week')).toBe(4333)
    expect(monthlyEquivalent(1000, 1, 'once')).toBe(0)
  })

  it('measures the elapsed part of the current billing period', () => {
    const progress = cycleProgress({
      nextBillingDate: '2026-02-01',
      billingIntervalCount: 1,
      billingIntervalUnit: 'month',
      billingAnchorDate: '2026-01-01',
    }, '2026-01-16')
    expect(progress).toBeGreaterThan(0.45)
    expect(progress).toBeLessThan(0.55)
  })
})

describe('money domain', () => {
  it('formats major and minor currency parts separately', () => {
    const parts = splitMoney(3500, 'CNY')
    expect(parts.symbol).toContain('¥')
    expect(parts.value).toBe('35.00')
    expect(formatMoney(3500, 'CNY')).toContain('35.00')
  })

  it('parses decimal input into minor units', () => {
    expect(parseMoneyToMinor('35.00', 'CNY')).toBe(3500)
    expect(parseMoneyToMinor('500', 'JPY')).toBe(500)
    expect(parseMoneyToMinor('abc', 'CNY')).toBeNull()
  })
})
