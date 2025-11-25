# 激活码生成工具 - 完整使用指南

## 📋 概述

本工具提供两种版本的激活码生成器，可独立生成特教安全教育资源仪的激活码：

1. **GUI版本** (`license_generator_gui.py`) - 推荐用于日常使用
   - 图形化界面，易于操作
   - 一键生成激活码
   - 复制到剪贴板
   - 历史记录管理
   
2. **命令行版本** (`license_generator_cli.py`) - 支持自动化脚本

## 🔧 环境要求

### 最小需求
- Python 3.8 或更高版本
- 私钥文件 (`.keys/private.pem`)

### Python 依赖
```bash
pip install -r requirements-gui.txt
```

## 🚀 快速开始

### 方式1：GUI版本（推荐）

#### a) 直接运行 Python 脚本
```bash
pip install -r requirements-gui.txt
python license_generator_gui.py
```

#### b) 打包为 .exe（推荐分发）

**在 Windows 上：**

```bash
# 双击运行打包脚本
build-gui.bat
```

**手动打包步骤：**

```bash
# 1. 安装依赖
pip install PyQt5 cryptography pyperclip pyinstaller

# 2. 创建虚拟环境（可选）
python -m venv venv
venv\Scripts\activate

# 3. 打包为 EXE
pyinstaller --onefile --windowed --name "激活码生成工具" ^
    --icon=icons/icon.ico ^
    license_generator_gui.py

# 输出文件：dist\激活码生成工具.exe
```

### 方式2：命令行版本

#### 生成试用码
```bash
python license_generator_cli.py --trial
```

#### 生成正式激活码（365天）
```bash
python license_generator_cli.py --machine ABC123DEF456 --days 365
```

#### 生成永久激活码
```bash
python license_generator_cli.py --machine ABC123DEF456 --permanent
```

#### 指定私钥文件
```bash
python license_generator_cli.py --machine ABC123DEF456 --days 365 --key /path/to/private.pem
```

## 🎯 GUI版本功能详解

### 标签页1：激活码生成

#### 激活码类型
- **试用码（7天）**：不需要输入机器码，自动有效期7天
- **正式码（限期）**：需要输入机器码，可自定义有效期
- **永久码**：需要输入机器码，永久有效

#### 机器码输入
- 从目标机器的"激活界面"复制机器码
- 粘贴到文本框中
- 支持大小写，会自动转换为大写

#### 有效期设置
- 范围：1-3650 天
- 实时显示过期日期
- 永久码时不需要此选项

#### 生成激活码
- 点击"🔑 生成激活码"按钮
- 激活码显示在下方的文本框中

#### 激活码操作
- **📋 复制激活码**：复制纯激活码到剪贴板
- **📋 复制完整信息**：复制包括类型、有效期等全部信息
- **💾 保存为文件**：保存激活码信息到本地文本文件

### 标签页2：生成历史

- 显示所有已生成的激活码记录
- 包含：类型、机器码、有效期、生成时间、激活码
- 支持表格排序和导出
- **🔄 刷新**：重新加载历史记录
- **🗑️ 清空历史**：删除所有历史记录

### 标签页3：设置

#### 私钥管理
- 显示当前使用的私钥文件路径
- 支持选择不同的私钥文件
- 显示私钥加载状态（✅ 成功 / ❌ 失败）

#### 关于
- 应用信息和版本
- 加密方式说明
- 安全提醒

## 🔐 安全说明

### 私钥管理
- **重要**：私钥文件 (`.keys/private.pem`) 必须妥善保管
- 不要将私钥上传到公开仓库
- 不要分享私钥给其他人
- 建议存储在安全的位置（如USB驱动器或密码保护的文件夹）

### 激活码加密
- **RSA-2048** 非对称加密
- **SHA-256** 哈希算法
- **Base64** 编码格式
- 激活码与机器硬件信息绑定

## 📝 使用场景

