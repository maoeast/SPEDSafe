# 特教安全教育资源仪

一款基于 Electron + Vue 3 的桌面应用，专为特殊教育安全教学设计，提供视频和 H5 交互课件的播放与学习记录管理。

## 📋 项目概述

本项目是一个离线桌面应用程序，包含 221 个安全教育资源（193 个视频 + 28 个 H5 课件），涵盖七大安全教育分类。应用采用 `.mdat` 扩展名伪装视频文件，防止用户直接双击播放，确保通过应用统一管理和学习。

### 核心功能

- 🎬 **视频播放**：支持本地 `.mdat` 格式视频文件播放
- 📄 **H5 课件**：内嵌 H5 交互课件播放
- 📚 **学习中心**：记录学习历史、观看次数、学习时长、观看进度
- 🏆 **成就系统**：根据学习数据解锁成就徽章
- 🗂️ **资源分类**：七大安全主题分类浏览
- 🔒 **资源保护**：扩展名伪装防止直接访问
- 🔑 **激活系统**：试用期 + 离线激活，机器绑定防盗版

## 🛠️ 技术栈

### 前端框架
- **Electron** 23.3.13 - 桌面应用框架
- **Vue 3** 3.5.24 - 响应式前端框架（Composition API）
- **Vite** 5.0 - 构建工具

### 数据存储
- **electron-store** 8.0.0 - 本地数据持久化
- **node-machine-id** - 机器指纹识别
- **crypto-js** - AES 加密库

### 样式资源
- **Font Awesome** 6.5.1 (CDN) - 图标库

## 📁 项目结构

```
SPEDSafe/
├── icons/                      # 应用图标
│   ├── icon.png               # 窗口图标
│   └── logo.png               # 应用 Logo
├── src/
│   ├── assets/
│   │   ├── vdat/              # 视频资源文件夹（.mdat 格式）
│   │   └── h5dat/             # H5 课件资源文件夹
│   ├── components/
│   │   ├── Header.vue         # 主界面头部（Logo + 学习中心入口）
│   │   ├── CategoryNav.vue    # 分类导航栏
│   │   ├── ResourceGrid.vue   # 资源卡片网格
│   │   ├── Player.vue         # 视频/H5 播放器
│   │   ├── LearningDashboard.vue  # 学习中心仪表盘
│   │   └── ActivationDialog.vue   # 激活对话框
│   ├── main.js                # Vue 应用入口
│   └── resources.json         # 资源配置文件
├── main.js                     # Electron 主进程
├── preload.js                  # 预加载脚本（IPC 桥接）
├── license-manager.js          # 激活验证模块
├── generate-license.js         # 激活码生成器（Node.js 脚本）
├── public-key.pem              # RSA 公钥（客户端验证用）
├── .keys/                      # RSA 密钥对（私钥仅服务端保管）
│   ├── private.pem            # RSA 私钥（生成激活码）
│   └── public.pem             # RSA 公钥（原始文件）
├── index.html                  # HTML 模板
├── rename-to-mdat.js           # 批量改名脚本（MP4 → MDAT）（终端运行：node rename-to-mdat.js）
├── package.json                # 项目配置
└── vite.config.js              # Vite 配置

```

## 🎯 七大安全分类

| 分类 ID | 名称 | 图标 | 资源数量 |
|---------|------|------|----------|
| `school` | 校园安全 | 🏫 | 默认分类 |
| `home` | 居家安全 | 🏠 | - |
| `community` | 社区安全 | 🏘️ | - |
| `personal` | 个人安全 | 👤 | - |
| `drill` | 安全演习 | 🚨 | - |
| `course` | 安全课程 | 📖 | - |
| `soft` | 安全互动 | 🎮 | - |

## 🚀 快速开始

### 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器 + Electron
npm run electron
```

### 构建生产版本

```bash
# 构建前端资源
npm run build

# 打包 Electron 应用
npm run electron:build
```

## 📝 资源管理

### 资源配置文件（`src/resources.json`）

每个资源包含以下字段：

```json
{
  "id": "unique-id",           // 唯一标识符
  "title": "资源标题",          // 显示标题
  "description": "资源描述",    // 视频简介（仅视频）
  "type": "video",             // 类型：video | h5
  "category": "school",        // 分类 ID
  "filePath": "/assets/vdat/xxx.mdat",  // 文件路径
  "coverUrl": "/assets/covers/xxx.jpg"  // 封面缩略图
}
```

### 添加新资源

1. **视频资源**：
   - 将 MP4 文件重命名为 `.mdat` 扩展名
   - 放入 `src/assets/vdat/` 目录
   - 在 `resources.json` 中添加配置

2. **H5 课件**：
   - 将 H5 项目文件夹放入 `src/assets/h5dat/`
   - 在 `resources.json` 中添加配置，`filePath` 指向 `index.html`

### 批量重命名工具

使用 `rename-to-mdat.js` 批量将 MP4 文件改为 MDAT：

```bash
node rename-to-mdat.js
```

## 🔧 核心功能实现

### 1. 本地资源加载（`local://` 协议）

