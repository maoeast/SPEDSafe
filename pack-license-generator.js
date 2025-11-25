/**
 * 激活码生成器打包脚本
 * 将生成器打包成独立工具，可分发给技术员使用
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const OUTPUT_DIR = path.join(__dirname, 'license-generator-dist');
const ZIP_FILE = path.join(__dirname, 'license-generator.zip');

console.log('📦 正在打包激活码生成器...\n');

// 1. 创建输出目录
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 2. 复制必要文件
const filesToCopy = [
    { src: 'generate-license.js', dest: 'generate-license.js' },
    { src: 'package.json', dest: 'package.json' }
];

console.log('📋 复制文件：');
filesToCopy.forEach(({ src, dest }) => {
    const srcPath = path.join(__dirname, src);
    const destPath = path.join(OUTPUT_DIR, dest);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`   ✅ ${src}`);
    } else {
        console.log(`   ⚠️  ${src} 不存在，跳过`);
    }
});

// 3. 复制密钥文件夹（如果存在）
const keyDir = path.join(__dirname, '.keys');
if (fs.existsSync(keyDir)) {
    const destKeyDir = path.join(OUTPUT_DIR, '.keys');
    fs.mkdirSync(destKeyDir, { recursive: true });

    const keyFiles = fs.readdirSync(keyDir);
    keyFiles.forEach(file => {
        fs.copyFileSync(
            path.join(keyDir, file),
            path.join(destKeyDir, file)
        );
    });
    console.log('   ✅ .keys/ (密钥文件夹)');
} else {
    console.log('   ⚠️  .keys/ 不存在，首次使用时会自动生成');
}

// 4. 创建使用说明
const readme = `# 特教安全教育资源仪 - 激活码生成器

## 📦 工具说明

此工具用于为客户生成激活码，支持生成试用码和正式授权码。

## 🚀 使用前准备

### 1. 安装 Node.js
- 下载地址：https://nodejs.org/
- 推荐版本：v16 或更高版本
- 安装后验证：在命令行输入 \`node -v\` 查看版本

### 2. 安装依赖（首次使用）
打开命令行（CMD 或 PowerShell），进入本目录，执行：
\`\`\`
npm install
\`\`\`

## 📖 使用方法

### 方式1：生成试用码（7天）
\`\`\`
node generate-license.js --trial
\`\`\`
- 不绑定机器，任何人都可使用
- 自动生成到 \`.txt\` 文件

### 方式2：生成正式激活码（绑定机器）

#### 生成有期限的激活码：
\`\`\`
node generate-license.js --machine <机器码> --days <天数>
\`\`\`

**示例**：生成365天（1年）授权
\`\`\`
node generate-license.js --machine ABC123DEF456 --days 365
\`\`\`

#### 生成永久激活码：
\`\`\`
node generate-license.js --machine <机器码> --permanent
\`\`\`

**示例**：
\`\`\`
node generate-license.js --machine ABC123DEF456 --permanent
\`\`\`

## 🔑 如何获取机器码？

1. 客户打开应用程序
2. 点击"激活"按钮
3. 在激活界面会显示"机器码"
4. 复制机器码发给技术员

## 📋 常用操作示例

### 示例1：为新客户生成1年授权
\`\`\`bash
# 1. 客户提供机器码：F5E8D9C2A1B3
# 2. 生成1年（365天）授权
node generate-license.js --machine F5E8D9C2A1B3 --days 365

# 3. 将生成的激活码发给客户
\`\`\`

### 示例2：为学校生成永久授权
\`\`\`bash
# 1. 学校提供机器码：X9Y8Z7W6V5U4
# 2. 生成永久授权
node generate-license.js --machine X9Y8Z7W6V5U4 --permanent

# 3. 将生成的激活码发给学校
\`\`\`

### 示例3：生成试用码用于演示
\`\`\`bash
# 直接生成，不需要机器码
node generate-license.js --trial

# 将生成的试用码提供给客户试用
\`\`\`

## ⚠️ 重要提示

1. **妥善保管 \`.keys\` 文件夹**
   - 包含私钥文件，千万不要泄露
   - 建议备份到安全位置
   - 如果丢失，之前生成的激活码将全部失效

2. **激活码特性**
   - 试用码：不绑定机器，7天有效期
   - 正式码：严格绑定机器硬件，换机器需重新生成
   - 永久码：永久有效，但仍然绑定机器

3. **生成记录**
   - 每次生成都会创建 \`.txt\` 文件
   - 文件名包含机器码和时间戳
   - 建议妥善保存这些记录

## 🆘 常见问题

### Q1：提示找不到 node 命令？
**A**：需要先安装 Node.js，下载地址：https://nodejs.org/

### Q2：提示找不到模块？
**A**：首次使用需要安装依赖，执行：\`npm install\`

### Q3：激活码太长，复制不便？
**A**：激活码会自动保存到 \`.txt\` 文件，可以直接发送文件给客户

### Q4：客户说激活码无效？
**A**：检查以下几点：
- 机器码是否正确（区分大小写）
- 激活码是否完整复制（包括 SPED- 前缀）
- 客户是否在正确的机器上使用

### Q5：如何批量生成激活码？
**A**：可以编写简单的批处理脚本，循环调用生成命令

## 📞 技术支持

如有问题，请联系技术支持部门。

---

**版本**：1.0.0  
**更新日期**：2025-11-24
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme, 'utf8');
console.log('   ✅ README.md (使用说明)');

// 5. 创建快捷批处理文件（Windows）
const generateTrialBat = `@echo off
chcp 65001 >nul
title 生成试用激活码
echo.
echo ========================================
echo   生成试用激活码 (7天有效期)
echo ========================================
echo.
node generate-license.js --trial
echo.
pause
`;

const generateFullBat = `@echo off
chcp 65001 >nul
title 生成正式激活码
echo.
echo ========================================
echo   生成正式激活码
echo ========================================
echo.
set /p machineId=请输入机器码: 
set /p days=请输入有效天数 (输入0表示永久): 
echo.

if "%days%"=="0" (
    node generate-license.js --machine %machineId% --permanent
) else (
    node generate-license.js --machine %machineId% --days %days%
)

echo.
pause
`;

fs.writeFileSync(path.join(OUTPUT_DIR, '1-生成试用码.bat'), generateTrialBat, 'utf8');
fs.writeFileSync(path.join(OUTPUT_DIR, '2-生成正式码.bat'), generateFullBat, 'utf8');
console.log('   ✅ 1-生成试用码.bat (快捷启动)');
console.log('   ✅ 2-生成正式码.bat (快捷启动)');

console.log('\n✅ 文件准备完成！');
console.log(`📂 输出目录: ${OUTPUT_DIR}\n`);

// 6. 创建 ZIP 压缩包
console.log('📦 正在创建压缩包...');

const output = fs.createWriteStream(ZIP_FILE);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`\n✅ 压缩包创建成功！`);
    console.log(`📦 文件: ${ZIP_FILE}`);
    console.log(`📊 大小: ${sizeInMB} MB`);
    console.log(`\n🎉 打包完成！可以将 ${path.basename(ZIP_FILE)} 分发给技术员了。\n`);
});

archive.on('error', (err) => {
    throw err;
});

archive.pipe(output);
archive.directory(OUTPUT_DIR, false);
archive.finalize();
