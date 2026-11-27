const currencyDigits: Record<string, number> = {
  CNY: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  JPY: 0,
  KRW: 0,
}

export function digitsForCurrency(currency: string) {
  return currencyDigits[currency.toUpperCase()] ?? 2
}

export function formatMoney(amountMinor: number, currency: string) {
  const digits = digitsForCurrency(currency)
  const amount = amountMinor / 10 ** digits
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export function splitMoney(amountMinor: number, currency: string) {
  const parts = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digitsForCurrency(currency),
    maximumFractionDigits: digitsForCurrency(currency),
  }).formatToParts(amountMinor / 10 ** digitsForCurrency(currency))
  const symbol = parts.find((part) => part.type === 'currency')?.value ?? currency
  const value = parts
    .filter((part) => part.type !== 'currency')
    .map((part) => part.value)
    .join('')
    .trim()
  return { symbol, value }
}

export function parseMoneyToMinor(input: string, currency: string) {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) return null
  const digits = digitsForCurrency(currency)
  return Math.round(Number.parseFloat(normalized) * 10 ** digits)
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`
}