主进程注册自定义协议，支持加载本地资源：

```javascript
// main.js
protocol.registerFileProtocol('local', (request, callback) => {
  let filePath = decodeURIComponent(request.url.replace('local://', ''));
  
  // MDAT 文件识别为 MP4
  let mimeType;
  if (filePath.endsWith('.mdat')) {
    mimeType = 'video/mp4';
  }
  
  callback({ path: filePath, mimeType: mimeType });
});
```

### 2. 学习记录系统

使用 `electron-store` 存储学习数据：

**数据结构**：
```javascript
{
  records: {
    "resource-id": {
      resourceId: "resource-id",
      title: "资源标题",
      type: "video",
      category: "school",
      viewCount: 5,              // 观看次数
      totalDuration: 3600,       // 总学习时长（秒）
      lastProgress: 85,          // 最后观看进度（%）
      firstViewedAt: "2025-01-01T12:00:00Z",
      lastViewedAt: "2025-01-15T14:30:00Z"
    }
  },
  statistics: {
    totalViews: 100,            // 总观看次数
    totalLearningTime: 36000,   // 总学习时长
    lastActiveDate: "2025-01-15"
  }
}
```

**IPC 通信接口**：
- `save-learning-record` - 保存/更新学习记录
- `get-all-learning-records` - 获取所有记录
- `get-learning-statistics` - 获取统计数据
- `clear-learning-records` - 清空所有记录

### 3. 成就系统

根据学习数据自动解锁徽章：

| 成就 | 条件 |
|------|------|
| 🥇 初学者 | 观看 5 个资源 |
| 🥈 好学生 | 观看 20 个资源 |
| 🥉 学霸 | 观看 50 个资源 |
| ⏰ 十小时达人 | 累计学习 10 小时 |
| 🏫 分类小卫士 | 完成某分类 100% 资源 |

## 🎨 界面设计

### 配色方案

- **主题渐变**：`linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5ed 100%)`
  - 黄色 → 珊瑚橙 → 青绿色
- **返回按钮**：
  - 普通：`rgba(255, 255, 255, 0.9)`
  - 悬停：`rgba(255, 255, 255, 1)`
  - 点击：`#ffa726`（橙黄色）

### 组件样式特点

1. **Header**：渐变背景 + Logo + 学习中心入口
2. **CategoryNav**：七大分类按钮，默认选中"校园安全"
3. **ResourceGrid**：卡片式网格布局，显示观看次数
4. **Player**：极简设计，只保留返回按钮
5. **LearningDashboard**：统计卡片 + 最近学习 + 学习进度 + 成就徽章

## 🔐 安全特性

### CSP（内容安全策略）

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; 
  font-src 'self' https://cdnjs.cloudflare.com; 
  img-src 'self' data: file: local:; 
  media-src 'self' file: blob: local:; 
  frame-src 'self' file: local:; 
  connect-src 'self' http://localhost:* ws://localhost:*;
">
```

### 扩展名伪装

- 所有视频文件使用 `.mdat` 扩展名
- 防止用户绕过应用直接播放
- 应用内通过 MIME 类型映射正常播放

### 右键菜单禁用

```javascript
// 视频播放器
<video @contextmenu.prevent ... />
```

### 激活系统安全保护

- **RSA-2048 数字签名**：激活码使用私钥签名，公钥验证
- **AES-256 加密存储**：本地激活信息双重加密
- **HMAC-SHA256 防篡改**：签名校验防止激活数据被修改
- **机器硬件绑定**：激活码与机器码绑定，宽松模式允许 60% 硬件变更
- **离线激活**：纯离线方式，适合教育场景无网络环境

## 📊 数据流程

### 播放资源流程

```
用户点击资源卡片
  ↓
App.vue 接收资源ID/对象
  ↓
查找完整资源对象（如果是ID）
  ↓
设置 currentResource → Player.vue
  ↓
Player 加载视频/H5
  ↓
立即保存初始记录（观看次数+1）
  ↓
