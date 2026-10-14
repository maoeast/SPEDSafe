/**
 * 激活许可管理器
 * 负责验证、存储和管理激活状态
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const CryptoJS = require('crypto-js');
const Store = require('electron-store');

// ============ 配置 ============
const PUBLIC_KEY_PATH = path.join(__dirname, 'public-key.pem');
const AES_SECRET = 'SPED-SAFE-EDU-2025-SECRET-KEY'; // 用于加密本地存储
const HMAC_SECRET = 'SPED-SAFE-EDU-2025-HMAC-KEY'; // 用于防篡改

// 宽松模式：机器码只使用稳定的硬件信息
const TOLERANCE_LEVEL = 0.6; // 60%相似度即可通过

// ============ 存储初始化 ============
const licenseStore = new Store({
    name: 'license-data',
    encryptionKey: 'sped-safe-encryption-key-2025'
});

// ============ 机器指纹（宽松模式）============

/**
 * 获取机器指纹（宽松模式）
 * 只使用相对稳定的硬件信息：CPU + 主板
 */
function getMachineFingerprint() {
    try {
        // 使用 node-machine-id 获取稳定的机器ID
        const machineId = machineIdSync({ original: true });

        // SHA256哈希
        const hash = crypto.createHash('sha256');
        hash.update(machineId);

        // 返回前16位（简化显示）
        return hash.digest('hex').substring(0, 16).toUpperCase();
    } catch (error) {
        console.error('获取机器指纹失败:', error);
        // 降级方案：使用主机名
        const os = require('os');
        const fallback = os.hostname() + os.platform() + os.arch();
        return crypto.createHash('sha256').update(fallback).digest('hex').substring(0, 16).toUpperCase();
    }
}

/**
 * 计算两个机器码的相似度（宽松模式）
 */
function calculateSimilarity(code1, code2) {
    if (code1 === code2) return 1.0;

    let matches = 0;
    const len = Math.min(code1.length, code2.length);

    for (let i = 0; i < len; i++) {
        if (code1[i] === code2[i]) matches++;
    }

    return matches / len;
}

/**
 * 验证机器码匹配（宽松模式）
 */
function verifyMachineMatch(storedMachineId, currentMachineId) {
    // 试用码：machineId为 '*'
    if (storedMachineId === '*') return true;

    // 完全匹配
    if (storedMachineId === currentMachineId) return true;

    // 宽松模式：允许部分硬件变更
    const similarity = calculateSimilarity(storedMachineId, currentMachineId);
    console.log(`机器码相似度: ${(similarity * 100).toFixed(1)}%`);

    return similarity >= TOLERANCE_LEVEL;
}

// ============ RSA解密 ============

/**
 * 加载公钥
 */
function loadPublicKey() {
    if (!fs.existsSync(PUBLIC_KEY_PATH)) {
        throw new Error('公钥文件不存在！请先运行激活码生成器初始化密钥。');
    }
    return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

/**
 * 反格式化激活码
 */
function unformatLicenseKey(formattedKey) {
    // 移除 SPED- 前缀和所有连字符
    const base64 = formattedKey
        .replace(/^SPED-/i, '')
        .replace(/-/g, '')
        .replace(/\s/g, ''); // 移除空白字符

    return base64;
}

/**
 * 签发公钥指纹 = SHA-256(公钥 SPKI DER) 前 16 位十六进制（大写）
 *
 * 生成器页面按同一算法显示「签发公钥指纹」，两处一致才说明双方是同一代密钥。
 * 手工复核：openssl pkey -pubin -in public-key.pem -outform DER | openssl dgst -sha256（取前 16 位）
 */
function getPublicKeyFingerprint() {
    try {
        const der = crypto.createPublicKey(loadPublicKey()).export({ type: 'spki', format: 'der' });
        return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16).toUpperCase();
    } catch (error) {
        console.error('计算公钥指纹失败:', error.message);
        return '';
    }
}

// 签名长度为固定的 RSA-2048 输出
const SIGNATURE_LENGTH = 256;
const FORMAT_ERROR_MESSAGE = '激活码格式不正确或已损坏，请确认已完整复制（含 SPED- 前缀）';

/**
 * 使用RSA公钥验证激活码
 * @returns {{ok: true, data: Object} | {ok: false, reason: 'environment'|'format'|'signature', message: string}}
 */
