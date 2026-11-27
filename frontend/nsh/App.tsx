import { computed, mount, Scroll, signal, Text, View, windowSize } from "nsh";
import type { Accessor } from "nsh";
import { Input } from "nsh/base";
import type { JSX } from "nsh";
import { BrandMark } from "./components/BrandMark";
import { SpendingChart } from "./components/Charts";
import { XuqiApi } from "./lib/api";
import { demoChannels, demoSubscriptions } from "./lib/demo";
import { dateLabel, formatMoney, intervalLabel, splitMoney } from "./lib/format";
import type {
  BillingChannel,
  CatalogPrice,
  CatalogService,
  ChartMode,
  Section,
  Subscription,
} from "./lib/types";

const colors = {
  paper: "#FAF9F7",
  ink: "#1D1C24",
  muted: "#706F78",
  line: "#E7E4DE",
  soft: "#F0EEE9",
  blue: "#263E9F",
  blueSoft: "#E7EBFF",
  white: "#FFFFFF",
};

function App() {
  const section = signal<Section>("overview");
  const chartMode = signal<ChartMode>("bubbles");
  const selectedId = signal(demoSubscriptions[1].id);
  const subscriptions = signal<Subscription[]>(demoSubscriptions);
  const channels = signal<BillingChannel[]>(demoChannels);
  const search = signal("");
  const addName = signal("");
  const addAmount = signal("");
  const addDate = signal("2026-12-28");
  const addCategory = signal("效率");
  const addBillingChannelId = signal(demoChannels.find((channel) => channel.isActive)?.id ?? "");
  const addLogoUrl = signal<string | null>(null);
  const addCatalogServiceId = signal<string | null>(null);
  const catalogQuery = signal("");
  const catalogResults = signal<CatalogService[]>([]);
  const catalogStatus = signal("");
  const backendUrl = signal("http://127.0.0.1:3000/api/v1");
  const token = signal("");
  const connectionState = signal<"demo" | "connected" | "error">("demo");
  const statusText = signal("");
  const wide = computed(() => windowSize().width >= 720);

  const totalMonthly = computed(() =>
    subscriptions().reduce(
      (total, subscription) => total + monthlyEquivalent(subscription),
      0,
    ),
  );

  const selected = computed(() =>
    subscriptions().find((subscription) => subscription.id === selectedId()) ??
    subscriptions()[0],
  );
  const activeChannels = computed(() => channels().filter((channel) => channel.isActive));

  const filteredSubscriptions = computed(() => {
    const query = search().trim().toLowerCase();
    if (!query) return subscriptions();
    return subscriptions().filter((subscription) =>
      `${subscription.name} ${subscription.category ?? ""}`.toLowerCase().includes(query),
    );
  });

  const loadFromApi = async () => {
    if (!token().trim()) {
      statusText.set("先填入 API token");
      connectionState.set("error");
      return;
    }
    statusText.set("正在同步");
    try {
      const api = new XuqiApi(backendUrl(), token().trim());
      const [overview, apiSubscriptions, apiChannels] = await Promise.all([
        api.getOverview("CNY"),
        api.listSubscriptions(),
        api.listBillingChannels(true),
      ]);
      subscriptions.set(mapSubscriptionList(apiSubscriptions));
      const mappedChannels = mapChannelList(apiChannels);
      channels.set(mappedChannels);
      addBillingChannelId.set(mappedChannels.find((channel) => channel.isActive)?.id ?? "");
      selectedId.set(overview.subscriptions[0]?.id ?? apiSubscriptions[0]?.id ?? "");
      connectionState.set("connected");
      statusText.set(`已同步 ${apiSubscriptions.length} 个订阅`);
    } catch (error) {
      connectionState.set("error");
      statusText.set(error instanceof Error ? error.message : "连接失败");
    }
  };

  const addSubscription = async () => {
    const amount = Number.parseFloat(addAmount().replace(",", "."));
    const name = addName().trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      statusText.set("填写名称和金额后保存");
      return;
    }
    const activeChannel = activeChannels().find((channel) => channel.id === addBillingChannelId());
    if (!activeChannel) {
      statusText.set("请选择扣费渠道");
      return;
    }
    const input = {
      name,
      amountMinor: Math.round(amount * 100),
      currency: "CNY",
      nextBillingDate: addDate(),
      renewalMethod: "auto",
      category: addCategory() || "其他",
      billingIntervalCount: 1,
      billingIntervalUnit: "month",
      billingChannelId: activeChannel.id,
      logoUrl: addLogoUrl(),
      catalogServiceId: addCatalogServiceId(),
    };
    if (token().trim()) {
      statusText.set("正在保存");
      try {
        const api = new XuqiApi(backendUrl(), token().trim());
        const created = await api.createSubscription(input);
        const item = mapSubscription(created);
        subscriptions.update((items) => [item, ...items]);
        selectedId.set(item.id);
        addName.set("");
        addAmount.set("");
        addLogoUrl.set(null);
        addCatalogServiceId.set(null);
        statusText.set(`${name} 已加入账本`);
        section.set("overview");
      } catch (error) {
        connectionState.set("error");
        statusText.set(error instanceof Error ? error.message : "保存失败");
      }
      return;
    }
    const item: Subscription = {
      id: `local-${Date.now()}`,
      name,
      logoUrl: addLogoUrl(),
      amountMinor: input.amountMinor,
      currency: "CNY",
      nextBillingDate: addDate(),
      renewalMethod: "auto",
      category: input.category,
      billingIntervalCount: 1,
      billingIntervalUnit: "month",
      billingChannelName: activeChannel.name,
      status: "active",
    };
    subscriptions.update((items) => [item, ...items]);
    selectedId.set(item.id);
    addName.set("");
    addAmount.set("");
    addLogoUrl.set(null);
    addCatalogServiceId.set(null);
    statusText.set(`${name} 已加入账本`);
    section.set("overview");
  };

  const toggleChannel = async (id: string) => {
    const current = channels().find((channel) => channel.id === id);
    if (!current) return;
    const nextActive = !current.isActive;
    if (token().trim()) {
      statusText.set("正在更新扣费渠道");
      try {
        const api = new XuqiApi(backendUrl(), token().trim());
        const updated = await api.updateBillingChannel(id, nextActive);
        channels.update((items) => items.map((item) => item.id === id ? mapChannel(updated) : item));
        if (!nextActive && addBillingChannelId() === id) {
          addBillingChannelId.set(
            channels().find((channel) => channel.isActive && channel.id !== id)?.id ?? "",
          );
        }
        statusText.set("扣费渠道已更新");
      } catch (error) {
        connectionState.set("error");
        statusText.set(error instanceof Error ? error.message : "更新失败");
      }
      return;
    }
    channels.update((items) =>
      items.map((item) => (item.id === id ? { ...item, isActive: nextActive } : item)),
    );
    if (!nextActive && addBillingChannelId() === id) {
      addBillingChannelId.set(channels().find((channel) => channel.isActive && channel.id !== id)?.id ?? "");
    }
  };

  const searchCatalog = async (query: string) => {
    catalogQuery.set(query);
    if (!token().trim() || query.trim().length < 2) {
      catalogResults.set([]);
      catalogStatus.set("");
      return;
    }
    catalogStatus.set("正在搜索");
    try {
      const api = new XuqiApi(backendUrl(), token().trim());
      const result = await api.searchCatalog(query.trim());
      catalogResults.set(result.map(mapCatalogService));
      catalogStatus.set(result.length ? "" : "没有匹配的服务");
    } catch (error) {
      catalogResults.set([]);
      catalogStatus.set(error instanceof Error ? error.message : "目录搜索失败");
    }
  };

  const applyCatalogPrice = (price: CatalogPrice) => {
    addAmount.set((price.amountMinor / 100).toFixed(2));
  };

  const selectCatalogService = async (service: CatalogService) => {
    addName.set(service.name);
    addLogoUrl.set(service.logoUrl ?? null);
    addCatalogServiceId.set(service.id);
    catalogQuery.set(service.name);
    catalogResults.set([]);
    if (service.logoUrl) {
      statusText.set(`${service.name} 已带入 Logo`);
    }
    if (!token().trim()) return;
    try {
      const api = new XuqiApi(backendUrl(), token().trim());
      const response = await api.getCatalogPrices(service.id, "CN");
      const rawPrice = response.prices.find((item) => item.currency === "CNY") ?? response.prices[0];
      const price = rawPrice ? mapCatalogPrice(rawPrice) : undefined;
      if (price) {
        applyCatalogPrice(price);
        statusText.set(`${service.name} 已带入参考价格`);
      }
    } catch {
      statusText.set(`${service.name} 已带入`);
    }
  };

  const content = () => {
    if (section() === "subscriptions") {
      return (
        <SubscriptionsPage
          subscriptions={filteredSubscriptions}
          query={search}
          onQueryChange={(value) => search.set(value)}
          onSelect={(id) => selectedId.set(id)}
          onAdd={() => section.set("add")}
        />
      );
    }
    if (section() === "calendar") {
      return <CalendarPage subscriptions={subscriptions} onSelect={(id) => selectedId.set(id)} />;
    }
    if (section() === "settings") {
      return (
        <SettingsPage
          channels={channels}
          backendUrl={backendUrl}
          token={token}
          status={statusText}
          connectionState={connectionState}
          onBackendUrlChange={(value) => backendUrl.set(value)}
          onTokenChange={(value) => token.set(value)}
          onConnect={loadFromApi}
          onToggleChannel={toggleChannel}
        />
      );
    }
    if (section() === "add") {
      return (
        <AddPage
          name={addName}
          amount={addAmount}
          date={addDate}
          category={addCategory}
          channels={activeChannels}
          selectedChannelId={addBillingChannelId}
          catalogQuery={catalogQuery}
          catalogResults={catalogResults}
          catalogStatus={catalogStatus}
          onNameChange={(value) => addName.set(value)}
          onAmountChange={(value) => addAmount.set(value)}
          onDateChange={(value) => addDate.set(value)}
          onCategoryChange={(value) => addCategory.set(value)}
          onChannelChange={(value) => addBillingChannelId.set(value)}
          onCatalogQueryChange={searchCatalog}
          onSelectCatalogService={selectCatalogService}
          onSave={addSubscription}
          onCancel={() => section.set("overview")}
        />
      );
    }
    return (
      <OverviewPage
        subscriptions={subscriptions}
        selected={selected}
        selectedId={selectedId}
        totalMonthly={totalMonthly}
        chartMode={chartMode}
        status={statusText}
        onChartModeChange={(mode) => chartMode.set(mode)}
        onSelect={(id) => selectedId.set(id)}
        onAdd={() => section.set("add")}
      />
    );
  };

  return (
    <View class="flex-1" style={{ backgroundColor: colors.paper }}>
      <View class={`flex-1 ${wide() ? "flex-row" : "flex-col"}`}>
        {wide() ? <Sidebar active={section()} onNavigate={(next) => section.set(next)} /> : null}
        <View class="flex-1">
          <Scroll class="flex-1" contentClass="min-h-full">
            <View
              class={`${wide() ? "mx-auto w-full max-w-[1260px] px-10 py-8" : "px-5 pb-7 pt-6"} gap-6`}
            >
              <TopBar
                section={section()}
                wide={wide()}
                onNavigate={(next) => section.set(next)}
                onAdd={() => section.set("add")}
              />
              {content()}
            </View>
          </Scroll>
          {!wide() ? <MobileNav active={section()} onNavigate={(next) => section.set(next)} /> : null}
        </View>
      </View>
    </View>
  );
}

