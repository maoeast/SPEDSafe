# 2026-10-14 · 小助手配置入口显性化
> 六段 append-only，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 编制：主 agent · 2026-10-14 · 来源 = 用户 2026-10-14 提问「AI 助手内置模型名是不是写死了、配置后没地方改」；查明模型只是默认常量、唯一入口藏在助手浮层图标里；用户选择「A+B 一起做」。
> 台账 = #2（儿童安全小助手 · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-10-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

- 起因（2026-10-14）：用户问「AI 助手内置的模型名是不是写死了，配置之后没有地方修改」。
- 查明（证据）：① 模型**不是**硬编码——`ai/secure-vault.js:6` 是默认常量 `deepseek-v4-flash-ga-260731`，读取时「有存值用存值、没存值用默认」（`:225-230`、`:243`）；② 覆盖入口存在但难找：小助手浮层右上角**无文字**小图标（`src/components/ChildSafetyAssistant.vue:14`）→「连接火山方舟」面板的「模型 / 推理接入点 ID」（`:178-179`），打开面板会回填当前值（`:485`）；③「应用设置」（`src/components/AppSettings.vue`）只有应用标题 / Logo / 顶部背景三节，**无任何 AI 配置**（`:32 / 67 / 93`），全前端仅 `ChildSafetyAssistant.vue:453` 一处写这份配置；④ 改模型**即时生效**，不用重启（每条消息现读配置：`ai/assistant-service.js:91`）。
- 判据：配置入口必须出现在用户自然会找的位置（应用设置），且助手内入口要有文字标签——不再靠猜。
- 授权口径：用户 2026-10-14 选择「A+B 一起做」。
- 边界：不做模型下拉候选（选项 C 未选）；不动 IPC / preload（通道已齐：`child-safety:get-status` / `save-config` / `clear-api-key`，`preload.js:53-59`）；不改 AI 主进程逻辑。
- 已知约束（写实现前必须遵守）：`saveConfig` 只在 `apiKey` 为非空字符串时写入（`ai/secure-vault.js:197`）+ preload 把缺省归一为 `''`（`preload.js:6-8`）⇒ 只传 `modelId` 不会误清 API Key；模型格式校验的单一事实源在主进程 `validateModelId`（`MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/`，`:5`、`:29-35`），前端只做非空、错误原文照显。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**状态行**：🔄 设计完成（用户 2026-10-14 回「开始」批准）

- 本批条目（覆盖）：**A** 应用设置新增「🤖 儿童安全小助手」节（管理员可改模型 / 推理接入点 ID；API Key 只看状态与清除、**不回显**）；**B** 助手内配置入口显性化（图标按钮加文字「配置」）。
- 机制设计：
  · **数据流**：`AppSettings.vue` 在管理员密码通过后（沿用既有 `isAuthenticated` 门，不开新门）并行调 `window.electronAPI.childSafetyAssistant.getStatus()` 回填 `modelId` / `hasApiKey` / `secureStorageAvailable`；保存时先做非空前置校验，再 `updateAppConfig()`，随后 `childSafetyAssistant.saveConfig({ modelId })`（**只传 modelId**：preload 把缺省 apiKey 归一为 `''`，vault 仅在非空字符串时写 Key ⇒ 不会误清，`ai/secure-vault.js:197`、`preload.js:6-8`）。
  · **校验单一事实源**：格式校验留在主进程 `validateModelId`（`MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/`，`ai/secure-vault.js:5/29-35`），前端只做非空，错误原文照显（`result.error.message`）。
  · **清除 Key**：`clearApiKey()` + `window.confirm` 二次确认，成功后回填 `hasApiKey=false`；不改助手内已有的「重新填写 Key」通路。
  · **B 的最小改动**：`ChildSafetyAssistant.vue` 头部按钮由「仅图标」改为「图标 + 文字『配置』」，保留 `title` / `aria-label`；不改 `openSettings()` 行为。
  · **零新增通道**：`child-safety:get-status` / `save-config` / `clear-api-key` 已在 `preload.js:53-59` 暴露，主进程 AI 模块一行不改。
