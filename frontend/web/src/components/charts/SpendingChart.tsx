import { useEffect, useMemo, useRef, useState } from 'react'
import type { OverviewSubscription } from '@shared/api/types'
import { cycleProgress, monthlyEquivalent } from '@shared/domain/billing'
import { formatMoney } from '@shared/domain/money'
import { BrandMark } from '@/components/BrandMark'

export type ChartMode = 'bubbles' | 'blocks' | 'rings'

const chartColors = ['#263E9F', '#E85D4A', '#F2B84B', '#4B8F8C', '#7764B8', '#1D1C24']

type ChartSubscription = Pick<
  OverviewSubscription,
  'id' | 'name' | 'logoUrl' | 'amountMinor' | 'currency' | 'billingIntervalCount' | 'billingIntervalUnit' | 'nextBillingDate' | 'billingAnchorDate'
>

interface ChartProps {
  subscriptions: ChartSubscription[]
  selectedId: string
  onSelect: (id: string) => void
}

function monthly(item: ChartSubscription) {
  return monthlyEquivalent(item.amountMinor, item.billingIntervalCount, item.billingIntervalUnit)
}

export function SpendingChart({ mode, ...props }: ChartProps & { mode: ChartMode }) {
  if (mode === 'blocks') return <BudgetBlocks {...props} />
  if (mode === 'rings') return <CycleRings {...props} />
  return <BubbleChart {...props} />
}

type BubbleNode = ChartSubscription & { diameter: number; monthlyMinor: number }

type Point = { x: number; y: number; vx: number; vy: number }

function initialPoints(nodes: BubbleNode[], width: number, height: number) {
  const anchors = [
    [0.28, 0.36],
    [0.66, 0.28],
    [0.47, 0.68],
    [0.78, 0.68],
    [0.18, 0.72],
    [0.55, 0.42],
  ]
  return Object.fromEntries(nodes.map((node, index) => {
    const [ax, ay] = anchors[index % anchors.length]
    return [node.id, {
      x: width * ax + (index >= anchors.length ? (index % 3) * 16 : 0),
      y: height * ay,
      vx: ((index % 2) ? -1 : 1) * (8 + index * 1.4),
      vy: ((index % 3) ? 1 : -1) * (6 + index * 1.1),
    }]
  })) as Record<string, Point>
}

