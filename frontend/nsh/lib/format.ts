import type { Subscription } from "./types";

export function formatMoney(amountMinor: number, currency: string) {
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `;
  const amount = (amountMinor / 100).toFixed(2);
  return `${symbol}${amount}`;
}

export function splitMoney(amountMinor: number, currency: string) {
  const formatted = formatMoney(amountMinor, currency);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : currency;
  return {
    symbol,
    value: formatted.replace(symbol, "").trim(),
  };
}

export function intervalLabel(subscription: Pick<Subscription, "billingIntervalCount" | "billingIntervalUnit">) {
  const count = subscription.billingIntervalCount;
  const unit = subscription.billingIntervalUnit;
  const labels: Record<string, string> = {
    day: "天",
    week: "周",
    month: "月",
    year: "年",
  };
  return `${count}${labels[unit] ?? unit}`;
}

export function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
