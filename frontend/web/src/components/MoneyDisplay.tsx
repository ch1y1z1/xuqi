import { splitMoney } from '@shared/domain/money'

export function MoneyDisplay({ amountMinor, currency, large = false }: { amountMinor: number; currency: string; large?: boolean }) {
  const money = splitMoney(amountMinor, currency)
  return (
    <div className="font-number flex items-end tracking-[-0.03em]">
      <span className={`${large ? 'pb-2 text-[24px]' : 'pb-1 text-[15px]'} mr-2 font-medium`}>{money.symbol}</span>
      <span className={`${large ? 'text-[58px] leading-[0.95] md:text-[64px]' : 'text-[24px] leading-none'} font-semibold`}>{money.value}</span>
    </div>
  )
}