function useBubbleMotion(nodes: BubbleNode[], selectedId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [points, setPoints] = useState<Record<string, Point>>({})

  useEffect(() => {
    const element = containerRef.current
    if (!element || nodes.length === 0) return
    const container = element
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = Math.max(280, container.clientWidth)
    let height = Math.max(230, container.clientHeight)
    let state = initialPoints(nodes, width, height)
    let frame = 0
    let last = performance.now()

    function resize() {
      width = Math.max(280, container.clientWidth)
      height = Math.max(230, container.clientHeight)
      state = initialPoints(nodes, width, height)
      setPoints({ ...state })
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    if (reduced) return () => observer.disconnect()

    function tick(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const next: Record<string, Point> = {}
      for (const node of nodes) {
        const point = state[node.id]
        if (!point) continue
        const radius = node.diameter / 2
        const selected = node.id === selectedId
        const speedScale = selected ? 0.15 : 1
        let x = point.x + point.vx * dt * speedScale
        let y = point.y + point.vy * dt * speedScale
        let vx = point.vx * 0.996
        let vy = point.vy * 0.996
        if (x < radius) { x = radius; vx = Math.abs(vx) * 0.34 }
        if (x > width - radius) { x = width - radius; vx = -Math.abs(vx) * 0.34 }
        if (y < radius) { y = radius; vy = Math.abs(vy) * 0.34 }
        if (y > height - radius) { y = height - radius; vy = -Math.abs(vy) * 0.34 }
        next[node.id] = { x, y, vx, vy }
      }

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = next[nodes[i].id]
          const b = next[nodes[j].id]
          if (!a || !b) continue
          const minDistance = nodes[i].diameter / 2 + nodes[j].diameter / 2 + 5
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.hypot(dx, dy) || 1
          if (distance < minDistance) {
            const nx = dx / distance
            const ny = dy / distance
            const overlap = minDistance - distance
            a.x -= nx * overlap * 0.34
            a.y -= ny * overlap * 0.34
            b.x += nx * overlap * 0.34
            b.y += ny * overlap * 0.34
            const push = overlap * 0.32
            a.vx -= nx * push
            a.vy -= ny * push
            b.vx += nx * push
            b.vy += ny * push
          }
        }
      }
      state = next
      setPoints({ ...next })
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [nodes, selectedId])

  return { containerRef, points }
}

function BubbleChart({ subscriptions, selectedId, onSelect }: ChartProps) {
  const nodes = useMemo<BubbleNode[]>(() => {
    const monthlies = subscriptions.map((item) => ({ item, monthlyMinor: monthly(item) }))
    const max = Math.max(...monthlies.map((item) => item.monthlyMinor), 1)
    return monthlies.map(({ item, monthlyMinor }) => ({
      ...item,
      monthlyMinor,
      diameter: 56 + Math.sqrt(Math.max(monthlyMinor, 0) / max) * 82,
    }))
  }, [subscriptions])
  const { containerRef, points } = useBubbleMotion(nodes, selectedId)

  return (
    <div className="card min-h-[245px] p-2 md:min-h-[280px]">
      <div ref={containerRef} className="relative h-[229px] overflow-hidden rounded-[20px] md:h-[264px]">
        {nodes.map((node) => {
          const point = points[node.id]
          return (
            <button
              type="button"
              key={node.id}
              className={`glass-bubble ${selectedId === node.id ? 'selected' : ''}`}
              style={{
                width: node.diameter,
                height: node.diameter,
                transform: `translate(${(point?.x ?? 0) - node.diameter / 2}px, ${(point?.y ?? 0) - node.diameter / 2}px)`,
              }}
              onClick={() => onSelect(node.id)}
              aria-label={`${node.name} ${formatMoney(node.amountMinor, node.currency)}`}
            >
              <span className="grid justify-items-center gap-1 px-2 text-center">
                <BrandMark name={node.name} logoUrl={node.logoUrl} size="small" />
                <span className="font-number text-[12px] font-semibold text-[#1D1C24]">
                  {formatMoney(node.amountMinor, node.currency).replace(/^[^\d\s]+\s?/, '')}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BudgetBlocks({ subscriptions, selectedId, onSelect }: ChartProps) {
  const monthlies = subscriptions.map((item) => ({ item, monthlyMinor: Math.max(monthly(item), 1) }))
  return (
    <div className="card min-h-[235px] justify-center p-5">
      <div className="flex h-[155px] w-full gap-1.5 overflow-hidden rounded-[19px]">
        {monthlies.map(({ item, monthlyMinor }, index) => (
          <button
            type="button"
            key={item.id}
            className={`budget-block ${selectedId === item.id ? 'selected' : ''}`}
            style={{ flexGrow: monthlyMinor, flexBasis: 0, backgroundColor: chartColors[index % chartColors.length] }}
            onClick={() => onSelect(item.id)}
            aria-label={`${item.name} ${formatMoney(item.amountMinor, item.currency)}`}
          >
            <span className="grid justify-items-center gap-2">
              <BrandMark name={item.name} logoUrl={item.logoUrl} size="small" />
              <span className="hidden text-center text-[11px] font-semibold sm:block">{item.name}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[#706F78]">月均支出构成</span>
        <span className="font-medium text-[#1D1C24]">点击区块查看</span>
      </div>
    </div>
  )
}

function CycleRings({ subscriptions, selectedId, onSelect }: ChartProps) {
  const visible = subscriptions.slice(0, 5)
  const size = 228
  const center = size / 2
  return (
    <div className="card flex min-h-[270px] flex-col items-center justify-center gap-5 p-5 md:flex-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="账期圆环">
        {visible.map((item, index) => {
          const radius = 99 - index * 18
          const circumference = Math.PI * 2 * radius
          const progress = cycleProgress(item)
          const selected = selectedId === item.id
          const color = chartColors[index % chartColors.length]
          return (
            <g key={item.id} className={`ring-hit ${!selected && selectedId ? 'dim' : ''}`} onClick={() => onSelect(item.id)}>
              <circle cx={center} cy={center} r={radius} fill="none" stroke="#DCD9D1" strokeWidth={selected ? 9 : 6} />
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={selected ? 9 : 6}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0.01, progress * circumference)} ${circumference}`}
                transform={`rotate(-90 ${center} ${center})`}
              />
            </g>
          )
        })}
        <text x={center} y={center - 7} textAnchor="middle" fontSize="11" letterSpacing="2" fill="#706F78">账期</text>
        <text x={center} y={center + 22} textAnchor="middle" fontSize="24" fontWeight="650" fill="#1D1C24">{visible.length}</text>
      </svg>
      <div className="hidden min-w-[150px] gap-2 md:grid">
        {visible.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-left ${selectedId === item.id ? 'bg-white' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <span className="flex-1 text-xs text-[#1D1C24]">{item.name}</span>
            <span className="font-number text-xs text-[#706F78]">{Math.round(cycleProgress(item) * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}