播放过程中追踪进度
  ↓
退出时更新学习时长和进度
```

### 学习记录流程

```
Player.vue
  ↓
window.electronAPI.saveLearningRecord()
  ↓
preload.js (IPC 桥接)
  ↓
main.js (ipcMain.handle)
  ↓
electron-store 持久化
  ↓
返回结果
  ↓
LearningDashboard 读取显示
```

## 🔑 激活系统架构

### 设计理念

本应用采用**试用期 + 离线激活**的双模式机制，适合教育场景的纯离线部署需求。激活码采用 RSA 数字签名 + AES 加密存储，确保安全性与防篡改。

### 核心模块

#### 1. 激活码生成器（`generate-license.js`）

**作用**：服务端工具，用于生成试用码和正式激活码

**功能**：
- 生成 RSA-2048 密钥对（首次运行）
- 生成试用激活码（7 天免费，不绑定机器）
- 生成正式激活码（绑定机器码，支持限时或永久）
- 使用 RSA 私钥对激活数据进行数字签名

**使用方法**：

```bash
# 生成试用码
node generate-license.js --trial

# 生成正式激活码（365天）
node generate-license.js --machine <机器码> --days 365

# 生成永久激活码
node generate-license.js --machine <机器码> --permanent
```

**关键代码片段**：

```javascript
// 数据结构（字段缩写以减少激活码长度）
const licenseData = {
    t: 'full',              // type: 激活类型（trial/full）
    v: '1.0',               // version: 版本号
    m: '067D30ECBD218C95',  // machineId: 机器码
    c: Date.now(),          // createdAt: 创建时间戳
    e: null,                // expireAt: 过期时间（null=永久）
    p: true                 // permanent: 是否永久
};

// RSA 签名流程
const dataBuffer = Buffer.from(JSON.stringify(licenseData), 'utf8');
const signature = crypto.sign('sha256', dataBuffer, {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
});

// 组合格式：[4字节数据长度] + [JSON数据] + [RSA签名]
const lengthBuffer = Buffer.allocUnsafe(4);
lengthBuffer.writeUInt32BE(dataBuffer.length, 0);
const combined = Buffer.concat([lengthBuffer, dataBuffer, signature]);

