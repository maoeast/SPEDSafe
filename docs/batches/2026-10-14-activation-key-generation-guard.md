# 2026-10-14 · 激活码密钥代际核对与防呆
> 六段 append-only，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 编制：主 agent · 2026-10-14 · 来源 = 用户报障：其他电脑安装 1.0.3 后导入激活码报「激活码无效或已损坏」（2026-10-14，G 盘两份激活码 + 现场安装包）。
> 台账 = #1（激活系统 · 归批）。前情 = 无（独立批）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-10-14
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

- 报障（2026-10-14）：其他电脑装 1.0.3 后导入激活码报「激活码无效或已损坏」；样例 `G:\特教安全教育仪\license_20261014_140149.txt`、`license_77CF7BF7_2026-10-14T05-40-19-057Z.lic`（机器码 `77CF7BF7BB54EEA0`，永久）。
- 定位结论（本地实测验签）：两份码用 G 盘 `.keys/public.pem`（指纹 `280BF3E63F772D59` = 轮换前 9d8500d 的公钥）验签**通过**，用打包产物 asar 内 `public-key.pem`（指纹 `165B8EEC45416A27` = 仓库 `.keys/private.pem` 同对）验签**失败** ⇒ 现场生成器仍是上一代私钥。报错点 `license-manager.js:242`（真正的「签名验证失败」被 181-184 行吞成日志）。
- 判据：① 代际不一致必须「一眼可见」，不能靠现场猜；② 「分发件私钥与客户端公钥不同代」必须被自动化测试拦住；③ 已激活机器不受影响（`getActivationStatus` 只查本地加密记录 + 机器码/有效期）。
- 授权口径：用户 2026-10-14 明确「一起做」= 计划 1（分发件换新）+ 计划 2（a 指纹显示 / b 配对回归测试 / c 指南补节 / d 报错细分）全做。
- 已交付先行动作：用当前私钥重签机器码 `77CF7BF7BB54EEA0` 的永久码（asar 内公钥实测通过），.lic 随本批落到 G 盘。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

**状态行**：🔄 设计完成（实施已落地，见 §5）

- 本批条目（覆盖）：
  1. **分发件换新**：把 `license-generator-dist/`（已含新代私钥）换到实施人员手上，旧的生成器/旧 `.keys` 就地封存；
  2. **防呆 a**：生成器页面显示「签发公钥指纹」，客户端激活页显示「本版本签发公钥指纹」，同一算法、可对表；
  3. **防呆 b**：把「同代」写成回归测试（新增 `tests/activation-keys.test.js`，挂进 `npm test`）；
  4. **防呆 c**：`LICENSE_GENERATOR_GUIDE.md` 补「密钥代际核对（轮换密钥后必做）」+ 故障排除「问题5」；
  5. **防呆 d**：客户端激活失败文案细分——签名代际不匹配与格式损坏分开报，并把本版本指纹写进提示。

- 机制设计：
  · **指纹唯一口径**：`SHA-256(公钥 SPKI DER)` 前 16 位十六进制大写（例 `165B8EEC45416A27`）。开发机手工复核：`openssl pkey -pubin -in public-key.pem -outform DER | openssl dgst -sha256` 取前 16 位。
  · **客户端侧**：`license-manager.js` 新增 `getPublicKeyFingerprint()`；`getActivationStatus()` 改为「计算函数 + 附指纹包装」，各分支（试用/过期/已激活/硬件变更）都带上 `publicKeyFingerprint`；`ActivationDialog.vue` 经既有 `activationStatus` prop 读取并显示——**不新增 IPC 通道、不动 preload 窄 API**。
  · **生成器侧**：浏览器只有 PKCS#8 私钥，WebCrypto 不提供「由私钥导公钥」，因此在页面内实现最小 DER 读取（PKCS#8 → RSAPrivateKey 的 n、e → 重建 SPKI DER）再 SHA-256；该段以 `// ===== BEGIN/END 公钥指纹算法 =====` 标记包裹，测试**直接抽取这一段执行**，与 Node 的 SPKI 导出逐字节比对——页面里跑的算法与断言对象是同一份代码，避免两侧漂移。
  · **报错细分**：`decryptLicenseKey` 由「失败返回 null」改为结构化失败 `{ok:false, reason:'environment'|'format'|'signature', message}`，`verifyLicenseKey` 分流文案；签名失败文案内含本版本公钥指纹。
  · **仓库侧守门**：测试断言 `.keys/private.pem` 与 `public-key.pem` 成对、私钥签发能被公钥验签、`license-generator-dist` 私钥与内嵌版 HTML 注入的私钥同代；`.keys` 缺失（新克隆）时自动跳过。

