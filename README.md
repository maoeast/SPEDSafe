# 特教安全教育资源仪（SPEDSafe）

一款基于 Electron + Vue 3 的**离线桌面应用**，面向特殊教育学校、幼儿园、小学和家庭场景，提供安全教育教学资源的播放与学习记录管理。内置"儿童安全小助手"AI 智能体，提供预防性安全教育与风险识别支持。

## 📋 项目概述

- **资源规模**：295 个安全教育资源（213 个视频 + 82 个 H5 交互课件），覆盖 7 大安全分类
- **运行方式**：完全离线运行，资源采用扩展名伪装保护（`.mdat` ← MP4、`.hdat` ← HTML）
- **授权机制**：RSA-2048 签名激活码 + 机器指纹绑定，7 天试用期，支持测试模式
- **语言界面**：简体中文

### 核心功能

| 功能 | 说明 |
|------|------|
| 🎬 视频播放 | 播放 `.mdat` 伪装格式的本地 MP4 视频 |
| 📄 H5 课件 | 内嵌播放 `.hdat` 伪装格式的 H5 交互课件 |
| 📚 学习中心 | 学习历史、观看次数、学习时长、观看进度、成就徽章 |
| 🗂️ 资源分类 | 七大安全主题分类浏览（含分类滚动位置记忆） |
| 🔒 资源保护 | 扩展名伪装 + 禁用右键/复制 + 自定义协议 |
| 🔑 激活系统 | 试用期 + 离线激活，机器绑定防盗版 |
| ⚙️ 应用设置 | 自定义标题、Logo、配色方案，管理员密码保护 |
| 🤖 儿童安全小助手 | 内置 AI 智能体（火山方舟），支持会话、流式生成、加密存储 |

## 🛠️ 技术栈

- **Electron 23.3.13**（Node 18）— 桌面应用框架
- **Vue 3.5.24**（Composition API、`<script setup>`）— 渲染进程框架
- **Vite 5** — 前端构建工具
- **electron-store 8** — 本地持久化（学习记录、应用配置、AI 配置与会话）
- **node-machine-id** — 机器指纹识别
- **crypto-js / node:crypto** — AES 加密、RSA 签名验证
- **Electron safeStorage** — API Key 与数据密钥的本地安全存储
- **node:test** — 内置测试框架（`npm test`）

无 TypeScript、无路由库、无状态管理库、无额外 UI 库。

## 📁 目录结构

```
SPEDSafe/
├── main.js                  # Electron 主进程（窗口、协议、HTTP 服务器、IPC）
├── preload.js               # contextBridge 预加载脚本（窄 API 暴露）
├── license-manager.js       # 激活码验证模块（RSA-2048 + 机器绑定）
├── generate-license.js      # 激活码生成器（Node.js 版本）
├── license-generator.html   # 激活码生成器（单文件 HTML 网页版，浏览器即开即用）
├── public-key.pem           # RSA 公钥（客户端验证用）
├── .keys/                   # RSA 密钥对（private.pem 仅服务端保管，勿提交）
├── ai/                      # 儿童安全小助手主进程模块
│   ├── ipc.js               #   IPC 通道注册与运行时组装
│   ├── assistant-service.js #   生成事务、流式事件、停止/编辑/重发
│   ├── session-service.js   #   会话管理（加密快照、revision 防旧流回写）
│   ├── secure-vault.js      #   API Key / 数据密钥的安全存储（safeStorage）
│   ├── ark-client.js        #   火山方舟 SSE 客户端（仅此一个 provider）
│   ├── p0-safety.js         #   P0 紧急事件本地快速响应（120/119/110）
│   └── child-safety-prompt.js # 版本化内置提示词（v1.0.0）
├── src/                     # Vue 渲染进程
│   ├── main.js              #   Vue 应用入口
│   ├── App.vue              #   根组件（view 切换 + 激活对话框）
│   ├── style.css            #   全局样式
│   ├── resources.json       #   资源清单（295 条）
│   ├── assets/covers/       #   资源封面缩略图
│   └── components/          #   UI 组件
│       ├── Header.vue               # 顶栏（Logo、学习中心、小助手入口）
│       ├── CategoryNav.vue          # 七大分类导航
│       ├── ResourceGrid.vue         # 资源卡片网格
│       ├── Player.vue               # 视频 / H5 播放器
│       ├── LearningDashboard.vue    # 学习中心仪表盘
│       ├── AppSettings.vue          # 应用设置（自定义配置）
│       ├── ActivationDialog.vue     # 激活对话框
│       └── ChildSafetyAssistant.vue # 小助手右侧工作区
├── tests/                   # Node 测试（node --test）
│   ├── child-safety-assistant.test.js  # 小助手模块
│   ├── license-generator.test.js       # 激活码生成/导入链路
│   └── activation-keys.test.js         # 激活密钥代际核对
├── docs/planning/           # 设计方案存档（如儿童安全小助手实施文档）
├── installer/               # 资源安装器（NSIS 脚本与生成工具）
├── license-generator-dist/  # 激活码生成器分发包（含 README）
├── icons/                   # 应用图标、Logo、AI 助手头像
├── index.html               # Vite HTML 模板
├── vite.config.js           # Vite 配置
├── installer.nsh            # NSIS 自定义安装脚本（默认安装路径）
└── package.json             # 项目配置与 electron-builder 配置
```

