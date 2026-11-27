import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOverviewData } from '@/lib/ledger'
import { useSession } from '@/auth/session'
import { PageHeader } from '@/components/PageHeader'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { BrandMark } from '@/components/BrandMark'
import { SpendingChart, type ChartMode } from '@/components/charts/SpendingChart'
import { dateLabel } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'

const chartModes: Array<{ value: ChartMode; label: string }> = [
  { value: 'bubbles', label: '气泡' },
  { value: 'blocks', label: '块' },
  { value: 'rings', label: '环' },
]

export function OverviewPage() {
  const { status } = useSession()
  const [currency, setCurrency] = useState('CNY')
  const [mode, setMode] = useState<ChartMode>('bubbles')
  const [selectedId, setSelectedId] = useState('')
  const { data: overview, isLoading } = useOverviewData(currency)
  const subscriptions = useMemo(() => overview?.subscriptions ?? [], [overview])

  useEffect(() => {
    if (!subscriptions.length) {
      setSelectedId('')
      return
    }
    if (!subscriptions.some((item) => item.id === selectedId)) setSelectedId(subscriptions[0].id)
  }, [subscriptions, selectedId])

  const selected = subscriptions.find((item) => item.id === selectedId) ?? subscriptions[0]

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        title="支出概览"
        subtitle={status === 'connected' ? '已连接 API' : '演示数据 · 连接 API 后同步真实账本'}
        add
        wideAction={(
          <select className="input h-10 w-[92px] rounded-full px-3 pr-8 text-xs" value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="币种">
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
            <option value="HKD">HKD</option>
          </select>
        )}
      />

      {isLoading && !overview ? (
        <div className="card grid min-h-[380px] place-items-center text-sm text-[#706F78]">读取账本…</div>
      ) : (
        <div className="grid gap-7">
          <section className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#706F78]">月均支出</div>
            <div className="mt-2 flex justify-center">
              <MoneyDisplay amountMinor={overview?.monthlyPlannedMinor ?? 0} currency={currency} large />
            </div>
            <div className="mt-2 text-xs text-[#706F78]">未来 30 天 {formatMoney(overview?.upcoming30DaysMinor ?? 0, currency)}</div>
          </section>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">构成</div>
            <div className="segmented" aria-label="图形模式">
              {chartModes.map((item) => (
                <button key={item.value} type="button" className={mode === item.value ? 'active' : ''} onClick={() => setMode(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <SpendingChart mode={mode} subscriptions={subscriptions} selectedId={selected?.id ?? ''} onSelect={setSelectedId} />

          {selected ? (
            <Link to={`/subscriptions/${selected.id}`} className="hairline-card flex items-center gap-3 p-4">
              <BrandMark name={selected.name} logoUrl={selected.logoUrl} size="large" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{selected.name}</div>
                <div className="mt-1 text-xs text-[#706F78]">{dateLabel(selected.nextBillingDate)}</div>
              </div>
              <div className="text-right">
                <div className="font-number text-[17px] font-semibold">{formatMoney(selected.amountMinor, selected.currency)}</div>
                <div className="mt-1 text-[11px] text-[#706F78]">{selected.billingChannelName ?? '未设渠道'}</div>
              </div>
            </Link>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">订阅</h2>
              <Link to="/subscriptions" className="text-xs font-semibold text-[#263E9F]">查看全部</Link>
            </div>
            <div className="hairline-card divide-y divide-[#E7E4DE] px-2 py-1">
              {subscriptions.slice(0, 5).map((item) => (
                <Link key={item.id} to={`/subscriptions/${item.id}`} className="list-row">
                  <BrandMark name={item.name} logoUrl={item.logoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-[#706F78]">{dateLabel(item.nextBillingDate)}</span>
                  </span>
                  <span className="font-number text-sm font-semibold">{formatMoney(item.amountMinor, item.currency)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