- 受影响文件与测试覆盖：`license-manager.js`、`license-generator.html`、`src/components/ActivationDialog.vue`、`tests/activation-keys.test.js`（新增）、`package.json`（test 脚本挂载）、`LICENSE_GENERATOR_GUIDE.md`、`AGENTS.md`、`license-generator-dist/`（重打包产物，git 忽略）。

- 验收对照：① `npm test` 全绿且新用例非跳过；② 生成器页面（浏览器实测）显示 `165B8EEC45416A27`，与客户端算法同值；③ 页面真签一张永久码，用**打包 exe 内公钥**验签通过；④ 「分发件私钥与 public-key.pem 不同代」时测试必须红（本批以仓库新代私钥实测通过，反例逻辑由断言文本保证）；⑤ 无新 IPC 通道与新运行时依赖。

- 关键决策：① 指纹取「公钥 SPKI」而非页面原有的「私钥 DER 后 8 位」——旧口径客户端算不出来，无法对表；② 指纹随 `getActivationStatus` 返回而非新通道；③ 客户端两处改动要重新打包安装包才到现场，本批只落源码，是否升版本重打包由用户定；④ 测试用「抽取页面代码执行」而非各写一份实现。

- 上抛项：**G 盘在执行过程中从系统消失**（当前仅 C/D/E/F，非网络盘）⇒ 条目 1 的「换到实施人员手上 + 旧件封存 + 写本机 .lic」无法执行，改为交付 `license-generator-dist/` + `license-generator.zip` 并请用户侧盘到位后拷贝（详见 §5）。

### 收口归一化（2026-10-14）

按「改动 → 来源 → 落地坐标 → 文档归口」逐条对账：

