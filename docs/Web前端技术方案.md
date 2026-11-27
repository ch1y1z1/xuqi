# 续期 Web 前端技术方案

- 状态：建议稿，尚未实施
- 日期：2026-11-26
- 代码基线：`d0de790`（`feat: add subscription backend and macOS testable frontend`）
- 相关文档：`订阅管理器-前后端设计.md`、`macOS测试交接.md`

## 0. 结论

建议新增一套真正的 Web 原生前端，放在 `frontend/web/`，与现有 NSH 前端 `frontend/nsh/` 并行。短期不替换 NSH 端；等 Web 端完成视觉和功能验收后，再决定 NSH 端定位。

推荐技术组合：React、Vite、TypeScript、React Router、TanStack Query、Tailwind CSS、React Hook Form、Zod、Vitest、Testing Library、Playwright。首版使用 npm 和 `package-lock.json`，先不引入 JS workspace；共享逻辑先放 `frontend/shared/`，以源码方式被 Web 端引用。

后端首版不需要重写。Web 端可以直接使用现有 Axum API，但生产部署应优先同源：由 Axum 托管 `frontend/web/dist`，或由 Caddy/Nginx 将 `/api` 反代到 Axum。当前后端 `CorsLayer::allow_origin(Any)` 只适合开发期过渡，正式上线前应改为同源部署或白名单。

## 1. 背景与现状

### 1.1 已有基础

后端已经具备首版核心能力：

- Rust、Axum 0.8、SQLx、SQLite。
- Bearer token 认证，数据库只保存 token 的 SHA-256 摘要。
- 用户偏好、扣费渠道、订阅 CRUD、付款记录、概览、日历、目录查询、JSON 导入导出。
- 目录表和价格表已在迁移中预留，在线同步任务尚未接入。
- CLI 支持 `create-user` 和 `rotate-token`。

现有前端是 NSH TSX：

- 手机竖屏用底部导航，宽窗口用侧边栏。
- 支持概览、订阅、日历、新增、设置。
- 支持演示数据和真实 API 连接。
- 支持三种首页图表：泡泡、月费分块、账期圆环。
- macOS 原生构建和冒烟测试已经通过。

视觉方向已经明确：

- 暖白 `#FAF9F7`、墨色 `#1D1C24`、钴蓝 `#263E9F`。
- Allo Variable 数字分层，中文用系统中文字体。
- 品牌优先使用原色 Logo。
- 首页探索方向包括动态泡泡、月费分块和账期圆环。
- 最新泡泡方向是透明水滴轮廓、软碰撞、少装饰，并遵循 Reduce Motion。

### 1.2 为什么还需要 Web 原生

NSH 的 `--target web` 适合预览，但它仍然受 NSH 组件模型和运行时约束。若 Web 会成为正式客户端，浏览器原生前端更合适，因为可以获得：

- 真实 URL、浏览器前进后退、深链接和分享链接。
- 标准 HTML 表单、语义化元素、键盘操作和屏幕阅读器支持。
- 常规 Web 构建、代码分割、缓存、PWA、测试和 CI 生态。
- 更容易部署到自托管服务器或静态托管环境。
- 更容易让其他贡献者参与，不要求理解 NSH。

### 1.3 当前后端边界

这些边界会影响 Web 端设计：

1. API 返回 Rust/serde 默认的 snake_case 字段，前端需要统一映射为 camelCase。
2. 错误格式为 `{ "error": code, "message": message }`。
3. `GET /calendar` 只返回 `next_billing_date` 落在区间内的订阅，不会把日付、周付、月付在区间内展开成多次账期。
4. `POST /import` 会直接导入，目前没有服务端 dry-run 预览接口。
5. `GET /overview` 的订阅摘要包含金额、周期、下次扣费日和渠道名称，但不包含完整订阅字段；详情页仍需调用 `GET /subscriptions/{id}`。
6. `GET /overview?currency=` 的汇总金额会按币种过滤，但当前返回的 `subscriptions` 摘要列表仍包含全部生效订阅，`active_subscription_count` 也按全部生效订阅计算；Web 端图表若要和总额一致，需要按当前币种再过滤，或推动后端修正。
7. 不传 `currency` 时，当前 `paid_this_month_minor` 会是 0；Web 端应始终传 `me.default_currency`。
8. `GET /calendar` 的 upcoming 当前没有按 `status = active` 过滤，暂停或结束订阅也可能出现；Web 端需要决定显示规则并明确标注状态。
9. 多币种只做原币筛选和汇总，不做汇率转换。
10. 目录同步任务未接入，目录搜索可能为空，这不是 Web 前端 bug。

## 2. 目标与非目标

### 2.1 Web 首版目标

- 手机竖屏优先，同时适配桌面宽窗口。
- 用真实 URL 承载主要页面和详情页。
- 支持演示模式和真实 API 模式。
- 完成概览、订阅列表、订阅详情、新增、编辑、日历、付款确认、扣费渠道管理、设置、导入导出。
- 视觉还原优先于动效复杂度。
- 默认不接入第三方统计、广告或崩溃上报。
- 支持自托管同源部署。

### 2.2 首版非目标

- 订阅通知、银行账单接入、真实扣款。
- 共享账本、多设备实时同步、协作权限。
- 汇率转换和跨币种总额。
- 完整离线账本。PWA 第一阶段只做应用壳缓存，默认不缓存敏感账本 API 数据。
- 目录上游同步任务的实现。Web 端只消费现有目录 API。