- 受影响文件与行数（实测）：`src/components/AppSettings.vue`（607 行 → 预计 +85）、`src/components/ChildSafetyAssistant.vue`（1368 行 → 预计 +2）、`docs/user-manual.md`（若手册需要写入口位置，作为文档面后补——见下）。
- 验收对照：① 密码进设置可见该节、模型回填默认 `deepseek-v4-flash-ga-260731`、Key 状态正确；② 改模型保存 → 助手面板打开时回填新值，发消息即用新模型（`ai/assistant-service.js:91` 每条消息现读配置）；③ 空模型 → 前置校验拦下、不写入任何一侧；④ 非法格式 → 主进程错误原文展示；⑤ 只改模型后 `hasApiKey` 仍为真；⑥ 助手头部出现「配置」二字；⑦ `npm test` 全绿。
- 关键决策：① 不引入模型候选下拉（用户未选 C）；② 保存沿用既有「保存设置」按钮，不新增独立保存钮（一次点击保存全部，避免两套保存语义）；③ 不用 IPC 新增通道。
- 上抛项：是否随本批出 1.0.5 安装包以到现场 —— 用户答复「交付时再定」，交付时再问。
- 最近先例：同批前例 `docs/batches/2026-10-14-activation-key-generation-guard.md`（同一 UI 层次：激活页/生成器页加提示行，沿用既有样式类与既有点击处理，不新增通道）；应用设置节的先例＝本文件既有三节（`AppSettings.vue:32/67/93`：`.form-section` + `.section-title` + `.form-group` + `.hint`），本批第 4 节沿用同一形状。偏离：新增了一个「只读状态 + 危险操作（清除 Key）」组合，既有三节没有这种形态——理由是 Key 不能回显，只能用状态 + 清除表达。

### 收口归一化（2026-10-14）

| # | 改动 | 来源 | 落地坐标 | 文档归口 |
|---|---|---|---|---|
| 1 | 应用设置新增「🤖 儿童安全小助手」节：模型 / 推理接入点 ID 输入（回填当前值）、API Key 状态胶囊、清除 Key（二次确认）、两行说明；`loadAssistantStatus()` / `clearAssistantKey()`；`saveSettings()` 改为「非空前置校验 → 存应用配置 → **只传 modelId** → 未配 Key 时提示」；`settings-desc` 文案与样式 | 用户选择 A | `src/components/AppSettings.vue:5`、`:116-163`、`:209-256`、`:273`、`:361-419`、`:601-676` | README「使用」第 2 条（入口指清，`README.md:222`）；`AGENTS.md:71` 补「覆盖入口」一句 |
| 2 | 助手头部配置入口由「仅图标」改为「图标 + 文字『配置』」（新增 `icon-button--labeled`） | 用户选择 B | `src/components/ChildSafetyAssistant.vue:14-17`、`:663-673` | 同上一行两处；用户手册仍走「去配置」通路（见下） |
| 3 | 回归断言 4 组（只改模型不动 Key ×2、非法模型被拒、被拒后配置不损坏） | 防「误清 Key」 | `tests/child-safety-assistant.test.js:219-247` | 测试文件内注释；本档 §5 |
| 4 | 版本 1.0.4 → 1.0.5 + NSIS 安装包 | 用户「出包并提交」 | `package.json:3`；`dist\特教安全教育资源仪 Setup 1.0.5.exe`（169.2MB） | README 版本历史补 v1.0.5 行（`README.md:244`） |
| 5 | 提交 `5485065` + 推送 origin/main | 用户「提交」「推送」 | git：`5485065` = 远端 `refs/heads/main` | 无需文档面 |

**文档 ↔ 实现一致性核对结论**：
- README「使用」节原写「设置中填入火山方舟 API Key」未指清位置 ⇒ 已改为两条入口分述（应用设置节 / 助手面板「配置」）。
- `AGENTS.md` 原写「界面自动预填、用户可覆盖」但没说在哪里覆盖 ⇒ 已补两处入口。
- `docs/user-manual.md` 覆盖小助手配置流程（7.3「去配置」→ 填 Key）：该通路未变，手册描述仍成立；本次新增的**管理员入口**（应用设置节）手册未提——属新增能力、非矛盾 ⇒ 记入 §6 遗留交用户决定（手册 `:3` 仍写「适用版本：1.0.3」，与上一批同一件事：Word/PDF 交付件未重生成）。
- 单一来源核对：小助手配置机制的唯一权威描述仍在 `docs/planning/2026-07-23-child-safety-assistant-plan.md`（4.1 固定配置：渲染层只可提交 API Key 与模型 ID、主进程做长度与白名单校验）；本批只加 UI 入口，机制未变，故该文档不动。

### 评审整改（round 1 发现项处置 · 2026-10-14）

