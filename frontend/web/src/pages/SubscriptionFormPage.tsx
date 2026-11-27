import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useChannelsData, useConnectedApi, useLedgerActions } from '@/lib/ledger'
import { useDemoLedger } from '@/demo/DemoLedgerContext'
import { BrandMark } from '@/components/BrandMark'
import { digitsForCurrency, parseMoneyToMinor } from '@shared/domain/money'
import { todayDateOnly } from '@shared/domain/dates'
import type { CatalogService } from '@shared/api/types'

const formSchema = z.object({
  name: z.string().min(1, '请填写服务名称'),
  logoUrl: z.string(),
  category: z.string(),
  amount: z.string().min(1, '请填写金额'),
  currency: z.string().min(3).max(3),
  billingIntervalCount: z.string().min(1),
  billingIntervalUnit: z.enum(['day', 'week', 'month', 'year', 'once']),
  nextBillingDate: z.string().min(1, '请选择下次扣款日'),
  renewalMethod: z.enum(['auto', 'manual']),
  billingChannelId: z.string(),
  managementUrl: z.string(),
  notes: z.string(),
})

type FormValues = z.infer<typeof formSchema>

const emptyValues: FormValues = {
  name: '',
  logoUrl: '',
  category: '',
  amount: '',
  currency: 'CNY',
  billingIntervalCount: '1',
  billingIntervalUnit: 'month',
  nextBillingDate: todayDateOnly(),
  renewalMethod: 'auto',
  billingChannelId: '',
  managementUrl: '',
  notes: '',
}