## 3. `frontend/` 多客户端目录拆分

### 3.1 目标结构

```text
frontend/
  README.md                 # 各客户端说明、运行命令、边界
  nsh/                      # 现有 NSH 前端，原 frontend/ 内容迁入
    App.tsx
    App.test.tsx
    README.md
    components/
    lib/
    nsh.json
    tsconfig.json
  web/                      # 新增 Web 原生前端
    index.html
    package.json
    package-lock.json
    vite.config.ts
    tsconfig.json
    src/
  shared/                   # 纯 TypeScript 共享代码，首版不独立发包
    api/
    domain/
    design/
  ios/                      # 未来原生 iOS，先不创建空实现
```

如果未来 Apple 原生端同时覆盖 iOS 和 macOS，可以把 `ios/` 改命名为 `apple/`。目前按用户预期先保留 `ios/` 作为未来位置，不建议提前创建空壳。

### 3.2 迁移现有 NSH 代码

迁移映射：

```text
frontend/App.tsx          -> frontend/nsh/App.tsx
frontend/App.test.tsx     -> frontend/nsh/App.test.tsx
frontend/README.md        -> frontend/nsh/README.md
frontend/components/      -> frontend/nsh/components/
frontend/lib/             -> frontend/nsh/lib/
frontend/nsh.json         -> frontend/nsh/nsh.json
frontend/tsconfig.json    -> frontend/nsh/tsconfig.json
```

迁移后需要更新：

- 根 `README.md` 中的前端路径和命令。
- `docs/macOS测试交接.md` 中的运行命令。
- 根文档里所有 `nsh run frontend/App.tsx`、`nsh check frontend`、`nsh test frontend` 的示例。

预期新命令：

```bash
nsh run frontend/nsh/App.tsx --target macos
nsh check frontend/nsh
nsh test frontend/nsh
```

这些命令要以 NSH CLI 实际行为为准；如果 `check` 和 `test` 不接受目录参数，则以入口文件参数形式调整。

### 3.3 共享代码策略

`frontend/shared/` 只放纯 TypeScript、无副作用、无平台 API 依赖的代码：

```text
frontend/shared/
  api/
    wire-types.ts          # API snake_case wire types
    enum.ts                # interval/status/renewal_method 枚举
  domain/
    money.ts               # minor unit、格式化、精度
    billing.ts             # 月均金额、周期进度等纯函数
    dates.ts               # date-only 解析和比较
  design/
    tokens.json            # 平台中性的颜色、字号、间距、圆角令牌
    tokens.ts              # TypeScript 便捷封装，保持与 JSON 同步
```

边界规则：

- `shared/` 不允许 import React、DOM、NSH、浏览器 API、Node API。
- `shared/` 不直接发网络请求。
- UI 组件不共享。NSH 与 Web 的组件模型不同，强行共享会增加抽象成本。
- `tokens.json` 是设计令牌的事实来源，未来 iOS 可以读取同一文件或生成 Swift 常量。
- API mapper 可以先各自实现，稳定后再决定是否放进 `shared/api/`。
- 首版 Web 用 Vite alias 直接引用源码：`@shared/* -> ../shared/*`。
- 如果未来 `shared/` 需要独立构建、版本化或被多个 TypeScript 客户端稳定消费，再评估 pnpm workspace。

### 3.4 包管理选择

首版建议：`frontend/web/` 独立使用 npm 和 `package-lock.json`。

理由：

- 当前只有一个真正的 JS 客户端。
- NSH 有自己的工具链，iOS 原生也不使用 npm。
- 引入 workspace 会先增加配置成本，而不会立即带来收益。

当满足以下任一条件时再迁移到 pnpm workspace：

- `shared/` 需要独立构建产物。
- Web 与另一个 TS 客户端同时消费 `shared/`。
- 需要统一管理多个 JS 包的脚本、依赖和 CI 缓存。

## 4. Web 前端总体架构

### 4.1 技术栈

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 构建 | Vite | 快速、标准、适合 SPA |
| 框架 | React + TypeScript | 与现有 TSX 心智最接近，生态成熟 |
| 路由 | React Router | 真实 URL、嵌套路由、前进后退、深链接 |
| 服务端状态 | TanStack Query | 缓存、失效、重试、mutation 状态清晰 |
| 表单 | React Hook Form + Zod | 表单校验和错误状态可控，适合新增/编辑复杂表单 |
| 样式 | Tailwind CSS + CSS variables | 可映射现有类名风格，同时保留设计令牌 |
| 图表 | 自绘 DOM/SVG | 泡泡、分块、圆环都是定制视觉，通用图表库不合适 |
| 测试 | Vitest + Testing Library + Playwright | 单元、组件、端到端测试覆盖完整 |
| 代码质量 | TypeScript strict + ESLint + Prettier | 生态通用，贡献者熟悉 |

实施时不要使用未验证的新发布依赖版本。依赖版本应固定，`package-lock.json` 必须入库；新增依赖优先选择发布时间超过 7 天的稳定版本。

### 4.2 应用分层

```text
routes/ 或 features/*Page.tsx
  组合页面、处理 URL 参数、编排数据
features/*
  具体业务模块：overview、subscriptions、calendar、settings
components/ui/*
  按钮、输入框、弹层、空状态、导航、Toast
components/charts/*
  BubbleChart、BudgetBlocks、CycleRings
api/*
  fetch client、错误处理、React Query hooks、mutation
auth/*
  token 会话、连接状态、退出登录
shared/domain/*
  金额、周期、日期等纯函数
```

