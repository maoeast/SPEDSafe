const crypto = require('crypto');

const SAFE_VALUE_PREFIX = 'safe:v1:';
const SESSION_SNAPSHOT_VERSION = 1;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

class VaultError extends Error {
    constructor(kind, message) {
        super(message);
        this.name = 'VaultError';
        this.kind = kind;
    }
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function createEmptySnapshot(workspaceId) {
    return {
        schemaVersion: SESSION_SNAPSHOT_VERSION,
        workspaceId,
        sessions: [],
        updatedAt: new Date().toISOString()
    };
}

function validateModelId(modelId) {
    const value = typeof modelId === 'string' ? modelId.trim() : '';
    if (!MODEL_ID_PATTERN.test(value)) {
        throw new VaultError('invalid_model', '模型/推理接入点 ID 格式不正确');
    }
    return value;
}

function createSecureVault(options) {
    const safeStorage = options.safeStorage;
    const configStore = options.configStore;
    const sessionStore = options.sessionStore;
    const cryptoImpl = options.cryptoImpl || crypto;
    const createId = options.randomUUID || cryptoImpl.randomUUID.bind(cryptoImpl);

    let workspaceId = String(configStore.get('workspaceId', '') || '').trim();
    if (!workspaceId) {
        workspaceId = createId();
        configStore.set('workspaceId', workspaceId);
    }

    let memoryOnly = false;
    let memoryReason = null;
    let sessionKey = null;
    let memorySnapshot = createEmptySnapshot(workspaceId);

    function isEncryptionAvailable() {
        try {
            return Boolean(safeStorage?.isEncryptionAvailable?.());
        } catch {
            return false;
        }
    }

    function protectWithSafeStorage(value) {
        if (!isEncryptionAvailable()) {
            throw new VaultError('safe_storage_unavailable', '当前系统安全存储不可用');
        }
        try {
            const encrypted = safeStorage.encryptString(value);
            return `${SAFE_VALUE_PREFIX}${Buffer.from(encrypted).toString('base64')}`;
        } catch {
            throw new VaultError('safe_storage_encrypt_failed', '系统安全存储加密失败');
        }
    }

    function unprotectWithSafeStorage(value) {
        if (!isEncryptionAvailable()) {
            throw new VaultError('safe_storage_unavailable', '当前系统安全存储不可用');
        }
        if (typeof value !== 'string' || !value.startsWith(SAFE_VALUE_PREFIX)) {
            throw new VaultError('invalid_ciphertext', '安全存储数据格式无效');
        }
        try {
            const payload = Buffer.from(value.slice(SAFE_VALUE_PREFIX.length), 'base64');
            return safeStorage.decryptString(payload);
        } catch {
            throw new VaultError('safe_storage_decrypt_failed', '系统安全存储解密失败');
        }
    }

    function encryptSnapshot(snapshot) {
        const iv = cryptoImpl.randomBytes(12);
        const cipher = cryptoImpl.createCipheriv('aes-256-gcm', sessionKey, iv);
        const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8');
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return {
            version: SESSION_SNAPSHOT_VERSION,
            algorithm: 'aes-256-gcm',
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            ciphertext: ciphertext.toString('base64')
        };
    }

    function decryptSnapshot(envelope) {
        if (!envelope || envelope.version !== SESSION_SNAPSHOT_VERSION || envelope.algorithm !== 'aes-256-gcm') {
            throw new VaultError('invalid_snapshot', '会话加密快照格式无效');
        }
        const decipher = cryptoImpl.createDecipheriv(
            'aes-256-gcm',
            sessionKey,
            Buffer.from(envelope.iv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
            decipher.final()
        ]);
        const snapshot = JSON.parse(plaintext.toString('utf8'));
        if (
            snapshot?.schemaVersion !== SESSION_SNAPSHOT_VERSION ||
            snapshot?.workspaceId !== workspaceId ||
            !Array.isArray(snapshot?.sessions)
        ) {
            throw new VaultError('invalid_snapshot', '会话加密快照内容无效');
        }
        return snapshot;
    }

    function switchToMemory(reason) {
        memoryOnly = true;
        memoryReason = reason;
        sessionKey = null;
        memorySnapshot = createEmptySnapshot(workspaceId);
    }

    function initializeSessions() {
        if (!isEncryptionAvailable()) {
            switchToMemory('safe_storage_unavailable');
            return;
        }

        try {
            const protectedKey = configStore.get('sessionDataKey', '');
            if (protectedKey) {
                sessionKey = Buffer.from(unprotectWithSafeStorage(protectedKey), 'base64');
                if (sessionKey.length !== 32) {
                    throw new VaultError('invalid_session_key', '会话数据密钥无效');
                }
            } else {
                sessionKey = cryptoImpl.randomBytes(32);
                configStore.set('sessionDataKey', protectWithSafeStorage(sessionKey.toString('base64')));
            }

            const encryptedSnapshot = sessionStore.get('encryptedSnapshot', null);
            if (encryptedSnapshot) {
                memorySnapshot = decryptSnapshot(encryptedSnapshot);
            } else {
                sessionStore.set('encryptedSnapshot', encryptSnapshot(memorySnapshot));
            }
        } catch {
            switchToMemory('session_decrypt_failed');
        }
    }

    function writeSnapshot(snapshot) {
        const next = cloneJson(snapshot);
        next.schemaVersion = SESSION_SNAPSHOT_VERSION;
        next.workspaceId = workspaceId;
        next.updatedAt = new Date().toISOString();
        memorySnapshot = next;

        if (memoryOnly || !sessionKey) {
            return { persisted: false, memoryOnly: true };
        }

        try {
            sessionStore.set('encryptedSnapshot', encryptSnapshot(next));
            return { persisted: true, memoryOnly: false };
        } catch {
            memoryOnly = true;
            memoryReason = 'session_persist_failed';
            sessionKey = null;
            return { persisted: false, memoryOnly: true };
        }
    }

    function readSnapshot() {
        return cloneJson(memorySnapshot);
    }

    function saveConfig(input = {}) {
        if (input.modelId !== undefined) {
            configStore.set('modelId', validateModelId(input.modelId));
        }

        if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
            const apiKey = input.apiKey.trim();
            if (apiKey.length > 4096) {
                throw new VaultError('invalid_api_key', 'API Key 长度不正确');
            }
            configStore.set('apiKey', protectWithSafeStorage(apiKey));
        }

        return getPublicStatus();
    }

