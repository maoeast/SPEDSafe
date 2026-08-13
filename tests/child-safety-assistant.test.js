const test = require('node:test');
const assert = require('node:assert/strict');

const { detectP0 } = require('../ai/p0-safety');
const {
    ARK_BASE_URL,
    ArkClientError,
    createArkClient
} = require('../ai/ark-client');
const { createAssistantService } = require('../ai/assistant-service');
const {
    createSecureVault,
    VaultError
} = require('../ai/secure-vault');
const { createSessionService } = require('../ai/session-service');
const {
    CHANNELS,
    registerHandlers
} = require('../ai/ipc');

class MemoryStore {
    constructor(data = {}) {
        this.data = data;
    }

    get(key, fallback) {
        return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    }

    set(key, value) {
        this.data[key] = value;
    }

    delete(key) {
        delete this.data[key];
    }
}

function createSafeStorage(available = true) {
    return {
        isEncryptionAvailable: () => available,
        encryptString(value) {
            return Buffer.from('wrapped:' + value, 'utf8');
        },
        decryptString(buffer) {
            const value = Buffer.from(buffer).toString('utf8');
            if (!value.startsWith('wrapped:')) {
                throw new Error('bad ciphertext');
            }
            return value.slice('wrapped:'.length);
        }
    };
}

function createVaultFixture(available = true) {
    const configData = {};
    const sessionData = {};
    const vault = createSecureVault({
        safeStorage: createSafeStorage(available),
        configStore: new MemoryStore(configData),
        sessionStore: new MemoryStore(sessionData)
    });
    return { vault, configData, sessionData };
}

function createSessionFixture(available = true) {
    const fixture = createVaultFixture(available);
    const service = createSessionService({
        vault: fixture.vault,
        randomUUID: (() => {
            let index = 0;
            return () => 'id-' + (++index);
        })(),
        now: (() => {
            let index = 0;
            return () => '2026-07-23T00:00:0' + (++index) + '.000Z';
        })()
    });
    return { ...fixture, service };
}

function readerFor(chunks) {
    let index = 0;
    return {
        getReader() {
            return {
                async read() {
                    if (index >= chunks.length) {
                        return { done: true };
                    }
                    return { done: false, value: chunks[index++] };
                },
                releaseLock() {}
            };
        }
    };
}

test('P0 本地响应识别正在发生的高危事件，预防性问题不误触发', () => {
    assert.deepEqual(detectP0('孩子现在正在窒息'), {
        kind: 'medical',
        local: true,
        phoneNumbers: ['120'],
        content: '这是正在发生的紧急情况。请立即拨打中国大陆医疗急救电话 120。本助手不提供现场急救或救援操作，请不要等待进一步分析。'
    });
    assert.equal(detectP0('现在正在发生火灾').kind, 'fire');
    assert.equal(detectP0('孩子现在正在着火').kind, 'fire');
    assert.equal(detectP0('儿童当前失踪，找不到了').kind, 'police');
    assert.equal(detectP0('怎么预防孩子溺水'), null);
    assert.equal(detectP0('如果孩子溺水怎么办'), null);
});

test('方舟客户端固定 URL，构建安全请求并解析跨 chunk SSE', async () => {
    let request;
    const chunks = [
        Buffer.from('data: {"choices":[{"delta":{"content":"先"}}]}\r\n\r'),
        Buffer.from('\ndata: {"choices":[{"delta":{"content":"确认当前安全。"}}]}\n\n'),
        Buffer.from('data: {"usage":{"prompt_tokens":8,"completion_tokens":5,"total_tokens":13}}\n\n'),
        Buffer.from('data: [DONE]\n\n')
    ];
    const client = createArkClient({
        fetchImpl: async (url, options) => {
            request = { url, options: JSON.parse(options.body) };
            return { ok: true, status: 200, body: readerFor(chunks) };
        }
    });

    const result = await client.streamChat({
        apiKey: 'key-only-in-main-test',
        modelId: 'ep-test',
        systemPrompt: '内置提示词',
        messages: [{ role: 'user', content: '我想学习过马路安全' }]
    });

    assert.equal(request.url, ARK_BASE_URL + '/chat/completions');
    assert.equal(request.options.model, 'ep-test');
    assert.equal(request.options.stream, true);
    assert.deepEqual(request.options.tools, []);
    assert.equal(request.options.messages[0].role, 'system');
    assert.equal(result.content, '先确认当前安全。');
    assert.deepEqual(result.usage, {
        promptTokens: 8,
        completionTokens: 5,
        totalTokens: 13
    });
});