**① 最近先例（规范行 · 补 🔴）**
- 先例坐标（实现 ∥ 设计档 ∥ 批次）：`src/components/AppSettings.vue` 既有三节——`:32` 应用标题 / `:67` 应用Logo / `:93` 顶部背景，形状 = `.form-section` + `.section-title` + `.form-group` + `.hint` ∥ 该页无独立设计档，其形态约定见 `docs/handoff/2026-08-13-user-manual.md`「界面专有名词与 UI 一致」∥ 本仓最近批次 `docs/batches/2026-10-14-activation-key-generation-guard.md`（同属「加提示行、沿用既有样式类、不新增通道」的 UI 批次）。
- 对齐：第 4 节沿用同形状与同类名；保存沿用同页既有单按钮 `saveSettings` 与 `save-message` 提示位；状态数据取自既有窄 API `childSafetyAssistant.getStatus()`，不新增 IPC 通道。
- 有意偏离（显式命名先例 + 说明既有形态为何不适用）：新增「只读状态胶囊（已配置 / 未配置）+ 危险操作（清除 API Key）」组合——既有三节全是「可写输入 + 保存」，**没有**「不可回显的密文 + 清除」形态；偏离理由＝API Key 的安全约束（`docs/planning/2026-07-23-child-safety-assistant-plan.md` 4.1「窄边界」：渲染层永远读不到明文 Key），该字段只能用「状态 + 清除」表达，不能照抄输入框形态。
- 无先例声明：本仓库无「组件分拆」先例（一页一组件、节内联是既有惯例），故本批不做分拆（见下 ②）。

**② 受影响文件规模对账与处置（补 🔴）**
- 实测（vs 本批基线 `701f7d6`）：`src/components/AppSettings.vue` 607 行 → **810 行（+212 / −10）**；§2 原预估「+85」偏低，低估项＝新增样式块（约 76 行）、`saveSettings` 重排（约 +40）、状态与清除逻辑（约 +50）、模板节（约 +48）逐项叠加。`ChildSafetyAssistant.vue` 1368 → **1380 行（+13 / −1）**；`tests/child-safety-assistant.test.js` 435 → **464 行（+29）**。
- 越线处置（**明确接受并附理由**）：810 行确实越过「可分拆审视」尺度，但**同尺度组件在本项目是常态**（实测 `ChildSafetyAssistant.vue` 1380 行、`LearningDashboard.vue` 744 行、`ActivationDialog.vue` 727 行），而本批拆分会把「新增一节」升级成跨文件重构、扩大回归面；故**选择保持现状**，并把分拆作为独立技术债登记：台账新增技术待办（标题「AppSettings.vue 810 行：四节可拆为子组件」，触发＝认账不排期）。

## §3 设计评审（评审子代理）

### 轮次 1（评审子代理）

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Affected-file size annotations | 🔴 | The design document states "src/components/AppSettings.vue（607 行 → 预计 +85）" at line docs/batches/2026-10-14-assistant-config-entry.md:29. Implementation record states the file now has 810 lines (line docs/batches/2026-10-14-assistant-config-entry.md:68 coordinates cite `:601-676` as new styles, and grep result shows total 810 lines). Actual delta = 810 - 607 = +203 lines, exceeding the estimated +85 by +118 lines. The design did not anticipate this magnitude and did not flag the file crossing the >500-line proactive-split-review tier or provide a split plan. | Re-verify the current line count. If the file now exceeds 500 lines (it does: 810 lines), document the overage and either: (a) provide a split plan before implementation proceeds further, or (b) explicitly accept the structure as-is with a rationale (e.g., "split deferred to next refactor batch"). The design should have annotated this risk. |
| 2 | Closest-precedent check | 🔴 | The design document contains no **closest-precedent line** (precedent coordinates + alignment ∥ deviation rationale). Line docs/batches/2026-10-14-assistant-config-entry.md:33 mentions "最近先例" as prose, listing `docs/batches/2026-10-14-activation-key-generation-guard.md` and existing sections in `AppSettings.vue`, but this is not structured as a formal precedent line with explicit deviation rationale where required. The design does state a deviation ("新增了一个「只读状态 + 危险操作（清除 Key）」组合，既有三节没有这种形态") and provides a reason ("理由是 Key 不能回显，只能用状态 + 清除表达"), but the format is embedded in prose rather than a dedicated precedent declaration line. | Add a formal **closest-precedent line** in the required format: precedent coordinates (implementation ∥ design-doc section ∥ batches) + alignment statement ∥ deviation rationale (explicit: names surveyed precedent + states why existing form does not apply). For this design: "Closest precedent = AppSettings.vue existing three sections (`:32/67/93` `.form-section` + `.section-title` + `.form-group`) ∥ Deviation: introduces read-only status indicator + destructive action (clear Key) combination not present in existing sections ∥ Rationale: API Key must not be echoed (security constraint), only status display + clear operation can express the state". |