    function clearApiKey() {
        configStore.delete('apiKey');
        return getPublicStatus();
    }

    function getApiKey() {
        const protectedKey = configStore.get('apiKey', '');
        if (!protectedKey) {
            throw new VaultError('no_key', '尚未配置火山方舟 API Key');
        }
        const value = unprotectWithSafeStorage(protectedKey).trim();
        if (!value) {
            throw new VaultError('no_key', '尚未配置火山方舟 API Key');
        }
        return value;
    }

    function getModelId() {
        const value = String(configStore.get('modelId', '') || '').trim();
        if (!value) {
            throw new VaultError('no_model', '尚未配置模型/推理接入点 ID');
        }
        return validateModelId(value);
    }

    function getRequestConfig() {
        return {
            apiKey: getApiKey(),
            modelId: getModelId()
        };
    }

    function getPublicStatus() {
        const protectedKey = configStore.get('apiKey', '');
        return {
            workspaceId,
            modelId: String(configStore.get('modelId', '') || ''),
            hasApiKey: typeof protectedKey === 'string' && protectedKey.startsWith(SAFE_VALUE_PREFIX),
            secureStorageAvailable: isEncryptionAvailable(),
            memoryOnly,
            memoryReason
        };
    }

    initializeSessions();

    return {
        clearApiKey,
        getPublicStatus,
        getRequestConfig,
        readSnapshot,
        saveConfig,
        writeSnapshot
    };
}

module.exports = {
    SAFE_VALUE_PREFIX,
    SESSION_SNAPSHOT_VERSION,
    VaultError,
    createEmptySnapshot,
    createSecureVault,
    validateModelId
};