function CatalogPicker({ onPick }: { onPick: (service: CatalogService) => void }) {
  const api = useConnectedApi()
  const [queryText, setQueryText] = useState('')
  const enabled = Boolean(api && queryText.trim().length >= 2)
  const query = useQuery({
    queryKey: ['catalog', queryText],
    queryFn: () => api!.searchCatalog(queryText.trim()),
    enabled,
  })
  if (!api) return null
  return (
    <div className="rounded-[18px] bg-[#F0EEE9] p-3">
      <input className="input bg-white" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="搜索服务目录，例如 Spotify" />
      {query.data?.length ? (
        <div className="mt-2 grid gap-1">
          {query.data.slice(0, 5).map((service) => (
            <button key={service.id} type="button" className="flex items-center gap-2 rounded-[12px] bg-white/60 px-2 py-2 text-left" onClick={() => onPick(service)}>
              <BrandMark name={service.name} logoUrl={service.logoUrl} size="small" />
              <span className="flex-1 text-sm font-medium">{service.name}</span>
              <span className="text-xs text-[#706F78]">服务目录</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SubscriptionFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const actions = useLedgerActions()
  const { data: channels } = useChannelsData()
  const [submitError, setSubmitError] = useState('')
  const existingQuery = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api!.getSubscription(id!),
    enabled: Boolean(api && id),
  })
  const existing = useMemo(() => api ? existingQuery.data : demo.subscriptions.find((item) => item.id === id), [api, existingQuery.data, demo.subscriptions, id])
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues })
  const watchedName = form.watch('name')
  const watchedLogo = form.watch('logoUrl')

  useEffect(() => {
    if (!existing) return
    const decimals = digitsForCurrency(existing.currency)
    form.reset({
      name: existing.name,
      logoUrl: existing.logoUrl ?? '',
      category: existing.category ?? '',
      amount: (existing.amountMinor / 10 ** decimals).toFixed(decimals),
      currency: existing.currency,
      billingIntervalCount: String(existing.billingIntervalCount),
      billingIntervalUnit: existing.billingIntervalUnit,
      nextBillingDate: existing.nextBillingDate,
      renewalMethod: existing.renewalMethod,
      billingChannelId: existing.billingChannelId ?? '',
      managementUrl: existing.managementUrl ?? '',
      notes: existing.notes ?? '',
    })
  }, [existing, form])

  async function onSubmit(values: FormValues) {
    setSubmitError('')
    const amountMinor = parseMoneyToMinor(values.amount, values.currency.toUpperCase())
    if (amountMinor === null || amountMinor < 0) {
      setSubmitError('金额格式不正确')
      return
    }
    const payload = {
      name: values.name.trim(),
      logoUrl: values.logoUrl.trim() || null,
      category: values.category.trim() || null,
      amountMinor,
      currency: values.currency.toUpperCase(),
      billingIntervalCount: Math.max(1, Number(values.billingIntervalCount) || 1),
      billingIntervalUnit: values.billingIntervalUnit,
      billingAnchorDate: values.nextBillingDate,
      nextBillingDate: values.nextBillingDate,
      renewalMethod: values.renewalMethod,
      billingChannelId: values.billingChannelId || null,
      managementUrl: values.managementUrl.trim() || null,
      notes: values.notes.trim() || null,
    }
    try {
      const saved = isEdit && id ? await actions.updateSubscription(id, payload) : await actions.createSubscription(payload)
      navigate(saved?.id ? `/subscriptions/${saved.id}` : '/subscriptions')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '保存失败')
    }
  }

  return (
    <div className="mx-auto max-w-[620px]">
      <div className="mb-6 flex items-center justify-between">
        <Link to={isEdit && id ? `/subscriptions/${id}` : '/subscriptions'} className="text-sm font-semibold text-[#263E9F]">← 取消</Link>
        <h1 className="text-lg font-semibold">{isEdit ? '编辑订阅' : '添加订阅'}</h1>
        <span className="w-10" />
      </div>

      <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
        {!isEdit ? <CatalogPicker onPick={(service) => {
          form.setValue('name', service.name)
          form.setValue('logoUrl', service.logoUrl ?? '')
        }} /> : null}

        <div className="hairline-card flex items-center gap-3 p-4">
          <BrandMark name={watchedName || '新订阅'} logoUrl={watchedLogo} size="large" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{watchedName || '新订阅'}</div>
            <div className="mt-1 text-xs text-[#706F78]">品牌 Logo 保持原色，不使用文字覆盖。</div>
          </div>
        </div>

        <label className="label">服务名称<input className="input" {...form.register('name')} placeholder="例如 Spotify" /></label>
        <label className="label">Logo URL<input className="input" {...form.register('logoUrl')} placeholder="https://…" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">金额<input className="input font-number" inputMode="decimal" {...form.register('amount')} placeholder="35.00" /></label>
          <label className="label">币种<input className="input uppercase" maxLength={3} {...form.register('currency')} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="label">每<input className="input font-number" inputMode="numeric" {...form.register('billingIntervalCount')} /></label>
          <label className="label">周期<select className="input" {...form.register('billingIntervalUnit')}>
            <option value="day">天</option><option value="week">周</option><option value="month">个月</option><option value="year">年</option><option value="once">一次性</option>
          </select></label>
          <label className="label">下次扣款<input className="input" type="date" {...form.register('nextBillingDate')} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">续费方式<select className="input" {...form.register('renewalMethod')}>
            <option value="auto">自动续费</option><option value="manual">手动续费</option>
          </select></label>
          <label className="label">付款渠道<select className="input" {...form.register('billingChannelId')}>
            <option value="">未设置</option>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
          </select></label>
        </div>
        <label className="label">分类<input className="input" {...form.register('category')} placeholder="音乐 / 效率 / 存储…" /></label>
        <label className="label">管理页面<input className="input" {...form.register('managementUrl')} placeholder="https://…" /></label>
        <label className="label">备注<textarea className="input min-h-[88px] resize-y" {...form.register('notes')} /></label>

        {Object.values(form.formState.errors)[0]?.message ? <div className="text-sm text-[#A44138]">{String(Object.values(form.formState.errors)[0]?.message)}</div> : null}
        {submitError ? <div className="text-sm text-[#A44138]">{submitError}</div> : null}
        <button type="submit" className="primary-button h-12" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? '保存中…' : '保存订阅'}</button>
      </form>
    </div>
  )
}