原则：

- 页面不直接写 `fetch`。
- 组件不处理 snake_case 字段；API 层统一映射成 camelCase。
- 服务端状态交给 TanStack Query，不另起 Redux。
- URL 可表达的状态放 URL，例如搜索词、筛选、当前月份、图表模式。
- 本地临时状态放组件或表单，例如输入草稿、弹层开关。

### 4.3 建议目录

```text
frontend/web/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    router.tsx
    styles/
      index.css
      tokens.css
    app/
      providers.tsx
      query-client.ts
      api-error.ts
    auth/
      session-store.ts
      session-context.tsx
      ConnectPage.tsx
    api/
      client.ts
      mappers.ts
      query-keys.ts
      hooks.ts
    components/
      ui/
      BrandMark.tsx
      charts/
      layout/
    features/
      overview/
      subscriptions/
      calendar/
      settings/
    lib/
      demo.ts
      download.ts
      validation.ts
```

路径别名：

```text
@/*        -> frontend/web/src/*
@shared/*  -> frontend/shared/*
```

## 5. 路由与信息架构

### 5.1 路由表

| 路径 | 页面 | 数据 | 说明 |
| --- | --- | --- | --- |
| `/` | 概览 | `GET /me`、`GET /overview` | 默认首页 |
| `/subscriptions` | 订阅列表 | `GET /subscriptions` | `?q=&status=` 进 URL |
| `/subscriptions/new` | 新增订阅 | 目录、渠道 | 手机全屏，桌面可为侧边大面板 |
| `/subscriptions/:id` | 订阅详情 | 订阅详情、付款记录 | 深链接和浏览器返回可用 |
| `/subscriptions/:id/edit` | 编辑订阅 | 订阅详情、渠道、目录 | 复用新增表单 |
| `/calendar` | 日历 | `GET /calendar` | `?month=YYYY-MM` 进 URL |
| `/settings` | 设置首页 | `GET /me` | 账户、连接、显示偏好 |
| `/settings/channels` | 扣费渠道 | `GET/POST/PATCH /billing-channels` | 新增、改名、启停 |
| `/settings/backup` | 备份与导入 | `GET /export`、`POST /import` | 导出下载、导入确认 |
| `/connect` | 连接账本 | `GET /me` 验证 | 无 token 或 token 失效时进入 |

### 5.2 导航

窄屏：

- 底部导航：概览、订阅、日历、设置。
- 顶部右侧圆形加号进入 `/subscriptions/new`。
- 详情页使用顶部返回按钮，同时支持浏览器返回。

宽屏：

- 左侧侧边栏：概览、订阅、日历、设置。
- 内容最大宽度约 1180–1260px。
- 新增和编辑可以使用宽表单页，也可以后续改成右侧 drawer；首版建议独立路由，减少复杂度。

路由守卫：

- 无 token 时仍允许进入演示模式。
- 用户点击“连接真实账本”才进入 `/connect`。
- 已连接后访问写操作失败并返回 401 时，清除会话并跳到 `/connect?expired=1`。
- 演示模式下所有写操作只写内存，刷新后消失，页面必须明确标示“演示账本”。

## 6. API 合约与数据层

### 6.1 API base URL

开发环境：

```text
浏览器 -> Vite dev server /api/* -> 127.0.0.1:3000/api/*
```

生产环境：

```text
浏览器 -> 同源 Axum /api/v1/*
```

Web 端默认使用 `/api/v1`。设置页仍可以允许高级用户填写自定义 API 地址，但默认路径应优先同源，避免把自托管部署复杂化。

### 6.2 端点使用表

| API | Web 用途 | Query key |
| --- | --- | --- |
| `GET /me` | 验证 token、读取默认币种/地区/时区 | `['me']` |
| `PATCH /me` | 更新账户偏好 | mutation 后失效 `['me']`、`['overview']` |
| `GET /billing-channels?include_inactive=true` | 渠道管理、表单选项 | `['billing-channels', includeInactive]` |
| `POST /billing-channels` | 新增渠道 | 失效 `['billing-channels']` |
| `PATCH /billing-channels/{id}` | 改名、启停 | 失效渠道、订阅、概览、日历 |
| `GET /subscriptions?q=&status=&limit=` | 订阅列表 | `['subscriptions', filters]` |
| `POST /subscriptions` | 新增订阅 | 失效列表、概览、日历 |
| `GET /subscriptions/{id}` | 详情、编辑回显 | `['subscription', id]` |
| `PATCH /subscriptions/{id}` | 编辑、暂停、恢复、结束 | 失效详情、列表、概览、日历 |
| `DELETE /subscriptions/{id}` | 删除误建记录 | 失效列表、概览、日历 |
| `GET /subscriptions/{id}/payments` | 付款历史 | `['payments', subscriptionId]` |
| `POST /subscriptions/{id}/payments` | 确认付款 | 失效付款、详情、概览、日历 |
| `PATCH /subscriptions/{id}/payments/{payment_id}` | 更正付款 | 失效付款、概览、日历 |
| `GET /overview?currency=` | 首页总览和图形 | `['overview', currency]` |
| `GET /calendar?from=&to=` | 月历 | `['calendar', from, to]` |
| `GET /catalog/services?q=` | 服务搜索 | `['catalog','services', q]` |
| `GET /catalog/services/{id}/prices?region=` | 套餐价格 | `['catalog','prices', serviceId, region]` |
| `GET /export` | 导出 JSON | 不缓存或短时缓存 |
| `POST /import` | 导入 JSON | 失效所有账本 query |

