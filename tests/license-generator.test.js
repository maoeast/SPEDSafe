/**
 * 激活码生成格式兼容性测试
 *
 * 验证目标：
 * 1. license-generator.html（浏览器 WebCrypto 路径）生成的激活码，
 *    与客户端 license-manager.js 的验证逻辑（crypto.verify + RSA_PKCS1_PADDING）完全兼容；
 * 2. WebCrypto 的 RSASSA-PKCS1-v1_5 签名与 Node crypto.sign 输出逐字节一致；
 * 3. 数据字段顺序与 generate-license.js 一致（字段顺序影响签名结果）；
 * 4. 篡改激活码会被验证逻辑拒绝。
 *
 * 测试独立生成临时密钥对，不依赖仓库 .keys/。
 */

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const LICENSE_VERSION = '1.0';

// ========== WebCrypto 路径（与 license-generator.html 相同的实现）==========

async function webcryptoSignLicense(pkcs8Der, dataObj) {
    const key = await crypto.webcrypto.subtle.importKey(
        'pkcs8', pkcs8Der,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );
    const jsonData = JSON.stringify(dataObj);
    const dataBuffer = new TextEncoder().encode(jsonData);
    const signature = new Uint8Array(
        await crypto.webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', key, dataBuffer)
    );
    const combined = new Uint8Array(4 + dataBuffer.length + signature.length);
    new DataView(combined.buffer).setUint32(0, dataBuffer.length, false);
    combined.set(dataBuffer, 4);
    combined.set(signature, 4 + dataBuffer.length);
    return Buffer.from(combined).toString('base64');
}

function formatLicenseKey(base64Key) {
    const groups = [];
    for (let i = 0; i < base64Key.length; i += 5) {
        groups.push(base64Key.slice(i, i + 5));
    }
    return 'SPED-' + groups.join('-');
}

// 与 generate-license.js 相同的字段构建（字段顺序即签名内容）
function buildTrialData(now) {
    return {
        t: 'trial',
        v: LICENSE_VERSION,
        c: now,
        e: now + 7 * 24 * 60 * 60 * 1000,
        m: '*'
    };
}

function buildFullData(machineId, days, now) {
    return {
        t: 'full',
        v: LICENSE_VERSION,
        m: machineId,
        c: now,
        e: days ? now + days * 24 * 60 * 60 * 1000 : null,
        p: !days
    };
}

// ========== 客户端验证路径（复刻 license-manager.js 的 decryptLicenseKey）==========

function verifyLicenseKey(formattedKey, publicKeyPem) {
    const base64 = formattedKey
        .replace(/^SPED-/i, '')
        .replace(/-/g, '')
        .replace(/\s/g, '');
    const combined = Buffer.from(base64, 'base64');
    if (combined.length < 4) return null;
    const dataLength = combined.readUInt32BE(0);
    const dataStart = 4;
    const dataEnd = dataStart + dataLength;
    if (combined.length < dataEnd) return null;
    const dataBuffer = combined.slice(dataStart, dataEnd);
    const signature = combined.slice(dataEnd);
    const isValid = crypto.verify(
        'sha256',
        dataBuffer,
        { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
        signature
    );
    if (!isValid) return null;
    return JSON.parse(dataBuffer.toString('utf8'));
}

// ========== 测试辅助 ==========

function pemEncode(der, label) {
    const b64 = der.toString('base64').match(/.{1,64}/g).join('\n');
    return '-----BEGIN ' + label + '-----\n' + b64 + '\n-----END ' + label + '-----';
}

async function generateKeyPair() {
    const { privateKey, publicKey } = await crypto.webcrypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true,
        ['sign', 'verify']
    );
    const pkcs8 = Buffer.from(await crypto.webcrypto.subtle.exportKey('pkcs8', privateKey));
    const spki = Buffer.from(await crypto.webcrypto.subtle.exportKey('spki', publicKey));
    return {
        pkcs8Der: new Uint8Array(pkcs8),
        privatePem: pemEncode(pkcs8, 'PRIVATE KEY'),
        publicPem: pemEncode(spki, 'PUBLIC KEY')
    };
}

// ========== 用例 ==========

test('WebCrypto 生成的试用码可通过客户端验证逻辑，且 m=* 不绑定机器', async () => {
    const keys = await generateKeyPair();
    const now = Date.now();
    const data = buildTrialData(now);

    const base64 = await webcryptoSignLicense(keys.pkcs8Der, data);
    const formatted = formatLicenseKey(base64);

    // 格式断言：SPED- 前缀 + 每 5 字符一组
    assert.ok(formatted.startsWith('SPED-'));
    const body = formatted.slice(5);
    assert.ok(/^([A-Za-z0-9+/]{5}-)*[A-Za-z0-9+/]{1,5}$/.test(body), '应为 5 字符分组');

    const parsed = verifyLicenseKey(formatted, keys.publicPem);
    assert.ok(parsed, '客户端验证逻辑应通过');
    assert.strictEqual(parsed.t, 'trial');
    assert.strictEqual(parsed.v, LICENSE_VERSION);
    assert.strictEqual(parsed.m, '*');
    assert.strictEqual(parsed.c, now);
    assert.strictEqual(parsed.e, now + 7 * 24 * 60 * 60 * 1000);
});