## 🚀 快速开始

### 环境要求

- Node.js 18.x（Electron 23 内置 Node 18，开发建议同版本）
- npm

### 开发

```bash
npm install          # 安装依赖
npm run electron     # 启动 Vite 开发服务器 + Electron（开发模式自动开 DevTools）
npm run dev          # 仅启动 Vite 开发服务器（端口 5173）
```

开发模式下激活系统可走"测试模式"跳过激活验证。

### 测试与构建

```bash
npm test                 # 运行 Node 测试（node --test）
npm run build            # 构建前端资源到 dist/
npm run electron:build   # 完整打包（vite build + electron-builder NSIS 安装包）
npm run pack:resources   # 生成资源安装器脚本（installer/）
npm run pack:license-generator  # 打包激活码生成器分发包
```

## 📝 资源管理

### 资源清单（`src/resources.json`）

资源条目字段：

```json
{
  "id": "1",
  "title": "安全如厕",
  "type": "video",
  "category": "school",
  "description": "资源描述",
  "coverUrl": "/assets/covers/anquanruce.jpg",
  "filePath": "/assets/vdat/anquanruce.mdat",
  "duration": 112,
  "views": 0,
  "createdAt": "2025-11-07T14:01:49Z"
}
```

### 七大安全分类（295 个资源分布）

| 分类 ID | 名称 | 图标 | 资源数 |
|---------|------|------|--------|
| `school` | 校园安全 | 🏫 | 24 |
| `home` | 居家安全 | 🏠 | 31 |
| `community` | 社区安全 | 🏘️ | 21 |
| `personal` | 个人安全 | 👤 | 21 |
| `drill` | 安全演习 | 🚨 | 96 |
| `course` | 安全课程 | 📖 | 27 |
| `soft` | 安全互动 | 🎮 | 75 |

### 添加新资源

1. **视频**：将 MP4 重命名为 `.mdat`，放入 `src/assets/vdat/`；封面放入 `src/assets/covers/`
2. **H5 课件**：将 H5 目录的入口 `index.html` 重命名为 `index.hdat`，放入 `src/assets/h5dat/`（文件夹）
3. 在 `src/resources.json` 中新增条目（`filePath` 以 `/assets/...` 开头）
4. 用 `npm run pack:resources` 重新生成资源安装器（如需分发）

## 🏗️ 架构

### 进程模型

- **主进程**（`main.js`）：窗口创建、`local://` 自定义协议（视频加载）、本地 HTTP 服务器（H5 资源，随机端口）、全部 IPC 处理器、5 个 electron-store 实例
- **Preload**（`preload.js`）：`contextBridge.exposeInMainWorld` 暴露 `window.electronAPI`，只提供固定语义方法
- **渲染进程**（Vue 3 SPA）：无路由库，`App.vue` 用 `currentView` 在 `home` / `dashboard` / `player` 间切换；组件本地状态

### 资源加载机制

- **视频**：`local://` 协议将 `.mdat` 映射为 `video/mp4`，禁止直接双击文件播放
- **H5 课件**：主进程启动本地 HTTP 服务器（随机端口，仅监听 localhost），将 `.hdat` 映射为 `text/html`；封面图片也经该服务器提供
- 打包后资源从安装目录的 `assets/` 读取（`extraResources` 配置），开发时从 `src/assets` 读取

### IPC 通道

**资源**：`load-resources`、`get-video-path`、`read-video-file`、`get-h5-path`、`get-http-server-port`、`get-cover-path`

**学习记录**：`get-learning-record`、`get-all-learning-records`、`save-learning-record`、`get-learning-statistics`、`clear-learning-records`

**激活**：`get-machine-id`、`verify-license`、`get-activation-status`、`reset-activation`（仅开发模式）

**应用配置**：`get-app-config`、`update-app-config`、`upload-logo`、`reset-logo`、`verify-admin-password`（默认密码硬编码于 `main.js`）

**儿童安全小助手**：`child-safety:get-status`、`child-safety:save-config`、`child-safety:clear-api-key`、`child-safety:list-sessions`、`child-safety:create-session`、`child-safety:get-session`、`child-safety:delete-session`、`child-safety:clear-history`、`child-safety:send-message`、`child-safety:stop-generation`、`child-safety:edit-and-resend`、`child-safety:regenerate`，事件通道 `child-safety:event`

### 数据存储（electron-store）

