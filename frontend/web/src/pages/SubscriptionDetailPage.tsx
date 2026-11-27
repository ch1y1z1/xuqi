import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useConnectedApi, useLedgerActions } from '@/lib/ledger'
import { useDemoLedger } from '@/demo/DemoLedgerContext'
import { BrandMark } from '@/components/BrandMark'
import { MoneyDisplay } from '@/components/MoneyDisplay'
import { intervalLabel, monthlyEquivalent } from '@shared/domain/billing'
import { dateLabel } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'

const statusLabels: Record<string, string> = {
  active: '进行中',
  paused: '已暂停',
  ended: '已结束',
}

export function SubscriptionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const actions = useLedgerActions()
  const [busy, setBusy] = useState(false)
  const query = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api!.getSubscription(id),
    enabled: Boolean(api && id),
  })
  const subscription = api ? query.data : demo.subscriptions.find((item) => item.id === id)
  const paymentsQuery = useQuery({
    queryKey: ['payments', id],
    queryFn: () => api!.listPayments(id),
    enabled: Boolean(api && id),
  })
  const payments = api ? paymentsQuery.data ?? [] : demo.payments.filter((item) => item.subscriptionId === id)
  const monthly = useMemo(() => subscription ? monthlyEquivalent(subscription.amountMinor, subscription.billingIntervalCount, subscription.billingIntervalUnit) : 0, [subscription])

  if (!subscription) {
    return (
      <div className="mx-auto max-w-[620px]">
        <Link to="/subscriptions" className="text-sm font-semibold text-[#263E9F]">← 订阅</Link>
        <div className="card mt-6 p-8 text-center text-sm text-[#706F78]">{query.isLoading ? '读取订阅…' : '没有找到这项订阅'}</div>
      </div>
    )
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/subscriptions" className="text-sm font-semibold text-[#263E9F]">← 订阅</Link>
        <Link to={`/subscriptions/${subscription.id}/edit`} className="secondary-button">编辑</Link>
      </div>

      <section className="text-center">
        <div className="flex justify-center"><BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="large" /></div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.4px]">{subscription.name}</h1>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[#706F78]">
          <span className="status-pill">{statusLabels[subscription.status] ?? subscription.status}</span>
          <span>{intervalLabel(subscription.billingIntervalCount, subscription.billingIntervalUnit)}</span>
        </div>
        <div className="mt-5 flex justify-center"><MoneyDisplay amountMinor={subscription.amountMinor} currency={subscription.currency} large /></div>
        <div className="mt-2 text-xs text-[#706F78]">月均 {formatMoney(monthly, subscription.currency)}</div>
      </section>

      <section className="hairline-card mt-7 grid divide-y divide-[#E7E4DE] text-sm">
        {[
          ['下次扣款', dateLabel(subscription.nextBillingDate)],
          ['付款渠道', subscription.billingChannelName ?? '未设置'],
          ['续费方式', subscription.renewalMethod === 'auto' ? '自动续费' : '手动续费'],
          ['分类', subscription.category ?? '未分类'],
          ['备注', subscription.notes ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-3.5">
            <span className="text-[#706F78]">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </section>

      <section className="mt-7">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">付款记录</h2>
          <span className="text-xs text-[#706F78]">{payments.length} 条</span>
        </div>
        <div className="hairline-card divide-y divide-[#E7E4DE] px-2 py-1">
          {payments.length === 0 ? <div className="p-5 text-center text-sm text-[#706F78]">还没有付款记录</div> : null}
          {payments.map((payment) => (
            <div key={payment.id} className="list-row">
              <span className="grid size-8 place-items-center rounded-full bg-[#E7EBFF] text-xs font-semibold text-[#263E9F]">✓</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{dateLabel(payment.paidAt.slice(0, 10))}</span>
                <span className="mt-0.5 block text-xs text-[#706F78]">{payment.billingChannelName ?? '未设渠道'}</span>
              </span>
              <span className="font-number text-sm font-semibold">{formatMoney(payment.amountMinor, payment.currency)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void run(async () => {
            await actions.createPayment(subscription.id, {
              billingPeriodDate: subscription.nextBillingDate,
              amountMinor: subscription.amountMinor,
              currency: subscription.currency,
            })
          })}
        >记录付款</button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void run(async () => {
            await actions.updateSubscription(subscription.id, { status: subscription.status === 'active' ? 'paused' : 'active' })
          })}
        >{subscription.status === 'active' ? '暂停订阅' : '恢复订阅'}</button>
      </div>
      <button
        type="button"
        className="mt-3 w-full text-center text-xs font-semibold text-[#A44138]"
        disabled={busy}
        onClick={() => {
          if (!window.confirm(`删除「${subscription.name}」？`)) return
          void run(async () => {
            await actions.deleteSubscription(subscription.id)
            navigate('/subscriptions')
          })
        }}
      >删除订阅</button>
    </div>
  )
}
