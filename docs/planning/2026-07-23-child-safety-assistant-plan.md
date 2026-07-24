# 儿童安全小助手第一阶段实施方案

> 状态：已批准，按本方案实施
> 日期：2026-07-23
> 目标仓库：`E:\VSC\H5\SPEDSafe`
> 只读参考仓库：`E:\VSC\H5\SIC-ADS`

## 1. 目标

在现有 Electron 23 + Vue 3 单页应用内增加唯一内置智能体“儿童安全小助手”。它面向中国大陆幼儿园、小学、特殊教育学校和家庭场景，提供预防性安全教育、风险识别、儿童保护支持、环境安全评估和融合活动适配建议。

第一阶段保持目标项目当前架构：CommonJS Main、窄 Preload、Vue 组件本地状态、独立 `electron-store`。不迁移源项目的多智能体、动态 Skill、Pinia、SQL、用户体系、附件或工具调用能力。

## 2. 冻结与非目标

- 冻结 Electron 23.3.13、Node 18.12.1、Vue 3.5.24、Vite 5.4.21、electron-store 8.2.0。
- 不新增运行时依赖，不引入 Pinia、Element Plus、vue-router 或 SQL.js。
- 只接火山方舟，不提供其他 provider、任意 Base URL 或兼容入口。
- `tools` 固定为空数组，不访问资源、学习记录、学生、评估、报告或附件。
- 不迁移源项目用户 ID、数据库、会话、API Key、附件或其他用户数据。
- 不做分支会话、多人同步、云同步或后台知识库。

## 3. 领域规则分层

桌面文件《儿童安全小助手》作为产品规则源，不在每次请求中原样加载。运行时分为三层：

1. **Main 本地硬规则**：识别明确正在发生的 P0 事件并立即返回本地短响应，不等待网络。
2. **版本化内置提示词**：压缩保留身份、服务范围、风险路由、儿童保护、特殊教育适配、隐私、非诊断边界和输出风格。
3. **会话正文**：只发送当前本机 workspace 中当前会话的必要消息，由 Main 读取和裁剪。

提示词采用 `child-safety-assistant/v1.0.0` 版本标识。特教与融合适配原则包括：

- 先描述儿童当前能做什么，预设其有学习、表达和成长能力。
- 保留安全教育目标，优先移除与目标无关的语言、动作、感官和流程门槛。
- 允许口语、指认、图片、操作和辅助沟通等与目标匹配的参与方式。
- 优先调整环境、材料、节奏、提示和成人站位，不按诊断标签推断能力。
- 使用正向支持和可观察事实，不使用羞辱、恐吓、惩罚性或强制服从建议。
- 不作医学、心理、行为功能或障碍诊断，不提供身体约束操作。

## 4. Main 安全架构

### 4.1 固定配置

- 方舟 Base URL 仅定义在 Main 常量中：`https://ark.cn-beijing.volces.com/api/v3`。
- Renderer 只可提交 API Key 和模型/推理接入点 ID。
- 模型 ID 做长度和字符白名单校验；API Key 只做必要的非空与长度校验。
- Preload 不提供 Base URL、system prompt、工具或任意历史 payload 参数。
- Main 构建方舟请求，固定 `stream: true`、`tools: []`，并注入内置提示词。

### 4.2 密钥和本机标识

- 新建独立 `electron-store`：`child-safety-assistant-config`。
- 首次启动用 `crypto.randomUUID()` 生成 `workspaceId`，只表示本机 AI 工作区，不复用机器码或任何源项目用户 ID。
- API Key 仅由 Main 接收并用 Electron `safeStorage.encryptString()` 加密后落盘。
- Renderer 只能读取 `hasApiKey`、`modelId`、`workspaceId` 和安全存储可用状态，永远不能读取明文或密文 Key。
- `safeStorage` 不可用时拒绝持久化 API Key，不做明文或自制固定密钥降级。

### 4.3 会话加密

- 新建独立 `electron-store`：`child-safety-assistant-sessions`。
- Main 生成随机 AES-256-GCM 数据密钥，数据密钥只以 `safeStorage` 密文保存。
- 会话列表、标题和正文作为一个版本化 JSON 快照，用 AES-256-GCM 加密后落盘；磁盘不保存明文消息。
- `safeStorage` 不可用、解密失败或密钥不可恢复时，会话服务切换为当前进程内存模式，并返回明确的 `memoryOnly` 状态。
- 内存模式不覆盖无法解密的旧快照，也不进行明文降级。

## 5. 会话与流式事务

每条消息有稳定 `messageId`，每次生成有 `requestId`，每个会话有单调递增 `conversationRevision`。

### 5.1 普通发送

1. Renderer 只提交 `sessionId`、新用户文本和客户端生成的 `requestId`。
2. Main 校验输入，在当前会话写入用户消息和 assistant 占位消息，递增 revision。
3. Main 从自身会话存储构建有限历史并发起方舟请求。
4. 每个 chunk 携带 `sessionId`、`requestId`、`messageId` 和 revision。
5. 只有四个标识仍与当前生成事务一致时才能追加并持久化内容。