test('WebCrypto 生成的正式码（限时）可通过客户端验证逻辑', async () => {
    const keys = await generateKeyPair();
    const now = Date.now();
    const machineId = '067D30ECBD218C95';
    const data = buildFullData(machineId, 365, now);

    const formatted = formatLicenseKey(await webcryptoSignLicense(keys.pkcs8Der, data));

    const parsed = verifyLicenseKey(formatted, keys.publicPem);
    assert.ok(parsed, '客户端验证逻辑应通过');
    assert.strictEqual(parsed.t, 'full');
    assert.strictEqual(parsed.m, machineId);
    assert.strictEqual(parsed.c, now);
    assert.strictEqual(parsed.e, now + 365 * 24 * 60 * 60 * 1000);
    assert.strictEqual(parsed.p, false);
});

test('WebCrypto 生成的永久码可通过客户端验证逻辑（e=null, p=true）', async () => {
    const keys = await generateKeyPair();
    const now = Date.now();
    const data = buildFullData('A1B2C3D4E5F60718', null, now);

    const formatted = formatLicenseKey(await webcryptoSignLicense(keys.pkcs8Der, data));

    const parsed = verifyLicenseKey(formatted, keys.publicPem);
    assert.ok(parsed, '客户端验证逻辑应通过');
    assert.strictEqual(parsed.t, 'full');
    assert.strictEqual(parsed.p, true);
    assert.strictEqual(parsed.e, null);
});

test('WebCrypto 签名与 Node crypto.sign 输出逐字节一致（格式兼容核心）', async () => {
    const keys = await generateKeyPair();
    const now = Date.now();
    const data = buildFullData('F5E8D9C2A1B3D4E5', 30, now);

    // WebCrypto 路径
    const webBase64 = await webcryptoSignLicense(keys.pkcs8Der, data);

    // Node 原生路径（generate-license.js 使用）
    const jsonData = JSON.stringify(data);
    const dataBuffer = Buffer.from(jsonData, 'utf8');
    const signature = crypto.sign('sha256', dataBuffer, {
        key: keys.privatePem,
        padding: crypto.constants.RSA_PKCS1_PADDING
    });
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(dataBuffer.length, 0);
    const nativeBase64 = Buffer.concat([lengthBuffer, dataBuffer, signature]).toString('base64');

    assert.strictEqual(webBase64, nativeBase64, '两种路径生成的激活码必须完全一致');
    assert.strictEqual(
        formatLicenseKey(webBase64),
        formatLicenseKey(nativeBase64)
    );
});

test('数据字段顺序与 generate-license.js 一致（JSON.stringify 顺序断言）', async () => {
    const now = 1700000000000;
    const trial = buildTrialData(now);
    const full = buildFullData('ABCDEF1234567890', 365, now);
    const permanent = buildFullData('ABCDEF1234567890', null, now);

    assert.strictEqual(
        JSON.stringify(trial),
        '{"t":"trial","v":"1.0","c":1700000000000,"e":1700604800000,"m":"*"}'
    );
    assert.strictEqual(
        JSON.stringify(full),
        '{"t":"full","v":"1.0","m":"ABCDEF1234567890","c":1700000000000,"e":1731536000000,"p":false}'
    );
    assert.strictEqual(
        JSON.stringify(permanent),
        '{"t":"full","v":"1.0","m":"ABCDEF1234567890","c":1700000000000,"e":null,"p":true}'
    );
});

test('篡改激活码任一字符后客户端验证失败', async () => {
    const keys = await generateKeyPair();
    const now = Date.now();
    const data = buildTrialData(now);

    const formatted = formatLicenseKey(await webcryptoSignLicense(keys.pkcs8Der, data));

    // 在中间有效载荷区改一个字符（注意：末尾是 base64 padding '='，不携带数据，改它无意义）
    const mid = Math.floor(formatted.length / 2);
    const tampered = formatted.slice(0, mid) +
        (formatted[mid] === 'A' ? 'B' : 'A') +
        formatted.slice(mid + 1);
    assert.strictEqual(verifyLicenseKey(tampered, keys.publicPem), null, '篡改后必须验证失败');

    // 截断尾部字符（去掉部分签名）也必须失败。
    // 注意：去掉 SPED- 前缀不构成破坏——客户端验证逻辑对前缀宽容（可选移除）。
    const truncated = formatted.replace(/-/g, '').slice(0, -8);
    assert.strictEqual(verifyLicenseKey(truncated, keys.publicPem), null, '截断后必须验证失败');
});