| # | 改动 | 来源 | 落地坐标 | 文档归口 |
|---|---|---|---|---|
| 1 | 客户端公钥指纹计算 | 防呆 a | `license-manager.js` `getPublicKeyFingerprint`（`:117`）；`getActivationStatus` 附值（`:329`） | `AGENTS.md:81`；`LICENSE_GENERATOR_GUIDE.md:170-201` |
| 2 | 激活失败文案细分 | 防呆 d | `license-manager.js` `decryptLicenseKey` 结构化失败（`:128-190`）、`verifyLicenseKey` 分流（`:274`） | 指南故障排除「问题5」（`:293-302`） |
| 3 | 激活页显示指纹 + 对表提示 | 防呆 a | `src/components/ActivationDialog.vue:33-37`、`:178`、`:572-580` | 用户手册自述不覆盖激活（`docs/user-manual.md:5`）⇒ 不需改；README 版本历史补 v1.0.4 |
| 4 | 生成器页面指纹 + 对表提示 | 防呆 a | `license-generator.html:416-482`（算法标记段）、`:250`（提示）、`:99-100`（样式）、`:327`（安全提示③） | 指南 :170-201 与 :293-302 |
| 5 | 代际回归测试 | 防呆 b | `tests/activation-keys.test.js`（8 例）、`package.json:9` | `AGENTS.md:94`；README 测试树 |
| 6 | 计划外修复（加载后按钮可用、历史表头不竖排） | 浏览器走查 | `license-generator.html:505`、`:517`、`:188` | 无独立文档面（分发件 UI 微调），记于 §5 |
| 7 | 分发件重打包 + G 盘换装 + 旧件封存 | 计划 1 | `license-generator-dist/`、`license-generator.zip`；`G:\特教安全教育仪\激活码生成器-新密钥\` 与 `_作废-旧密钥-请勿使用\` | 指南「轮换密钥后的分发纪律」（`:190-192`） |
| 8 | 版本 1.0.3 → 1.0.4 | 客户端改动到现场 | `package.json:3`；`dist\特教安全教育资源仪 Setup 1.0.4.exe` | README 版本历史 v1.0.4 行 |

**文档 ↔ 实现一致性核对结论**：
- README 版本历史补 v1.0.4；文件树里 `tests/` 由「单文件（11 项）」更正为三个测试文件。
- `docs/user-manual.md` 明确不涉及激活 ⇒ 激活页新增指纹行不影响它（不改）。
- README「密钥管理」保持「轮换使已签发码失效 + 指向指南」，机制细则单一来源留在 `LICENSE_GENERATOR_GUIDE.md`，不重复描述。
- `AGENTS.md`、指南、生成器页面、客户端激活页四处对「指纹口径」与「已激活机器不受影响」的表述已同一口径（前一评审批次 🟡 已修）。

### 评审整改（round 1 发现项处置 · 2026-10-14）

**① 最近先例（补 🔴 缺行）**
- 先例坐标：既有激活校验链 `license-manager.js`（引入提交 `9d8500d`）与生成器分发链 `license-generator.html` + `pack-license-generator.js`（分发纪律见 `LICENSE_GENERATOR_GUIDE.md`「私钥管理」）。本批沿用这两条链，不新造 IPC 通道、不新增运行时依赖。
- 对齐：指纹算法沿用既有 `crypto.createPublicKey(...).export({type:'spki',format:'der'})` + SHA-256 路径；激活页提示沿用 `.section-hint` 既有样式；生成器沿用 `.key-loaded` 状态徽标与 `updateGenerateState()` 既有刷新点。
- 有意偏离（各带理由）：⒜ 指纹口径由「私钥 DER 后 8 位」改为「公钥 SPKI 前 16 位」——旧口径客户端算不出、无法对表，而「可对表」正是本批目的；⒝ 报错由单一笼统文案改为结构化失败 + 分流文案——该笼统文案正是本次现场故障无法定位的直接原因；⒞ 报错细分不再吞异常（原实现在 catch 里返回 null）——同上。
- **无先例声明**：浏览器侧最小 DER 推导（PKCS#8 → n/e → SPKI）在本仓库**无先例**（原 `license-generator.html` 仅做 PEM→DER 解码）；被否的替代方案是把公钥随分发件下发、由页面读取——分发件属多文件复制场景，漏拷即静默失效，现方案只依赖私钥本身。

**② 受影响文件行数与增量（补 🟡 缺注）**

| 文件 | 当前行数 | vs 本轮基线（HEAD） |
|---|---|---|
| `license-manager.js` | 462 | +106 / −58 |
| `license-generator.html` | 817 | +86 / −8 |
| `src/components/ActivationDialog.vue` | 727 | +22 / −0 |
| `tests/activation-keys.test.js` | 199 | 新增 |
| `package.json` | 88 | +2 / −2 |
| `LICENSE_GENERATOR_GUIDE.md` | 347 | +42 / −0 |
| `AGENTS.md` | 112 | +4 / −1 |
| `README.md` | 247 | +5 / −1 |
| 本批次档 | 124（本轮补写前） | 新增 |

**③ 文档范围（处置 🟡）**
归一化表第 3 行涉及的 `docs/user-manual.md` 未在 round 1 评审范围内，收口方已取证核对：`:5`「软件激活由安装方负责，手册不涉及激活/许可相关内容」、`:45` 仅提示联系安装方 ⇒「手册不涉及激活、本批无需改」成立。另记一条**交用户决定**的漂移：手册 `:3` 仍写「适用版本：1.0.3」，而它记载的操作在 1.0.4 未变（激活页不在手册覆盖范围）；Word/PDF 交付件未重生成，故不擅改 md（改了会让 md 与已交付的 Word/PDF 分叉）。

**④ 计划外修复的授权链（补 🔵）**
走查发现 → 当轮修掉 → 交付报告逐条披露（含坐标）→ 用户回「收口」追认。本批属「交付即落地」，无独立设计评审环节。

## §3 设计评审（评审子代理）
## §4 用户批准（主 agent）

**状态行**：✅ 已批准（2026-10-14）

- 用户原话：「一起做」——回应我列出的计划 1（分发件换新）+ 计划 2 a–d（指纹显示 / 配对回归测试 / 指南补节 / 报错细分）。
- 范围即 §2 条目 1–5，批准后用户未追加新范围；本段只记用户已说出口的批准，不追改。

**状态行**：✅ 已批准（2026-10-14 · 收口）

- 用户原话：「收口」（2026-10-14 约 15:00）——批准本批收口。此前同一批的用户原话：「一起做」（批准计划 1 + 2a–2d）、「这台机器的激活码已经能用，G盘插好了，重新打包安装包」（指示 G 盘落地与出 1.0.4）。
- 覆盖范围（**我方解读，非用户原话**）：§2 条目 1–8 全部落地，含 §5 两处计划外修复（已在交付报告逐条披露并给坐标）；G 盘换装封存与 1.0.4 安装包按用户上一条指示执行。

## §5 实施记录（实施者：主 agent ∥ coder）

**状态行**：实施完成（激活页视觉确认未做（截桌面时抓到用户无关私人窗口内容，已止损并删图）；替代验证＝代码链（App.vue prop → ActivationDialog computed）+ 打包产物静态核对 + 端到端签码验签 30/30；建议用户装 1.0.4 后自行看一眼）

### 改动清单（文件 · 符号 · 坐标）
| 文件 | 改动 | 坐标 |
|---|---|---|
| `license-manager.js` | 新增 `getPublicKeyFingerprint()`（SPKI DER → sha256 → 前 16 位大写）；`decryptLicenseKey` 改结构化失败（`environment`/`format`/`signature`）并抽出 `SIGNATURE_LENGTH`、`FORMAT_ERROR_MESSAGE`；`verifyLicenseKey` 分流文案并回传 `reason`；`getActivationStatus` 拆为「计算 + 附指纹」；导出新函数 | `:117`、`:128-129`、`:135`、`:274`、`:329`、`:339`、`:455` |
| `license-generator.html` | 新增标记段「公钥指纹算法」（`derivePublicSpkiFromPkcs8` + DER 读写工具，供测试抽取执行）；`loadKeyFromText` 改算公钥指纹并显示；新增 `#fpHint` 对表提示与样式；安全提示③补轮换纪律；私钥加载/移除后调 `updateGenerateState()`；历史表头 `white-space: nowrap` | `:416-482`、`:250`、`:99-100`、`:188`、`:327`、`:505`、`:517` |
| `src/components/ActivationDialog.vue` | 激活页显示「本版本签发公钥指纹」+ 对表提示（`publicKeyFingerprint` computed + 两条样式） | `:33-37`、`:178`、`:572-580` |
| `tests/activation-keys.test.js` | 新增 8 例：页面算法 ↔ Node SPKI（RSA-2048 / RSA-1024）、`.keys` ↔ `public-key.pem` 配对、仓库钥端到端签名往返、页面指纹 = 客户端指纹、分发件私钥同代、内嵌版 HTML 注入私钥同代、失败文案源码级核对 | 新文件 |
| `package.json` | `test` 脚本挂 `tests/activation-keys.test.js` | `:9` |
| `LICENSE_GENERATOR_GUIDE.md` | 新增「密钥代际核对（轮换密钥后必做）」（口径 / 三处对表 / openssl 复核 / 轮换分发纪律）+ 故障排除「问题5」 | `:170-201`、`:293-302` |
| `AGENTS.md` | 激活系统节补「密钥代际核对」；关键路径补 `tests/activation-keys.test.js`、`license-manager.js` 注解 | `:81`、`:92-94` |
| `license-generator-dist/` + `license-generator.zip` | 重打包（新指纹显示 + 新代私钥 + 按钮/表头修复） | `npm run pack:license-generator` |

