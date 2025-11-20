const fs = require('fs');
const path = require('path');

// vdat目录路径
const vdatDir = path.join(__dirname, 'src', 'assets', 'out_mp4');

console.log('📂 开始批量改名...');
console.log('目录:', vdatDir);
console.log('');

try {
    // 读取目录下所有文件
    const files = fs.readdirSync(vdatDir);

    let successCount = 0;
    let skipCount = 0;

    files.forEach(file => {
        if (file.endsWith('.mp4')) {
            const oldPath = path.join(vdatDir, file);
            const newName = file.replace('.mp4', '.mdat');
            const newPath = path.join(vdatDir, newName);

            try {
                fs.renameSync(oldPath, newPath);
                console.log(`✅ ${file} → ${newName}`);
                successCount++;
            } catch (err) {
                console.error(`❌ 改名失败: ${file}`, err.message);
            }
        } else if (file.endsWith('.mdat')) {
            console.log(`⏭️  跳过(已是.mdat): ${file}`);
            skipCount++;
        }
    });

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 批量改名完成！`);
    console.log(`✅ 成功: ${successCount} 个文件`);
    console.log(`⏭️  跳过: ${skipCount} 个文件`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

} catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
}