interface SidebarProps {
  active: Section;
  onNavigate: (section: Section) => void;
}

function Sidebar(props: SidebarProps) {
  return (
    <View class="w-[230px] shrink-0 border-r px-5 py-7" style={{ backgroundColor: colors.paper, borderColor: colors.line }}>
      <View class="mb-12 flex-row items-center gap-3 px-2">
        <View class="size-9 items-center justify-center rounded-[13px] bg-[#263E9F]">
          <View class="size-4 rounded-full border-2 border-[#FAF9F7]" />
        </View>
        <View>
          <Text class="text-[17px] font-semibold" style={{ color: colors.ink }}>续期</Text>
          <Text class="mt-0.5 text-[11px]" style={{ color: colors.muted }}>subscription ledger</Text>
        </View>
      </View>
      <View class="gap-2">
        <NavItem label="概览" icon="◌" active={props.active === "overview"} onPress={() => props.onNavigate("overview")} />
        <NavItem label="订阅" icon="▦" active={props.active === "subscriptions"} onPress={() => props.onNavigate("subscriptions")} />
        <NavItem label="日历" icon="□" active={props.active === "calendar"} onPress={() => props.onNavigate("calendar")} />
        <NavItem label="设置" icon="⌘" active={props.active === "settings"} onPress={() => props.onNavigate("settings")} />
      </View>
      <View class="mt-auto rounded-[18px] p-4" style={{ backgroundColor: colors.soft }}>
        <Text class="text-xs font-medium" style={{ color: colors.ink }}>账本状态</Text>
        <Text class="mt-2 text-xs leading-5" style={{ color: colors.muted }}>
          API 连接和本地演示数据都在这里切换。
        </Text>
      </View>
    </View>
  );
}

