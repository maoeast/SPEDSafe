/**
 * H5资源保护脚本
 * 功能：
 * 1. 将 src/assets/html 目录重命名为 h5dat
 * 2. 批量将所有 index.html 重命名为 index.hdat
 * 3. 更新 resources.json 中的路径引用
 */

const fs = require('fs');
const path = require('path');

// 配置
const assetsDir = path.join(__dirname, 'src/assets');
const oldDirName = 'html';
const newDirName = 'h5dat';
const oldExtension = '.html';
const newExtension = '.hdat';
const resourcesJsonPath = path.join(__dirname, 'src/resources.json');

console.log('🔐 开始H5资源保护流程...\n');

// 步骤1: 将 html 目录复制为 h5dat，然后删除原目录
function renameHtmlDir() {
    const oldPath = path.join(assetsDir, oldDirName);
    const newPath = path.join(assetsDir, newDirName);

    if (!fs.existsSync(oldPath)) {
        console.log(`⚠️  ${oldDirName} 目录不存在，跳过重命名`);
        return;
    }

    if (fs.existsSync(newPath)) {
        console.log(`⚠️  ${newDirName} 目录已存在，跳过重命名`);
        return;
    }

    try {
        // 使用复制+删除的方式代替重命名
        console.log(`📂 正在复制目录: ${oldDirName} → ${newDirName}`);
        copyDirRecursive(oldPath, newPath);
        console.log(`✅ 目录复制成功`);
        console.log(`🗑️  删除原目录: ${oldDirName}`);
        deleteDirRecursive(oldPath);
        console.log(`✅ 目录重命名成功: ${oldDirName} → ${newDirName}`);
    } catch (error) {
        console.error('❌ 目录重命名失败:', error.message);
        process.exit(1);
    }
}

// 递归复制目录
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 递归删除目录
function deleteDirRecursive(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// 步骤2: 递归查找并重命名所有 index.html 为 index.hdat
function renameHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    let count = 0;

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 递归处理子目录
            count += renameHtmlFiles(fullPath);
        } else if (file.endsWith(oldExtension)) {
            // 重命名 HTML 文件
            const newFileName = file.replace(oldExtension, newExtension);
            const newPath = path.join(dir, newFileName);

            try {
                fs.renameSync(fullPath, newPath);
                console.log(`  ✓ ${path.relative(assetsDir, fullPath)} → ${newFileName}`);
                count++;
            } catch (error) {
                console.error(`  ✗ 重命名失败: ${file}`, error.message);
            }
        }
    });

    return count;
}

// 步骤3: 更新 resources.json 中的路径
function updateResourcesJson() {
    try {
        // 读取 resources.json
        const data = fs.readFileSync(resourcesJsonPath, 'utf-8');
        let resources = JSON.parse(data);
        let updateCount = 0;

        // 更新所有 H5 资源的路径
        resources.forEach(resource => {
            if (resource.type === 'h5' && resource.filePath) {
                // 替换目录名和扩展名
                const oldPath = resource.filePath;
                let newPath = oldPath.replace(`/assets/${oldDirName}/`, `/assets/${newDirName}/`);
                newPath = newPath.replace(oldExtension, newExtension);

                if (oldPath !== newPath) {
                    resource.filePath = newPath;
                    updateCount++;
                }
            }
        });

        // 写回文件
        fs.writeFileSync(resourcesJsonPath, JSON.stringify(resources, null, 2), 'utf-8');
        console.log(`\n✅ 更新 resources.json: ${updateCount} 条H5资源路径`);
    } catch (error) {
        console.error('❌ 更新 resources.json 失败:', error.message);
        process.exit(1);
    }
}

// 执行流程
try {
    // 步骤1: 重命名目录
    renameHtmlDir();

    // 步骤2: 重命名HTML文件
    const h5datPath = path.join(assetsDir, newDirName);
    if (fs.existsSync(h5datPath)) {
        console.log(`\n📝 正在重命名HTML文件...`);
        const renamedCount = renameHtmlFiles(h5datPath);
        console.log(`\n✅ 成功重命名 ${renamedCount} 个HTML文件`);
    }

    // 步骤3: 更新资源配置
    updateResourcesJson();

    console.log('\n🎉 H5资源保护完成！');
    console.log('\n📋 保护效果：');
    console.log('  • 目录名称伪装: html → h5dat');
    console.log('  • 文件扩展名伪装: .html → .hdat');
    console.log('  • 普通浏览器无法直接打开');
    console.log('  • 只能通过应用的 local:// 协议加载');

} catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    process.exit(1);
}