function decryptLicenseKey(licenseKey) {
    let publicKey;
    try {
        publicKey = loadPublicKey();
    } catch (error) {
        console.error('加载公钥失败:', error.message);
        return { ok: false, reason: 'environment', message: '本机公钥文件缺失或不可读，无法验证激活码' };
    }

    // 反格式化激活码
    const base64Data = unformatLicenseKey(String(licenseKey || ''));
    console.log('Base64数据长度:', base64Data.length);

    // Base64解码
    const combined = Buffer.from(base64Data, 'base64');
    console.log('解码后总长度:', combined.length);

    // 结构：4 字节数据长度 + 数据 + 256 字节签名
    if (combined.length < 4 + SIGNATURE_LENGTH) {
        console.error('激活码长度不足:', combined.length);
        return { ok: false, reason: 'format', message: FORMAT_ERROR_MESSAGE };
    }

    const dataLength = combined.readUInt32BE(0);
    const dataEnd = 4 + dataLength;
    console.log('数据长度:', dataLength);

    if (dataLength <= 0 || combined.length - dataEnd !== SIGNATURE_LENGTH) {
        console.error('激活码结构不完整，数据段与签名段长度不匹配');
        return { ok: false, reason: 'format', message: FORMAT_ERROR_MESSAGE };
    }

    const dataBuffer = combined.slice(4, dataEnd);
    const signature = combined.slice(dataEnd);

    console.log('数据实际长度:', dataBuffer.length);
    console.log('签名长度:', signature.length);

    // 验证RSA签名
    const isValid = crypto.verify(
        'sha256',
        dataBuffer,
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        },
        signature
    );

    if (!isValid) {
        // 同一条激活码由不同代密钥签发时必然走到这里：提示指纹，现场可直接对表
        const fingerprint = getPublicKeyFingerprint();
        console.error('激活码签名验证失败：签发密钥与本版本不匹配（本版本签发公钥指纹 ' + (fingerprint || '未知') + '）');
        return {
            ok: false,
            reason: 'signature',
            message: `激活码签名校验失败：该码由不匹配的密钥签发（本版本签发公钥指纹 ${fingerprint || '未知'}），请用配套密钥的生成器重新签发`
        };
    }

    console.log('✅ 签名验证成功');

    // 解析JSON数据
    const jsonData = dataBuffer.toString('utf8');
    console.log('原始数据:', jsonData);

    let parsed;
    try {
        parsed = JSON.parse(jsonData);
    } catch (error) {
        console.error('激活码载荷解析失败:', error.message);
        return { ok: false, reason: 'format', message: FORMAT_ERROR_MESSAGE };
    }

    // 将缩短字段转换回完整字段
    return {
        ok: true,
        data: {
            type: parsed.t,
            version: parsed.v,
            machineId: parsed.m,
            createdAt: parsed.c,
            expireAt: parsed.e,
            permanent: parsed.p || false
        }
    };
}

// ============ 本地存储加密 ============

/**
 * AES加密激活数据
 */
function encryptActivationData(data) {
    const jsonStr = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, AES_SECRET).toString();

    // 添加HMAC签名防篡改
    const hmac = CryptoJS.HmacSHA256(encrypted, HMAC_SECRET).toString();

    return {
        data: encrypted,
        signature: hmac
    };
}

/**
 * AES解密激活数据
 */
function decryptActivationData(encryptedObj) {
    try {
        // 验证HMAC签名
        const expectedHmac = CryptoJS.HmacSHA256(encryptedObj.data, HMAC_SECRET).toString();
        if (expectedHmac !== encryptedObj.signature) {
            console.error('激活数据已被篡改！');
            return null;
        }

        // AES解密
        const decrypted = CryptoJS.AES.decrypt(encryptedObj.data, AES_SECRET);
        const jsonStr = decrypted.toString(CryptoJS.enc.Utf8);

        if (!jsonStr) {
            console.error('解密失败');
            return null;
        }

        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('解密激活数据失败:', error);
        return null;
    }
}

// ============ 激活验证 ============

/**
 * 验证激活码
 */
