import type {
  BillingChannel,
  CalendarResponse,
  CatalogService,
  Overview,
  PaymentRecord,
  ServiceWithPrices,
  Subscription,
  User,
} from '@shared/api/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function snakeKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function camelize<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => camelize(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [camelKey(key), camelize(item)]),
    ) as T
  }
  return value as T
}

export function snakeize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => snakeize(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [snakeKey(key), snakeize(item)]),
    )
  }
  return value
}

type JsonRecord = Record<string, unknown>

export class XuqiApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          ...(init?.headers ?? {}),
        },
      })
    } catch {
      throw new ApiError(0, 'network_error', '无法连接后端服务')
    }

    if (!response.ok) {
      let code = 'unknown_error'
      let message = `${response.status} ${response.statusText}`
      try {
        const body = (await response.json()) as { error?: string; message?: string }
        code = body.error ?? code
        message = body.message ?? message
      } catch {}
      throw new ApiError(response.status, code, message)
    }
    if (response.status === 204) return undefined as T
    return camelize<T>(await response.json())
  }

  getMe() {
    return this.request<User>('/me')
  }

  updateMe(input: Partial<Pick<User, 'displayName' | 'timezone' | 'defaultRegion' | 'defaultCurrency'>>) {
    return this.request<User>('/me', { method: 'PATCH', body: JSON.stringify(snakeize(input)) })
  }

  listBillingChannels(includeInactive = true) {
    return this.request<BillingChannel[]>(`/billing-channels?include_inactive=${includeInactive ? 'true' : 'false'}`)
  }

  createBillingChannel(input: { name: string; brand?: string | null }) {
    return this.request<BillingChannel>('/billing-channels', { method: 'POST', body: JSON.stringify(snakeize(input)) })
  }

  updateBillingChannel(id: string, input: Partial<Pick<BillingChannel, 'name' | 'brand' | 'isActive'>>) {
    return this.request<BillingChannel>(`/billing-channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(snakeize(input)),
    })
  }

  listSubscriptions(filters: { q?: string; status?: string; limit?: number } = {}) {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.status) params.set('status', filters.status)
    if (filters.limit) params.set('limit', String(filters.limit))
    const query = params.toString()
    return this.request<Subscription[]>(`/subscriptions${query ? `?${query}` : ''}`)
  }

  getSubscription(id: string) {
    return this.request<Subscription>(`/subscriptions/${encodeURIComponent(id)}`)
  }

  createSubscription(input: JsonRecord) {
    return this.request<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(snakeize(input)) })
  }

  updateSubscription(id: string, input: JsonRecord) {
    return this.request<Subscription>(`/subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(snakeize(input)),
    })
  }

  deleteSubscription(id: string) {
    return this.request<void>(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  listPayments(subscriptionId: string) {
    return this.request<PaymentRecord[]>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`)
  }

  createPayment(subscriptionId: string, input: JsonRecord) {
    return this.request<PaymentRecord>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments`, {
      method: 'POST',
      body: JSON.stringify(snakeize(input)),
    })
  }

  updatePayment(subscriptionId: string, paymentId: string, input: JsonRecord) {
    return this.request<PaymentRecord>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments/${encodeURIComponent(paymentId)}`,
      { method: 'PATCH', body: JSON.stringify(snakeize(input)) },
    )
  }

  getOverview(currency?: string) {
    const query = currency ? `?currency=${encodeURIComponent(currency)}` : ''
    return this.request<Overview>(`/overview${query}`)
  }

  getCalendar(from: string, to: string) {
    return this.request<CalendarResponse>(`/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  searchCatalog(query: string) {
    return this.request<CatalogService[]>(`/catalog/services?q=${encodeURIComponent(query)}`)
  }

  getCatalogPrices(serviceId: string, region?: string) {
    const query = region ? `?region=${encodeURIComponent(region)}` : ''
    return this.request<ServiceWithPrices>(`/catalog/services/${encodeURIComponent(serviceId)}/prices${query}`)
  }

  exportData() {
    return this.request<Record<string, unknown>>('/export')
  }

  importData(payload: unknown) {
    return this.request<Record<string, unknown>>('/import', { method: 'POST', body: JSON.stringify(snakeize(payload)) })
  }
}