function MobileNav(props: SidebarProps) {
  return (
    <View class="flex-row border-t px-3 pb-2 pt-2" style={{ backgroundColor: colors.paper, borderColor: colors.line }}>
      <MobileNavItem label="概览" icon="◌" active={props.active === "overview"} onPress={() => props.onNavigate("overview")} />
      <MobileNavItem label="订阅" icon="▦" active={props.active === "subscriptions"} onPress={() => props.onNavigate("subscriptions")} />
      <MobileNavItem label="日历" icon="□" active={props.active === "calendar"} onPress={() => props.onNavigate("calendar")} />
      <MobileNavItem label="设置" icon="⌘" active={props.active === "settings"} onPress={() => props.onNavigate("settings")} />
    </View>
  );
}

interface TopBarProps {
  section: Section;
  wide: boolean;
  onNavigate: (section: Section) => void;
  onAdd: () => void;
}

function TopBar(props: TopBarProps) {
  const titles: Record<Section, string> = {
    overview: "概览",
    subscriptions: "订阅",
    calendar: "日历",
    settings: "设置",
    add: "添加订阅",
  };
  return (
    <View class="flex-row items-center justify-between gap-4">
      <View>
        <Text class={`${props.wide ? "text-2xl" : "text-[22px]"} font-semibold`} style={{ color: colors.ink }}>
          {titles[props.section]}
        </Text>
        <Text class="mt-1 text-xs" style={{ color: colors.muted }}>
          {props.section === "overview" ? "把每一笔周期支出放在同一张账本里。" : "续期 · 2026"}
        </Text>
      </View>
      <View class="flex-row items-center gap-2">
        {props.wide ? (
          <View
            onPress={() => props.onNavigate("subscriptions")}
            role="button"
            class="rounded-full border px-4 py-2"
            style={{ borderColor: colors.line }}
          >
            <Text class="text-xs font-medium" style={{ color: colors.ink }}>查看全部</Text>
          </View>
        ) : null}
        <View
          onPress={props.onAdd}
          role="button"
          class="size-10 items-center justify-center rounded-full bg-[#263E9F] active:opacity-80"
          accessibilityLabel="添加订阅"
        >
          <Text class="text-[22px] font-light leading-none" style={{ color: colors.white }}>+</Text>
        </View>
      </View>
    </View>
  );
}