test('方舟 HTTP 错误被归一化且不暴露请求凭据', async () => {
    const client = createArkClient({
        fetchImpl: async () => ({
            ok: false,
            status: 401,
            text: async () => JSON.stringify({ error: { message: 'secret-value leaked upstream' } })
        })
    });

    await assert.rejects(
        client.streamChat({
            apiKey: 'secret-value',
            modelId: 'ep-test',
            systemPrompt: '内置提示词',
            messages: [{ role: 'user', content: '测试' }]
        }),
        (error) => {
            assert.ok(error instanceof ArkClientError);
            assert.equal(error.kind, 'auth');
            assert.equal(error.message.includes('secret-value'), false);
            return true;
        }
    );
});

test('safeStorage 可用时只落加密会话，状态不返回 Key', () => {
    const fixture = createVaultFixture(true);
    fixture.vault.saveConfig({ apiKey: 'api-key-secret', modelId: 'ep-test' });
    const status = fixture.vault.getPublicStatus();

    assert.equal(status.hasApiKey, true);
    assert.equal(status.modelId, 'ep-test');
    assert.equal(Object.prototype.hasOwnProperty.call(status, 'apiKey'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(status, 'apiKeyEncrypted'), false);
    assert.equal(JSON.stringify(fixture.sessionData).includes('session-secret'), false);

    const snapshot = fixture.vault.readSnapshot();
    snapshot.sessions.push({
        id: 'session-1',
        title: '安全',
        conversationRevision: 1,
        messages: [{ id: 'message-1', role: 'user', content: 'session-secret', status: 'complete' }]
    });
    fixture.vault.writeSnapshot(snapshot);
    assert.equal(JSON.stringify(fixture.sessionData).includes('session-secret'), false);
    assert.ok(fixture.sessionData.encryptedSnapshot.ciphertext);
});

test('未配置时预置默认模型接入点 ID，用户可覆盖', () => {
    const fixture = createVaultFixture(true);

    // 未配置：状态返回预置默认，仅缺 API Key
    const initial = fixture.vault.getPublicStatus();
    assert.equal(initial.modelId, 'deepseek-v4-flash-ga-260731');
    assert.equal(initial.hasApiKey, false);
    assert.throws(() => fixture.vault.getRequestConfig(), (err) => err.kind === 'no_key');

    // 只配置 API Key：请求配置自动使用预置默认模型 ID（默认值通过格式校验）
    fixture.vault.saveConfig({ apiKey: 'key-only' });
    assert.deepEqual(fixture.vault.getRequestConfig(), {
        apiKey: 'key-only',
        modelId: 'deepseek-v4-flash-ga-260731'
    });

    // 用户保存自定义模型 ID 后覆盖默认
    fixture.vault.saveConfig({ apiKey: 'key-only', modelId: 'ep-custom-1' });
    assert.equal(fixture.vault.getPublicStatus().modelId, 'ep-custom-1');
    assert.deepEqual(fixture.vault.getRequestConfig(), {
        apiKey: 'key-only',
        modelId: 'ep-custom-1'
    });
});


test('加密会话可在服务重启后恢复，落盘内容不含正文', () => {
    const configData = {};
    const sessionData = {};
    const firstVault = createSecureVault({
        safeStorage: createSafeStorage(true),
        configStore: new MemoryStore(configData),
        sessionStore: new MemoryStore(sessionData)
    });
    const firstSessions = createSessionService({ vault: firstVault });
    const session = firstSessions.createSession();
    const transaction = firstSessions.beginSend(session.id, '需要跨重启保留的正文', 'request-persist-1');
    firstSessions.appendChunk(transaction, '已加密保存的回答');
    firstSessions.completeGeneration(transaction);

    assert.equal(JSON.stringify(sessionData).includes('跨重启'), false);
    assert.equal(JSON.stringify(sessionData).includes('已加密保存'), false);

    const reopenedVault = createSecureVault({
        safeStorage: createSafeStorage(true),
        configStore: new MemoryStore(configData),
        sessionStore: new MemoryStore(sessionData)
    });
    const reopenedSessions = createSessionService({ vault: reopenedVault });
    const restored = reopenedSessions.getSession(session.id);
    assert.equal(restored.messages[0].content, '需要跨重启保留的正文');
    assert.equal(restored.messages[1].content, '已加密保存的回答');
});

test('safeStorage 不可用时只保留内存会话，不写明文快照', () => {
    const fixture = createVaultFixture(false);
    const status = fixture.vault.getPublicStatus();
    assert.equal(status.memoryOnly, true);
    assert.equal(status.secureStorageAvailable, false);
    const snapshot = fixture.vault.readSnapshot();
    snapshot.sessions.push({ id: 'memory-1', title: '内存', conversationRevision: 0, messages: [] });
    fixture.vault.writeSnapshot(snapshot);
    assert.deepEqual(fixture.sessionData, {});
    assert.throws(
        () => fixture.vault.saveConfig({ apiKey: 'should-not-persist', modelId: 'ep-test' }),
        (error) => error instanceof VaultError && error.kind === 'safe_storage_unavailable'
    );
});

test('编辑重发替换原用户消息，重生成不重复插入用户消息，旧流不能回写', () => {
    const { service } = createSessionFixture(true);
    const session = service.createSession();
    const first = service.beginSend(session.id, '第一条问题', 'request-111');
    assert.equal(service.appendChunk(first, '旧回答'), true);
    assert.equal(service.completeGeneration(first), true);

    const edited = service.beginEditAndResend(session.id, first.userMessageId, '修改后的问题', 'request-222');
    let current = service.getSession(session.id);
    assert.equal(current.messages.length, 2);
    assert.equal(current.messages[0].id, first.userMessageId);
    assert.equal(current.messages[0].content, '修改后的问题');
    assert.equal(current.messages[1].content, '');
    assert.equal(service.appendChunk(first, '晚到的旧流'), false);
    assert.equal(service.appendChunk({
        ...edited,
        conversationRevision: edited.conversationRevision - 1
    }, '错误修订流'), false);
    assert.equal(service.appendChunk({
        ...edited,
        requestId: 'request-wrong'
    }, '错误请求流'), false);
    assert.equal(service.appendChunk({
        ...edited,
        assistantMessageId: 'id-wrong'
    }, '错误消息流'), false);

    assert.equal(service.appendChunk(edited, '新回答'), true);
    assert.equal(service.completeGeneration(edited), true);
    const regenerated = service.beginRegenerate(session.id, edited.assistantMessageId, 'request-333');
    current = service.getSession(session.id);
    assert.equal(current.messages.filter((message) => message.role === 'user').length, 1);
    assert.equal(current.messages.length, 2);
    assert.equal(current.messages[0].content, '修改后的问题');
    assert.equal(current.messages[1].id, regenerated.assistantMessageId);
});

test('停止生成会中止网络请求并只发布一次停止状态', async () => {
    const { vault } = createVaultFixture(true);
    vault.saveConfig({ apiKey: 'api-key-secret', modelId: 'ep-test' });
    const sessions = createSessionService({ vault });
    const session = sessions.createSession();
    const events = [];
    const service = createAssistantService({
        vault,
        sessionService: sessions,
        arkClient: {
            streamChat: (input) => new Promise((_resolve, reject) => {
                input.signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.kind = 'aborted';
                    reject(error);
                }, { once: true });
            })
        }
    });

    const generation = service.sendMessage({
        sessionId: session.id,
        content: '讲讲校门口安全',
        requestId: 'request-stop-1'
    }, (event) => events.push(event));
    const stopped = service.stopRequest('request-stop-1');
    const result = await generation;

    assert.equal(stopped.success, true);
    assert.equal(result.stopped, true);
    assert.equal(events.filter((event) => event.type === 'stopped').length, 1);
    assert.equal(sessions.getSession(session.id).messages[1].status, 'stopped');
    assert.deepEqual(service.getStatus().activeRequests, []);
});

