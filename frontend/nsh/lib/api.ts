import type { CalendarResponse, Overview } from "./types";

export interface CreateSubscriptionInput {
  catalogServiceId?: string | null;
  name: string;
  amountMinor: number;
  currency: string;
  nextBillingDate: string;
  logoUrl?: string | null;
  category?: string;
  billingIntervalCount?: number;
  billingIntervalUnit?: string;
  renewalMethod?: string;
  billingChannelId?: string;
}

export class XuqiApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  getOverview(currency?: string) {
    const query = currency ? `?currency=${encodeURIComponent(currency)}` : "";
    return this.request<Overview>(`/overview${query}`);
  }

  listSubscriptions() {
    return this.request<Array<Record<string, unknown>>>("/subscriptions");
  }

  listBillingChannels(includeInactive = true) {
    return this.request<Array<Record<string, unknown>>>(
      `/billing-channels?include_inactive=${includeInactive ? "true" : "false"}`,
    );
  }

  updateBillingChannel(id: string, isActive: boolean) {
    return this.request<Record<string, unknown>>(`/billing-channels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  getCalendar(from: string, to: string) {
    return this.request<CalendarResponse>(
      `/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  }

  searchCatalog(query: string) {
    return this.request<Array<{
      id: string;
      name: string;
      aliases?: string;
      website_domain?: string | null;
      logo_url?: string | null;
    }>>(
      `/catalog/services?q=${encodeURIComponent(query)}`,
    );
  }

  getCatalogPrices(serviceId: string, region?: string) {
    const query = region ? `?region=${encodeURIComponent(region)}` : "";
    return this.request<{
      service: {
        id: string;
        name: string;
        aliases: string;
        website_domain?: string | null;
        logo_url?: string | null;
      };
      prices: Array<{
        id: string;
        service_id: string;
        region: string;
        platform?: string | null;
        plan_name: string;
        billing_interval_count: number;
        billing_interval_unit: string;
        amount_minor: number;
        currency: string;
        source_name?: string | null;
        source_url?: string | null;
      }>;
    }>(`/catalog/services/${encodeURIComponent(serviceId)}/prices${query}`);
  }

  createSubscription(input: CreateSubscriptionInput) {
    return this.request<Record<string, unknown>>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        catalog_service_id: input.catalogServiceId ?? null,
        name: input.name,
        amount_minor: input.amountMinor,
        currency: input.currency,
        next_billing_date: input.nextBillingDate,
        logo_url: input.logoUrl ?? null,
        category: input.category ?? null,
        billing_interval_count: input.billingIntervalCount ?? 1,
        billing_interval_unit: input.billingIntervalUnit ?? "month",
        renewal_method: input.renewalMethod ?? "auto",
        billing_channel_id: input.billingChannelId ?? null,
      }),
    });
  }
}
