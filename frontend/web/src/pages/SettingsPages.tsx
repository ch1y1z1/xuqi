import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/auth/session'
import { useChannelsData, useConnectedApi, useLedgerActions } from '@/lib/ledger'
import { useDemoLedger } from '@/demo/DemoLedgerContext'
import { PageHeader } from '@/components/PageHeader'

function ConnectionCard() {
  const session = useSession()
  const [baseUrl, setBaseUrl] = useState(session.baseUrl)
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <section className="hairline-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">API 连接</h2>
          <p className="mt-1 text-xs leading-5 text-[#706F78]">
            {session.status === 'connected'
              ? `已连接${session.user?.displayName ? ` · ${session.user.displayName}` : ''}`
              : '未连接时，应用使用本地演示数据。token 默认只保存在当前会话。'}
          </p>
        </div>
        {session.status === 'connected' ? <button type="button" className="secondary-button" onClick={session.logout}>断开</button> : null}
      </div>
      {session.status !== 'connected' ? (
        <form className="mt-4 grid gap-3" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void session.connect({ baseUrl, token, remember }).finally(() => setBusy(false))
        }}>
          <label className="label">API 地址<input className="input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="/api/v1" /></label>
          <label className="label">Bearer Token<input className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="粘贴 API token" /></label>
          <label className="flex items-center gap-2 text-xs text-[#706F78]">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            在这台设备上记住 token（保存在 localStorage）
          </label>
          {session.error ? <div className="text-sm text-[#A44138]">{session.error}</div> : null}
          <button type="submit" className="primary-button" disabled={busy}>{busy ? '连接中…' : '连接 API'}</button>
        </form>
      ) : null}
    </section>
  )
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="设置" subtitle="连接、渠道和数据管理" />
      <div className="grid gap-4">
        <ConnectionCard />
        <section className="hairline-card divide-y divide-[#E7E4DE]">
          {[
            ['/settings/channels', '付款渠道', '登记和停用扣款账户'],
            ['/settings/backup', '备份与导入', '导出 JSON，或直接执行导入'],
          ].map(([to, title, description]) => (
            <Link key={to} to={to} className="flex items-center justify-between gap-4 px-5 py-4">
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-1 block text-xs text-[#706F78]">{description}</span>
              </span>
              <span className="text-[#706F78]">›</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}

export function ConnectPage() {
  return (
    <div className="mx-auto max-w-[520px] pt-8">
      <div className="mb-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-[#263E9F]"><div className="size-5 rounded-full border-[3px] border-[#FAF9F7]" /></div>
        <h1 className="mt-5 text-2xl font-semibold">连接续期账本</h1>
        <p className="mt-2 text-sm text-[#706F78]">连接前可以先浏览演示数据。</p>
      </div>
      <ConnectionCard />
      <Link to="/" className="mt-5 block text-center text-sm font-semibold text-[#263E9F]">先使用演示模式</Link>
    </div>
  )
}

export function ChannelsPage() {
  const { data: channels } = useChannelsData()
  const actions = useLedgerActions()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="付款渠道" subtitle="账户只作为扣款方式记录，不保存敏感凭证" />
      <form className="hairline-card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        void actions.createChannel({ name: name.trim(), brand: brand.trim() || null })
        setName('')
        setBrand('')
      }}>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 Mastercard" />
        <input className="input" value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="品牌标识，可选" />
        <button type="submit" className="primary-button">添加</button>
      </form>
      <div className="hairline-card divide-y divide-[#E7E4DE]">
        {channels.map((channel) => (
          <div key={channel.id} className="flex items-center gap-3 px-5 py-4">
            <div className="grid size-9 place-items-center rounded-full bg-[#E7EBFF] text-sm font-semibold text-[#263E9F]">{channel.name.slice(0, 1)}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{channel.name}</div>
              <div className="mt-0.5 text-xs text-[#706F78]">{channel.brand ?? '自定义渠道'}</div>
            </div>
            <button type="button" className="secondary-button" onClick={() => void actions.updateChannel(channel.id, { isActive: !channel.isActive })}>
              {channel.isActive ? '停用' : '启用'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BackupPage() {
  const api = useConnectedApi()
  const demo = useDemoLedger()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState('')
  const [importText, setImportText] = useState('')

  async function exportJson() {
    const payload = api ? await api.exportData() : {
      version: 'xuqi-demo-v1',
      exportedAt: new Date().toISOString(),
      subscriptions: demo.subscriptions,
      billingChannels: demo.channels,
      payments: demo.payments,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `xuqi-export-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(text: string) {
    setMessage('')
    try {
      const payload = JSON.parse(text)
      if (!api) {
        setMessage('演示模式不会写入后端；请连接 API 后导入。')
        return
      }
      await api.importData(payload)
      setMessage('导入已执行。当前后端没有 dry-run，导入前请确认文件来源。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败')
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void file.text().then((text) => {
      setImportText(text)
      void importJson(text)
    })
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="备份与导入" subtitle="导出是可逆备份；导入会直接执行，没有服务端预览" />
      <div className="grid gap-4">
        <section className="hairline-card p-5">
          <h2 className="text-sm font-semibold">导出</h2>
          <p className="mt-1 text-xs leading-5 text-[#706F78]">下载包含订阅、渠道和付款记录的 JSON 文件。</p>
          <button type="button" className="primary-button mt-4" onClick={() => void exportJson()}>导出 JSON</button>
        </section>
        <section className="hairline-card p-5">
          <h2 className="text-sm font-semibold">导入</h2>
          <p className="mt-1 text-xs leading-5 text-[#A44138]">警告：当前后端导入接口会直接执行，没有 dry-run 预览。</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>选择 JSON 文件</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          </div>
          <textarea className="input mt-3 min-h-[160px] font-mono text-xs" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="也可以粘贴 JSON" />
          <button type="button" className="primary-button mt-3" onClick={() => void importJson(importText)}>执行导入</button>
          {message ? <div className="mt-3 text-sm text-[#706F78]">{message}</div> : null}
        </section>
      </div>
    </div>
  )
}