### 6.3 Query invalidation 规则

| 操作 | 必须失效 |
| --- | --- |
| 新增/编辑/删除订阅 | `subscriptions`、`subscription:{id}`、`overview`、`calendar` |
| 确认/更正付款 | `payments:{subscriptionId}`、`subscription:{id}`、`overview`、`calendar` |
| 新增/改名/启停渠道 | `billing-channels`、`subscriptions`、`overview`、`calendar` |
| 更新用户默认币种 | `me`、`overview` |
| 导入账本 | 全部账本相关 query |

### 6.4 API client 设计

API client 只做四件事：

1. 拼接 base URL 和路径。
2. 附加 `Authorization: Bearer <token>`。
3. 把 HTTP 错误规范化成 `ApiError`。
4. 把 wire type 映射成 app type。

建议接口形态：

```ts
type ApiClient = {
  getMe(): Promise<User>
  updateMe(input: UpdateMeInput): Promise<User>
  listBillingChannels(includeInactive: boolean): Promise<BillingChannel[]>
  createBillingChannel(input: CreateBillingChannelInput): Promise<BillingChannel>
  updateBillingChannel(id: string, input: UpdateBillingChannelInput): Promise<BillingChannel>
  listSubscriptions(filters: SubscriptionFilters): Promise<Subscription[]>
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>
  getSubscription(id: string): Promise<Subscription>
  updateSubscription(id: string, input: UpdateSubscriptionInput): Promise<Subscription>
  deleteSubscription(id: string): Promise<void>
  listPayments(subscriptionId: string): Promise<PaymentRecord[]>
  createPayment(subscriptionId: string, input: CreatePaymentInput): Promise<PaymentRecord>
  updatePayment(subscriptionId: string, paymentId: string, input: UpdatePaymentInput): Promise<PaymentRecord>
  getOverview(currency?: string): Promise<Overview>
  getCalendar(from: string, to: string): Promise<CalendarResponse>
  searchCatalog(query: string): Promise<CatalogService[]>
  getCatalogPrices(serviceId: string, region?: string): Promise<ServiceWithPrices>
  exportData(): Promise<ExportPayload>
  importData(payload: ImportPayload): Promise<ImportResult>
}
```

错误规范化：

```ts
type ApiError = {
  status: number
  code: 'bad_request' | 'unauthorized' | 'not_found' | 'conflict' | 'internal_error' | 'network_error' | 'unknown_error'
  message: string
}
```

约束：

- token 不写入 URL query。
- token 不写入日志、错误上报或 LocalStorage 以外的任意位置。
- 401 统一触发会话失效流程。
- mutation 成功后不只更新本地 state，必须按规则失效服务端 query。

### 6.5 类型策略

后端 wire types 使用 snake_case，例如：

```ts
type WireSubscription = {
  id: string
  user_id: string
  catalog_service_id: string | null
  logo_url: string | null
  amount_minor: number
  billing_interval_count: number
  billing_interval_unit: 'day' | 'week' | 'month' | 'year' | 'once'
  billing_anchor_date: string | null
  next_billing_date: string
  renewal_method: 'auto' | 'manual'
  billing_channel_id: string | null
  billing_channel_name: string | null
  status: 'active' | 'paused' | 'ended'
}
```

应用层统一 camelCase：

```ts
type Subscription = {
  id: string
  userId: string
  catalogServiceId: string | null
  logoUrl: string | null
  amountMinor: number
  billingIntervalCount: number
  billingIntervalUnit: BillingIntervalUnit
  billingAnchorDate: string | null
  nextBillingDate: string
  renewalMethod: RenewalMethod
  billingChannelId: string | null
  billingChannelName: string | null
  status: SubscriptionStatus
}
```

首版手写 mapper，并用 Zod 校验关键输入表单。后续如果 API 继续扩大，再给 Rust 后端增加 OpenAPI/utoipa，并生成 TypeScript 类型，避免长期手写漂移。

## 7. 领域逻辑

### 7.1 金额

- 后端以币种最小单位整数 `amount_minor` 存储。
- 前端不能用浮点数直接计算金额；输入解析后立即转换为 minor unit。
- 首版实现常见精度表：`CNY=2`、`USD=2`、`EUR=2`、`JPY=0`，未知币种默认 2 位并原样显示币种代码。
- 多币种不转换汇率；概览按当前币种过滤。

### 7.2 月均金额

前端显示逻辑必须与后端一致：

```text
month: amount_minor / count
year:  amount_minor / (12 × count)
week:  amount_minor × 52 / (12 × count)
day:   amount_minor × 365 / (12 × count)
once:  0
```

首页总额优先使用 `GET /overview` 返回的 `monthly_planned_minor`，不要在 Web 端重新求和后覆盖服务端结果。客户端函数只用于图形比例和演示数据。

### 7.3 账期圆环进度

圆环弧长表示当前周期已经过去的比例：

```text
progress = (today - currentPeriodStart) / (currentPeriodEnd - currentPeriodStart)
```

其中 `currentPeriodEnd` 通常等于下一次扣费日。问题在于后端目前没有直接返回 `currentPeriodStart`。

首版策略：

