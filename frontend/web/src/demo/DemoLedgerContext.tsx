import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { BillingChannel, PaymentRecord, Subscription } from '@shared/api/types'
import { addDaysDateOnly, todayDateOnly, utcDateFromDateOnly, formatDateOnly } from '@shared/domain/dates'
import { demoChannels, demoPayments, demoSubscriptions } from './demo-data'

interface DemoLedgerContextValue {
  subscriptions: Subscription[]
  channels: BillingChannel[]
  payments: PaymentRecord[]
  addSubscription: (input: Omit<Subscription, 'id'>) => Subscription
  updateSubscription: (id: string, input: Partial<Subscription>) => void
  deleteSubscription: (id: string) => void
  upsertChannel: (input: BillingChannel) => void
  addPayment: (subscriptionId: string, input: Partial<PaymentRecord>) => void
}

const DemoLedgerContext = createContext<DemoLedgerContextValue | null>(null)

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function addInterval(dateValue: string, count: number, unit: Subscription['billingIntervalUnit']) {
  const date = utcDateFromDateOnly(dateValue)
  if (!date) return dateValue
  if (unit === 'day') return addDaysDateOnly(dateValue, count)
  if (unit === 'week') return addDaysDateOnly(dateValue, count * 7)
  if (unit === 'month') {
    date.setUTCMonth(date.getUTCMonth() + count)
    return formatDateOnly(date)
  }
  if (unit === 'year') {
    date.setUTCFullYear(date.getUTCFullYear() + count)
    return formatDateOnly(date)
  }
  return dateValue
}

export function DemoLedgerProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState(demoSubscriptions)
  const [channels, setChannels] = useState(demoChannels)
  const [payments, setPayments] = useState(demoPayments)

  const value = useMemo<DemoLedgerContextValue>(() => ({
    subscriptions,
    channels,
    payments,
    addSubscription(input) {
      const item = { ...input, id: nextId('local') }
      setSubscriptions((items) => [item, ...items])
      return item
    },
    updateSubscription(id, input) {
      setSubscriptions((items) => items.map((item) => (item.id === id ? { ...item, ...input } : item)))
    },
    deleteSubscription(id) {
      setSubscriptions((items) => items.filter((item) => item.id !== id))
      setPayments((items) => items.filter((item) => item.subscriptionId !== id))
    },
    upsertChannel(input) {
      setChannels((items) => {
        const exists = items.some((item) => item.id === input.id)
        return exists ? items.map((item) => (item.id === input.id ? input : item)) : [...items, input]
      })
    },
    addPayment(subscriptionId, input) {
      const subscription = subscriptions.find((item) => item.id === subscriptionId)
      if (!subscription) return
      const payment: PaymentRecord = {
        id: nextId('payment'),
        subscriptionId,
        billingPeriodDate: input.billingPeriodDate ?? subscription.nextBillingDate,
        paidAt: input.paidAt ?? `${todayDateOnly()}T12:00:00`,
        amountMinor: input.amountMinor ?? subscription.amountMinor,
        currency: input.currency ?? subscription.currency,
        billingChannelName: input.billingChannelName ?? subscription.billingChannelName,
        note: input.note ?? null,
      }
      setPayments((items) => [payment, ...items])
      setSubscriptions((items) => items.map((item) => item.id === subscriptionId
        ? { ...item, nextBillingDate: addInterval(item.nextBillingDate, item.billingIntervalCount, item.billingIntervalUnit) }
        : item))
    },
  }), [subscriptions, channels, payments])

  return <DemoLedgerContext.Provider value={value}>{children}</DemoLedgerContext.Provider>
}

export function useDemoLedger() {
  const value = useContext(DemoLedgerContext)
  if (!value) throw new Error('useDemoLedger must be used within DemoLedgerProvider')
  return value
}
