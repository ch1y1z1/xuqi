import type { BillingChannel, PaymentRecord, Subscription } from '@shared/api/types'

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateIn(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

function monthBefore(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return isoDate(new Date(year, month - 2, day))
}

function paymentDateTime(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return `${isoDate(date)}T12:00:00`
}

export const demoChannels: BillingChannel[] = [
  { id: 'wechat', name: '微信支付', brand: 'wechat', isActive: true },
  { id: 'alipay', name: '支付宝 Alipay', brand: 'alipay', isActive: true },
  { id: 'apple-pay', name: 'Apple Pay', brand: 'apple-pay', isActive: true },
  { id: 'mastercard', name: 'Mastercard', brand: 'mastercard', isActive: true },
]

export const demoSubscriptions: Subscription[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    logoUrl: 'https://cdn.simpleicons.org/spotify/1ED760',
    category: '音乐',
    amountMinor: 3500,
    currency: 'CNY',
    billingIntervalCount: 1,
    billingIntervalUnit: 'month',
    billingAnchorDate: monthBefore(dateIn(2)),
    nextBillingDate: dateIn(2),
    renewalMethod: 'auto',
    billingChannelId: 'apple-pay',
    billingChannelName: 'Apple Pay',
    status: 'active',
  },
  {
    id: 'notion',
    name: 'Notion',
    logoUrl: 'https://cdn.simpleicons.org/notion/1D1C24',
    category: '效率',
    amountMinor: 8000,
    currency: 'CNY',
    billingIntervalCount: 1,
    billingIntervalUnit: 'month',
    billingAnchorDate: monthBefore(dateIn(6)),
    nextBillingDate: dateIn(6),
    renewalMethod: 'auto',
    billingChannelId: 'mastercard',
    billingChannelName: 'Mastercard',
    status: 'active',
  },
  {
    id: 'figma',
    name: 'Figma',
    logoUrl: 'https://cdn.simpleicons.org/figma/F24E1E',
    category: '设计',
    amountMinor: 12000,
    currency: 'CNY',
    billingIntervalCount: 1,
    billingIntervalUnit: 'month',
    billingAnchorDate: monthBefore(dateIn(10)),
    nextBillingDate: dateIn(10),
    renewalMethod: 'auto',
    billingChannelId: 'alipay',
    billingChannelName: '支付宝 Alipay',
    status: 'active',
  },
  {
    id: 'icloud',
    name: 'iCloud+',
    logoUrl: 'https://cdn.simpleicons.org/icloud/3693F3',
    category: '存储',
    amountMinor: 2100,
    currency: 'CNY',
    billingIntervalCount: 1,
    billingIntervalUnit: 'month',
    billingAnchorDate: monthBefore(dateIn(18)),
    nextBillingDate: dateIn(18),
    renewalMethod: 'auto',
    billingChannelId: 'wechat',
    billingChannelName: '微信支付',
    status: 'active',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    logoUrl: 'https://cdn.simpleicons.org/openai/1D1C24',
    category: '效率',
    amountMinor: 14400,
    currency: 'CNY',
    billingIntervalCount: 1,
    billingIntervalUnit: 'month',
    billingAnchorDate: monthBefore(dateIn(26)),
    nextBillingDate: dateIn(26),
    renewalMethod: 'manual',
    billingChannelId: 'mastercard',
    billingChannelName: 'Mastercard',
    status: 'active',
  },
]

export const demoPayments: PaymentRecord[] = [
  {
    id: 'payment-spotify-2026-10',
    subscriptionId: 'spotify',
    billingPeriodDate: dateIn(-28),
    paidAt: paymentDateTime(28),
    amountMinor: 3500,
    currency: 'CNY',
    billingChannelName: 'Apple Pay',
  },
]
