import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSubscriptionsData } from '@/lib/ledger'
import { PageHeader } from '@/components/PageHeader'
import { SubscriptionRow } from '@/components/SubscriptionRow'

export function SubscriptionsPage() {
  const [query, setQuery] = useState('')
  const filters = useMemo(() => ({ q: query || undefined }), [query])
  const { data: subscriptions, isLoading } = useSubscriptionsData(filters)

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="订阅" add />
      <div className="mb-5">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索订阅" />
      </div>
      {isLoading ? <div className="card p-8 text-center text-sm text-[#706F78]">读取订阅…</div> : null}
      {!isLoading && subscriptions.length === 0 ? (
        <div className="card grid min-h-[220px] place-items-center p-8 text-center">
          <div>
            <div className="text-lg font-semibold">还没有订阅</div>
            <p className="mt-2 text-sm text-[#706F78]">点击右上角加号，登记第一项服务。</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-2">
        {subscriptions.map((item) => <SubscriptionRow key={item.id} subscription={item} />)}
        <Link to="/subscriptions/new" className="grid min-h-[52px] place-items-center rounded-[16px] border border-dashed border-[#D8D4CD] text-xs font-medium text-[#263E9F]">
          添加一项订阅
        </Link>
      </div>
    </div>
  )
}