test('会话可删除且清空历史后不保留旧会话', () => {
    const { service } = createSessionFixture(true);
    const first = service.createSession('第一条会话');
    const second = service.createSession('第二条会话');

    assert.equal(service.listSessions().length, 2);
    assert.equal(service.deleteSession(first.id), true);
    assert.deepEqual(service.listSessions().map((session) => session.id), [second.id]);

    service.clearSessions();
    assert.deepEqual(service.listSessions(), []);
});

test('P0 服务路径不读取 Key、不调用网络，并保存本地回答', async () => {
    const { vault } = createVaultFixture(true);
    const sessions = createSessionService({ vault });
    const session = sessions.createSession();
    let networkCalls = 0;
    const events = [];
    const service = createAssistantService({
        vault,
        sessionService: sessions,
        arkClient: {
            streamChat: async () => {
                networkCalls += 1;
                throw new Error('network should not be called');
            }
        }
    });

    const result = await service.sendMessage({
        sessionId: session.id,
        content: '孩子现在正在窒息',
        requestId: 'request-p0-1'
    }, (event) => events.push(event));

    assert.equal(result.success, true);
    assert.equal(result.local, true);
    assert.equal(networkCalls, 0);
    assert.ok(events.some((event) => event.type === 'done' && event.local));
    const saved = sessions.getSession(session.id);
    assert.equal(saved.messages[1].status, 'complete');
    assert.match(saved.messages[1].content, /120/);
});

