/**
 * 资源安装器构建脚本
 *
 * 方案: NSIS 引导器 + 7za.exe 内嵌 + resources.7z 追加到 exe 尾部
 *
 * 最终 exe 结构: [NSIS 引导器(含 7za.exe)] + [resources.7z]
 * 7za 能自动识别 exe 尾部的 7z 数据并解压
 *
 * 用法: npm run pack:resources
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── 配置 ──────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const TEMPLATE = path.join(__dirname, 'resource-installer.nsi');
const OUTPUT_DIR = path.join(ROOT, 'dist');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `特教安全教育资源包 Setup ${VERSION}.exe`);
const ICON_FILE = path.join(ROOT, 'icons', 'icon.ico');

const VDAT_SRC = path.join(ROOT, 'src', 'assets', 'vdat');
const H5DAT_SRC = path.join(ROOT, 'src', 'assets', 'h5dat');

const MAKENSIS = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NSIS', 'makensis.exe');
const SEVEN_ZIP = path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe');
const SEVEN_ZA = path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7za.exe');

// ─── 工具函数 ───────────────────────────────────────────
function log(msg) { console.log(`[pack:resources] ${msg}`); }
function checkPath(p, label) {
  if (!fs.existsSync(p)) { log(`错误: ${label} 不存在: ${p}`); process.exit(1); }
}
function countFiles(dirPath) {
  let count = 0, size = 0;
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else { count++; try { size += fs.statSync(f).size; } catch (_) {} }
    }
  }
  walk(dirPath);
  return { count, size };
}

// ─── 主流程 ─────────────────────────────────────────────
function main() {
  log(`版本: ${VERSION}`);

  // 1. 前置检查
  checkPath(VDAT_SRC, 'vdat 目录');
  checkPath(H5DAT_SRC, 'h5dat 目录');
  checkPath(ICON_FILE, '图标');
  checkPath(TEMPLATE, 'NSIS 模板');
  checkPath(MAKENSIS, 'makensis');
  // 7za.exe 或 7z.exe 至少有一个
  const has7za = fs.existsSync(SEVEN_ZA);
  const has7z = fs.existsSync(SEVEN_ZIP);
  if (!has7za && !has7z) {
    log('错误: 找不到 7za.exe 或 7z.exe');
    process.exit(1);
  }
  const sevenZip = has7za ? SEVEN_ZA : SEVEN_ZIP;
  log(`使用 7-Zip: ${sevenZip}`);

  try {
    const ver = execSync(`"${MAKENSIS}" /VERSION`, { encoding: 'utf8' }).trim();
    log(`NSIS 版本: ${ver}`);
  } catch (e) {
    log(`错误: 找不到 makensis (${MAKENSIS})`);
    process.exit(1);
  }

  // 2. 统计
  const vdatInfo = countFiles(VDAT_SRC);
  const h5datInfo = countFiles(H5DAT_SRC);
  log(`视频: ${vdatInfo.count} 文件 (${(vdatInfo.size / 1024 / 1024).toFixed(0)} MB)`);
  log(`H5课件: ${h5datInfo.count} 文件 (${(h5datInfo.size / 1024 / 1024).toFixed(0)} MB)`);
  log(`合计: ${vdatInfo.count + h5datInfo.count} 文件 (${((vdatInfo.size + h5datInfo.size) / 1024 / 1024).toFixed(0)} MB)`);

  // 3. 准备临时目录
  const tmpDir = path.join(OUTPUT_DIR, '.resource-staging');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  // 4. 创建 staging 目录结构（junction link），使 7z 内路径为 assets/vdat, assets/h5dat
  const stagingAssets = path.join(tmpDir, 'assets');
  fs.mkdirSync(stagingAssets, { recursive: true });
  execSync(`mklink /J "${stagingAssets}\\vdat" "${VDAT_SRC}"`, { stdio: 'pipe' });
  execSync(`mklink /J "${stagingAssets}\\h5dat" "${H5DAT_SRC}"`, { stdio: 'pipe' });
  log('临时目录已创建');

  // 5. 压缩为 7z
  const tmpArchive = path.join(tmpDir, 'resources.7z');
  log('正在压缩资源文件...');
  execSync(
    `"${sevenZip}" a -t7z -mx=5 -m0=lzma2 "${tmpArchive}" "assets\\vdat" "assets\\h5dat"`,
    { cwd: tmpDir, stdio: 'inherit', maxBuffer: 50 * 1024 * 1024 }
  );
  const archiveMB = (fs.statSync(tmpArchive).size / 1024 / 1024).toFixed(0);
  log(`压缩包: ${archiveMB} MB`);

  // 6. 生成 NSIS 脚本
  //    嵌入 7za.exe（使用 7za.exe 自身，约 1.5MB）
  const embedded7za = has7za ? SEVEN_ZA : SEVEN_ZIP;
  let nsiContent = fs.readFileSync(TEMPLATE, 'utf8');
  nsiContent = nsiContent
    .replaceAll('__VERSION__', VERSION)
    .replaceAll('__OUTPUT_FILE__', path.resolve(path.join(tmpDir, 'installer.exe')))
    .replaceAll('__NSIS_ICON__', path.resolve(ICON_FILE))
    .replaceAll('__7ZA_EXE__', path.resolve(embedded7za));

  const tmpNsi = path.join(tmpDir, 'installer.nsi');
  fs.writeFileSync(tmpNsi, '\uFEFF' + nsiContent, 'utf8');
  log('NSIS 脚本已生成');

  // 7. 编译 NSIS 引导器
  log('编译 NSIS 引导器...');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  execSync(`"${MAKENSIS}" /V2 "${tmpNsi}"`, {
    stdio: 'inherit',
    maxBuffer: 10 * 1024 * 1024,
  });

  const nsisExe = path.join(tmpDir, 'installer.exe');
  checkPath(nsisExe, 'NSIS 引导器');
  log(`引导器: ${(fs.statSync(nsisExe).size / 1024).toFixed(0)} KB`);

  // 8. 合并: NSIS 引导器 + resources.7z → 最终安装器
  log('正在合并引导器和资源包...');
  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  const parts = [nsisExe, tmpArchive];

  let partIndex = 0;
  function concatNext() {
    if (partIndex >= parts.length) {
      writeStream.end(() => {
        // 9. 清理
        fs.rmSync(tmpDir, { recursive: true, force: true });

        const resultMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(0);
        log('─'.repeat(50));
        log(`安装器已生成: ${OUTPUT_FILE}`);
        log(`安装器大小: ${resultMB} MB`);
        log('');
        log('使用方法:');
        log(`  1. 先安装主程序「特教安全教育资源仪 Setup ${VERSION}.exe」`);
        log(`  2. 运行「特教安全教育资源包 Setup ${VERSION}.exe」`);
        log('  3. 自动检测安装路径，点击安装即可');
        log('完成!');
      });
      return;
    }
    const rs = fs.createReadStream(parts[partIndex++]);
    rs.pipe(writeStream, { end: false });
    rs.on('end', concatNext);
    rs.on('error', (e) => { log(`合并失败: ${e.message}`); process.exit(1); });
  }
  concatNext();
}

main();
