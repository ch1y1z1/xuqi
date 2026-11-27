import { Link } from 'react-router-dom'

export function PageHeader({ title, subtitle, add = false, wideAction }: { title: string; subtitle?: string; add?: boolean; wideAction?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] md:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-[#706F78]">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {wideAction}
        {add ? <Link to="/subscriptions/new" className="icon-button" aria-label="添加订阅">+</Link> : null}
      </div>
    </div>
  )
}
