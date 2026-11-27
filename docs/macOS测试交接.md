# 续期 macOS 测试交接

当前版本包含 Rust + Axum + SQLite 后端和 NSH TSX 前端。

## 1. 获取代码

```bash
git clone https://github.com/ch1y1z1/xuqi.git
cd xuqi
```

## 2. 启动后端

需要 Rust stable。

```bash
cd backend
cp .env.example .env
cargo run -- create-user --name "我的账本"
```

命令会输出一次 API token。请先保存，后续不会再次显示。

```bash
cargo run -- serve
```

默认 API 地址是：

```text
http://127.0.0.1:3000/api/v1
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

## 3. 启动 macOS 前端

另开一个终端，在仓库根目录执行：

```bash
nsh run frontend/nsh/App.tsx --target macos
```

如果只想先看界面，可以直接启动，不填写 token。此时应用使用 Spotify、Notion、Figma、iCloud+ 和 ChatGPT 演示数据。

## 4. 连接后端

打开应用的“设置”页面，填写：

- API 地址：`http://127.0.0.1:3000/api/v1`
- Bearer Token：第 2 步生成的 token

点击“连接并同步”后，应用会读取真实订阅、概览和扣费渠道。

## 5. 建议测试顺序

1. 检查概览页在窄窗口下是否保持竖屏布局。
2. 拉宽 macOS 窗口，确认侧边栏和宽布局自动出现。
3. 切换“泡泡”“分块”“账期”三种图表。
4. 打开订阅列表，确认 Logo、金额、下次扣费日和扣费渠道显示正常。
5. 在添加订阅页面搜索服务目录。
6. 选择目录服务，确认 Logo 和参考价格能带入，且金额可以修改。
7. 保存一项订阅，确认后端数据增加。
8. 在设置页停用和启用 Apple Pay、支付宝 Alipay、微信支付、Mastercard。
9. 回到添加订阅页面，确认停用渠道不再作为新订阅选项。
10. 关闭后端后重新打开应用，确认本地演示模式仍可启动。

## 6. 当前实现边界

- 目录服务搜索和价格查询依赖后端已有目录数据。
- 目录在线同步任务尚未接入，当前可以使用目录缓存接口。
- 添加订阅首版默认按 CNY、每月、自动扣款处理。
- 付款记录、编辑订阅和导入导出 API 已在后端提供，前端页面尚未全部接入。
- Linux 环境没有执行 macOS 原生窗口构建，窗口尺寸、字体和远程 Logo 加载需要在 macOS 实机确认。

## 7. 常见命令

前端检查：

```bash
nsh check frontend/nsh
nsh test frontend/nsh
```

后端检查：

```bash
cd backend
cargo check
cargo test
```

轮换 token：

```bash
cargo run -- rotate-token --user-id "<user-id>"
```
