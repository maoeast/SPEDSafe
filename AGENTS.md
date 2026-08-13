# AGENTS.md

本文件为 AI 编程代理（Codex / Claude Code 等）在本仓库工作时的协作指南。

## 项目概述

SPEDSafe（特教安全教育资源仪）—— 离线 Electron 桌面应用，用于特殊教育安全教学。播放视频（`.mdat` 伪装的 MP4）与 H5 交互课件（`.hdat` 伪装的 HTML），管理学习记录，并内置"儿童安全小助手"AI 智能体（火山方舟）。共 295 个资源（213 视频 + 82 H5），覆盖 7 大安全分类。中文界面。

## 技术栈

- Electron 23.3.13 + Vue 3（Composition API、`<script setup>`）+ Vite 5
- electron-store 8（5 个实例）持久化、node-machine-id 机器指纹、crypto-js 加密
- Electron safeStorage（AI 配置加密）、AES-256-GCM（AI 会话加密）、RSA-2048（激活码签名）
- 测试：Node 内置 `node:test`（`npm test`）
- 无 TypeScript、无路由库、无状态管理库、无 linter

## 命令

```bash
npm run electron          # 开发：Vite dev server + Electron 并发启动
npm run dev               # 仅 Vite dev server（端口 5173）
npm run build             # 仅 Vite 前端构建
npm run electron:build    # 生产构建（vite build + electron-builder，NSIS 安装包）
npm test                  # 运行 tests/ 下的 Node 测试
npm run pack:resources    # 生成资源安装器脚本
npm run pack:license-generator  # 打包激活码生成器分发包
```

## 架构

### 进程模型

**主进程**（`main.js`，548 行）：窗口创建、`local://` 自定义协议（视频）、本地 HTTP 服务器（H5 资源，随机端口）、全部 IPC 处理器、5 个 electron-store。

**Preload**（`preload.js`）：`contextBridge.exposeInMainWorld` 暴露 `window.electronAPI`，固定语义方法，无通用 invoke。

**渲染进程**（Vue 3 SPA）：无 vue-router——`App.vue` 用 `currentView` ref 切换 `home` / `dashboard` / `player`，另有 `ChildSafetyAssistant` 右侧工作区。所有状态组件本地化。

### 资源保护

- 视频：MP4 重命名为 `.mdat`，经 `local://` 协议映射为 `video/mp4`
- H5 课件：目录入口 `index.html` 重命名为 `index.hdat`，经本地 HTTP 服务器映射为 `text/html`；封面图片同服务器提供
- 打包后资源从安装目录 `assets/` 读取（`extraResources`），开发时从 `src/assets` 读取
- 生产环境禁用右键菜单；渲染进程 `nodeIntegration: false`、`contextIsolation: true`

### IPC 通道

全部基于 `ipcMain.handle` / `ipcRenderer.invoke`：

- **资源**：`load-resources`、`get-video-path`、`read-video-file`、`get-h5-path`、`get-http-server-port`、`get-cover-path`
- **学习记录**：`get-learning-record`、`get-all-learning-records`、`save-learning-record`、`get-learning-statistics`、`clear-learning-records`
- **激活**：`get-machine-id`、`verify-license`、`get-activation-status`、`reset-activation`（仅未打包时可用）
- **应用配置**：`get-app-config`、`update-app-config`、`upload-logo`、`reset-logo`、`verify-admin-password`（默认密码 299451 硬编码于 main.js）
- **激活文件导入**：`import-license-file`（打开文件对话框并读取 .lic / .txt 内容）
- **AI（child-safety: 前缀）**：`get-status`、`save-config`、`clear-api-key`、`list-sessions`、`create-session`、`get-session`、`delete-session`、`clear-history`、`send-message`、`stop-generation`、`edit-and-resend`、`regenerate`；事件通道 `child-safety:event`（流式 chunk 推送）

### 数据存储（electron-store）

