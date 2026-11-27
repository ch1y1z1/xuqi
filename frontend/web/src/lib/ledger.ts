import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session'
import { useDemoLedger } from '@/demo/DemoLedgerContext'
import type { BillingChannel, CalendarResponse, Overview, Subscription } from '@shared/api/types'
import { monthlyEquivalent } from '@shared/domain/billing'
import { addDaysDateOnly, monthRange, todayDateOnly } from '@shared/domain/dates'

export function useConnectedApi() {
  const { api, status } = useSession()
  return status === 'connected' && api ? api : null
}

export function useSubscriptionsData(filters: { q?: string; status?: string } = {}) {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const query = useQuery({
    queryKey: ['subscriptions', filters],
    queryFn: () => api!.listSubscriptions(filters),
    enabled: Boolean(api),
  })
  const demoData = useMemo(() => {
    const q = filters.q?.trim().toLowerCase()
    return demo.subscriptions.filter((item) => {
      const matchesQuery = !q || `${item.name} ${item.category ?? ''}`.toLowerCase().includes(q)
      const matchesStatus = !filters.status || item.status === filters.status
      return matchesQuery && matchesStatus
    })
  }, [demo.subscriptions, filters.q, filters.status])
  return { ...query, data: api ? query.data ?? [] : demoData, isDemo: !api }
}

export function useChannelsData() {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const query = useQuery({
    queryKey: ['billing-channels'],
    queryFn: () => api!.listBillingChannels(true),
    enabled: Boolean(api),
  })
  return { ...query, data: api ? query.data ?? [] : demo.channels, isDemo: !api }
}

function demoOverview(subscriptions: Subscription[], currency: string): Overview {
  const today = todayDateOnly()
  const end = addDaysDateOnly(today, 30)
  const active = subscriptions.filter((item) => item.status === 'active' && item.currency === currency)
  return {
    currency,
    monthlyPlannedMinor: active.reduce((sum, item) => sum + monthlyEquivalent(item.amountMinor, item.billingIntervalCount, item.billingIntervalUnit), 0),
    upcoming30DaysMinor: active.reduce((sum, item) => sum + (item.nextBillingDate >= today && item.nextBillingDate <= end ? item.amountMinor : 0), 0),
    paidThisMonthMinor: 0,
    activeSubscriptionCount: active.length,
    subscriptions: active,
  }
}

export function useOverviewData(currency = 'CNY') {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const query = useQuery({
    queryKey: ['overview', currency],
    queryFn: () => api!.getOverview(currency),
    enabled: Boolean(api),
  })
  const fallback = useMemo(() => demoOverview(demo.subscriptions, currency), [demo.subscriptions, currency])
  return { ...query, data: api ? query.data : fallback, isDemo: !api }
}

export function useCalendarData(monthKey: string) {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const { from, to } = monthRange(monthKey)
  const query = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => api!.getCalendar(from, to),
    enabled: Boolean(api),
  })
  const fallback = useMemo<CalendarResponse>(() => ({
    from,
    to,
    upcoming: demo.subscriptions.filter((item) => item.nextBillingDate >= from && item.nextBillingDate <= to),
    payments: demo.payments.filter((item) => item.paidAt.slice(0, 10) >= from && item.paidAt.slice(0, 10) <= to),
  }), [demo.subscriptions, demo.payments, from, to])
  return { ...query, data: api ? query.data : fallback, isDemo: !api }
}

export function useLedgerActions() {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const queryClient = useQueryClient()
  const invalidateLedger = async () => {
    await queryClient.invalidateQueries()
  }

  return {
    isDemo: !api,
    async createSubscription(input: Record<string, unknown>) {
      if (api) {
        const result = await api.createSubscription(input)
        await invalidateLedger()
        return result
      }
      const channel = demo.channels.find((item) => item.id === input.billingChannelId)
      return demo.addSubscription({
        name: String(input.name),
        logoUrl: (input.logoUrl as string | null) ?? null,
        category: (input.category as string | null) ?? null,
        amountMinor: Number(input.amountMinor),
        currency: String(input.currency),
        billingIntervalCount: Number(input.billingIntervalCount ?? 1),
        billingIntervalUnit: (input.billingIntervalUnit as Subscription['billingIntervalUnit']) ?? 'month',
        billingAnchorDate: (input.billingAnchorDate as string | null) ?? null,
        nextBillingDate: String(input.nextBillingDate),
        renewalMethod: (input.renewalMethod as Subscription['renewalMethod']) ?? 'auto',
        billingChannelId: (input.billingChannelId as string | null) ?? null,
        billingChannelName: channel?.name ?? null,
        status: 'active',
        catalogServiceId: (input.catalogServiceId as string | null) ?? null,
        managementUrl: (input.managementUrl as string | null) ?? null,
        notes: (input.notes as string | null) ?? null,
        endDate: (input.endDate as string | null) ?? null,
      })
    },
    async updateSubscription(id: string, input: Record<string, unknown>) {
      if (api) {
        const result = await api.updateSubscription(id, input)
        await invalidateLedger()
        return result
      }
      demo.updateSubscription(id, input)
      return demo.subscriptions.find((item) => item.id === id)
    },
    async deleteSubscription(id: string) {
      if (api) {
        await api.deleteSubscription(id)
        await invalidateLedger()
        return
      }
      demo.deleteSubscription(id)
    },
    async updateChannel(id: string, input: Partial<BillingChannel>) {
      if (api) {
        const result = await api.updateBillingChannel(id, input)
        await invalidateLedger()
        return result
      }
      const current = demo.channels.find((item) => item.id === id)
      if (current) demo.upsertChannel({ ...current, ...input })
      return current
    },
    async createChannel(input: { name: string; brand?: string | null }) {
      if (api) {
        const result = await api.createBillingChannel(input)
        await invalidateLedger()
        return result
      }
      const channel = { id: `local-channel-${Date.now()}`, name: input.name, brand: input.brand ?? null, isActive: true }
      demo.upsertChannel(channel)
      return channel
    },
    async createPayment(subscriptionId: string, input: Record<string, unknown>) {
      if (api) {
        const result = await api.createPayment(subscriptionId, input)
        await invalidateLedger()
        return result
      }
      demo.addPayment(subscriptionId, input)
    },
  }
}