### 计划外改动（自行发现，已披露）
1. **生成器「生成激活码」按钮加载私钥后仍禁用**（浏览器走查时发现）：`updateGenerateState()` 原先只在初始化与类型/输入变更时调用。已在私钥加载、移除后各补一次调用（`:505`、`:517`）。
2. **历史表格表头被挤成竖排**：`.history-table th { white-space: nowrap }`（`:188`）。修复后实测表头高度 32.5px（单行）。

### 验证（命令 → 结果）
- `npm test` → 30 tests / 30 pass / 0 fail / 0 skipped（含新增 8 例；改动后与重打包后各跑一次，两次一致）。
- 浏览器真机走查（`python -m http.server` + `license-generator-dist/license-generator-embedded.html`，Edge/Chromium 无头）：
  · 页面显示「签发公钥指纹 165B8EEC45416A27」，与客户端 `getPublicKeyFingerprint` 同值；
  · 「永久码 + 机器码 `77CF7BF7BB54EEA0`」生成成功，元信息行显示「类型：正式版（永久）／机器码／创建 2026-10-14 14:36／到期：永久」；
  · 把页面产出的激活码回灌 Node，用**打包 exe 内 `public-key.pem`** 走客户端同一验签路径 → `true`（浏览器签 → 客户端公钥验的端到端闭环）。
