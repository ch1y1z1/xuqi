import { NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

const navItems = [
  { to: '/', label: '概览', icon: '◌' },
  { to: '/subscriptions', label: '订阅', icon: '▦' },
  { to: '/calendar', label: '日历', icon: '□' },
  { to: '/settings', label: '设置', icon: '⌘' },
]

function WordMark() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-[14px] bg-[#263E9F]">
        <div className="size-4 rounded-full border-[2.5px] border-[#FAF9F7]" />
      </div>
      <div>
        <div className="text-[17px] font-semibold tracking-[-0.2px]">续期</div>
        <div className="mt-0.5 text-[11px] text-[#706F78]">subscription ledger</div>
      </div>
    </div>
  )
}

function SideNav() {
  return (
    <aside className="hidden min-h-screen w-[232px] shrink-0 border-r border-[#E7E4DE] bg-[#FAF9F7] px-5 py-7 md:flex md:flex-col">
      <div className="mb-11"><WordMark /></div>
      <nav className="grid gap-1.5" aria-label="主导航">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="w-5 text-center text-[15px]">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-[18px] bg-[#F0EEE9] p-4">
        <div className="text-xs font-semibold">账本状态</div>
        <p className="mt-2 text-xs leading-5 text-[#706F78]">API 连接和本地演示数据在设置里切换。</p>
      </div>
    </aside>
  )
}

function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E4DE] bg-[#FAF9F7]/92 px-3 pb-[calc(7px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="主导航">
      <div className="mx-auto flex max-w-[430px]">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <span className="text-[17px] leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1D1C24] md:flex">
      <SideNav />
      <main className="min-w-0 flex-1 pb-28 md:pb-0">
        <div className="mx-auto w-full max-w-[1180px] px-5 pb-8 pt-6 md:px-10 md:py-8">
          {children ?? <Outlet />}
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