**Findings count**: 2 total — 2 🔴 Critical, 0 🟡 Advisory, 0 🔵 Note

VERDICT: changes-required

## §4 用户批准（主 agent）

**状态行**：✅ 已批准（2026-10-14 · 收口）

- 用户原话：提问「AI助手有个问题，是不是内置的模型名称已经写死了，还有就是配置之后没有地方修改」→ 我给出 A/B/C/D 选项 → 用户选「A+B 一起做（我推荐）」；实现前用户原话「开始」批准设计；出件阶段原话「出包并提交」「推送」；收口原话「收口」。
- 覆盖范围（**我方解读，非用户原话**）：§2 条目 1–5 全部落地，含 1.0.5 安装包出件、提交与推送。
- 未获用户指令的两件事，明确不在本批：用户手册 Word/PDF 是否随 1.0.5 重出；「清除 API Key」在有 Key 机器上的补点（建议项，非批准项）。

## §5 实施记录（实施者：主 agent ∥ coder）

**状态行**：实施完成

### 改动清单（文件 · 改动 · 坐标）

| 文件 | 改动 | 坐标 |
|---|---|---|
| `src/components/AppSettings.vue` | 新增第 4 节「🤖 儿童安全小助手」：模型 / 推理接入点 ID 输入框（回填当前值）、API Key 状态胶囊（已配置 / 未配置）、「清除已保存的 API Key」按钮（二次确认）、两行说明；`loadAssistantStatus()`（密码通过后拉 `getStatus()`）；`clearAssistantKey()`；`saveSettings()` 改为「非空前置校验 → 存应用配置 → **只传 modelId** 存小助手 → 未配 Key 时提示」；`settings-desc` 文案同步；新增样式 `.assistant-key-row` / `.key-status` / `.clear-key-btn` / `.key-warn` / `.assistant-message` | `:5`、`:116-163`、`:209-256`、`:273`、`:361-419`、`:601-676` |
| `src/components/ChildSafetyAssistant.vue` | 头部配置按钮由「仅图标」改为「图标 + 文字『配置』」（新增 `icon-button--labeled` 修饰类 + 样式），`title` / `aria-label` 不变 | `:14-17`、`:663-673` |
| `tests/child-safety-assistant.test.js` | 在「未配置时预置默认模型接入点 ID，用户可覆盖」用例内补 4 组断言：只传空 `apiKey` 改模型 ⇒ Key 保留；省略 `apiKey` 字段改模型 ⇒ Key 保留；空模型与中文模型被拒（`invalid_model`）；被拒后模型与 Key 均未被破坏 | `:219-247` |

### 验证（命令 → 结果）
- `npm run build`（vite build）→ ✅ 28 modules transformed，无报错（SFC 模板/脚本编译通过）。
- `npm test` → ✅ **30 tests / 30 pass / 0 fail / 0 skipped**（新断言在同一用例内，用例数不变、断言数 +11）。
- 改动 JS 文件 `node --check` / edit 工具语法检查 → ✅。
- **真机走查（真实 Electron 应用，CDP 驱动；只截应用窗口内容，不截桌面）**：
  · 环境：`npm run dev`（vite 5173）+ `npx electron . --remote-debugging-port=9222`；走查脚本放 `%TEMP%`，跑完已删。
  · 路径与结果：学习中心 → ⚙️ 应用设置 → 管理员密码 `299451` → 通过；随后
    ① 节标题序列 = 应用标题 / 应用Logo / 顶部背景 / **🤖 儿童安全小助手**（第 4 节，在保存按钮之前）；
    ② 模型输入框回填 `deepseek-v4-flash-ga-260731`（预置默认），占位符与助手面板一致；
    ③ Key 状态显示「未配置」、清除按钮 `disabled=true`（本机无 Key，语义正确）；
    ④ 清空模型 → 保存 → 提示「保存失败：请填写小助手的模型 / 推理接入点 ID」（`.save-message.error`），**未写入任何一侧**；
    ⑤ 填回模型 → 保存 → 页面按既有逻辑刷新；重进设置回读模型值一致（store 往返成立）；
    ⑥ 助手面板头部按钮实测渲染为「配置」(text) + 「配置方舟」(title/aria)，点击打开配置面板。
  · 截图证据：`%TEMP%\sped-ui-10-assistant-section-view.png`（设置页新节）、`%TEMP%\sped-ui-6-assistant-panel.png`（助手头部「配置」）。

