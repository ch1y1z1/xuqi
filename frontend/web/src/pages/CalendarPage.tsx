import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCalendarData } from '@/lib/ledger'
import { PageHeader } from '@/components/PageHeader'
import { BrandMark } from '@/components/BrandMark'
import { formatMoney } from '@shared/domain/money'
import { dateLabel, formatDateOnly, todayDateOnly } from '@shared/domain/dates'

function pad(value: number) { return String(value).padStart(2, '0') }
function localDateOnly(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function monthKeyFromDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}` }

function gridDates(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return localDateOnly(date)
  })
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number)
  return monthKeyFromDate(new Date(year, month - 1 + delta, 1))
}

export function CalendarPage() {
  const today = todayDateOnly()
  const [monthKey, setMonthKey] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const { data, isLoading } = useCalendarData(monthKey)
  const dates = useMemo(() => gridDates(monthKey), [monthKey])
  const upcomingByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['upcoming']>()
    for (const item of data?.upcoming ?? []) map.set(item.nextBillingDate, [...(map.get(item.nextBillingDate) ?? []), item])
    return map
  }, [data])
  const paymentsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['payments']>()
    for (const item of data?.payments ?? []) {
      const key = item.paidAt.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data])
  const selectedUpcoming = upcomingByDate.get(selectedDate) ?? []
  const selectedPayments = paymentsByDate.get(selectedDate) ?? []

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title="日历" subtitle="当前后端只显示每期下一次扣款，不展开未来重复账期" add />
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="secondary-button" onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>← 上月</button>
        <div className="text-lg font-semibold">{monthKey.replace('-', ' 年 ')} 月</div>
        <button type="button" className="secondary-button" onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>下月 →</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
        <section className="hairline-card p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 px-1 pb-2 text-center text-[11px] font-semibold text-[#706F78]">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dates.map((date) => {
              const dues = upcomingByDate.get(date) ?? []
              const payments = paymentsByDate.get(date) ?? []
              const outside = !date.startsWith(monthKey)
              return (
                <button
                  type="button"
                  key={date}
                  className={`calendar-day ${outside ? 'outside' : ''} ${selectedDate === date ? 'selected' : ''} ${today === date ? 'today' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="day-number">{Number(date.slice(-2))}</span>
                  <span className="mt-2 flex min-h-[14px] flex-wrap gap-1">
                    {dues.slice(0, 3).map((item) => <span key={item.id} className="size-1.5 rounded-full bg-[#263E9F]" />)}
                    {payments.slice(0, 2).map((item) => <span key={item.id} className="size-1.5 rounded-full bg-[#4B8F8C]" />)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <aside className="hairline-card h-fit p-4">
          <div className="text-sm font-semibold">{dateLabel(selectedDate)}</div>
          {isLoading ? <div className="mt-5 text-sm text-[#706F78]">读取日历…</div> : null}
          {!isLoading && selectedUpcoming.length === 0 && selectedPayments.length === 0 ? (
            <div className="grid min-h-[160px] place-items-center text-center text-sm text-[#706F78]">这一天没有账目</div>
          ) : null}
          <div className="mt-4 grid gap-3">
            {selectedUpcoming.map((item) => (
              <Link key={item.id} to={`/subscriptions/${item.id}`} className="list-row !p-2">
                <BrandMark name={item.name} logoUrl={item.logoUrl} size="small" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs text-[#706F78]">待扣款</span>
                </span>
                <span className="font-number text-sm font-semibold">{formatMoney(item.amountMinor, item.currency)}</span>
              </Link>
            ))}
            {selectedPayments.map((item) => (
              <div key={item.id} className="list-row !p-2">
                <span className="grid size-6 place-items-center rounded-full bg-[#E7EBFF] text-xs text-[#263E9F]">✓</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">付款记录</span>
                  <span className="text-xs text-[#706F78]">已付款 · {item.billingChannelName ?? '未设渠道'}</span>
                </span>
                <span className="font-number text-sm font-semibold">{formatMoney(item.amountMinor, item.currency)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
