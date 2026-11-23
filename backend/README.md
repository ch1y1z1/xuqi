# 续期后端

这是「续期」订阅管理器的独立 Rust API 服务，使用 Axum 和 SQLite。

## 运行

需要 Rust stable 工具链。

```bash
cp .env.example .env
cargo run -- serve
```

首次部署先创建一个用户。命令会生成一次性展示的 API token，数据库只保存 token 摘要。

```bash
cargo run -- create-user --name "我的账本"
```

默认地址是 `http://127.0.0.1:3000`。健康检查不需要 token，其他接口使用：

```http
Authorization: Bearer xuqi_...
```

## 已提供的接口

- `GET /health`
- `GET/PATCH /api/v1/me`
- `GET/POST/PATCH /api/v1/billing-channels`
- `GET/POST/PATCH/DELETE /api/v1/subscriptions`
- `GET/POST /api/v1/subscriptions/{id}/payments`
- `PATCH /api/v1/subscriptions/{id}/payments/{payment_id}`
- `GET /api/v1/overview`
- `GET /api/v1/calendar`
- `GET /api/v1/catalog/services`
- `GET /api/v1/catalog/services/{id}/prices`
- `GET /api/v1/export`
- `POST /api/v1/import`

目录表和缓存接口已经包含在迁移中。价格源同步任务会在目录数据源确定后接入，用户订阅保存的实际金额不会被目录更新覆盖。