### 未完成 / 未验证（如实登记）
- 未在真机点「清除已保存的 API Key」走通全流程：dev 环境本机无 Key，按钮为禁用态。该路径由代码链（`clearApiKey()` → `hasApiKey` 回填）与既有测试覆盖；交付后可在有 Key 的机器上复点一次。
- 未出安装包：本批改的是客户端界面，要到现场需重新打包 1.0.5（用户答复「交付时再定」，交付时再问）。

### 独立评审（代码）与处置
- 评审结论：**pass**（1 🔵，无 🔴）。
- 🔵 处置：**Not an issue**（技术反驳，带证据）。评审意见：文档称「apiKey 经 preload 归一为空串」，而实现是完全省略 `apiKey` 字段 ⇒ 认为 preload 归一不成立、文档失真。实测反证：`preload.js:55-58` `saveConfig: (input = {}) => ipcRenderer.invoke('child-safety:save-config', { apiKey: stringValue(input.apiKey), modelId: stringValue(input.modelId) })`、`preload.js:6-8` `stringValue(value) { return typeof value === 'string' ? value : ''; }` —— 渲染层省略 `apiKey` 时 `stringValue(undefined) === ''`，**preload 确实归一为空串**；主进程 `ai/ipc.js:57-60` 收到字符串 `''` 后透传，`ai/secure-vault.js:197` 仅在非空字符串时写 Key。⇒ 生产路径与文档、测试注释描述一致，按评审建议改写会让文档失真。

### 打包出件（1.0.5）
- `package.json` 版本 1.0.4 → 1.0.5；`npm run electron:build` → `dist\特教安全教育资源仪 Setup 1.0.5.exe` **169.2MB**（版本资源 FileVersion / ProductVersion = 1.0.5），`dist\latest.yml` version 1.0.5。
- 产物自检（asar 原文检索）：含「模型 / 推理接入点 ID」（设置页新节）、「清除已保存的 API Key」、「icon-button--labeled」（助手头部「配置」文字按钮）；上一批的 `getPublicKeyFingerprint` 仍在；包内公钥指纹 `165B8EEC45416A27` 未变（激活码代际不受影响）。
- 打包按 electron-builder 惯例清掉了旧的 `Setup 1.0.4.exe` 与旧 `latest.yml`。
- 用户指示口径：2026-10-14「出包并提交」——本轮交付含提交动作。

## §6 验证与收口（父代理）

**状态行**：已收口（2026-10-14）

### 验收测试行
- 命令：`npm test`（`node --test tests/child-safety-assistant.test.js tests/license-generator.test.js tests/activation-keys.test.js`）
- 结果：**30 tests / 30 pass / 0 fail / 0 skipped**（实施后两次一致）；`npm run build` 28 modules 无报错
- 真机走查：真实 Electron 应用内 6 项全过（设置页新节渲染 / 默认模型回填 / 空模型拦截且不写入 / 保存后 store 往返一致 / 助手头部「配置」文字按钮）；截图证据见 §5
- 产物核对：`dist\特教安全教育资源仪 Setup 1.0.5.exe`（169.2MB，版本资源 1.0.5）；asar 内含本批界面与上一批的指纹函数；**包内公钥指纹 `165B8EEC45416A27` 未变**（不影响已激活机器与已签发激活码）
- 独立评审：代码评审 **pass**（1 🔵 已技术反驳留证）；收口设计评审 round 1 **changes-required**（2 🔴：规模预估失准未处置、先例未成规范行）→ 整改 → round 2 **pass**（2 🔴 全 Fixed，host 复核 7/7 引用与文件现状一致，无新发现）

### 收口记录
- 台账 #2（本批需求）→ 已核销。
- 本批产出：功能 A（应用设置小助手节）+ B（助手入口加文字）、回归断言 4 组、安装包 1.0.5、提交 `5485065`（已推 `origin/main`）。
- 台账新增技术待办 #3：`AppSettings.vue` 810 行、四节可拆子组件（触发＝认账不排期）——本批规模越线的处置载体。
- 记录冻结：本档随 close 冻结，此后零改写；有改动另开新批。

### 遗留 / 移交用户决定
1. **用户手册未随 1.0.5 重出**：`docs/user-manual.md:3` 仍写「适用版本：1.0.3」；其覆盖的小助手配置流程走「去配置」通路（未变），本批新增的**管理员入口**（应用设置节）手册未提——Word/PDF 交付件是否重出由用户定。
2. 「清除已保存的 API Key」未在有 Key 的机器上真机点过（本机 dev 无 Key，按钮为禁用态）；代码链与既有测试覆盖，建议现场点一次。
3. 收口归一化产生的两处文档改动（`README.md` 版本历史 v1.0.5、`AGENTS.md` 配置入口一句）**尚未提交**——属对外动作，待用户确认后补一笔。
