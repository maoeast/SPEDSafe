/**
 * H5资源保护脚本
 * 功能：
 * 1. 将所有二级目录中的 index.html 重命名为 index.hdat
 * 2. 将 html 目录重命名为 h5dat
 * 3. 更新 resources.json 中的路径引用
 */

const fs = require('fs');
const path = require('path');

// 配置
const assetsDir = path.join(__dirname, 'src/assets');
const htmlDir = path.join(assetsDir, 'html');
const h5datDir = path.join(assetsDir, 'h5dat');
const resourcesJsonPath = path.join(__dirname, 'src/resources.json');

console.log('🔐 开始H5资源保护流程...\n');

// 步骤1: 重命名所有 index.html 为 index.hdat
function renameHtmlFiles() {
    if (!fs.existsSync(htmlDir)) {
        console.log('⚠️  html 目录不存在，跳过重命名');
        return 0;
    }

    console.log('📝 步骤1: 重命名 index.html → index.hdat');

    const subDirs = fs.readdirSync(htmlDir);
    let count = 0;

    subDirs.forEach(subDir => {
        const subDirPath = path.join(htmlDir, subDir);

        if (fs.statSync(subDirPath).isDirectory()) {
            const htmlFile = path.join(subDirPath, 'index.html');
            const hdatFile = path.join(subDirPath, 'index.hdat');

            if (fs.existsSync(htmlFile)) {
                fs.renameSync(htmlFile, hdatFile);
                console.log(`  ✅ ${subDir}/index.html → index.hdat`);
                count++;
            }
        }
    });

    console.log(`📊 共重命名 ${count} 个文件
`);
    return count;
}

// 步骤2: 重命名 html 目录为 h5dat（手动操作）
function renameDirectory() {
    console.log('📝 步骤2: 重命名目录 html → h5dat');
    console.log('  ⚠️  请手动将 src/assets/html 目录重命名为 h5dat\n');
    return true;
}

// 步骤3: 更新 resources.json
function updateResourcesJson() {
    console.log('📝 步骤3: 更新 resources.json');

    if (!fs.existsSync(resourcesJsonPath)) {
        console.log('❌ resources.json 不存在');
        return 0;
    }

    const content = fs.readFileSync(resourcesJsonPath, 'utf8');
    const resources = JSON.parse(content);

    let updateCount = 0;

    // resources 是数组格式，直接遍历
    resources.forEach(resource => {
        if (resource.type === 'h5' && resource.filePath) {
            const oldPath = resource.filePath;

            // 替换路径：/assets/html/ → /assets/h5dat/
            let newPath = oldPath.replace('/assets/html/', '/assets/h5dat/');

            // 替换扩展名：.html → .hdat
            newPath = newPath.replace('/index.html', '/index.hdat');

            if (newPath !== oldPath) {
                resource.filePath = newPath;
                console.log(`  ✅ ${resource.title}: ${oldPath} → ${newPath}`);
                updateCount++;
            }
        }
    });

    // 保存更新后的 JSON
    fs.writeFileSync(
        resourcesJsonPath,
        JSON.stringify(resources, null, 2),
        'utf8'
    );

    console.log(`📊 共更新 ${updateCount} 条路径\n`);
    return updateCount;
}

// 执行所有步骤
try {
    const fileCount = renameHtmlFiles();
    const dirRenamed = renameDirectory();
    const pathCount = updateResourcesJson();

    console.log('✅ H5资源保护完成！');
    console.log(`📊 统计：`);
    console.log(`   - 重命名文件: ${fileCount} 个`);
    console.log(`   - 重命名目录: ${dirRenamed ? '成功' : '跳过'}`);
    console.log(`   - 更新路径: ${pathCount} 条`);

} catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
}
