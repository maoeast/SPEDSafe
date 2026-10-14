/**
 * 激活密钥代际核对测试
 *
 * 背景（2026-10-14 现场故障）：仓库激活签名密钥 2026-08-13 轮换（提交 d2f439c）后，
 * 实施人员手上的生成器仍是上一代私钥——签出的激活码被 1.0.3 客户端一律拒收
 * （旧文案「激活码无效或已损坏」）。本测试把「生成器与客户端同代」变成机器可验的断言：
 *
 * 1. 生成器 HTML 内嵌的「签发公钥指纹」算法与 Node 的 SPKI 导出逐字节一致（防两侧算法漂移）；
 * 2. .keys/private.pem 必须与 public-key.pem 成对（轮换只改一侧时立刻红）；
 * 3. 生成器页面对仓库私钥算出的指纹，必须等于客户端 public-key.pem 的指纹（现场对表依据）；
 * 4. 分发件（license-generator-dist 的私钥与内嵌版 HTML）必须与 public-key.pem 同代；
 * 5. 客户端失败文案必须区分「签名代际不匹配」与「格式损坏」（源码级核对，见文末说明）。
 *
 * 指纹定义（唯一口径）：SHA-256(公钥 SPKI DER) 前 16 位十六进制大写，例 165B8EEC45416A27。
 * 手工复核：openssl pkey -pubin -in public-key.pem -outform DER | openssl dgst -sha256（取前 16 位）
 *
 * 仓库密钥缺失时（例如新克隆、.keys/ 未随 git 分发）相关用例自动跳过，不误报。
 */

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_KEY_PATH = path.join(ROOT, 'public-key.pem');
const PRIVATE_KEY_PATH = path.join(ROOT, '.keys', 'private.pem');
const DIST_PRIVATE_KEY_PATH = path.join(ROOT, 'license-generator-dist', '.keys', 'private.pem');
const DIST_EMBEDDED_HTML_PATH = path.join(ROOT, 'license-generator-dist', 'license-generator-embedded.html');
const GENERATOR_HTML_PATH = path.join(ROOT, 'license-generator.html');
const LICENSE_MANAGER_PATH = path.join(ROOT, 'license-manager.js');

// ========== 指纹算法（此处独立重述规格，与 license-manager.js getPublicKeyFingerprint 同口径）==========

function spkiFingerprintOfPublicPem(publicPem) {
    const spkiDer = crypto.createPublicKey(publicPem).export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spkiDer).digest('hex').slice(0, 16).toUpperCase();
}

function spkiFingerprintOfPrivatePem(privatePem) {
    const publicKey = crypto.createPublicKey(crypto.createPrivateKey(privatePem));
    const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spkiDer).digest('hex').slice(0, 16).toUpperCase();
}

function fingerprintOfSpkiDer(spkiDer) {
    return crypto.createHash('sha256').update(spkiDer).digest('hex').slice(0, 16).toUpperCase();
}

/**
 * 抽取生成器 HTML 里的公钥指纹算法段并执行。
 * 用 HTML 里真正跑的那段代码做断言——避免「测试自己实现一遍、页面另写一遍」的漂移。
 */
function loadGeneratorDeriver() {
    const html = fs.readFileSync(GENERATOR_HTML_PATH, 'utf8');
    const begin = html.indexOf('// ===== BEGIN 公钥指纹算法');
    const end = html.indexOf('// ===== END 公钥指纹算法');
    assert.ok(begin >= 0 && end > begin, 'license-generator.html 应包含公钥指纹算法标记段');
    const code = html.slice(html.indexOf('\n', begin) + 1, html.lastIndexOf('\n', end));
    return new Function(code + '\nreturn derivePublicSpkiFromPkcs8;')();
}

// ========== 1. 页面算法与 Node 实现一致 ==========

test('生成器页面的公钥指纹算法与 Node 的 SPKI 导出逐字节一致（RSA-2048）', () => {
    const derive = loadGeneratorDeriver();
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

    const derived = Buffer.from(derive(new Uint8Array(privateKey.export({ type: 'pkcs8', format: 'der' }))));
    const expected = publicKey.export({ type: 'spki', format: 'der' });

    assert.deepStrictEqual(derived, expected, '浏览器侧推导出的 SPKI 公钥 DER 应与 Node 导出完全一致');
    assert.match(fingerprintOfSpkiDer(derived), /^[0-9A-F]{16}$/, '指纹应为 16 位十六进制大写');
});

test('生成器页面的公钥指纹算法与 Node 的 SPKI 导出逐字节一致（RSA-1024，不同模长）', () => {
    const derive = loadGeneratorDeriver();
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });

    const derived = Buffer.from(derive(new Uint8Array(privateKey.export({ type: 'pkcs8', format: 'der' }))));
    const expected = publicKey.export({ type: 'spki', format: 'der' });

    assert.deepStrictEqual(derived, expected, '不同模长下推导结果同样应与 Node 导出一致');
});

// ========== 2/3. 仓库密钥成对 + 页面/客户端指纹对表 ==========

const repoKeysReady = fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH);
const skipNoRepoKeys = repoKeysReady
    ? false
    : '仓库无 .keys/private.pem 或 public-key.pem（如新克隆），跳过代际核对';