| store 名称 | 用途 |
|---|---|
| `learning-history` | 学习记录与统计（records、statistics） |
| `app-config` | 应用标题、Logo、标题样式、头部背景 |
| `license-data` | 激活信息（AES 加密 + HMAC 签名，见 license-manager.js） |
| `child-safety-assistant-config` | AI 配置（workspaceId、modelId、加密后的 API Key） |
| `child-safety-assistant-sessions` | AI 会话（AES-256-GCM 加密快照，磁盘无明文） |

## 🔑 激活系统

- **流程**：机器指纹（node-machine-id）→ 管理员用私钥生成激活码（`SPED-XXXX-...`）→ 客户端用 `public-key.pem` 验证 RSA-2048 签名并绑定机器
- **激活方式**：
  - 手动输入激活码（激活页面直接粘贴）
  - **导入激活文件**（.lic）：管理员在生成工具中"导出激活文件"，客户在激活页面点击"导入激活文件"选择 .lic 即可自动完成激活，全程免复制粘贴
- **试用**：首次运行起 7 天试用期；试用期内可跳过激活，过期后强制激活
- **测试模式**：开发环境（未打包）可在激活对话框走"测试模式"
- **生成工具**：
  - HTML 网页工具 `license-generator.html`（推荐，零安装，浏览器即开即用，支持导出 .lic）
  - Node 版：`generate-license.js`（`--lic` 参数可同时输出 .lic 激活文件）
  - Python GUI/CLI：`license_generator_gui.py` / `license_generator_cli.py`（依赖见 `requirements-gui.txt`）
  - 打包分发：`license-generator-dist/`（可用 `npm run pack:license-generator` 重新生成，含 HTML 工具）
  - 使用指南：`LICENSE_GENERATOR_GUIDE.md`
- **密钥管理**：签发私钥位于 `.keys/private.pem`（git 已忽略，严禁提交）；客户端验证公钥为 `public-key.pem`。**密钥轮换会使已签发激活码全部失效**，需重新签发

## 🤖 儿童安全小助手

内置唯一 AI 智能体，面向幼儿园、小学、特教学校和家庭场景，提供预防性安全教育、风险识别、儿童保护支持、环境安全评估和融合活动适配建议。详细设计见 `docs/planning/2026-07-23-child-safety-assistant-plan.md`。

### 安全架构

- **唯一 provider**：火山方舟（Base URL 固定于主进程常量，`tools: []`，无工具调用）
- **窄 Preload 边界**：渲染进程只能提交 API Key 与模型/推理接入点 ID，无法读取明文 Key、完整历史或 Base URL
- **密钥存储**：API Key 经 Electron `safeStorage` 加密落盘；`safeStorage` 不可用时拒绝持久化，不做明文降级
- **会话加密**：AES-256-GCM 加密快照落盘，磁盘无明文消息；解密失败时切换为内存会话模式
- **P0 本地响应**：识别"正在/现在/刚刚发生"的窒息、溺水、火灾、严重暴力、失踪等高危事件时，主进程直接返回 120/119/110 短响应，不等待网络
- **版本化提示词**：内置提示词 `child-safety-assistant/v1.0.0`，含特教与融合适配原则（正向支持、可观察事实、不诊断、不约束）
- **流式事务**：messageId / requestId / conversationRevision 三重校验，旧请求无法回写当前会话；支持停止生成、编辑并重发、重新生成

### 使用

1. 顶栏点击"儿童安全小助手"入口，打开右侧工作区
2. 设置中填入火山方舟 API Key（模型接入点已预置默认 `deepseek-v4-flash-ga-260731`，可按需修改）
3. 新建会话开始提问（空会话提供安全教育起始问题）

## 🧪 测试

```bash
npm test
```

使用 Node 内置 `node:test`，通过依赖注入模拟 fetch、safeStorage、store 与流事件，覆盖：方舟请求构造、SSE 解析（跨 chunk/CRLF/`[DONE]`/错误）、Preload 密钥边界、加密持久化与内存模式、编辑重发/重新生成事务、旧流隔离、P0 本地响应。

## 📦 构建与分发

- 打包目标：Windows NSIS 安装包（`electron-builder` 配置见 `package.json → build`）
- 自定义 NSIS 脚本 `installer.nsh` 设置默认安装路径 `D:\Program Files\SpedSafe`，支持自定义安装目录
- `extraResources` 将封面、资源清单、图标随安装包分发
- 大批量资源分发可配合 `installer/` 资源安装器（`npm run pack:resources`）

## 📜 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.4 | 2026-10 | 激活密钥代际核对：生成器页面与激活页各显示「签发公钥指纹」（可对表）、激活失败文案区分签名代际不匹配与格式损坏、新增配对与分发件回归测试 |
| v1.0.3 | 2026-07 | 资源入库（221 → 295 个）；新增儿童安全小助手（AI 模块 + 窄 Preload + 加密会话）；项目冗余清理 |
| v1.0.0 | 2025-11-24 | 首个正式版本：资源播放、学习中心、激活系统、应用配置系统 |
