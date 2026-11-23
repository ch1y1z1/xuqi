import { Text, View } from "nsh";
import type { Accessor } from "nsh";
import type { ChartMode, Subscription } from "../lib/types";
import { formatMoney, intervalLabel } from "../lib/format";
import { BrandMark } from "./BrandMark";

const chartColors = ["#263E9F", "#E85D4A", "#F2B84B", "#4B8F8C", "#7764B8", "#1D1C24"];

interface ChartProps {
  subscriptions: Subscription[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SpendingChart(props: ChartProps & { mode: Accessor<ChartMode> }) {
  return (
    <View>
      <If when={props.mode() === "bubbles"}>
        <BubbleChart subscriptions={props.subscriptions} selectedId={props.selectedId} onSelect={props.onSelect} />
      </If>
      <If when={props.mode() === "blocks"}>
        <BudgetBlocks subscriptions={props.subscriptions} selectedId={props.selectedId} onSelect={props.onSelect} />
      </If>
      <If when={props.mode() === "rings"}>
        <CycleRings subscriptions={props.subscriptions} selectedId={props.selectedId} onSelect={props.onSelect} />
      </If>
    </View>
  );
}

function BubbleChart(props: ChartProps) {
  const max = Math.max(...props.subscriptions.map((item) => item.amountMinor), 1);
  return (
    <View class="min-h-[220px] flex-1 flex-row flex-wrap items-center justify-center gap-3 rounded-[26px] bg-[#F0EEE9] p-5">
      {props.subscriptions.map((subscription, index) => {
        const size = 62 + Math.round((subscription.amountMinor / max) * 80);
        const selected = props.selectedId === subscription.id;
        return (
          <View
            onPress={() => props.onSelect(subscription.id)}
            role="button"
            accessibilityLabel={`${subscription.name} ${formatMoney(subscription.amountMinor, subscription.currency)}`}
            class={`items-center justify-center rounded-full border-2 ${selected ? "border-[#1D1C24]" : "border-transparent"}`}
            style={{
              width: size,
              height: size,
              backgroundColor: chartColors[index % chartColors.length],
              opacity: selected ? 1 : 0.82,
            }}
          >
            <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="small" />
            <Text class="mt-1 text-[11px] font-semibold text-white">
              {formatMoney(subscription.amountMinor, subscription.currency).replace("¥", "")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BudgetBlocks(props: ChartProps) {
  return (
    <View class="min-h-[220px] flex-1 justify-center gap-2 rounded-[26px] bg-[#F0EEE9] p-5">
      <View class="h-[150px] w-full flex-row gap-1 overflow-hidden rounded-[18px]">
        {props.subscriptions.map((subscription, index) => {
          const selected = props.selectedId === subscription.id;
          return (
            <View
              onPress={() => props.onSelect(subscription.id)}
              role="button"
              class={`min-w-[58px] flex-1 items-center justify-end gap-2 p-3 ${selected ? "border-2 border-[#1D1C24]" : ""}`}
              style={{ flexGrow: Math.max(subscription.amountMinor, 1), backgroundColor: chartColors[index % chartColors.length] }}
            >
              <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="small" />
              <Text class="text-center text-[11px] font-semibold text-white">{subscription.name}</Text>
            </View>
          );
        })}
      </View>
      <View class="flex-row justify-between">
        <Text class="text-xs text-[#706F78]">月均支出构成</Text>
        <Text class="text-xs font-medium text-[#1D1C24]">点击区块查看</Text>
      </View>
    </View>
  );
}

function CycleRings(props: ChartProps) {
  const ringSizes = [210, 174, 138, 102, 66];
  return (
    <View class="min-h-[260px] flex-1 flex-row items-center justify-center gap-6 rounded-[26px] bg-[#F0EEE9] p-5">
      <View class="relative items-center justify-center" style={{ width: 220, height: 220 }}>
        {props.subscriptions.slice(0, ringSizes.length).map((subscription, index) => {
          const selected = props.selectedId === subscription.id;
          const size = ringSizes[index];
          const progressColor = chartColors[index % chartColors.length];
          return (
            <View
              onPress={() => props.onSelect(subscription.id)}
              role="button"
              class="absolute items-center justify-center rounded-full"
              style={{
                width: size,
                height: size,
                borderWidth: selected ? 9 : 6,
                borderColor: "#DCD9D1",
                borderTopColor: progressColor,
                borderRightColor: progressColor,
                opacity: selected ? 1 : 0.76,
              }}
            >
              {selected ? <View class="size-3 rounded-full bg-[#1D1C24]" /> : null}
            </View>
          );
        })}
        <View class="items-center">
          <Text class="text-[11px] uppercase tracking-[2px] text-[#706F78]">本月</Text>
          <Text class="mt-1 text-[24px] font-semibold text-[#1D1C24]">{props.subscriptions.length}</Text>
          <Text class="text-xs text-[#706F78]">个周期</Text>
        </View>
      </View>
      <View class="hidden min-w-[150px] gap-3 md:flex">
        {props.subscriptions.slice(0, 4).map((subscription, index) => (
          <View
            onPress={() => props.onSelect(subscription.id)}
            role="button"
            class={`flex-row items-center gap-2 rounded-[12px] px-2 py-1 ${props.selectedId === subscription.id ? "bg-white" : ""}`}
          >
            <View class="size-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <Text class="flex-1 text-xs text-[#1D1C24]">{subscription.name}</Text>
            <Text class="text-xs text-[#706F78]">{intervalLabel(subscription)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
