/**
 * 激活码生成器
 * 用于生成特教安全教育资源仪的激活码
 * 
 * 使用方法：
 * 1. 试用码：node generate-license.js --trial
 * 2. 正式码：node generate-license.js --machine <机器码> --days <天数>
 * 3. 永久码：node generate-license.js --machine <机器码> --permanent
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ 配置区 ============
const RSA_KEY_SIZE = 2048;
const LICENSE_VERSION = '1.0';
const KEY_DIR = path.join(__dirname, '.keys');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'public.pem');

// ============ RSA密钥管理 ============

/**
 * 生成RSA密钥对
 */
function generateRSAKeys() {
    console.log('🔐 正在生成RSA密钥对...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: RSA_KEY_SIZE,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    // 创建密钥目录
    if (!fs.existsSync(KEY_DIR)) {
        fs.mkdirSync(KEY_DIR, { recursive: true });
    }

    // 保存密钥
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

    console.log('✅ RSA密钥对生成成功！');
    console.log(`   私钥: ${PRIVATE_KEY_PATH}`);
    console.log(`   公钥: ${PUBLIC_KEY_PATH}`);
    console.log('⚠️  请妥善保管私钥，不要泄露！');

    return { privateKey, publicKey };
}

/**
 * 加载RSA密钥
 */
function loadRSAKeys() {
    if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
        console.log('⚠️  未找到RSA密钥，将自动生成...');
        return generateRSAKeys();
    }

    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

    return { privateKey, publicKey };
}

/**
 * 复制公钥到项目目录（客户端需要）
 */
function copyPublicKeyToProject() {
    const destPath = path.join(__dirname, 'public-key.pem');
    fs.copyFileSync(PUBLIC_KEY_PATH, destPath);
    console.log(`✅ 公钥已复制到: ${destPath}`);
}

// ============ 激活码生成 ============

/**
 * 生成试用激活码
 */
function generateTrialLicense() {
    const licenseData = {
        t: 'trial', // type 缩短
        v: LICENSE_VERSION, // version 缩短
        c: Date.now(), // createdAt 缩短
        e: Date.now() + 7 * 24 * 60 * 60 * 1000, // expireAt 缩短
        m: '*' // machineId 缩短
    };

    return licenseData;
}

/**
 * 生成正式激活码
 */
function generateFullLicense(machineId, days = null) {
    const licenseData = {
        t: 'full', // type 缩短
        v: LICENSE_VERSION, // version 缩短
        m: machineId, // machineId 缩短
        c: Date.now(), // createdAt 缩短
        e: days ? Date.now() + days * 24 * 60 * 60 * 1000 : null, // expireAt 缩短
        p: !days // permanent 缩短
    };

    return licenseData;
}

/**
 * 使用RSA私钥签名许可数据
 */
function encryptLicenseData(licenseData, privateKey) {
    // 紧凑的JSON编码
    const jsonData = JSON.stringify(licenseData);
    const dataBuffer = Buffer.from(jsonData, 'utf8');

    console.log('原始数据:', jsonData);
    console.log('数据长度:', dataBuffer.length);

    // 使用RSA私钥签名
    const signature = crypto.sign('sha256', dataBuffer, {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    });

    console.log('签名长度:', signature.length);

    // 组合格式：[4字节数据长度] + [数据] + [签名]
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(dataBuffer.length, 0);

    const combined = Buffer.concat([lengthBuffer, dataBuffer, signature]);
    console.log('组合后长度:', combined.length);

    // Base64编码
    const base64 = combined.toString('base64');
    console.log('Base64长度:', base64.length);

    return base64;
}

/**
 * 格式化激活码（添加分隔符）
 */
function formatLicenseKey(base64Key) {
    // 直接使用Base64，每5个字符一组
    const groups = [];
    for (let i = 0; i < base64Key.length; i += 5) {
        groups.push(base64Key.slice(i, i + 5));
    }

    return 'SPED-' + groups.join('-');
}

/**
 * 反格式化激活码
 */
function unformatLicenseKey(formattedKey) {
    // 移除 SPED- 前缀和所有连字符
    const base64 = formattedKey
        .replace(/^SPED-/i, '')
        .replace(/-/g, '');

    return base64;
}

// ============ 命令行接口 ============

function printUsage() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║        特教安全教育资源仪 - 激活码生成器 v${LICENSE_VERSION}          ║
╚════════════════════════════════════════════════════════════╝

📋 使用方法：

1️⃣  生成试用码（7天免费试用）：
   node generate-license.js --trial

