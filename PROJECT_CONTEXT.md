# Project Context

## 2026-07-24
- 应用包含唯一内置智能体“儿童安全小助手”：Main 负责方舟请求、内置提示词、P0 路由和加密会话，Renderer 只通过窄 Preload API 操作。
- 火山方舟 Base URL 固定在 Main，`tools: []`，不绑定源项目用户、业务数据、附件或工具。
- API Key 使用 Electron `safeStorage`；会话使用 AES-256-GCM，安全存储不可用时仅保留内存会话。
