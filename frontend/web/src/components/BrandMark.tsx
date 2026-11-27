import { useEffect, useState } from 'react'

const sizeMap = {
  small: 24,
  medium: 34,
  large: 48,
}

export function BrandMark({ name, logoUrl, size = 'medium' }: { name: string; logoUrl?: string | null; size?: keyof typeof sizeMap }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [logoUrl])
  const dimension = sizeMap[size]
  const showImage = Boolean(logoUrl) && !failed
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/76 text-[11px] font-bold text-[#1D1C24] shadow-sm"
      style={{ width: dimension, height: dimension }}
      aria-label={`${name} 标志`}
    >
      {showImage ? (
        <img
          src={logoUrl ?? undefined}
          alt=""
          className="h-full w-full object-contain p-[3px]"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{name.trim().slice(0, 1).toUpperCase() || '·'}</span>
      )}
    </span>
  )
}