### 场景1：生成试用码分发给新用户
```bash
python license_generator_cli.py --trial
# 或直接运行 GUI，选择"试用码（7天）"
```

### 场景2：为已购买的机器生成激活码
```bash
# 获取用户的机器码（从应用界面复制）
# 生成1年有效的激活码
python license_generator_cli.py --machine USER_MACHINE_ID --days 365
```

### 场景3：生成永久激活码
```bash
python license_generator_cli.py --machine USER_MACHINE_ID --permanent
```

### 场景4：批量生成激活码（脚本）

创建 `batch_generate.py`：

```python
from license_generator_cli import LicenseGenerator
from pathlib import Path

# 加载私钥
key_path = Path('.keys/private.pem')
with open(key_path, 'r') as f:
    private_key_pem = f.read()

generator = LicenseGenerator(private_key_pem)

# 机器码列表
machines = [
    'MACHINE001',
    'MACHINE002',
    'MACHINE003'
]

# 批量生成
for machine_id in machines:
    license_data = generator.generate_full_license(machine_id, days=365)
    encrypted = generator.encrypt_license_data(license_data)
    formatted = generator.format_license_key(encrypted)
    
    print(f"{machine_id}: {formatted}")
```

## 🐛 故障排除

### 问题1：找不到私钥文件
**错误信息**：`私钥文件不存在: .keys/private.pem`

**解决方案**：
- 确保私钥文件位置正确
- 在 GUI 中使用"📁 选择文件"按钮选择正确的私钥文件
- 或使用 `--key` 参数指定私钥路径

### 问题2：加载私钥失败
**错误信息**：`加载私钥失败: ...`

**解决方案**：
- 确保私钥文件格式正确（PEM格式）
- 检查文件编码是否为 UTF-8
- 尝试从 JavaScript 版本重新导出私钥

### 问题3：GUI 无法启动
**错误信息**：`ModuleNotFoundError: No module named 'PyQt5'`

**解决方案**：
```bash
pip install PyQt5 cryptography pyperclip
```

### 问题4：复制到剪贴板不工作
**错误信息**：`ModuleNotFoundError: No module named 'pyperclip'`

**解决方案**：
```bash
pip install pyperclip
```

## 📊 文件结构

```
项目目录
├── license_generator_gui.py      # GUI版本（推荐）
├── license_generator_cli.py      # 命令行版本
├── requirements-gui.txt          # Python依赖
├── build-gui.bat                # 打包脚本（Windows）
├── .keys/
│   ├── private.pem              # 私钥（需要保管）
│   └── public.pem               # 公钥
└── LICENSE_GENERATOR_GUIDE.md   # 本文件
```

## 🔄 与 JavaScript 版本的对比

| 功能 | JavaScript版本 | Python-GUI版本 | Python-CLI版本 |
|------|-----------|-----------|-----------|
| 图形界面 | ❌ | ✅ | ❌ |
| 命令行 | ✅ | ❌ | ✅ |
| 历史记录 | ❌ | ✅ | ❌ |
| 独立 .exe | ❌ | ✅ | ❌ |
| 剪贴板复制 | ❌ | ✅ | ❌ |
| 加密兼容性 | ✅ | ✅ | ✅ |

## 💡 最佳实践

1. **定期备份私钥**：定期备份 `.keys/private.pem` 到安全位置
2. **版本控制**：不要将 `.keys/private.pem` 提交到 Git
3. **使用 GUI 分发**：打包为 .exe 分发给公司技术员，避免要求他们安装 Python
4. **记录激活信息**：保存生成的激活码日志，便于跟踪
5. **定期更新**：关注安全更新，定期升级 Python 依赖库

## 📞 技术支持

如遇到问题，请检查：
1. Python 版本是否 >= 3.8
2. 所有依赖是否已安装
3. 私钥文件是否存在且格式正确
4. 激活码是否与应用程序兼容

## 📄 许可证

与特教安全教育资源仪主程序使用相同的许可证。