- 语法：改动文件 `node --check` / edit 工具语法检查均 OK。

### 未完成 / 受阻（如实登记）
- **条目 1 的现场落地受阻**：执行中途 G 盘从系统消失——`G:/` 不存在；`wmic logicaldisk` 仅 C/D/E/F（均固定盘），`net use` 无连接；D/E/C 根目录亦无「特教安全教育仪」。因此以下三项**未执行**：
  ① 新分发件拷到 G 盘；② 旧 `.keys` / 旧 `license-generator.html` / 2025-11-25 的 `特教安全激活生成工具.exe` 封存；③ 机器码 `77CF7BF7BB54EEA0` 的 `.lic` / `.txt` 落到 G 盘。
  可交付物已就绪：仓库内 `license-generator-dist/`（内嵌私钥版 html + `.keys` + README + 两个 .bat）与 `license-generator.zip`；激活码已在对话中给出（当前私钥签发，打包 exe 内公钥实测通过）。
- **客户端两处改动需重新打包安装包才到现场**（激活页指纹显示、报错细分）：本批未升版本号、未出安装包——是否升版重打包待用户定。

### 追加（2026-10-14 14:45 后，用户「G 盘插好了，重新打包安装包」）

**G 盘落地（条目 1 补完）**
- `G:\特教安全教育仪\激活码生成器-新密钥\` ← 拷入 `license-generator-dist/`（内嵌私钥版 html + 新代 `.keys` + README + 两个 .bat）；实测私钥指纹 `165B8EEC45416A27`。
- `G:\特教安全教育仪\_作废-旧密钥-请勿使用\` ← 移入旧 `.keys`（指纹 `280BF3E63F772D59`）、旧 `license-generator.html`、`特教安全激活生成工具.exe`（2025-11-25）。
- `G:\特教安全教育仪\license_77CF7BF7_2026-10-14T06-25-37-431Z.lic` + 同名 `.txt`：机器码 `77CF7BF7BB54EEA0` 永久码，与对话中已交付的那张**同一载荷**（PKCS#1 v1.5 签名确定性 ⇒ 字节一致）；写盘后读回用客户端公钥验签通过。
- `G:\特教安全教育仪\密钥代际说明.txt`：现场版一页说明（发生了什么 / 用哪一个 / 签码前对表 / 本机激活文件）。

**安装包重打包（1.0.4）**
- `package.json` 1.0.3 → 1.0.4；`npm run electron:build` → `dist\特教安全教育资源仪 Setup 1.0.4.exe`（169.2MB，版本资源 FileVersion/ProductVersion = 1.0.4）。
- 首跑 makensis 报 `Can't open output file`（半截 386KB 产物、无进程占用、磁盘 241GB 可用）⇒ 判为写盘瞬间被占用/扫描的偶发失败；删除半截文件重跑即成功。
- 本次打包清掉了旧 `dist\特教安全教育资源仪 Setup 1.0.3.exe` 与旧 `latest.yml`（electron-builder 常规清理）；`electron-updater` 不在依赖里，`latest.yml` 惰性、不参与运行。
- 产物核对（asar 原文检索）：含 `function getPublicKeyFingerprint`、`reason: 'signature'`、「本版本签发公钥指纹」文案，旧笼统文案已消失；包内公钥指纹仍 `165B8EEC45416A27`（**公钥未变 ⇒ 今天签发的码在 1.0.3 与 1.0.4 上同样有效**）。