test('IPC 只向服务层传递固定字段，丢弃 Base URL、提示词、历史和工具', async () => {
    const handlers = new Map();
    const ipcMain = {
        handle(channel, handler) {
            handlers.set(channel, handler);
        },
        removeHandler(channel) {
            handlers.delete(channel);
        }
    };
    const captured = {};
    const service = {
        getStatus: () => ({ agentName: '儿童安全小助手' }),
        saveConfig: (input) => { captured.config = input; return { saved: true }; },
        clearApiKey: () => ({}),
        listSessions: () => [],
        createSession: () => ({}),
        getSession: () => ({}),
        deleteSession: () => true,
        clearHistory: () => {},
        sendMessage: (input) => { captured.send = input; return { success: true }; },
        stopRequest: () => ({ success: true }),
        editAndResend: () => ({ success: true }),
        regenerate: () => ({ success: true })
    };
    registerHandlers(ipcMain, service);
    const event = { sender: { isDestroyed: () => false, send: () => {} } };

    await handlers.get(CHANNELS.saveConfig)(event, {
        apiKey: 'key',
        modelId: 'ep-test',
        baseUrl: 'https://untrusted.example',
        systemPrompt: 'untrusted',
        messages: [{ role: 'user', content: 'history' }],
        tools: [{ type: 'function' }]
    });
    assert.deepEqual(captured.config, { apiKey: 'key', modelId: 'ep-test' });

    await handlers.get(CHANNELS.sendMessage)(event, {
        sessionId: 'session-1',
        content: '当前问题',
        requestId: 'request-123',
        baseUrl: 'https://untrusted.example',
        systemPrompt: 'untrusted',
        messages: [{ role: 'user', content: 'history' }],
        tools: [{ type: 'function' }]
    });
    assert.deepEqual(captured.send, {
        sessionId: 'session-1',
        content: '当前问题',
        requestId: 'request-123'
    });
});