1. Web 端用 `next_billing_date`、`billing_interval_count`、`billing_interval_unit`、`billing_anchor_date` 推导一个周期起点。
2. 推导逻辑写成纯函数并重点测试 1 月 31 日跨月、闰年、年付、一次性订阅。
3. 后续建议后端在 `OverviewSubscription` 或详情接口中增加 `current_period_start`，让服务端成为唯一权威来源。

### 7.4 日期和时区

- API 使用 `YYYY-MM-DD` 的 date-only 字符串。
- 前端解析日期时不要直接依赖 `new Date('YYYY-MM-DD')` 的 UTC 语义，应用统一 `parseDateOnly`。
- 月历按用户 `timezone` 解释。首版浏览器端可用本地时区显示，但必须在设置页显示账户时区。
- 跨时区 correctness 的权威逻辑应在后端；前端不自己滚动续费日期。

## 8. 页面级功能规格

### 8.1 概览 `/`

数据：

- `GET /me`
- `GET /overview?currency=<me.default_currency>`

内容：

- 月均订阅支出，货币符号、整数、小数分层排版。
- 未来 30 天应付、本月已付、生效订阅数。
- 三种图表切换：泡泡、月费分块、账期圆环。
- 选中订阅后的金额、月费占比、周期、下次扣费日、渠道。
- 近期续费列表，按日期排序，显示品牌 Logo、名称、金额、渠道、续费方式。

交互：

- 图表模式写入 URL query 或本地偏好；首版建议 URL query，便于分享和返回。
- 点击图形选中订阅；再次点击可进入详情。
- 空账本显示演示入口和新增入口。
- API 未连接时清楚标示演示账本。

### 8.2 订阅列表 `/subscriptions`

数据：

- `GET /subscriptions?q=&status=&limit=`

功能：

- 名称和分类搜索。
- 状态筛选：全部、生效中、暂停、已结束。
- 条目显示 Logo、名称、分类、金额、周期、下次扣费日、渠道。
- 点击进入详情。
- 顶部或浮动按钮进入新增。

URL：

```text
/subscriptions?q=spotify&status=active
```

### 8.3 订阅详情 `/subscriptions/:id`

数据：

- `GET /subscriptions/{id}`
- `GET /subscriptions/{id}/payments`

内容：

- 品牌、名称、分类、金额、币种、周期、下次扣费日、续费方式、扣费渠道、状态。
- 管理链接、备注、结束日期。
- 付款历史。
- 确认付款入口。
- 编辑、暂停/恢复、结束、删除入口。

操作规则：

- 暂停、结束、删除是明确动作，按钮文案直接说明结果。
- 删除只用于误建记录，必须二次确认。
- 确认付款默认带入当前订阅金额、当前币种、渠道名称和下一账期日期，用户可修改。
- 后端对同一订阅同一账期返回 409 时，前端提示“该账期已确认”，并跳转到已有付款记录。

### 8.4 新增/编辑订阅

路径：

- `/subscriptions/new`
- `/subscriptions/:id/edit`

字段：

- 服务目录搜索。
- 名称、金额、币种。
- 周期间隔和单位：每 N 天/周/月/年、一次性。
- 下次扣费日、账期锚点。
- 续费方式：自动扣款、手动续费。
- 扣费渠道。
- 分类、管理链接、备注、结束日期。

目录交互：

- 搜索输入 debounce 约 250ms。
- 至少两个字符再请求 `GET /catalog/services?q=`。
- 选中服务后带入名称、Logo、`catalog_service_id`。
- 继续请求套餐价格，按用户默认地区优先。
- 目录价格只是参考，用户修改金额后不再自动覆盖。
- 目录为空时允许完全手动添加。

表单校验：

- 名称必填。
- 金额为数字，不能为负；为 0 时显示“免费或待确认金额”。
- 周期间隔为大于等于 1 的整数。
- 日期必须符合 `YYYY-MM-DD`。
- 管理链接只允许 `http:` 或 `https:`。
- 结束日期早于下次扣费日时给出警告，是否阻止由最终产品规则决定；建议首版阻止，避免脏数据。

### 8.5 日历 `/calendar`

数据：

```text
GET /calendar?from=<visibleMonthStart>&to=<visibleMonthEnd>
```

界面：

- 月历格内最多显示 2–3 个品牌 Logo，超出显示 `+N`。
- 点击某天，下方或侧边展开当天账单和付款记录。
- 宽屏可以左侧月历、右侧日明细；窄屏上下布局。
- `?month=YYYY-MM` 保持当前月份。

限制：

- 当前后端不会展开周期订阅在区间内的多次出现。首版 Web 不应在前端自行推演并伪造成后端事实，只在页面上按 API 返回显示。
- 后续应在后端增加 recurrence expansion 或 occurrences API，再让日历完整显示周付/日付的多次扣款。

### 8.6 扣费渠道 `/settings/channels`

功能：

- 列出启用和停用渠道。
- 新增自定义渠道。
- 改名。
- 停用、重新启用。
- 预设渠道显示品牌标识：微信支付、支付宝 Alipay、Apple Pay、Mastercard。

规则：

- 停用只影响新订阅可选范围。
- 已有订阅继续显示原关联渠道。
- 已确认付款保留当时渠道名称。

### 8.7 设置 `/settings`

内容：

- API 连接状态。
- 账户昵称、默认地区、默认币种、时区。
- 默认首页图表。
- 演示模式说明。
- 退出连接/清除 token。
- 备份与导入入口。

### 8.8 备份与导入 `/settings/backup`

导出：

