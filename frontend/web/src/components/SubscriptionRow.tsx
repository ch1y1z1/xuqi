import { Link } from 'react-router-dom'
import type { Subscription } from '@shared/api/types'
import { dateLabel } from '@shared/domain/dates'
import { formatMoney } from '@shared/domain/money'
import { BrandMark } from '@/components/BrandMark'

export function SubscriptionRow({ subscription }: { subscription: Subscription }) {
  return (
    <Link to={`/subscriptions/${subscription.id}`} className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E7E4DE] bg-white p-4 transition-colors hover:bg-white/80">
      <span className="flex min-w-0 items-center gap-3">
        <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{subscription.name}</span>
          <span className="mt-1 block text-xs text-[#706F78]">
            {subscription.category ?? '其他'} · {dateLabel(subscription.nextBillingDate)}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-number block text-sm font-semibold">{formatMoney(subscription.amountMinor, subscription.currency)}</span>
        <span className="mt-1 block text-xs text-[#706F78]">{subscription.billingChannelName ?? '未设置渠道'}</span>
      </span>
    </Link>
  )
}
