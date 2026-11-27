import type { BillingIntervalUnit, RenewalMethod, SubscriptionStatus } from './enums'

export interface User {
  id: string
  displayName: string
  timezone: string
  defaultRegion: string
  defaultCurrency: string
  createdAt: string
  updatedAt: string
}

export interface BillingChannel {
  id: string
  userId?: string
  name: string
  brand?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Subscription {
  id: string
  userId?: string
  catalogServiceId?: string | null
  name: string
  logoUrl?: string | null
  category?: string | null
  amountMinor: number
  currency: string
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  billingAnchorDate?: string | null
  nextBillingDate: string
  renewalMethod: RenewalMethod
  billingChannelId?: string | null
  billingChannelName?: string | null
  status: SubscriptionStatus
  managementUrl?: string | null
  notes?: string | null
  endDate?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PaymentRecord {
  id: string
  subscriptionId: string
  billingPeriodDate: string
  paidAt: string
  amountMinor: number
  currency: string
  billingChannelName?: string | null
  note?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface OverviewSubscription {
  id: string
  name: string
  logoUrl?: string | null
  amountMinor: number
  currency: string
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  billingAnchorDate?: string | null
  nextBillingDate: string
  renewalMethod?: RenewalMethod
  billingChannelName?: string | null
  status?: SubscriptionStatus
  category?: string | null
}

export interface Overview {
  currency?: string | null
  monthlyPlannedMinor: number
  upcoming30DaysMinor: number
  paidThisMonthMinor: number
  activeSubscriptionCount: number
  subscriptions: OverviewSubscription[]
}

export interface CalendarSubscription extends OverviewSubscription {
  renewalMethod: RenewalMethod
  status: SubscriptionStatus
}

export interface CalendarResponse {
  from: string
  to: string
  upcoming: CalendarSubscription[]
  payments: PaymentRecord[]
}

export interface CatalogService {
  id: string
  name: string
  aliases?: string
  websiteDomain?: string | null
  logoUrl?: string | null
}

export interface CatalogPrice {
  id: string
  serviceId: string
  region: string
  platform?: string | null
  planName: string
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  amountMinor: number
  currency: string
  sourceName?: string | null
  sourceUrl?: string | null
}

export interface ServiceWithPrices {
  service: CatalogService
  prices: CatalogPrice[]
}