- 调 `GET /export`。
- 下载为 `xuqi-export-YYYYMMDD.json`。

导入：

1. 用户选择 JSON 文件。
2. Web 端本地解析，检查 `version`、渠道数、订阅数、付款数。
3. 显示本地预览和确认按钮。
4. 用户确认后调用 `POST /import`。
5. 成功后失效所有 query 并回到概览。

后端后续建议增加 `POST /import/preview` 或 `POST /import?dry_run=true`。没有服务端 dry-run 前，Web 端预览只是文件结构预览，不能保证全部服务端约束一定通过。

## 9. 图表技术方案

### 9.1 共同原则

- 三种图都使用月均金额的比例，不使用原始账单金额直接比较。
- 图形的可访问性不能只依赖颜色和形状；必须提供等价列表或表格。
- `prefers-reduced-motion` 开启时禁用漂移、碰撞和过渡动画。
- 金额、日期、渠道是主信息，装饰图形不能挤压可读性。

### 9.2 动态水滴/泡泡

推荐用绝对定位 DOM 元素加 `requestAnimationFrame` 实现，而不是 canvas：

- 每个泡泡需要包含品牌 Logo 和金额文本，DOM 更容易排版。
- `backdrop-filter`、半透明边框、模糊阴影在 DOM/CSS 中更直接。
- 订阅数量首版通常不大，DOM 性能足够。

面积计算：

```text
monthlyRatio = monthlyEquivalent(item) / maxMonthlyEquivalent
diameter = minDiameter + sqrt(monthlyRatio) × (maxDiameter - minDiameter)
```

碰撞：

- 低速漂移，阻尼衰减。
- 接触时沿接触轴轻微压缩，不做硬反弹。
- 选中泡泡停止漂移并提高层级。
- 超过订阅数量阈值时降低动画密度或退化为静态布局。

### 9.3 月费分块

- 固定高度矩形容器。
- 每个订阅宽度按月均金额占比分配。
- 过窄块优先显示 Logo，不显示名称和金额。
- 最小宽度会扭曲比例时，在说明中接受视觉折衷，不能用线性原始金额替代比例。
- 选中块显示描边和下方详情。

### 9.4 账期圆环

- 用 SVG `circle` 和 `stroke-dasharray` 绘制。
- 一个圆环代表一个订阅的完整付费周期。
- 弧线从 12 点顺时针表示已过周期。
- 选中时整条环高亮，中心显示订阅名和已过/完整周期。
- 移动端最多显示 5 个主要圆环，其余在列表中显示；避免线条过密。
- 一次性订阅不参与圆环，或单独标记为“单次”。

## 10. 视觉系统与组件

### 10.1 设计令牌

```css
:root {
  --color-paper: #FAF9F7;
  --color-ink: #1D1C24;
  --color-muted: #706F78;
  --color-line: #E7E4DE;
  --color-soft: #F0EEE9;
  --color-blue: #263E9F;
  --color-blue-soft: #E7EBFF;
  --color-white: #FFFFFF;

  --radius-card: 26px;
  --radius-control: 14px;
  --space-page-x: 20px;
  --space-page-x-wide: 40px;
}
```

Tailwind 中把这些变量映射成语义 token，避免到处散落 hex。

### 10.2 字体

- 数字和英文优先使用 Allo Variable。
- 中文使用系统中文字体。
- 如果 Allo 字体文件许可证允许自托管，放入 `frontend/web/public/fonts/` 并 subset；否则不强行引入。
- 字体应 `font-display: swap`，避免阻塞首屏。

### 10.3 基础组件

首批组件：

- `AppShell`、`Sidebar`、`BottomNav`
- `Button`、`IconButton`
- `TextField`、`NumberField`、`DateField`、`Select`
- `Card`、`MetricPill`
- `Sheet`、`Dialog`
- `Toast` 或轻量通知区域
- `EmptyState`、`ErrorState`、`LoadingState`
- `BrandMark`
- `SubscriptionListItem`
- `PaymentListItem`

`BrandMark` 规则：

- 有 Logo 时显示图片。
- 图片加载失败时只显示干净的首字母或通用图形。
- 不能把透明图片叠在占位字母上，避免透出字母。
- 远程 Logo 使用 lazy loading，并给固定尺寸，避免布局抖动。

## 11. 认证、安全与隐私

### 11.1 Token 生命周期

```text
粘贴 token
  -> GET /me 验证
  -> 成功：写入内存 + sessionStorage
  -> 用户勾选“记住此设备”：写入 localStorage
  -> 失败：不进存储，显示错误
```

推荐策略：

- 默认使用内存 + `sessionStorage`，刷新页面仍可用，关闭标签页后清除。
- 用户明确勾选“记住此设备”后才写 `localStorage`。
- “退出连接”同时清除内存、`sessionStorage`、`localStorage`。
- 401 时清除本地 token 并提示重新连接。

### 11.2 后续更安全的认证方向

正式上线前建议增加：

1. `POST /auth/session`：用一次性 Bearer token 换 HttpOnly、Secure、SameSite Cookie。
2. `POST /auth/logout`：清除会话。
3. Cookie 模式下的 CSRF token。
4. token 轮换和会话过期时间。

首版可以不做，但要在部署文档中明确 Bearer token 自托管模式的风险边界。

### 11.3 CSP 与安全头

生产建议：

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  connect-src 'self';
  img-src 'self' data: https:;
  font-src 'self';
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

说明：

