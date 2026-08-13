const { createArkClient } = require('./ark-client');
const { createAssistantService, publicError } = require('./assistant-service');
const { PROMPT_VERSION } = require('./child-safety-prompt');
const { createSecureVault, DEFAULT_MODEL_ID } = require('./secure-vault');
const { createSessionService } = require('./session-service');

const EVENT_CHANNEL = 'child-safety:event';

const CHANNELS = {
    getStatus: 'child-safety:get-status',
    saveConfig: 'child-safety:save-config',
    clearApiKey: 'child-safety:clear-api-key',
    listSessions: 'child-safety:list-sessions',
    createSession: 'child-safety:create-session',
    getSession: 'child-safety:get-session',
    deleteSession: 'child-safety:delete-session',
    clearHistory: 'child-safety:clear-history',
    sendMessage: 'child-safety:send-message',
    stopGeneration: 'child-safety:stop-generation',
    editAndResend: 'child-safety:edit-and-resend',
    regenerate: 'child-safety:regenerate'
};

function requireString(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        const error = new Error(`${label}无效`);
        error.kind = 'invalid_input';
        throw error;
    }
    return value.trim();
}

function makeEmitter(event) {
    return (payload) => {
        if (!event.sender.isDestroyed()) {
            event.sender.send(EVENT_CHANNEL, payload);
        }
    };
}

function registerHandlers(ipcMain, service) {
    const registered = [];

    function handle(channel, handler) {
        ipcMain.handle(channel, async (event, payload) => {
            try {
                const result = await handler(event, payload || {});
                return result?.success === false ? result : { success: true, ...result };
            } catch (error) {
                return { success: false, error: publicError(error) };
            }
        });
        registered.push(channel);
    }

    handle(CHANNELS.getStatus, () => service.getStatus());
    handle(CHANNELS.saveConfig, (_event, payload) => service.saveConfig({
        apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : undefined,
        modelId: typeof payload.modelId === 'string' ? payload.modelId : undefined
    }));
    handle(CHANNELS.clearApiKey, () => service.clearApiKey());
    handle(CHANNELS.listSessions, () => ({ sessions: service.listSessions() }));
    handle(CHANNELS.createSession, (_event, payload) => ({
        session: service.createSession(typeof payload.title === 'string' ? payload.title : undefined)
    }));
    handle(CHANNELS.getSession, (_event, payload) => ({
        session: service.getSession(requireString(payload.sessionId, '会话标识'))
    }));
    handle(CHANNELS.deleteSession, (_event, payload) => ({
        deleted: service.deleteSession(requireString(payload.sessionId, '会话标识'))
    }));
    handle(CHANNELS.clearHistory, () => {
        service.clearHistory();
        return { cleared: true };
    });
    handle(CHANNELS.sendMessage, (event, payload) => service.sendMessage({
        sessionId: requireString(payload.sessionId, '会话标识'),
        content: typeof payload.content === 'string' ? payload.content : '',
        requestId: requireString(payload.requestId, '请求标识')
    }, makeEmitter(event)));
    handle(CHANNELS.stopGeneration, (_event, payload) => service.stopRequest(
        requireString(payload.requestId, '请求标识')
    ));
    handle(CHANNELS.editAndResend, (event, payload) => service.editAndResend({
        sessionId: requireString(payload.sessionId, '会话标识'),
        messageId: requireString(payload.messageId, '消息标识'),
        content: typeof payload.content === 'string' ? payload.content : '',
        requestId: requireString(payload.requestId, '请求标识')
    }, makeEmitter(event)));
    handle(CHANNELS.regenerate, (event, payload) => service.regenerate({
        sessionId: requireString(payload.sessionId, '会话标识'),
        messageId: requireString(payload.messageId, '消息标识'),
        requestId: requireString(payload.requestId, '请求标识')
    }, makeEmitter(event)));

    return () => {
        for (const channel of registered) {
            ipcMain.removeHandler(channel);
        }
    };
}

function createChildSafetyAssistantRuntime(options) {
    const configStore = new options.Store({
        name: 'child-safety-assistant-config',
        defaults: {
            workspaceId: '',
            modelId: DEFAULT_MODEL_ID,
            apiKey: '',
            sessionDataKey: ''
        }
    });
    const sessionStore = new options.Store({
        name: 'child-safety-assistant-sessions',
        defaults: {}
    });
    const vault = createSecureVault({
        safeStorage: options.safeStorage,
        configStore,
        sessionStore
    });
    const sessionService = createSessionService({ vault });
    const arkClient = createArkClient({ fetchImpl: options.fetchImpl });
    const service = createAssistantService({ vault, sessionService, arkClient });
    const unregister = registerHandlers(options.ipcMain, service);

    return {
        promptVersion: PROMPT_VERSION,
        service,
        shutdown() {
            service.shutdown();
            unregister();
        }
    };
}

module.exports = {
    CHANNELS,
    EVENT_CHANNEL,
    createChildSafetyAssistantRuntime,
    makeEmitter,
    registerHandlers
};