**未做的核对（如实登记）**
客户端激活页的**视觉确认未完成**：拉起打包应用后截桌面时抓到了用户桌面上的无关私人窗口内容，已立即停止该做法并删除两张临时截图（不再重试）。激活页显示逻辑由代码链（`App.vue` prop → `ActivationDialog` computed）与打包产物静态核对保证；建议用户装完 1.0.4 后自行看一眼激活页的指纹行。

## §6 验证与收口（父代理）

**状态行**：已收口（2026-10-14）

### 验收测试行
- 命令：`npm test`（`node --test tests/child-safety-assistant.test.js tests/license-generator.test.js tests/activation-keys.test.js`）
- 结果：**30 tests / 30 pass / 0 fail / 0 skipped**（改动后、重打包后、评审整改后各跑一次，三次一致）
- 端到端：打包后的生成器页面真签一张永久码（机器码 `77CF7BF7BB54EEA0`）→ 回灌 Node，用**打包 exe 内 `public-key.pem`** 走客户端同一验签路径 → `true`
- 独立评审：code 评审（pass，1🟡+6🔵 全处置）；收口设计评审（round 1 changes-required → 五项整改 → round 2 pass，无新 🔴）
- 交付件核对：`dist\特教安全教育资源仪 Setup 1.0.4.exe` 169.2MB、版本资源 1.0.4；asar 内含本批新代码；**包内公钥指纹 `165B8EEC45416A27` 未变**（⇒ 今天签发的码在 1.0.3 与 1.0.4 上同样有效）

### 收口记录
- 台账 #1（激活系统）→ 已核销。
- G 盘现场件：`激活码生成器-新密钥\`（私钥指纹已核 `165B8EEC45416A27`）、`_作废-旧密钥-请勿使用\`（旧钥 `280BF3E63F772D59` 及旧 html/exe）、`license_77CF7BF7_2026-10-14T06-25-37-431Z.lic`/`.txt`、`密钥代际说明.txt`——均已落盘，`.lic` 读回验签通过。
- 记录冻结：本档随 close 冻结，此后零改写；有改动另开新批。

### 遗留 / 移交用户决定
1. **客户端激活页视觉确认未做**（截图越界已止损）：替代验证＝代码链（`App.vue` prop → `ActivationDialog` computed）+ 打包产物静态核对；请装 1.0.4 后扫一眼指纹行。
2. `docs/user-manual.md:3` 仍写「适用版本：1.0.3」；其覆盖的操作在 1.0.4 未变，Word/PDF 交付件未重生成 ⇒ 是否随 1.0.4 重出手册由用户定。
3. 工作树未提交（8 个改动 + 2 个新增文件）；提交属对外动作，待用户单独确认。
4. 现场若仍有 2026-08-13 之前构建的安装包在运行：新代私钥签的码在它上面不通过，需升级到 1.0.4（已激活的机器不受影响）。
