/**
 * 截图工具：启动应用并驱动真实 UI，为《用户操作手册》抓取界面截图。
 *
 * 用法：node scripts/capture-screenshots.js
 * 输出：docs/manual-images/*.png
 *
 * 原理：以开发模式启动 vite + Electron（--remote-debugging-port），
 * 通过 CDP（Node 内置 WebSocket）驱动页面交互并截图。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'manual-images');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const ELECTRON_EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DEBUG_PORT = 9222;
const DEV_URL = 'http://localhost:5173';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(400);
  }
  throw new Error(`等待 ${url} 超时`);
}

/** 极简 CDP 客户端（Node 24 内置 WebSocket） */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket 连接失败: ' + url));
    });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const page = { cdp: null };
let viteProc = null;
let electronProc = null;

async function evalJs(expression) {
  const r = await page.cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error('页面脚本异常: ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200));
  }
  return r.result.value;
}

async function waitFor(expression, timeoutMs = 30000, label = expression) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evalJs(expression)) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`等待条件超时: ${label}`);
}

async function clickExpr(expr) {
  const ok = await evalJs(`(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('未找到可点击元素: ' + expr);
}

/** 截图：name 为文件名；clip 为 {x,y,width,height}（CSS 像素，按 dsf 缩放） */
async function shot(name, clip) {
  const params = { format: 'png', fromSurface: true };
  if (clip) params.clip = { ...clip, scale: 2 };
  const r = await page.cdp.send('Page.captureScreenshot', params);
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('📸', name, (fs.statSync(file).size / 1024).toFixed(0) + 'KB');
}

/** 按选择器取元素在视口内的矩形（含 10px 边距），用于裁剪截图 */
async function rectOf(selector) {
  const r = await evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pad = 12;
    return {
      x: Math.max(0, rect.left - pad),
      y: Math.max(0, rect.top - pad),
      width: Math.min(rect.width + pad * 2, window.innerWidth - Math.max(0, rect.left - pad)),
      height: Math.min(rect.height + pad * 2, window.innerHeight - Math.max(0, rect.top - pad)),
    };
  })()`);
  if (!r) throw new Error('未找到元素区域: ' + selector);
  return r;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // 1. 启动 vite（若 5173 已被占用则复用）
  try {
    await waitHttp(DEV_URL, 2000);
    console.log('vite 已在运行，复用');
  } catch {
    viteProc = spawn(process.execPath, [VITE_BIN], { cwd: ROOT, stdio: 'ignore' });
    await waitHttp(DEV_URL, 60000);
    console.log('vite 已启动');
  }

  // 2. 启动 Electron（远程调试端口）
  electronProc = spawn(ELECTRON_EXE, ['.', `--remote-debugging-port=${DEBUG_PORT}`], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  await waitHttp(`http://127.0.0.1:${DEBUG_PORT}/json/list`, 60000);

  // 3. 浏览器级连接：关闭自动打开的 DevTools，找到应用页面 target
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
  if (!pageTarget) throw new Error('未找到应用页面 target: ' + JSON.stringify(targets.map((t) => t.url)));
  const browserWs = new WebSocket((await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json()).webSocketDebuggerUrl);
  await new Promise((res, rej) => { browserWs.onopen = res; browserWs.onerror = rej; });
  const devtoolsTarget = targets.find((t) => t.url.startsWith('devtools://'));
  if (devtoolsTarget) {
    browserWs.send(JSON.stringify({ id: 1, method: 'Target.closeTarget', params: { targetId: devtoolsTarget.id } }));
    console.log('已关闭 DevTools');
  }
  browserWs.close();

  // 4. 页面级连接
  page.cdp = await CDP.connect(pageTarget.webSocketDebuggerUrl);
  await page.cdp.send('Page.enable');
  await page.cdp.send('Runtime.enable');
  // 放大视口与分辨率，让截图更清晰（不影响真实应用行为）
  await page.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // ===== 首页 =====
  await waitFor(`document.querySelectorAll('.resource-card').length > 0`, 60000, '资源卡片加载');
  await sleep(2500); // 等待封面图加载
  await shot('01-主界面.png');

  const headerRect = await rectOf('.app-header');
  await shot('02-顶部标题栏.png', headerRect);

  const cardRect = await rectOf('.resource-card');
  await shot('03-资源卡片.png', cardRect);

  // ===== 视频播放（第 2 张卡：资源 1「安全如厕」的视频文件缺失，跳过）=====
  // 已知问题：src/assets/vdat/anquanruce.mdat 文件缺失（resources.json 213 个视频仅 212 个文件），
  // 且 CDP 抓取视频帧在此环境不稳定——此步失败不阻断后续截图；视频播放截图由人工补充。
  try {
    await clickExpr(`document.querySelectorAll('.resource-card')[1]`);
    await waitFor(
      `(() => { const v = document.querySelector('video'); return v && v.readyState >= 2; })()`,
      30000,
      '视频就绪'
    );
  await sleep(1200);
  // 鼠标悬停以显示播放控制条
  await page.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 800,
    y: 880,
  });
  await sleep(600);
  await shot('04-视频播放.png');
  await clickExpr(`document.querySelector('.back-button')`);
  await waitFor(`document.querySelectorAll('.resource-card').length > 0`, 20000, '返回首页');
  } catch (err) {
    console.warn('⚠️ 跳过视频截图（由人工补充）:', err.message);
    // 若已进入播放页，先返回首页，避免影响后续步骤
    await evalJs(`document.querySelector('.back-button')?.click()`);
    await waitFor(`document.querySelectorAll('.resource-card').length > 0`, 20000, '返回首页');
  }

  // ===== H5 课件（切到「安全互动」分类）=====
  await evalJs(
    `[...document.querySelectorAll('.category-btn')].find(b => b.textContent.includes('安全互动')).click()`
  );
  await waitFor(`document.querySelectorAll('.resource-card .type-badge.h5').length > 0`, 20000, 'H5 卡片');
  await clickExpr(
    `[...document.querySelectorAll('.resource-card')].find(c => c.querySelector('.type-badge.h5'))`
  );
  await waitFor(`document.querySelector('.h5-iframe')`, 20000, 'H5 iframe');
  await sleep(4000); // 等待课件内部资源加载
  await shot('05-H5课件.png');
  await clickExpr(`document.querySelector('.back-button')`);
  await waitFor(`document.querySelectorAll('.resource-card').length > 0`, 20000, '返回首页');

  // ===== 学习中心 =====
  await clickExpr(`document.querySelector('.learning-center-btn')`);
  await waitFor(`document.querySelector('.stats-cards')`, 20000, '学习中心统计');
  await sleep(800);
  await shot('06-学习中心统计.png');

  const statsRect = await rectOf('.stats-cards');
  await shot('07-统计卡片.png', statsRect);

  const overviewRect = await rectOf('.learning-overview');
  await shot('08-最近学习与学习进度.png', overviewRect);

  // 滚动到底部：成就徽章 + 操作按钮
  await evalJs(`(() => { const el = document.querySelector('.dashboard-view'); el.scrollTop = el.scrollHeight; })()`);
  await sleep(500);
  await shot('09-成就徽章.png');
  const achievementRect = await rectOf('.achievement-section');
  await shot('10-成就区域.png', achievementRect);

  // ===== 应用设置（管理员密码）=====
  await evalJs(`(() => { const el = document.querySelector('.dashboard-view'); el.scrollTop = 0; })()`);
  await sleep(300);
  await clickExpr(`document.querySelector('.settings-btn')`);
  await waitFor(`document.querySelector('.password-box')`, 20000, '密码验证框');
  await sleep(600);
  await shot('11-设置密码验证.png');
  await clickExpr(`document.querySelector('.settings-modal .close-btn')`);
  await waitFor(`!document.querySelector('.settings-modal')`, 20000, '关闭设置弹窗');

  // ===== 儿童安全小助手（入口在首页顶栏，先返回首页）=====
  await clickExpr(`document.querySelector('.dashboard-back-btn')`);
  await waitFor(`document.querySelector('.assistant-entry-btn')`, 20000, '返回首页');
  await clickExpr(`document.querySelector('.assistant-entry-btn')`);
  await waitFor(`document.querySelector('.assistant-panel')`, 20000, '小助手面板');
  await sleep(1200);
  await shot('12-小助手.png');

  console.log('✅ 全部截图完成 →', OUT);
}

main()
  .catch((err) => {
    console.error('❌ 截图失败:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      electronProc?.kill();
      viteProc?.kill();
    } catch {}
    page.cdp?.ws?.close();
  });
