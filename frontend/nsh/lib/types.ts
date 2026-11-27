export type Section = "overview" | "subscriptions" | "calendar" | "settings" | "add";

export type ChartMode = "bubbles" | "blocks" | "rings";

export interface Subscription {
  id: string;
  name: string;
  logoUrl?: string | null;
  category?: string | null;
  amountMinor: number;
  currency: string;
  billingIntervalCount: number;
  billingIntervalUnit: string;
  nextBillingDate: string;
  renewalMethod: string;
  billingChannelName?: string | null;
  status?: string;
}

export interface BillingChannel {
  id: string;
  name: string;
  brand?: string | null;
  isActive: boolean;
}

export interface CatalogService {
  id: string;
  name: string;
  aliases?: string;
  websiteDomain?: string | null;
  logoUrl?: string | null;
}

export interface CatalogPrice {
  id: string;
  serviceId: string;
  region: string;
  platform?: string | null;
  planName: string;
  billingIntervalCount: number;
  billingIntervalUnit: string;
  amountMinor: number;
  currency: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

export interface Overview {
  currency?: string | null;
  monthlyPlannedMinor: number;
  upcoming30DaysMinor: number;
  paidThisMonthMinor: number;
  activeSubscriptionCount: number;
  subscriptions: Subscription[];
}

export interface CalendarResponse {
  from: string;
  to: string;
  upcoming: Subscription[];
  payments: Array<{
    id: string;
    subscriptionId: string;
    billingPeriodDate: string;
    paidAt: string;
    amountMinor: number;
    currency: string;
    billingChannelName?: string | null;
  }>;
}