// Base64 编码后格式化
const base64 = combined.toString('base64');
const formatted = 'SPED-' + base64.match(/.{1,5}/g).join('-');
```

**激活码格式示例**：

```
SPED-AAAAU-XsidC-I6ImZ-1bGwi-LCJ2I-joiMS-4wIiw-ibSI6-IjA2N-0QzME-...
```

- 前缀：`SPED-`
- 分组：每 5 个字符用 `-` 分隔
- 长度：约 456 字符（包含签名）

#### 2. 激活验证模块（`license-manager.js`）

**作用**：客户端模块，验证激活码并管理激活状态

**核心功能**：

##### 机器指纹获取（宽松模式）

```javascript
function getMachineFingerprint() {
    // 使用 node-machine-id 获取稳定的机器ID（基于 CPU + 主板）
    const machineId = machineIdSync({ original: true });
    
    // SHA256 哈希后取前 16 位
    const hash = crypto.createHash('sha256');
    hash.update(machineId);
    return hash.digest('hex').substring(0, 16).toUpperCase();
    // 示例：067D30ECBD218C95
}
```

**宽松模式容忍度**：60%（允许更换内存等非核心硬件）

```javascript
function calculateSimilarity(code1, code2) {
    let matches = 0;
    const len = Math.min(code1.length, code2.length);
    for (let i = 0; i < len; i++) {
        if (code1[i] === code2[i]) matches++;
    }
    return matches / len; // >= 0.6 即通过验证
}
```

##### RSA 签名验证流程

```javascript
function decryptLicenseKey(licenseKey) {
    // 1. 反格式化：移除 SPED- 前缀和连字符
    const base64Data = licenseKey.replace(/^SPED-/i, '').replace(/-/g, '');
    
    // 2. Base64 解码
    const combined = Buffer.from(base64Data, 'base64');
    
    // 3. 读取前 4 字节获取数据长度
    const dataLength = combined.readUInt32BE(0);
    const dataBuffer = combined.slice(4, 4 + dataLength);
    const signature = combined.slice(4 + dataLength);
    
    // 4. 使用 RSA 公钥验证签名
    const isValid = crypto.verify('sha256', dataBuffer, {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, signature);
    
    if (!isValid) {
        throw new Error('激活码签名验证失败');
    }
    
    // 5. 解析 JSON 数据并转换字段
    const parsed = JSON.parse(dataBuffer.toString('utf8'));
    return {
        type: parsed.t,
        version: parsed.v,
        machineId: parsed.m,
        createdAt: parsed.c,
        expireAt: parsed.e,
        permanent: parsed.p
    };
}
```

##### AES 加密存储机制

激活成功后，使用 AES-256 加密存储到本地：

```javascript
function encryptActivationData(data) {
    // 1. AES 加密
    const jsonStr = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, AES_SECRET).toString();
    
    // 2. HMAC 签名防篡改
    const hmac = CryptoJS.HmacSHA256(encrypted, HMAC_SECRET).toString();
    
    return {
        data: encrypted,
        signature: hmac
    };
}
```

**存储位置**（使用 electron-store）：

```
Windows: C:\Users\<用户名>\AppData\Roaming\special-edu-safe\license-data.json
macOS: ~/Library/Application Support/special-edu-safe/license-data.json
Linux: ~/.config/special-edu-safe/license-data.json
```

**存储内容**（加密后）：

```json
{
  "activation": {
    "data": "U2FsdGVkX1...",  // AES 加密后的激活数据
    "signature": "a3f2e1..."  // HMAC-SHA256 签名
  },
  "firstRun": 1732089715408  // 试用期开始时间戳
}
```

##### HMAC 防篡改校验

每次读取激活数据时验证 HMAC 签名：

```javascript
function decryptActivationData(encryptedObj) {
    // 1. 验证 HMAC 签名
    const expectedHmac = CryptoJS.HmacSHA256(encryptedObj.data, HMAC_SECRET).toString();
    if (expectedHmac !== encryptedObj.signature) {
        console.error('激活数据已被篡改！');
        return null;
    }
    
    // 2. AES 解密
    const decrypted = CryptoJS.AES.decrypt(encryptedObj.data, AES_SECRET);
    const jsonStr = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(jsonStr);
}
```

#### 3. 试用期逻辑处理

**试用期管理**：

```javascript
function checkTrialStatus() {
    const firstRun = licenseStore.get('firstRun');
    const now = Date.now();
    
    if (!firstRun) {
        // 首次运行，记录开始时间
        licenseStore.set('firstRun', now);
        return {
            activated: false,
            type: 'trial',
            message: '欢迎使用！您有7天免费试用期',
            daysRemaining: 7
        };
    }
    
    const trialExpireAt = firstRun + 7 * 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((trialExpireAt - now) / (24 * 60 * 60 * 1000));
    
    if (now < trialExpireAt) {
        return {
            activated: false,
            type: 'trial',
            message: `试用期剩余 ${daysRemaining} 天`,
            daysRemaining: daysRemaining
        };
    } else {
        return {
            activated: false,
            type: 'trial_expired',
            message: '试用期已结束，请激活后继续使用',
            daysRemaining: 0
        };
    }
}
```

**应用启动时检查**：

```javascript
// App.vue - onMounted
const checkActivationStatus = async () => {
    const status = await window.electronAPI.getActivationStatus();
    activationStatus.value = status;
    
    // 未激活或试用期，显示激活对话框
    if (!status.activated) {
        setTimeout(() => {
            showActivationDialog.value = true;
        }, 500);
    }
};
```

**试用期内可跳过激活**：

```javascript
// ActivationDialog.vue
const canSkip = computed(() => {
    return props.activationStatus.type === 'trial' && 
           props.activationStatus.daysRemaining > 0;
});
```

### IPC 通信接口

```javascript
// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
    // 获取机器码
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    
    // 验证激活码
    verifyLicense: (licenseKey) => ipcRenderer.invoke('verify-license', licenseKey),
    
    // 获取激活状态
    getActivationStatus: () => ipcRenderer.invoke('get-activation-status')
});

// main.js
ipcMain.handle('get-machine-id', async () => {
    const machineId = licenseManager.getMachineFingerprint();
    return { success: true, machineId };
});

ipcMain.handle('verify-license', async (event, licenseKey) => {
    return licenseManager.verifyLicenseKey(licenseKey);
});

ipcMain.handle('get-activation-status', async () => {
    return licenseManager.getActivationStatus();
});
```

### 安全配置文件

**公钥文件**（`public-key.pem`）：

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

**密钥管理**：
- 私钥（`.keys/private.pem`）：仅服务端保管，用于生成激活码
- 公钥（`public-key.pem`）：打包到客户端，用于验证激活码

### 激活流程图

```
用户首次启动应用
  ↓
