const { detectP0 } = require('./p0-safety');
const { PROMPT_VERSION, SYSTEM_PROMPT } = require('./child-safety-prompt');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

class AssistantServiceError extends Error {
    constructor(kind, message) {
        super(message);
        this.name = 'AssistantServiceError';
        this.kind = kind;
    }
}

function validateRequestId(requestId) {
    const value = typeof requestId === 'string' ? requestId.trim() : '';
    if (!REQUEST_ID_PATTERN.test(value)) {
        throw new AssistantServiceError('invalid_request_id', '请求标识无效，请重试');
    }
    return value;
}

function publicError(error) {
    return {
        kind: String(error?.kind || 'internal'),
        message: String(error?.message || '生成失败，请重试')
    };
}

function createAssistantService(options) {
    const vault = options.vault;
    const sessions = options.sessionService;
    const arkClient = options.arkClient;
    const activeRequests = new Map();

    function getStatus() {
        return {
            ...vault.getPublicStatus(),
            promptVersion: PROMPT_VERSION,
            agentName: '儿童安全小助手',
            activeRequests: Array.from(activeRequests.keys())
        };
    }

    function assertNoActiveRequest() {
        if (activeRequests.size > 0) {
            throw new AssistantServiceError('generation_in_progress', '请先停止当前生成');
        }
    }

    function emitSafely(emit, payload) {
        try {
            emit?.(payload);
        } catch {
            // Renderer may close while the Main request is still unwinding.
        }
    }

    function emitWithMeta(emit, type, meta, extra = {}) {
        emitSafely(emit, {
            type,
            sessionId: meta.sessionId,
            conversationRevision: meta.conversationRevision,
            requestId: meta.requestId,
            messageId: meta.assistantMessageId,
            ...extra
        });
    }

    function beginTransaction(mode, input, requestId) {
        if (mode === 'send') {
            return sessions.beginSend(input.sessionId, input.content, requestId);
        }
        if (mode === 'edit') {
            return sessions.beginEditAndResend(input.sessionId, input.messageId, input.content, requestId);
        }
        return sessions.beginRegenerate(input.sessionId, input.messageId, requestId);
    }

    function getUserContent(mode, input) {
        if (mode === 'regenerate') {
            return sessions.getLastUserContent(input.sessionId);
        }
        return input.content;
    }

    async function generate(mode, input, emit) {
        assertNoActiveRequest();
        const requestId = validateRequestId(input.requestId);
        const userContent = getUserContent(mode, input);
        const emergency = detectP0(userContent);
        const requestConfig = emergency ? null : vault.getRequestConfig();
        const meta = beginTransaction(mode, input, requestId);

        emitWithMeta(emit, 'start', meta, {
            mode,
            session: sessions.getSession(meta.sessionId)
        });

        if (emergency) {
            sessions.appendChunk(meta, emergency.content);
            emitWithMeta(emit, 'chunk', meta, { delta: emergency.content, local: true });
            sessions.completeGeneration(meta, null);
            emitWithMeta(emit, 'done', meta, {
                local: true,
                emergencyKind: emergency.kind,
                phoneNumbers: emergency.phoneNumbers,
                session: sessions.getSession(meta.sessionId)
            });
            return {
                success: true,
                local: true,
                ...meta
            };
        }

        const controller = new AbortController();
        activeRequests.set(requestId, { controller, emit, meta });

        try {
            const result = await arkClient.streamChat({
                apiKey: requestConfig.apiKey,
                modelId: requestConfig.modelId,
                messages: sessions.getRequestMessages(meta),
                systemPrompt: SYSTEM_PROMPT,
                signal: controller.signal,
                onDelta(delta) {
                    if (sessions.appendChunk(meta, delta)) {
                        emitWithMeta(emit, 'chunk', meta, { delta });
                    }
                }
            });

            const completed = sessions.completeGeneration(meta, result.usage);
            if (completed) {
                emitWithMeta(emit, 'done', meta, {
                    usage: result.usage,
                    session: sessions.getSession(meta.sessionId)
                });
            }
            return {
                success: completed,
                stale: !completed,
                ...meta
            };
        } catch (error) {
            if (error?.kind === 'aborted') {
                const stopped = sessions.stopGeneration(meta);
                if (stopped) {
                    emitWithMeta(emit, 'stopped', meta, {
                        session: sessions.getSession(meta.sessionId)
                    });
                }
                return {
                    success: false,
                    stopped: true,
                    ...meta
                };
            }

            const safeError = publicError(error);
            const failed = sessions.failGeneration(meta, safeError);
            if (failed) {
                emitWithMeta(emit, 'error', meta, {
                    error: safeError,
                    session: sessions.getSession(meta.sessionId)
                });
            }
            return {
                success: false,
                error: safeError,
                ...meta
            };
        } finally {
            const active = activeRequests.get(requestId);
            if (active?.controller === controller) {
                activeRequests.delete(requestId);
            }
        }
    }

    function stopRequest(requestId) {
        const value = validateRequestId(requestId);
        const active = activeRequests.get(value);
        if (!active) {
            return { success: false, error: { kind: 'not_active', message: '该请求已结束' } };
        }

        const stopped = sessions.stopGeneration(active.meta);
        active.controller.abort();
        activeRequests.delete(value);
        if (stopped) {
            emitWithMeta(active.emit, 'stopped', active.meta, {
                session: sessions.getSession(active.meta.sessionId)
            });
        }
        return { success: true, stopped };
    }

    function stopRequestsForSession(sessionId) {
        for (const [requestId, active] of activeRequests) {
            if (active.meta.sessionId === sessionId) {
                stopRequest(requestId);
            }
        }
    }

    function stopAll() {
        for (const requestId of Array.from(activeRequests.keys())) {
            stopRequest(requestId);
        }
    }

    function deleteSession(sessionId) {
        stopRequestsForSession(sessionId);
        return sessions.deleteSession(sessionId);
    }

    function clearHistory() {
        stopAll();
        sessions.clearSessions();
    }

    return {
        clearApiKey: () => vault.clearApiKey(),
        clearHistory,
        createSession: (title) => sessions.createSession(title),
        deleteSession,
        editAndResend: (input, emit) => generate('edit', input, emit),
        getSession: (sessionId) => sessions.getSession(sessionId),
        getStatus,
        listSessions: () => sessions.listSessions(),
        regenerate: (input, emit) => generate('regenerate', input, emit),
        saveConfig: (input) => vault.saveConfig(input),
        sendMessage: (input, emit) => generate('send', input, emit),
        shutdown: stopAll,
        stopRequest
    };
}

module.exports = {
    AssistantServiceError,
    REQUEST_ID_PATTERN,
    createAssistantService,
    publicError,
    validateRequestId
};
