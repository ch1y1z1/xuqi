import type { BillingIntervalUnit } from '../api/enums'
import { formatDateOnly, todayDateOnly, utcDateFromDateOnly } from './dates'

export function monthlyEquivalent(amountMinor: number, count: number, unit: BillingIntervalUnit) {
  const safeCount = Math.max(1, count)
  if (unit === 'month') return Math.round(amountMinor / safeCount)
  if (unit === 'year') return Math.round(amountMinor / (12 * safeCount))
  if (unit === 'week') return Math.round((amountMinor * 52) / (12 * safeCount))
  if (unit === 'day') return Math.round((amountMinor * 365) / (12 * safeCount))
  return 0
}

export function intervalLabel(count: number, unit: BillingIntervalUnit) {
  if (unit === 'once') return '一次性'
  const labels: Record<BillingIntervalUnit, string> = {
    day: '天',
    week: '周',
    month: '个月',
    year: '年',
    once: '次',
  }
  return `每 ${count} ${labels[unit]}`
}

function subtractMonths(date: Date, months: number, anchorDay?: number) {
  const result = new Date(date.getTime())
  const desiredDay = anchorDay ?? result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(desiredDay, lastDay))
  return result
}

export function currentPeriodStart(input: {
  nextBillingDate: string
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  billingAnchorDate?: string | null
}) {
  if (input.billingIntervalUnit === 'once') return null
  const next = utcDateFromDateOnly(input.nextBillingDate)
  if (!next) return null
  const count = Math.max(1, input.billingIntervalCount)
  const anchorDay = input.billingAnchorDate ? utcDateFromDateOnly(input.billingAnchorDate)?.getUTCDate() : undefined
  let start: Date
  if (input.billingIntervalUnit === 'day') {
    start = new Date(next.getTime())
    start.setUTCDate(start.getUTCDate() - count)
  } else if (input.billingIntervalUnit === 'week') {
    start = new Date(next.getTime())
    start.setUTCDate(start.getUTCDate() - count * 7)
  } else if (input.billingIntervalUnit === 'month') {
    start = subtractMonths(next, count, anchorDay)
  } else {
    start = subtractMonths(next, count * 12, anchorDay)
  }
  return formatDateOnly(start)
}

export function cycleProgress(input: {
  nextBillingDate: string
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  billingAnchorDate?: string | null
}, today = todayDateOnly()) {
  const startValue = currentPeriodStart(input)
  const start = startValue ? utcDateFromDateOnly(startValue) : null
  const end = utcDateFromDateOnly(input.nextBillingDate)
  const now = utcDateFromDateOnly(today)
  if (!start || !end || !now || end.getTime() <= start.getTime()) return 0
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
}
