# 续期前端

这是「续期」的 NSH TSX 前端，手机竖屏和 macOS 宽窗口使用同一套界面代码。

## 本地运行

先安装 NSH CLI，然后在仓库根目录执行：

```bash
nsh run frontend/App.tsx
```

在 macOS 上运行原生窗口：

```bash
nsh run frontend/App.tsx --target macos
```

在浏览器中预览：

```bash
nsh run frontend/App.tsx --target web
```

## 当前实现

- 概览页支持泡泡、月费分块和账期圆环三种图表
- 手机使用底部导航，宽窗口使用侧边栏
- 订阅列表支持搜索
- 添加订阅支持本地演示账本写入，也支持通过 API 写入真实账本
- 添加订阅支持已连接后端时搜索服务目录，并带入 Logo、参考价格和扣费渠道
- 设置页支持微信支付、支付宝 Alipay、Apple Pay 和 Mastercard 的启停
- 扣费渠道启停已通过 API 同步到后端
- 设置页可以填写 Axum API 地址和 Bearer Token，同步真实账本
- 未连接后端时使用演示数据，方便先在 macOS 上检查视觉和布局

前端 API 客户端位于 `lib/api.ts`，后端接口前缀默认为 `http://127.0.0.1:3000/api/v1`。