test('生成的激活码可被真实客户端密钥对交叉验证（新密钥对往返）', async () => {
    // 模拟真实部署：用仓库公钥（public-key.pem）验证仓库私钥签发的码不可行（不依赖仓库密钥），
    // 这里验证：同一密钥对往返 + 换公钥必须失败
    const keysA = await generateKeyPair();
    const keysB = await generateKeyPair();
    const now = Date.now();
    const data = buildFullData('TESTMACHINE123456', 90, now);

    const formatted = formatLicenseKey(await webcryptoSignLicense(keysA.pkcs8Der, data));
    assert.ok(verifyLicenseKey(formatted, keysA.publicPem), '同密钥对应验证通过');
    assert.strictEqual(verifyLicenseKey(formatted, keysB.publicPem), null, '不同公钥必须验证失败');
});

// ========== .lic 激活文件流程（生成器 → 客户端导入）==========

// 与 ActivationDialog.vue 的 extractLicenseKey 保持一致
function extractLicenseKeyFromFile(text) {
    if (!text) return "";
    const match = String(text).match(/SPED-[A-Za-z0-9+/=-]+/);
    return match ? match[0] : "";
}

test('生成器导出的 .lic 激活文件可被客户端导入逻辑解析并验证', async () => {
    const generator = require('../generate-license.js');
    const keys = await generateKeyPair();

    // 与 generate-license.js --lic 相同的生成路径（Node crypto 签名）
    const data = generator.generateFullLicense('MACHINE12345678', 365);
    const key = generator.formatLicenseKey(generator.encryptLicenseData(data, keys.privatePem));

    // .lic 文件内容 = 激活码文本（saveLicFile 输出格式：激活码 + 换行）
    const licContent = key + '\n';
    const extracted = extractLicenseKeyFromFile(licContent);
    assert.strictEqual(extracted, key, '客户端应从 .lic 内容中提取出完整激活码');

    const parsed = verifyLicenseKey(extracted, keys.publicPem);
    assert.ok(parsed, '导入提取的激活码应通过客户端验证逻辑');
    assert.strictEqual(parsed.t, 'full');
    assert.strictEqual(parsed.m, 'MACHINE12345678');

    // saveLicFile 文件名规则：.txt → .lic
    const licName = 'license_ABC12345_2026-01-01T00-00-00-000Z.txt'.replace(/\.txt$/, '.lic');
    assert.strictEqual(licName, 'license_ABC12345_2026-01-01T00-00-00-000Z.lic');
});

test('客户端提取逻辑兼容带说明的旧版 txt 激活码记录', async () => {
    const generator = require('../generate-license.js');
    const keys = await generateKeyPair();

    const data = generator.generateTrialLicense();
    const key = generator.formatLicenseKey(generator.encryptLicenseData(data, keys.privatePem));

    // 模拟旧版 txt 记录格式（多行说明 + 激活码段）
    const txtContent = `激活码类型: 试用版
有效期: 7天
创建时间: 2025-11-20 11:17:27
过期时间: 2025-11-27 11:17:27

激活码:
${key}
`;
    const extracted = extractLicenseKeyFromFile(txtContent);
    assert.strictEqual(extracted, key, '应从带说明的文本中提取出激活码');

    const parsed = verifyLicenseKey(extracted, keys.publicPem);
    assert.ok(parsed, '提取的激活码应通过验证');
    assert.strictEqual(parsed.m, '*');
});

test('pack 脚本可将私钥安全注入 HTML 模板（内嵌版）', () => {
    const fs = require('fs');
    const { injectPrivateKey } = require('../pack-license-generator.js');

    // 用真实模板验证注入
    const template = fs.readFileSync('license-generator.html', 'utf8');
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFA\n-----END PRIVATE KEY-----';
    const injected = injectPrivateKey(template, pem);

    assert.ok(injected.includes('const EMBEDDED_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----'), '私钥应注入占位符');
    assert.ok(!injected.includes('const EMBEDDED_PRIVATE_KEY = "";'), '空占位符应被替换');
    assert.ok(injected.includes("if (EMBEDDED_PRIVATE_KEY && EMBEDDED_PRIVATE_KEY.includes('BEGIN'))"), '自动加载逻辑应保留');

    // 转义：私钥中出现双引号 / 反斜杠 / 换行时不得破坏 JS 字符串
    const weirdPem = 'a"b\\c"d';
    const injectedWeird = injectPrivateKey(
        '<script>const EMBEDDED_PRIVATE_KEY = "";</script>',
        weirdPem
    );
    assert.ok(injectedWeird.includes('a\\"b\\\\c\\"d'), '双引号与反斜杠应被转义');

    // 注入结果必须是合法 JS 字符串字面量，且执行后值还原为原 PEM（多行 PEM 关键验证）
    const injectedLine = injected.match(/const EMBEDDED_PRIVATE_KEY = ("[^"]*");/);
    assert.ok(injectedLine, '注入行应为单行字符串字面量');
    const roundTrip = Function('return ' + injectedLine[1])();
    assert.strictEqual(roundTrip, pem, '注入后执行值应还原为原 PEM 文本');

    // 占位符缺失时应报错
    assert.throws(
        () => injectPrivateKey('<script>no marker here</script>', pem),
        /EMBEDDED_PRIVATE_KEY/
    );
});