检查激活状态
  ↓
┌─────────────────┬─────────────────┬─────────────────┐
│  已激活且有效    │    试用期内     │   试用期已过期   │
├─────────────────┼─────────────────┼─────────────────┤
│  正常使用       │ 显示激活对话框   │ 显示激活对话框   │
│                │ （可跳过）       │ （不可跳过）     │
└─────────────────┴─────────────────┴─────────────────┘
                        ↓
                  用户输入激活码
                        ↓
              反格式化 → Base64解码
                        ↓
               分离数据和RSA签名
                        ↓
              ┌────────────────┐
              │  RSA公钥验证   │
              └────────────────┘
                ↓           ↓
              成功         失败
                ↓           ↓
          验证机器码     提示错误
          匹配度60%
                ↓
          检查过期时间
                ↓
        AES加密存储到本地
                ↓
          添加HMAC签名
                ↓
            激活成功
```

### 关键配置常量

```javascript
// license-manager.js
const AES_SECRET = 'SPED-SAFE-EDU-2025-SECRET-KEY';   // AES加密密钥
const HMAC_SECRET = 'SPED-SAFE-EDU-2025-HMAC-KEY';    // HMAC签名密钥
const TOLERANCE_LEVEL = 0.6;                           // 机器码相似度容忍度
const PUBLIC_KEY_PATH = path.join(__dirname, 'public-key.pem');

// generate-license.js
const RSA_KEY_SIZE = 2048;                             // RSA密钥长度
const LICENSE_VERSION = '1.0';                         // 激活码版本
const KEY_DIR = path.join(__dirname, '.keys');         // 密钥存储目录
```

### 开发维护建议

1. **密钥安全**：
   - 私钥（`.keys/private.pem`）不要提交到代码仓库
   - 添加 `.keys/` 到 `.gitignore`
   - 私钥仅用于服务端生成激活码

2. **激活码分发**：
   - 用户通过激活对话框获取机器码
   - 服务端使用 `generate-license.js` 生成对应激活码
   - 通过邮件或其他安全方式发送给用户

3. **测试重置**：
   ```javascript
   // 开发模式下可清空激活数据
   licenseStore.clear();
   ```

4. **日志调试**：
   - 验证过程会输出详细日志到控制台
   - 生产环境建议移除 `console.log`

5. **版本兼容**：
   - 激活码中包含 `version` 字段
   - 未来可实现版本检查逻辑

## 🐛 常见问题

### 1. 视频无法播放

**原因**：MIME 类型未正确设置

**解决**：检查 `main.js` 中 `local://` 协议的 MIME 类型映射

### 2. H5 课件底部白色

**原因**：iframe 默认背景为白色

**解决**：已在 `Player.vue` 中设置 `.h5-iframe { background: #000; }`

### 3. 学习记录不更新

**原因**：未调用刷新方法

**解决**：确保在返回主页/学习中心时调用对应组件的刷新方法

### 4. Font Awesome 图标不显示

**原因**：CDN 加载失败或 CSP 策略阻止

**解决**：检查网络连接和 CSP 配置中的 `style-src` 和 `font-src`

## 📦 打包配置

### electron-builder 配置（`package.json`）

```json
{
  "build": {
    "appId": "com.spedsafe.app",
    "productName": "特教安全教育资源仪",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*",
      "main.js",
      "preload.js"
    ],
    "win": {
      "target": "nsis",
      "icon": "icons/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### 打包注意事项

1. **资源文件**：确保 `src/assets/` 下的所有资源文件被正确打包
2. **路径处理**：生产环境使用绝对路径
3. **图标文件**：准备 Windows 的 `.ico` 格式图标

## 🔄 开发维护指南

### 添加新分类

1. 在 `App.vue` 的 `categories` 数组中添加新分类
2. 更新 `resources.json` 中的资源分类

### 修改界面配色

1. **主题色**：修改 `Header.vue` 和 `Player.vue` 中的渐变
2. **按钮色**：修改各组件中的 `:active` 状态背景色

### 调整成就系统

在 `LearningDashboard.vue` 的 `achievements` 计算属性中修改条件和徽章

### 更新 CSP 策略

如需引入新的外部资源，在 `index.html` 的 CSP meta 标签中添加白名单

## 📄 许可证

MIT License

## 👥 贡献者

- 开发团队：特教安全教育项目组
- 技术支持：Qoder AI Assistant

## 📞 联系方式

如有问题或建议，请联系项目维护团队。

---

**最后更新**：2025-11-20  
**版本**：1.0.0
