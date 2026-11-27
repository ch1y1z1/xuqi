# 续期

一个手机竖屏优先的订阅管理器设计草案。

当前仓库记录产品范围、信息架构、数据模型、API 草案和目录价格缓存方案。后端实现已经放在 `backend/`，使用 Rust、Axum 和 SQLite，前端通过 API 访问用户自己的订阅账本。

## 当前方向

- 用月均支出、近期续费和账期图形快速查看订阅账本
- 支持泡泡、月费分块和账期圆环三种首页探索方向
- 搜索服务后带入 Logo、地区、套餐、周期和参考价格
- 用户可以直接修改目录带入的金额和周期
- 订阅支持自动扣款、手动续费、扣费渠道和状态管理
- 设置里管理微信支付、支付宝 Alipay、Apple Pay、Mastercard 及自定义扣费渠道
- 上游价格不可用时使用 SQLite 中最近一次可用目录数据
- 首版暂缓订阅通知、银行账单接入和实际扣款接入

## 文档

- [前后端设计方案](docs/订阅管理器-前后端设计.md)
- [macOS 测试交接](docs/macOS测试交接.md)
- [在线查询与缓存调研](docs/订阅目录在线查询与缓存.html)
- [订阅预设目录调研](docs/订阅预设目录调研.html)
- [简版设计草案](docs/订阅管理器-简版设计.html)

## 原型

Doop 可点击原型  
https://doop.design/c/Kz6WDDMdvN/proto

当前原型包含首页两种支出图、账期圆环探索、订阅清单、续费日历、新增和编辑订阅、扣费渠道管理等页面。

## 后端快速开始

需要 Rust stable 工具链。

```bash
cd backend
cp .env.example .env
cargo run -- create-user --name "我的账本"
cargo run -- serve
```

创建用户命令会生成一次性 API token。服务启动后，使用 `Authorization: Bearer <token>` 访问 `/api/v1`，健康检查 `/health` 不需要 token。详细接口列表和环境变量见 [`backend/README.md`](backend/README.md)。

## 前端快速开始

前端按客户端拆分在 `frontend/`。NSH 端位于 `frontend/nsh/`，使用 NSH TSX 编写；Web 原生前端位于 `frontend/web/`。

```bash
nsh run frontend/nsh/App.tsx
```

在 macOS 上可以直接运行原生窗口：

```bash
nsh run frontend/nsh/App.tsx --target macos
```

Web 端开发和构建：

```bash
cd frontend/web
npm install
npm run dev
npm run build
```

构建后，Axum 默认同源托管 `frontend/web/dist`；可用 `XUQI_WEB_DIST` 指向其他产物目录。前端没有填写 token 时使用演示数据。打开设置页后，可以填写自托管后端地址和 Bearer Token，连接当前 Axum API。

## 状态

后端首版已经可运行，包含用户令牌认证、订阅账本、付款记录、扣费渠道、概览、日历、目录查询、JSON 导入导出和 SQLite 迁移。NSH 前端首版已经加入 `frontend/nsh/`，Web 前端位于 `frontend/web/`，目录上游同步任务仍在后续阶段。macOS 测试步骤见 [测试交接文档](docs/macOS测试交接.md)。