- `style-src` 首版可能需要 `unsafe-inline`，因为动态图形和组件会使用内联样式。后续可通过 nonce 或静态 class 收紧。
- 如果 Logo 改成本地缓存或后端代理，`img-src` 可收紧到 `'self' data:`。
- 不接入第三方统计脚本。

### 11.4 隐私

- 默认不向第三方分析服务发送账本数据。
- 远程品牌 Logo 会暴露用户访问行为给 Logo CDN；正式版应优先使用目录中的本地化 Logo 或后端缓存代理。
- PWA service worker 首版只缓存静态应用壳，不缓存账本 API 响应。

## 12. 后端配合事项

### 12.1 必须配合

| 事项 | 方案 |
| --- | --- |
| 静态文件托管 | Axum 增加 `ServeDir` 托管 `frontend/web/dist`，SPA fallback 到 `index.html` |
| 路径隔离 | `/api/v1` 优先匹配 API，其他 GET 路径回退到前端 |
| 缓存 | `assets/` 长缓存，`index.html` no-cache |
| 安全头 | 增加 CSP、nosniff、Referrer-Policy、frame-ancestors |
| 部署变量 | `WEB_DIST_DIR` 或等价配置 |

### 12.2 应该尽快配合

| 事项 | 原因 |
| --- | --- |
| CORS 白名单化 | 当前 `Any` 只适合开发，不应作为长期公开部署形态 |
| `current_period_start` 或周期进度字段 | 避免前端重复实现账期推导 |
| 日历 occurrences 展开 | 修复周付/日付在月历中只出现一次的问题 |
| 导入 dry-run | 让导入预览真正可靠 |
| 本地 Logo 缓存或代理 | 降低第三方 CDN 隐私暴露和 404 风险 |

### 12.3 可延后配合

- OpenAPI/utoipa 类型生成。
- HttpOnly Cookie 会话。
- 静态资源嵌入 Rust 二进制。
- 目录价格同步任务。

## 13. 开发与部署流程

### 13.1 本地开发

终端 1：

```bash
cd backend
cp .env.example .env
cargo run -- create-user --name "我的账本"
cargo run -- serve
```

终端 2：

```bash
cd frontend/web
npm install
npm run dev
```

Vite 代理：

```ts
server: {
  fs: {
    allow: ['..'] // 允许读取 frontend/shared
  },
  proxy: {
    '/api': 'http://127.0.0.1:3000'
  }
}
```

浏览器访问 Vite 地址时，Web 端默认请求 `/api/v1`，看起来已经是同源。`fs.allow` 只在开发服务器生效，不影响生产构建产物。

### 13.2 生产构建

```bash
cd frontend/web
npm run build
```

产物输出到 `frontend/web/dist`。

生产部署方式 A：Axum 同源托管

```text
Axum process
  /api/v1/* -> API
  /*        -> frontend/web/dist
```

生产部署方式 B：反向代理

```text
Caddy/Nginx
  /api/* -> Axum
  /*     -> 静态文件目录
```

优先推荐 A，因为自托管部署最少只有一个应用进程；如果用户已经有成熟反向代理，B 也合理。

### 13.3 环境变量

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `DATABASE_URL` | SQLite 位置 | `sqlite://data/xuqi.db` |
| `BIND_ADDR` | Axum 监听地址 | `127.0.0.1:3000` |
| `WEB_DIST_DIR` | Web 构建产物目录 | `../frontend/web/dist` 或部署包内路径 |
| `ALLOWED_ORIGINS` | 分离部署时的 CORS 白名单 | 空，表示同源优先 |

## 14. 测试与质量

### 14.1 单元测试

重点覆盖：

- 金额输入解析、minor unit 转换、格式化。
- 月均金额公式与后端一致。
- 1 月 31 日月付跨月、闰年、年付、周付、一次性订阅。
- API snake_case 到 camelCase mapper。
- 错误响应到 `ApiError` 的转换。
- 圆环 progress clamp 到 0–1。

### 14.2 组件测试

使用 Testing Library：

- 表单必填和错误提示。
- 图表点击后详情与选中项一致。
- Logo 加载失败 fallback。
- 空账本、加载失败、401 失效状态。
- 演示模式写操作不调用真实 API。

### 14.3 API mock 测试

使用 MSW 或轻量 fetch mock：

- `GET /overview` 返回后页面显示服务端总额。
- mutation 后触发正确 invalidation。
- 409 付款冲突显示“该账期已确认”。
- 目录搜索失败仍可手动录入。

### 14.4 E2E 测试

Playwright 至少覆盖两个视口：

- 手机：390×844。
- 桌面：1280×800。

关键场景：

1. 演示模式打开概览，切换三种图表。
2. 粘贴 token，连接真实后端，查看真实概览。
3. 新增订阅，出现在列表、概览和日历。
4. 编辑订阅金额，概览更新。
5. 停用渠道后，新表单不再可选，但旧订阅仍显示。
6. 确认付款后，下次扣费日更新，日历和付款历史变化。
7. 导出 JSON，导入同一 JSON，页面恢复。

### 14.5 可访问性检查

- 所有交互元素是真实 `button`、`a`、`input`、`select`。
- 图标按钮有 `aria-label`。
- 图表有文字摘要或等价表格。
- 键盘可以完成导航、选择和表单提交。
- 焦点样式明显。
- 触控目标不小于 44px。
- 检查主要文本颜色对比度。

### 14.6 性能预算

首版内部预算：