### 5.2 编辑并重发

- 仅允许编辑当前会话最后一条用户消息。
- Main 原子替换该消息内容并删除其后的旧回答，递增 revision，再创建一个新 assistant 占位消息。
- 不复制用户消息，不保留旧回答，不生成分支历史。

### 5.3 重新生成

- 使用当前最后一条用户消息，删除该消息之后的旧 assistant 内容，递增 revision，再生成新 assistant 占位消息。
- 不重复插入用户消息，不生成分支历史。

### 5.4 停止与旧流隔离

- Main 维护 `requestId -> AbortController` 映射；停止操作只接受当前活动 request。
- 停止后保留已生成内容并将消息标为 `stopped`，随后才允许编辑或重新生成。
- 切换、删除或清空涉及活动会话时先停止对应请求。
- 旧请求即使晚到 chunk 或完成事件，也因 requestId/revision/messageId 不匹配而被丢弃。

## 6. P0 本地快速响应

Main 在任何网络和配置检查之前识别“正在、现在、刚刚发生”等明确即时语义与以下高危事件组合：

- 窒息、严重吞咽/误吞：提示立即联系 120。
- 溺水、严重伤害、严重出血、严重坠落：提示立即联系 120。
- 火灾：提示立即联系 119，并在存在人身危险时联系 110。
- 正在遭受严重暴力、儿童当前失踪：提示立即联系 110；有伤情同时联系 120。

响应保持简短，说明助手不提供现场急救或救援操作，不继续长篇科普，不要求用户先补充大量信息。仅有预防性、假设性或历史描述时不触发 P0。

## 7. IPC 与 Preload 边界

Preload 只暴露固定语义方法：

- 获取脱敏状态、保存/清除方舟配置。
- 列出、新建、读取、切换、删除会话和清空全部历史。
- 发送、停止、编辑并重发、重新生成。
- 订阅/取消订阅固定的流式事件。

所有 payload 均由 Preload 重建允许字段，禁止提供通用 `invoke`、任意 channel、Base URL、system prompt、完整历史、Key 读取或 tools 参数。

## 8. Renderer 交互

- `Header` 增加带图标的“儿童安全小助手”入口。
- 打开全高右侧工作区；桌面端使用受约束宽度，窄屏占满视口。
- 工作区包含会话列表、当前会话、配置入口、清空历史、新建/切换/删除、消息流、输入区和明确错误状态。
- 生成时显示停止按钮，并禁用编辑、重新生成、切换破坏性操作。
- 生成停止或结束后，最后一条用户消息显示“编辑并重发”，最后一条 assistant 回答显示“重新生成”。
- 空会话提供少量安全教育起始问题；不展示产品营销或功能说明段落。
- 设置仅包含 API Key、模型/推理接入点 ID；Key 输入保存后立即清空本地表单值。

## 9. 模块与打包

预计新增 CommonJS 模块：

- `ai/child-safety-prompt.js`
- `ai/p0-safety.js`
- `ai/secure-vault.js`
- `ai/session-service.js`
- `ai/ark-client.js`
- `ai/assistant-service.js`
- `ai/ipc.js`

`package.json -> build.files` 显式加入 `ai/**/*.js`，避免 electron-builder 漏包。现有 Main 仅负责初始化服务和注册 IPC。

## 10. 验证矩阵

使用 Node 18 内置 `node:test`，通过依赖注入模拟 fetch、safeStorage、store 和流事件：

- 方舟 URL、请求头、固定模型、内置 prompt、Main 构建历史和 `tools: []`。
- SSE 跨 chunk、CRLF、多 data 行、`[DONE]`、usage、HTTP/网络/超时/中止错误。
- Preload/IPC 密钥边界与禁止字段；状态不含明文或密文 Key。
- safeStorage 可用时加密持久化；不可用时仅内存会话；磁盘快照无正文。
- 编辑并重发替换和截断事务；重新生成不复制用户消息。
- revision/messageId/requestId 阻止旧流回写。
- P0 本地响应不调用 fetch，号码和事件类型正确；预防性语句不误触发。

集成验证：

1. `npm test` 执行全部 Node 测试。
2. `npm run build` 验证 Vite 构建。
3. Electron 开发环境人工闭环：配置、发送、流式、停止、新建/切换/删除、清空、编辑重发、重新生成、重启恢复、P0 离线响应和错误提示。
4. 审计 electron-builder 文件清单包含新增 CommonJS 模块；必要时再执行 `npm run electron:build`。
5. 搜索新增实现，确认无非方舟 provider 品牌、源项目品牌、源用户 ID 或源工具绑定。
6. 对全部已跟踪和未跟踪文本执行行尾空格、冲突标记和严格 UTF-8 检查；既有非 UTF-8 遗留只记录，不转码。

## 11. 交接标准

- 更新 `.continue-here.md`，保留用户原有背景并写明本阶段当前状态。
- 最终报告已实现、未实现、自动验证、人工验证、打包检查和剩余风险。
- 不创建 commit，不 push，不修改只读源仓库。