interface OverviewPageProps {
  subscriptions: Accessor<Subscription[]>;
  selected: Accessor<Subscription | undefined>;
  selectedId: Accessor<string>;
  totalMonthly: Accessor<number>;
  chartMode: Accessor<ChartMode>;
  status: Accessor<string>;
  onChartModeChange: (mode: ChartMode) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function OverviewPage(props: OverviewPageProps) {
  const money = splitMoney(props.totalMonthly(), "CNY");
  const selected = props.selected();
  return (
    <View class="gap-6">
      <View class="flex-row flex-wrap items-end justify-between gap-4">
        <View>
          <Text class="text-xs uppercase tracking-[2px]" style={{ color: colors.muted }}>月均订阅支出</Text>
          <View class="mt-2 flex-row items-end">
            <Text class="mr-2 pb-2 text-[24px] font-medium" style={{ color: colors.ink }}>{money.symbol}</Text>
            <Text class="text-[56px] font-semibold tracking-[-2px]" style={{ color: colors.ink }}>{money.value}</Text>
          </View>
        </View>
        <View class="flex-row gap-2">
          <MetricPill label="活跃订阅" value={`${props.subscriptions().length}`} />
          <MetricPill label="未来 30 天" value={formatMoney(15200, "CNY")} />
        </View>
      </View>

      <View class="gap-3">
        <View class="flex-row items-center justify-between">
          <View>
            <Text class="text-base font-semibold" style={{ color: colors.ink }}>支出构成</Text>
            <Text class="mt-1 text-xs" style={{ color: colors.muted }}>按月均金额分配面积</Text>
          </View>
          <ChartSwitcher mode={props.chartMode} onChange={props.onChartModeChange} />
        </View>
        <SpendingChart mode={props.chartMode} subscriptions={props.subscriptions()} selectedId={props.selectedId()} onSelect={props.onSelect} />
      </View>

      {selected ? <SelectedSubscription subscription={selected} onAdd={props.onAdd} /> : null}

      <View class="gap-3">
        <View class="flex-row items-center justify-between">
          <Text class="text-base font-semibold" style={{ color: colors.ink }}>近期扣款</Text>
          <View onPress={props.onAdd} role="button">
            <Text class="text-xs font-medium" style={{ color: colors.blue }}>添加一笔</Text>
          </View>
        </View>
        <UpcomingList subscriptions={props.subscriptions().slice(0, 4)} />
      </View>

      {props.status() ? <Text class="text-xs" style={{ color: colors.muted }}>{props.status()}</Text> : null}
    </View>
  );
}

function MetricPill(props: { label: string; value: string }) {
  return (
    <View class="rounded-[16px] px-3 py-2" style={{ backgroundColor: colors.soft }}>
      <Text class="text-[10px]" style={{ color: colors.muted }}>{props.label}</Text>
      <Text class="mt-1 text-sm font-semibold" style={{ color: colors.ink }}>{props.value}</Text>
    </View>
  );
}

function ChartSwitcher(props: { mode: Accessor<ChartMode>; onChange: (mode: ChartMode) => void }) {
  const options: Array<[ChartMode, string]> = [
    ["bubbles", "泡泡"],
    ["blocks", "分块"],
    ["rings", "账期"],
  ];
  return (
    <View class="flex-row rounded-full p-1" style={{ backgroundColor: colors.soft }}>
      {options.map(([value, label]) => (
        <View onPress={() => props.onChange(value)} role="button" accessibilityLabel={label} class={`rounded-full px-3 py-1.5 ${props.mode() === value ? "bg-white" : ""}`}>
          <Text class="text-[11px] font-medium" style={{ color: props.mode() === value ? colors.ink : colors.muted }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SelectedSubscription(props: { subscription: Subscription; onAdd: () => void }) {
  return (
    <View class="flex-row items-center justify-between gap-4 rounded-[20px] border bg-white p-4" style={{ borderColor: colors.line }}>
      <View class="flex-row items-center gap-3">
        <BrandMark name={props.subscription.name} logoUrl={props.subscription.logoUrl} size="medium" />
        <View>
          <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{props.subscription.name}</Text>
          <Text class="mt-1 text-xs" style={{ color: colors.muted }}>
            {intervalLabel(props.subscription)} · {props.subscription.billingChannelName ?? "未设置渠道"}
          </Text>
        </View>
      </View>
      <View class="items-end">
        <Text class="text-base font-semibold" style={{ color: colors.ink }}>{formatMoney(props.subscription.amountMinor, props.subscription.currency)}</Text>
        <View onPress={props.onAdd} role="button">
          <Text class="mt-1 text-xs font-medium" style={{ color: colors.blue }}>管理</Text>
        </View>
      </View>
    </View>
  );
}

function UpcomingList(props: { subscriptions: Subscription[] }) {
  return (
    <View class="gap-2">
      {props.subscriptions.map((subscription) => (
        <View class="flex-row items-center justify-between rounded-[18px] border bg-white px-4 py-3" style={{ borderColor: colors.line }}>
          <View class="flex-row items-center gap-3">
            <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="small" />
            <View>
              <Text class="text-sm font-medium" style={{ color: colors.ink }}>{subscription.name}</Text>
              <Text class="mt-1 text-xs" style={{ color: colors.muted }}>
                {dateLabel(subscription.nextBillingDate)} · {subscription.billingChannelName ?? "手动续费"}
              </Text>
            </View>
          </View>
          <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{formatMoney(subscription.amountMinor, subscription.currency)}</Text>
        </View>
      ))}
    </View>
  );
}

interface SubscriptionsPageProps {
  subscriptions: Accessor<Subscription[]>;
  query: Accessor<string>;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function SubscriptionsPage(props: SubscriptionsPageProps) {
  return (
    <View class="gap-5">
      <Input
        value={props.query()}
        onChange={(event: { value: string }) => props.onQueryChange(event.value)}
        placeholder="搜索订阅"
        class="rounded-[16px] border bg-white px-4 py-3 text-sm"
        style={{ borderColor: colors.line, color: colors.ink }}
        accessibilityLabel="搜索订阅"
      />
      <View class="gap-2">
        {props.subscriptions().map((subscription) => (
          <View onPress={() => props.onSelect(subscription.id)} role="button" class="flex-row items-center justify-between rounded-[20px] border bg-white p-4 active:opacity-80" style={{ borderColor: colors.line }}>
            <View class="flex-row items-center gap-3">
              <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="medium" />
              <View>
                <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{subscription.name}</Text>
                <Text class="mt-1 text-xs" style={{ color: colors.muted }}>
                  {subscription.category ?? "其他"} · {dateLabel(subscription.nextBillingDate)}
                </Text>
              </View>
            </View>
            <View class="items-end">
              <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{formatMoney(subscription.amountMinor, subscription.currency)}</Text>
              <Text class="mt-1 text-xs" style={{ color: colors.muted }}>{subscription.billingChannelName ?? "未设置渠道"}</Text>
            </View>
          </View>
        ))}
      </View>
      <View onPress={props.onAdd} role="button" class="items-center rounded-[16px] border border-dashed py-3" style={{ borderColor: colors.line }}>
        <Text class="text-xs font-medium" style={{ color: colors.blue }}>添加一项订阅</Text>
      </View>
    </View>
  );
}

function CalendarPage(props: { subscriptions: Accessor<Subscription[]>; onSelect: (id: string) => void }) {
  const sorted = [...props.subscriptions()].sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
  return (
    <View class="gap-5">
      <View class="rounded-[22px] p-5" style={{ backgroundColor: colors.blue }}>
        <Text class="text-xs uppercase tracking-[2px]" style={{ color: "#C9D1FF" }}>未来 30 天</Text>
        <Text class="mt-2 text-[34px] font-semibold" style={{ color: colors.white }}>
          {formatMoney(sorted.reduce((sum, item) => sum + item.amountMinor, 0), "CNY")}
        </Text>
        <Text class="mt-1 text-xs" style={{ color: "#DDE2FF" }}>按下次扣费日排序</Text>
      </View>
      <View class="gap-2">
        {sorted.map((subscription) => (
          <View onPress={() => props.onSelect(subscription.id)} role="button" class="flex-row items-center gap-3 rounded-[18px] border bg-white p-4" style={{ borderColor: colors.line }}>
            <View class="w-[58px] items-center">
              <Text class="text-[11px] uppercase" style={{ color: colors.muted }}>{dateLabel(subscription.nextBillingDate).split(" ")[0]}</Text>
              <Text class="mt-1 text-xl font-semibold" style={{ color: colors.ink }}>{subscription.nextBillingDate.slice(8)}</Text>
            </View>
            <View class="h-10 w-px" style={{ backgroundColor: colors.line }} />
            <BrandMark name={subscription.name} logoUrl={subscription.logoUrl} size="small" />
            <View class="flex-1">
              <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{subscription.name}</Text>
              <Text class="mt-1 text-xs" style={{ color: colors.muted }}>
                {subscription.renewalMethod === "auto" ? "自动扣款" : "手动续费"} · {subscription.billingChannelName ?? "未设置渠道"}
              </Text>
            </View>
            <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{formatMoney(subscription.amountMinor, subscription.currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface AddPageProps {
  name: Accessor<string>;
  amount: Accessor<string>;
  date: Accessor<string>;
  category: Accessor<string>;
  channels: Accessor<BillingChannel[]>;
  selectedChannelId: Accessor<string>;
  catalogQuery: Accessor<string>;
  catalogResults: Accessor<CatalogService[]>;
  catalogStatus: Accessor<string>;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onCatalogQueryChange: (value: string) => void;
  onSelectCatalogService: (service: CatalogService) => void;
  onSave: () => void;
  onCancel: () => void;
}

function AddPage(props: AddPageProps) {
  return (
    <View class="gap-5">
      <View class="gap-3 rounded-[22px] p-5" style={{ backgroundColor: colors.soft }}>
        <Text class="text-base font-semibold" style={{ color: colors.ink }}>添加订阅</Text>
        <Input
          value={props.catalogQuery()}
          onChange={(event: { value: string }) => props.onCatalogQueryChange(event.value)}
          placeholder="搜索服务名称"
          class="rounded-[14px] border bg-white px-3 py-3 text-sm"
          style={{ borderColor: colors.line, color: colors.ink }}
          accessibilityLabel="搜索服务目录"
        />
        {props.catalogStatus() ? <Text class="text-xs" style={{ color: colors.muted }}>{props.catalogStatus()}</Text> : null}
        {props.catalogResults().length ? (
          <View class="gap-2">
            {props.catalogResults().map((service) => (
              <View
                onPress={() => props.onSelectCatalogService(service)}
                role="button"
                class="flex-row items-center gap-3 rounded-[14px] bg-white px-3 py-2"
              >
                <BrandMark name={service.name} logoUrl={service.logoUrl} size="small" />
                <Text class="flex-1 text-sm font-medium" style={{ color: colors.ink }}>{service.name}</Text>
                <Text class="text-xs" style={{ color: colors.blue }}>选择</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View class="gap-4 rounded-[22px] border bg-white p-5" style={{ borderColor: colors.line }}>
        <Field label="服务名称">
          <Input value={props.name()} onChange={(event: { value: string }) => props.onNameChange(event.value)} placeholder="例如 Spotify" class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <Field label="每月金额">
          <Input value={props.amount()} onChange={(event: { value: string }) => props.onAmountChange(event.value)} placeholder="例如 35" keyboardType="decimal-pad" class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <Field label="下次扣费日">
          <Input value={props.date()} onChange={(event: { value: string }) => props.onDateChange(event.value)} placeholder="YYYY-MM-DD" class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <Field label="分类">
          <Input value={props.category()} onChange={(event: { value: string }) => props.onCategoryChange(event.value)} placeholder="效率、设计、存储" class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <Field label="扣费渠道">
          <View class="flex-row flex-wrap gap-2">
            {props.channels().map((channel) => (
              <View
                onPress={() => props.onChannelChange(channel.id)}
                role="button"
                class={`rounded-full border px-3 py-2 ${props.selectedChannelId() === channel.id ? "bg-[#E7EBFF]" : "bg-white"}`}
                style={{ borderColor: props.selectedChannelId() === channel.id ? colors.blue : colors.line }}
              >
                <Text class="text-xs font-medium" style={{ color: props.selectedChannelId() === channel.id ? colors.blue : colors.ink }}>
                  {channel.name}
                </Text>
              </View>
            ))}
          </View>
        </Field>
        <View class="flex-row gap-2 pt-2">
          <View onPress={props.onCancel} role="button" class="flex-1 items-center rounded-[14px] border py-3" style={{ borderColor: colors.line }}>
            <Text class="text-sm font-medium" style={{ color: colors.ink }}>取消</Text>
          </View>
          <View onPress={props.onSave} role="button" class="flex-1 items-center rounded-[14px] bg-[#263E9F] py-3 active:opacity-80">
            <Text class="text-sm font-medium" style={{ color: colors.white }}>保存订阅</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Field(props: { label: string; children: JSX.Element }) {
  return (
    <View class="gap-2">
      <Text class="text-xs font-medium" style={{ color: colors.muted }}>{props.label}</Text>
      {props.children}
    </View>
  );
}

interface SettingsPageProps {
  channels: Accessor<BillingChannel[]>;
  backendUrl: Accessor<string>;
  token: Accessor<string>;
  status: Accessor<string>;
  connectionState: Accessor<"demo" | "connected" | "error">;
  onBackendUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onToggleChannel: (id: string) => void;
}

function SettingsPage(props: SettingsPageProps) {
  return (
    <View class="gap-5">
      <View class="gap-3">
        <Text class="text-base font-semibold" style={{ color: colors.ink }}>扣费渠道</Text>
        <Text class="text-xs" style={{ color: colors.muted }}>在订阅和付款记录里复用这些渠道。</Text>
      </View>
      <View class="gap-2">
        {props.channels().map((channel) => (
          <View class="flex-row items-center justify-between rounded-[18px] border bg-white p-4" style={{ borderColor: colors.line }}>
            <View class="flex-row items-center gap-3">
              <ChannelGlyph brand={channel.brand} />
              <View>
                <Text class="text-sm font-semibold" style={{ color: colors.ink }}>{channel.name}</Text>
                <Text class="mt-1 text-xs" style={{ color: channel.isActive ? colors.muted : "#A8A5A0" }}>
                  {channel.isActive ? "可用于新订阅" : "已停用"}
                </Text>
              </View>
            </View>
            <View onPress={() => props.onToggleChannel(channel.id)} role="button" class={`rounded-full px-3 py-1.5 ${channel.isActive ? "bg-[#E7EBFF]" : "bg-[#F0EEE9]"}`}>
              <Text class="text-xs font-medium" style={{ color: channel.isActive ? colors.blue : colors.muted }}>
                {channel.isActive ? "启用" : "停用"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View class="gap-4 rounded-[22px] border bg-white p-5" style={{ borderColor: colors.line }}>
        <View>
          <Text class="text-base font-semibold" style={{ color: colors.ink }}>连接自托管后端</Text>
          <Text class="mt-1 text-xs" style={{ color: colors.muted }}>留空 token 时使用本地演示数据。</Text>
        </View>
        <Field label="API 地址">
          <Input value={props.backendUrl()} onChange={(event: { value: string }) => props.onBackendUrlChange(event.value)} class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <Field label="Bearer Token">
          <Input value={props.token()} onChange={(event: { value: string }) => props.onTokenChange(event.value)} masked placeholder="xuqi_..." class="rounded-[14px] border px-3 py-3 text-sm" style={{ borderColor: colors.line, color: colors.ink }} />
        </Field>
        <View onPress={props.onConnect} role="button" class="items-center rounded-[14px] bg-[#263E9F] py-3 active:opacity-80">
          <Text class="text-sm font-medium" style={{ color: colors.white }}>
            {props.connectionState() === "connected" ? "已连接，重新同步" : "连接并同步"}
          </Text>
        </View>
        {props.status() ? <Text class="text-xs" style={{ color: props.connectionState() === "error" ? "#B23A2E" : colors.muted }}>{props.status()}</Text> : null}
      </View>
    </View>
  );
}

function ChannelGlyph(props: { brand?: string | null }) {
  const label = props.brand === "wechat" ? "微" : props.brand === "alipay" ? "支" : props.brand === "apple-pay" ? "" : "MC";
  const background = props.brand === "wechat" ? "#07C160" : props.brand === "alipay" ? "#1677FF" : props.brand === "apple-pay" ? "#1D1C24" : "#F1B742";
  return (
    <View class="size-10 items-center justify-center rounded-[12px]" style={{ backgroundColor: background }}>
      <Text class="text-xs font-semibold" style={{ color: colors.white }}>{label}</Text>
    </View>
  );
}

function NavItem(props: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <View onPress={props.onPress} role="button" accessibilityLabel={props.label} class={`flex-row items-center gap-3 rounded-[14px] px-3 py-3 ${props.active ? "bg-[#E7EBFF]" : ""}`}>
      <Text class="w-5 text-center text-base" style={{ color: props.active ? colors.blue : colors.muted }}>{props.icon}</Text>
      <Text class="text-sm font-medium" style={{ color: props.active ? colors.blue : colors.ink }}>{props.label}</Text>
    </View>
  );
}

function MobileNavItem(props: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <View onPress={props.onPress} role="button" accessibilityLabel={props.label} class="flex-1 items-center gap-1 py-1">
      <Text class="text-base" style={{ color: props.active ? colors.blue : colors.muted }}>{props.icon}</Text>
      <Text class="text-[10px] font-medium" style={{ color: props.active ? colors.blue : colors.muted }}>{props.label}</Text>
    </View>
  );
}

function monthlyEquivalent(subscription: Subscription) {
  const count = Math.max(subscription.billingIntervalCount, 1);
  if (subscription.billingIntervalUnit === "year") return subscription.amountMinor / (12 * count);
  if (subscription.billingIntervalUnit === "month") return subscription.amountMinor / count;
  if (subscription.billingIntervalUnit === "week") return (subscription.amountMinor * 52) / (12 * count);
  return (subscription.amountMinor * 365) / (30 * count);
}

function mapSubscription(item: Record<string, unknown>): Subscription {
  return {
    id: String(item.id),
    name: String(item.name),
    logoUrl: (item.logo_url as string | null | undefined) ?? null,
    category: (item.category as string | null | undefined) ?? null,
    amountMinor: Number(item.amount_minor ?? 0),
    currency: String(item.currency ?? "CNY"),
    billingIntervalCount: Number(item.billing_interval_count ?? 1),
    billingIntervalUnit: String(item.billing_interval_unit ?? "month"),
    nextBillingDate: String(item.next_billing_date ?? ""),
    renewalMethod: String(item.renewal_method ?? "auto"),
    billingChannelName: (item.billing_channel_name as string | null | undefined) ?? null,
    status: (item.status as string | undefined) ?? "active",
  };
}

function mapSubscriptionList(items: Array<Record<string, unknown>>): Subscription[] {
  return items.map(mapSubscription);
}

function mapChannel(item: Record<string, unknown>): BillingChannel {
  return {
    id: String(item.id),
    name: String(item.name),
    brand: (item.brand as string | null | undefined) ?? null,
    isActive: Boolean(item.is_active ?? item.isActive),
  };
}

function mapChannelList(items: Array<Record<string, unknown>>): BillingChannel[] {
  return items.map(mapChannel);
}

function mapCatalogService(item: {
  id: string;
  name: string;
  aliases?: string;
  website_domain?: string | null;
  logo_url?: string | null;
}): CatalogService {
  return {
    id: item.id,
    name: item.name,
    aliases: item.aliases,
    websiteDomain: item.website_domain ?? null,
    logoUrl: item.logo_url ?? null,
  };
}

function mapCatalogPrice(item: {
  id: string;
  service_id: string;
  region: string;
  platform?: string | null;
  plan_name: string;
  billing_interval_count: number;
  billing_interval_unit: string;
  amount_minor: number;
  currency: string;
  source_name?: string | null;
  source_url?: string | null;
}): CatalogPrice {
  return {
    id: item.id,
    serviceId: item.service_id,
    region: item.region,
    platform: item.platform ?? null,
    planName: item.plan_name,
    billingIntervalCount: item.billing_interval_count,
    billingIntervalUnit: item.billing_interval_unit,
    amountMinor: item.amount_minor,
    currency: item.currency,
    sourceName: item.source_name ?? null,
    sourceUrl: item.source_url ?? null,
  };
}

mount(App);
