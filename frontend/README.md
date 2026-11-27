# 续期前端

`frontend/` 按客户端拆分：

- `nsh/`：现有 NSH TSX 前端，适配手机竖屏和 macOS 宽窗口。
- `web/`：Web 原生 React 前端。
- `shared/`：跨 TypeScript 客户端共享的纯类型、纯函数和平台中立设计令牌。
- `ios/`：未来原生 iOS 客户端的预留方向，尚未创建。

## NSH

```bash
nsh run frontend/nsh/App.tsx --target macos
nsh check frontend/nsh
nsh test frontend/nsh
```

## Web

```bash
cd frontend/web
npm install
npm run dev
```
