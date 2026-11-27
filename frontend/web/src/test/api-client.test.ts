import { describe, expect, it } from 'vitest'
import { camelize, snakeize } from '@/api/client'

describe('API wire conversion', () => {
  it('camelizes snake_case responses recursively', () => {
    expect(camelize<{ nextBillingDate: string; items: Array<{ amountMinor: number }> }>({
      next_billing_date: '2026-01-01',
      items: [{ amount_minor: 3500 }],
    })).toEqual({ nextBillingDate: '2026-01-01', items: [{ amountMinor: 3500 }] })
  })

  it('snakeizes request payloads and omits undefined values', () => {
    expect(snakeize({ amountMinor: 3500, billingChannelId: 'card', notes: undefined })).toEqual({
      amount_minor: 3500,
      billing_channel_id: 'card',
    })
  })
})
