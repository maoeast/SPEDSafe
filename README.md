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

## 🛠️ 技术栈

### 前端框架
- **Electron** 23.3.13 - 桌面应用框架
- **Vue 3** 3.5.24 - 响应式前端框架（Composition API）
- **Vite** 5.0 - 构建工具

### 数据存储
- **electron-store** 8.0.0 - 本地数据持久化

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
│   │   └── LearningDashboard.vue  # 学习中心仪表盘
│   ├── main.js                # Vue 应用入口
│   └── resources.json         # 资源配置文件
├── main.js                     # Electron 主进程
├── preload.js                  # 预加载脚本（IPC 桥接）
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

**最后更新**：2025-11-19
**版本**：1.0.0