- 初始 JS gzip 后不超过约 200 KB，超过时需要解释或拆包。
- 路由级懒加载：日历、设置、备份可拆分。
- Logo 图片 lazy load。
- 字体 subset 并 preload 关键字重。
- 动效不阻塞输入；低端设备可降级为静态图。

## 15. CI 建议

每次提交至少执行：

```bash
cd backend
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --locked

cd ../frontend/nsh
# 按 NSH CLI 实际命令执行 check/test

cd ../web
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

E2E 可以先在本地和 release 前执行；稳定后再进入 CI。

## 16. 实施分期与验收

### M0：目录拆分，不改变行为

工作：

- 创建 `frontend/nsh/`。
- 移动现有 NSH 文件。
- 更新根 README 和 macOS 测试交接文档。
- 新建 `frontend/README.md` 说明多客户端结构。

验收：

- `cargo test --locked` 通过。
- NSH check/test 通过。
- macOS 原生运行命令更新后可启动。
- 仓库中没有残留指向旧 `frontend/App.tsx` 的文档命令。

### M1：Web 工程骨架和演示模式

工作：

- 创建 `frontend/web/`。
- 接入 Vite、React、TypeScript、路由、Tailwind、设计令牌。
- 实现 AppShell、窄屏底部导航、宽屏侧边栏。
- 移植演示数据。
- 实现概览静态页和三种图表的第一版。

验收：

- 390×844 和 1280×800 可正常浏览。
- 无后端时可进入演示模式。
- `npm run typecheck`、`npm run test`、`npm run build` 通过。

### M2：真实 API 只读链路

工作：

- 实现 `/connect`。
- 实现 token 验证、sessionStorage/localStorage 策略。
- 接入 `me`、`overview`、`subscriptions`、`calendar`。
- 实现订阅详情只读视图。

验收：

- 真实后端 token 可连接。
- 401 能清除会话并提示。
- 概览总额使用服务端返回值。
- 浏览器前进后退、刷新详情页都正常。

### M3：订阅和渠道写入

工作：

- 新增、编辑、暂停、恢复、结束、删除订阅。
- 目录搜索和套餐价格带入。
- 扣费渠道新增、改名、停用、启用。
- 完整错误、空状态和 mutation invalidation。

验收：

- 新增订阅后概览、列表、日历一致更新。
- 停用渠道后新表单不可选，旧订阅仍显示。
- 表单错误和后端 400/409 能以中文反馈。

### M4：付款与备份

工作：

- 付款确认、付款历史、付款更正。
- 导出 JSON。
- 导入本地预览和确认导入。

验收：

- 重复确认同一账期时正确展示冲突。
- 付款后下次扣费日按后端结果更新。
- 导出文件可再导入。

### M5：同源部署与安全硬化

工作：

- Axum 托管 `web/dist`。
- 增加安全头和缓存策略。
- CORS 白名单化。
- 完善部署文档。

验收：

- 单进程访问 `/` 打开 Web 应用。
- `/api/v1` API 正常。
- 刷新深层路由不 404。
- 安全头存在，CORS 不再无条件 `Any`。

### M6：PWA 与体验增强

工作：

- manifest、图标、安装体验。
- service worker 缓存静态应用壳。
- 视觉细节和动效验收。
- 可访问性专项检查。

验收：

- 手机浏览器可安装到主屏。
- 离线时至少能打开应用壳并显示明确的离线状态。
- Reduce Motion 开启后动画停止。

## 17. 主要风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Web 无法真正调用 macOS Liquid Glass | 视觉不能完全等同原生 | 用半透明、模糊、细边框近似；不要承诺完全一致 |
| 账期起点后端未返回 | 圆环进度可能与后端规则不一致 | 先纯函数推导并测试，后续后端补字段 |
| 日历不展开重复账期 | 周付/日付月历不完整 | 前端明确按 API 显示；后端补 occurrences |
| Bearer token 存浏览器 | XSS 下可能泄露 | CSP、退出清除、默认 sessionStorage；后续 HttpOnly Cookie |
| 远程 Logo CDN | 隐私泄露、404、加载慢 | 本地缓存或后端代理 |
| 多客户端共享过度抽象 | 拖慢首版 | 只共享纯函数和类型，UI 不共享 |
| 目录同步未完成 | 搜索服务为空 | 前端提供手动录入，不把目录当作必填 |

## 18. 建议的默认决策

| 决策点 | 默认建议 |
| --- | --- |
| 是否替换 NSH | 不替换，先并行 |
| Web 技术栈 | React + Vite + TypeScript |
| JS 包管理 | 首版 npm，后续按需评估 pnpm workspace |
| 目录结构 | `frontend/nsh`、`frontend/web`、`frontend/shared`、未来 `frontend/ios` |
| 部署 | Axum 同源托管 `frontend/web/dist` |
| token 保存 | 内存 + sessionStorage；用户明确选择后才 localStorage |
| 图表实现 | 自绘 DOM/SVG，不引入通用图表库 |
| 离线 | 首版只做 PWA 应用壳，不缓存账本 API 数据 |

## 19. 最小可执行第一步

先做 M0 目录拆分，不混入选型和新功能：

```text
frontend/ 现有内容 -> frontend/nsh/
新增 frontend/README.md
更新根 README.md 和 docs/macOS测试交接.md
运行后端测试与 NSH 检查
```

这一步完成后，再创建 `frontend/web/`。这样 Web 端的初始 PR 不会同时承担“迁移旧代码”和“新增大型前端”的双重风险。
