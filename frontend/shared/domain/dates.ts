export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return { year: Number(year), month: Number(month), day: Number(day) }
}

export function utcDateFromDateOnly(value: string) {
  const parsed = parseDateOnly(value)
  if (!parsed) return null
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
}

export function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDateOnly() {
  const now = new Date()
  return formatDateOnly(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function addDaysDateOnly(value: string, days: number) {
  const date = utcDateFromDateOnly(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateOnly(date)
}

export function compareDateOnly(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function dateLabel(value: string) {
  const date = utcDateFromDateOnly(value)
  if (!date) return value
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export function monthKeyOfDateOnly(value: string) {
  return value.slice(0, 7)
}

export function monthRange(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last = new Date(Date.UTC(year, month, 0))
  return { from: formatDateOnly(first), to: formatDateOnly(last) }
}