| store 名称 | 用途 | 位置 |
|---|---|---|
| `learning-history` | 学习记录 + 统计 | main.js |
| `app-config` | 标题、Logo、样式配置 | main.js |
| `license-data` | 激活信息（AES + HMAC） | license-manager.js |
| `child-safety-assistant-config` | workspaceId、modelId、加密 API Key | ai/ipc.js |
| `child-safety-assistant-sessions` | AES-256-GCM 加密会话快照 | ai/ipc.js |

### 儿童安全小助手（`ai/` 模块）

- **唯一 provider**：火山方舟（Base URL 固定于 `ark-client.js` 主进程常量，`tools: []`）
- **窄边界**：Preload 只接受 API Key / modelId，渲染进程永远读不到明文 Key 或会话历史
- **预置模型**：模型接入点 ID 预置默认 `deepseek-v4-flash-ga-260731`（`secure-vault.js` 常量），界面自动预填、用户可覆盖
- **加密**：API Key 用 safeStorage；会话用 AES-256-GCM；safeStorage 不可用时拒绝持久化 / 切内存会话，无明文降级
- **P0**：`p0-safety.js` 识别明确即时高危事件（窒息、溺水、火灾、暴力、失踪等），本地返回 120/119/110 短响应，不请求网络
- **流式事务**：messageId + requestId + conversationRevision 三重校验防旧流回写；支持停止、编辑并重发、重新生成
- **提示词**：`child-safety-prompt.js` 版本化内置提示词（`child-safety-assistant/v1.0.0`），含特教融合适配原则

### 激活系统

RSA-2048 签名 + AES-256 本地加密存储。流程：机器指纹（node-machine-id）→ 管理员生成激活码（`SPED-XXXX-...`，用 `.keys/private.pem`）→ 客户端 `public-key.pem` 验证。7 天试用期，试用期后可跳过，过期强制激活；未打包开发环境可走测试模式。生成工具：`generate-license.js`（Node）、`license_generator_gui.py` / `license_generator_cli.py`（Python）、`license-generator-dist/`（分发包）。完整指南见 `LICENSE_GENERATOR_GUIDE.md`。

## 关键路径

- `main.js` — 主进程入口（窗口、协议、HTTP 服务器、IPC、store）
- `preload.js` — contextBridge API
- `src/App.vue` — 根组件，视图路由
- `src/components/` — 全部 Vue 组件（Player、ResourceGrid、LearningDashboard、AppSettings、ActivationDialog、CategoryNav、Header、ChildSafetyAssistant）
- `src/resources.json` — 资源清单（295 条）
- `src/assets/covers/` — 封面缩略图；`src/assets/vdat/`（视频，git 忽略）、`src/assets/h5dat/`（H5 课件，git 忽略）
- `ai/` — 小助手主进程模块（ipc / assistant-service / session-service / secure-vault / ark-client / p0-safety / child-safety-prompt）
- `license-manager.js` — 激活验证
- `tests/child-safety-assistant.test.js` — AI 模块测试（依赖注入 mock fetch / safeStorage / store）
- `docs/planning/2026-07-23-child-safety-assistant-plan.md` — 小助手设计文档（已实施）

## 构建

electron-builder 配置在 `package.json → build`。目标 Windows NSIS 安装包；`installer.nsh` 设置默认安装路径 `D:\Program Files\SpedSafe`。`build.files` 显式包含 `ai/**/*.js`（勿移除，否则打包漏掉 AI 模块）。`extraResources` 携带 covers、resources.json、icons。

## 测试与约定

- 修改后运行 `npm test`；无 linter，JS 语法用 `node --check`
- IPC 新增通道需同步更新 `preload.js`（窄 API）与 `main.js`（或 `ai/ipc.js`）
- 不新增运行时依赖（方案冻结：Electron 23、Node 18、Vue 3.5、Vite 5、electron-store 8）
- 不引入其他 AI provider / 任意 Base URL / 工具调用；AI 请求固定 `tools: []`
- `.keys/private.pem` 私钥严禁新提交进 git；git 忽略项见 `.gitignore`（node_modules、dist/、vdat、h5dat、license-generator-dist 等）

## 遗留事项

- 未验证：开发模式下 Electron 加载 Vite 页面时偶发 `localhost/:1` 404（下一会话可用 DevTools Network 抓取完整 Request URL 定位）