2️⃣  生成正式激活码（绑定机器）：
   node generate-license.js --machine <机器码> --days <天数>
   
   示例：
   node generate-license.js --machine ABC123DEF456 --days 365

3️⃣  生成永久激活码：
   node generate-license.js --machine <机器码> --permanent

4️⃣  初始化密钥（首次使用自动执行）：
   node generate-license.js --init

💡 提示：
   - 机器码可从应用的激活界面获取
   - 试用码不绑定机器，任何人都可使用
   - 正式码严格绑定机器硬件信息
  `);
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        return;
    }

    // 加载或生成密钥
    const { privateKey, publicKey } = loadRSAKeys();
    copyPublicKeyToProject();

    console.log('\n' + '='.repeat(60));

    // 初始化模式
    if (args.includes('--init')) {
        console.log('✅ 密钥初始化完成！');
        return;
    }

    // 生成试用码
    if (args.includes('--trial')) {
        console.log('🎯 生成试用激活码...\n');
        const licenseData = generateTrialLicense();
        const encrypted = encryptLicenseData(licenseData, privateKey);
        const formatted = formatLicenseKey(encrypted);

        console.log('📄 激活码信息：');
        console.log(`   类型: 试用版`);
        console.log(`   有效期: 7天`);
        console.log(`   创建时间: ${new Date(licenseData.createdAt).toLocaleString('zh-CN')}`);
        console.log(`   过期时间: ${new Date(licenseData.expireAt).toLocaleString('zh-CN')}`);
        console.log(`   功能: 全功能`);
        console.log('\n🔑 激活码：');
        console.log(`\n   ${formatted}\n`);
        console.log('='.repeat(60));

        // 保存到文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `trial_license_${timestamp}.txt`;
        fs.writeFileSync(filename, `激活码类型: 试用版
有效期: 7天
创建时间: ${new Date(licenseData.createdAt).toLocaleString('zh-CN')}
过期时间: ${new Date(licenseData.expireAt).toLocaleString('zh-CN')}

激活码:
${formatted}
`);
        console.log(`💾 已保存到文件: ${filename}\n`);

        return;
    }

    // 生成正式激活码
    const machineIdIndex = args.indexOf('--machine');
    if (machineIdIndex === -1) {
        console.log('❌ 错误：缺少 --machine 参数');
        printUsage();
        return;
    }

    const machineId = args[machineIdIndex + 1];
    if (!machineId) {
        console.log('❌ 错误：--machine 参数值不能为空');
        return;
    }

    let days = null;
    let isPermanent = args.includes('--permanent');

    if (!isPermanent) {
        const daysIndex = args.indexOf('--days');
        if (daysIndex === -1) {
            console.log('❌ 错误：缺少 --days 或 --permanent 参数');
            printUsage();
            return;
        }
        days = parseInt(args[daysIndex + 1]);
        if (isNaN(days) || days <= 0) {
            console.log('❌ 错误：--days 参数必须是正整数');
            return;
        }
    }

    console.log('🎯 生成正式激活码...\n');
    const licenseData = generateFullLicense(machineId, isPermanent ? null : days);
    const encrypted = encryptLicenseData(licenseData, privateKey);
    const formatted = formatLicenseKey(encrypted);

    console.log('📄 激活码信息：');
    console.log(`   类型: 正式版`);
    console.log(`   机器码: ${machineId}`);
    console.log(`   有效期: ${isPermanent ? '永久' : days + '天'}`);
    console.log(`   创建时间: ${new Date(licenseData.createdAt).toLocaleString('zh-CN')}`);
    if (!isPermanent) {
        console.log(`   过期时间: ${new Date(licenseData.expireAt).toLocaleString('zh-CN')}`);
    }
    console.log(`   功能: 全功能`);
    console.log('\n🔑 激活码：');
    console.log(`\n   ${formatted}\n`);
    console.log('='.repeat(60));

    // 保存到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `license_${machineId.slice(0, 8)}_${timestamp}.txt`;
    fs.writeFileSync(filename, `激活码类型: 正式版
机器码: ${machineId}
有效期: ${isPermanent ? '永久' : days + '天'}
创建时间: ${new Date(licenseData.createdAt).toLocaleString('zh-CN')}
${!isPermanent ? '过期时间: ' + new Date(licenseData.expireAt).toLocaleString('zh-CN') : ''}

激活码:
${formatted}
`);
    console.log(`💾 已保存到文件: ${filename}\n`);
}

// 执行
main();