function verifyLicenseKey(licenseKey) {
    // 解密激活码（失败区分「格式损坏」与「签名代际不匹配」，便于现场定位）
    const decoded = decryptLicenseKey(licenseKey);
    if (!decoded.ok) {
        return { success: false, message: decoded.message, reason: decoded.reason };
    }
    const licenseData = decoded.data;

    // 获取当前机器码
    const currentMachineId = getMachineFingerprint();

    // 验证机器绑定（宽松模式）
    if (!verifyMachineMatch(licenseData.machineId, currentMachineId)) {
        return {
            success: false,
            message: '激活码与当前机器不匹配',
            details: `激活码绑定机器: ${licenseData.machineId}\n当前机器码: ${currentMachineId}`
        };
    }

    // 验证是否过期
    if (licenseData.expireAt && Date.now() > licenseData.expireAt) {
        return {
            success: false,
            message: '激活码已过期',
            details: `过期时间: ${new Date(licenseData.expireAt).toLocaleString('zh-CN')}`
        };
    }

    // 验证成功，保存激活信息
    const activationData = {
        ...licenseData,
        activatedAt: Date.now(),
        currentMachineId: currentMachineId,
        lastVerifiedAt: Date.now()
    };

    const encrypted = encryptActivationData(activationData);
    licenseStore.set('activation', encrypted);

    return {
        success: true,
        message: '激活成功！',
        data: {
            type: licenseData.type,
            isPermanent: licenseData.permanent || false,
            expireAt: licenseData.expireAt,
            features: licenseData.features
        }
    };
}

/**
 * 获取当前激活状态（附本版本签发公钥指纹，供激活页做密钥代际核对）
 */
function getActivationStatus() {
    return {
        ...computeActivationStatus(),
        publicKeyFingerprint: getPublicKeyFingerprint()
    };
}

/**
 * 计算激活状态（不含公钥指纹）
 */
function computeActivationStatus() {
    // 检查是否有激活记录
    const encrypted = licenseStore.get('activation');
    if (!encrypted) {
        // 未激活，检查是否在试用期
        return checkTrialStatus();
    }

    // 解密激活数据
    const activationData = decryptActivationData(encrypted);
    if (!activationData) {
        console.error('激活数据损坏，清除并进入试用模式');
        licenseStore.delete('activation');
        return checkTrialStatus();
    }

    // 验证机器码（宽松模式）
    const currentMachineId = getMachineFingerprint();
    if (!verifyMachineMatch(activationData.machineId, currentMachineId)) {
        console.warn('机器码不匹配（超出容忍度），需要重新激活');
        return {
            activated: false,
            type: 'invalid',
            message: '硬件变更过大，需要重新激活',
            machineId: currentMachineId
        };
    }

    // 验证是否过期
    if (activationData.expireAt && Date.now() > activationData.expireAt) {
        return {
            activated: false,
            type: 'expired',
            message: '激活已过期',
            expiredAt: activationData.expireAt,
            machineId: currentMachineId
        };
    }

    // 更新最后验证时间
    activationData.lastVerifiedAt = Date.now();
    const encrypted2 = encryptActivationData(activationData);
    licenseStore.set('activation', encrypted2);

    // 激活有效
    return {
        activated: true,
        type: activationData.type,
        isPermanent: activationData.permanent || false,
        expireAt: activationData.expireAt,
        activatedAt: activationData.activatedAt,
        features: activationData.features,
        machineId: currentMachineId,
        daysRemaining: activationData.expireAt ?
            Math.ceil((activationData.expireAt - Date.now()) / (24 * 60 * 60 * 1000)) : null
    };
}

/**
 * 检查试用状态
 */
function checkTrialStatus() {
    const firstRun = licenseStore.get('firstRun');
    const now = Date.now();

    if (!firstRun) {
        // 首次运行，开始试用期
        licenseStore.set('firstRun', now);
        return {
            activated: false,
            type: 'trial',
            message: '欢迎使用！您有7天免费试用期',
            trialStartAt: now,
            trialExpireAt: now + 7 * 24 * 60 * 60 * 1000,
            daysRemaining: 7,
            machineId: getMachineFingerprint()
        };
    }

    const trialExpireAt = firstRun + 7 * 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((trialExpireAt - now) / (24 * 60 * 60 * 1000));

    if (now < trialExpireAt) {
        // 试用期内
        return {
            activated: false,
            type: 'trial',
            message: `试用期剩余 ${daysRemaining} 天`,
            trialStartAt: firstRun,
            trialExpireAt: trialExpireAt,
            daysRemaining: daysRemaining,
            machineId: getMachineFingerprint()
        };
    } else {
        // 试用期已结束
        return {
            activated: false,
            type: 'trial_expired',
            message: '试用期已结束，请激活后继续使用',
            trialStartAt: firstRun,
            trialExpireAt: trialExpireAt,
            daysRemaining: 0,
            machineId: getMachineFingerprint()
        };
    }
}

/**
 * 重置激活状态（测试用）
 */
function resetActivation() {
    licenseStore.clear();
    return { success: true, message: '激活状态已重置' };
}

// ============ 导出 ============
module.exports = {
    getMachineFingerprint,
    getPublicKeyFingerprint,
    verifyLicenseKey,
    getActivationStatus,
    resetActivation
};