test('仓库 .keys/private.pem 与 public-key.pem 必须同代（轮换漏改一侧即红）', { skip: skipNoRepoKeys }, () => {
    const fromPrivate = spkiFingerprintOfPrivatePem(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'));
    const fromPublic = spkiFingerprintOfPublicPem(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));

    assert.strictEqual(
        fromPrivate,
        fromPublic,
        `.keys/private.pem（${fromPrivate}）与 public-key.pem（${fromPublic}）不是同一对密钥：` +
        '据此签发的全部激活码都会被客户端拒收'
    );
});

test('仓库私钥签发的激活码必须能被 public-key.pem 验签通过（端到端往返）', { skip: skipNoRepoKeys }, () => {
    const privatePem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    const payload = Buffer.from(JSON.stringify({
        t: 'full',
        v: '1.0',
        m: 'TESTMACHINE1234',
        c: Date.now(),
        e: null,
        p: true
    }), 'utf8');

    const signature = crypto.sign('sha256', payload, {
        key: privatePem,
        padding: crypto.constants.RSA_PKCS1_PADDING
    });

    assert.ok(
        crypto.verify('sha256', payload, { key: publicPem, padding: crypto.constants.RSA_PKCS1_PADDING }, signature),
        '仓库私钥签发的激活码必须能被客户端公钥验签通过（与 license-manager.js 验签路径同一算法）'
    );
});

test('生成器页面对仓库私钥算出的指纹 = 客户端 public-key.pem 的指纹', { skip: skipNoRepoKeys }, () => {
    const derive = loadGeneratorDeriver();
    const pkcs8 = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'))
        .export({ type: 'pkcs8', format: 'der' });

    const pageFingerprint = fingerprintOfSpkiDer(Buffer.from(derive(new Uint8Array(pkcs8))));
    const clientFingerprint = spkiFingerprintOfPublicPem(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));

    assert.strictEqual(
        pageFingerprint,
        clientFingerprint,
        `生成器页面显示「${pageFingerprint}」而客户端显示「${clientFingerprint}」：现场会照此签出被拒收的激活码`
    );
});

// ========== 4. 分发件（现场实际使用的工具）必须与客户端同代 ==========

test('分发件私钥（license-generator-dist/.keys/private.pem）必须与 public-key.pem 同代', {
    skip: !fs.existsSync(DIST_PRIVATE_KEY_PATH)
        ? '未打包分发件（先运行 npm run pack:license-generator），跳过'
        : (fs.existsSync(PUBLIC_KEY_PATH) ? false : '仓库无 public-key.pem，跳过')
}, () => {
    const distFingerprint = spkiFingerprintOfPrivatePem(fs.readFileSync(DIST_PRIVATE_KEY_PATH, 'utf8'));
    const clientFingerprint = spkiFingerprintOfPublicPem(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));

    assert.strictEqual(
        distFingerprint,
        clientFingerprint,
        `分发件私钥（${distFingerprint}）与客户端公钥（${clientFingerprint}）不同代：` +
        '正是 2026-10-14 现场故障的成因，现场用它会签出全部被拒收的激活码'
    );
});

test('内嵌私钥版生成器 HTML 注入的私钥必须与 public-key.pem 同代', {
    skip: !fs.existsSync(DIST_EMBEDDED_HTML_PATH)
        ? '未生成内嵌版分发件，跳过'
        : (fs.existsSync(PUBLIC_KEY_PATH) ? false : '仓库无 public-key.pem，跳过')
}, () => {
    const html = fs.readFileSync(DIST_EMBEDDED_HTML_PATH, 'utf8');
    const literal = html.match(/const EMBEDDED_PRIVATE_KEY = ("(?:[^"\\]|\\.)*");/);

    assert.ok(literal, '内嵌版应包含 EMBEDDED_PRIVATE_KEY 单行字符串字面量');
    const injectedPem = Function('return ' + literal[1])();
    const injectedFingerprint = spkiFingerprintOfPrivatePem(injectedPem);
    const clientFingerprint = spkiFingerprintOfPublicPem(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));

    assert.strictEqual(
        injectedFingerprint,
        clientFingerprint,
        `内嵌版注入的私钥（${injectedFingerprint}）与客户端公钥（${clientFingerprint}）不同代`
    );
});

// ========== 5. 客户端失败文案（源码级核对）==========
//
// license-manager.js 在模块加载时就要构造 electron-store，无法在纯 Node 下 require；
// 这里做源码级核对，锁住「签名代际不匹配不得再被报成『无效或已损坏』」这条规格。

test('客户端失败文案应区分签名代际不匹配与格式损坏', () => {
    const source = fs.readFileSync(LICENSE_MANAGER_PATH, 'utf8');

    assert.ok(source.includes("reason: 'signature'"), '签名失败应作为独立的失败原因返回');
    assert.ok(source.includes('激活码签名校验失败'), '签名失败应给出可定位的文案');
    assert.ok(source.includes('本版本签发公钥指纹'), '签名失败文案应带本版本公钥指纹，供现场对表');
    assert.ok(source.includes('激活码格式不正确或已损坏'), '格式问题应有独立文案');
    assert.ok(
        !source.includes("message: '激活码无效或已损坏'"),
        '旧版本的笼统文案「激活码无效或已损坏」已被细分为格式错误与签名失败两类，验签失败不得再用它'
    );
});
