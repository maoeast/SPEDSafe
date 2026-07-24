const crypto = require('crypto');

const MAX_MESSAGE_CHARS = 12000;
const MAX_CONTEXT_MESSAGES = 30;
const MAX_CONTEXT_CHARS = 32000;

class SessionError extends Error {
    constructor(kind, message) {
        super(message);
        this.name = 'SessionError';
        this.kind = kind;
    }
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeContent(content) {
    const value = typeof content === 'string' ? content.trim() : '';
    if (!value) {
        throw new SessionError('empty_message', '请输入要发送的内容');
    }
    if (value.length > MAX_MESSAGE_CHARS) {
        throw new SessionError('message_too_long', `单条消息不能超过 ${MAX_MESSAGE_CHARS} 个字符`);
    }
    return value;
}

function createSessionService(options) {
    const vault = options.vault;
    const createId = options.randomUUID || crypto.randomUUID;
    const now = options.now || (() => new Date().toISOString());
    let snapshot = vault.readSnapshot();

    function persist() {
        vault.writeSnapshot(snapshot);
    }

    function touch(session) {
        session.updatedAt = now();
    }

    function findSession(sessionId) {
        const session = snapshot.sessions.find((item) => item.id === sessionId);
        if (!session) {
            throw new SessionError('session_not_found', '会话不存在或已被删除');
        }
        return session;
    }

    function assertIdle(session) {
        if (session.messages.some((message) => message.status === 'streaming')) {
            throw new SessionError('generation_in_progress', '请先停止当前生成');
        }
    }

    function makeTitle(content) {
        const compact = content.replace(/\s+/g, ' ').trim();
        return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact;
    }

    function createSession(title = '新对话') {
        const timestamp = now();
        const session = {
            id: createId(),
            title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 60) : '新对话',
            conversationRevision: 0,
            messages: [],
            createdAt: timestamp,
            updatedAt: timestamp
        };
        snapshot.sessions.push(session);
        persist();
        return cloneJson(session);
    }

    function listSessions() {
        return snapshot.sessions
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((session) => ({
                id: session.id,
                title: session.title,
                conversationRevision: session.conversationRevision,
                messageCount: session.messages.length,
                isStreaming: session.messages.some((message) => message.status === 'streaming'),
                updatedAt: session.updatedAt
            }));
    }

    function getSession(sessionId) {
        return cloneJson(findSession(sessionId));
    }

    function deleteSession(sessionId) {
        const index = snapshot.sessions.findIndex((session) => session.id === sessionId);
        if (index < 0) {
            return false;
        }
        snapshot.sessions.splice(index, 1);
        persist();
        return true;
    }

    function clearSessions() {
        snapshot.sessions = [];
        persist();
    }

    function createAssistantPlaceholder(session, requestId) {
        const message = {
            id: createId(),
            role: 'assistant',
            content: '',
            status: 'streaming',
            requestId,
            createdAt: now()
        };
        session.messages.push(message);
        return message;
    }

    function transactionResult(session, userMessage, assistantMessage, mode) {
        return {
            mode,
            sessionId: session.id,
            conversationRevision: session.conversationRevision,
            requestId: assistantMessage.requestId,
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
            userContent: userMessage.content
        };
    }

    function beginSend(sessionId, content, requestId) {
        const session = findSession(sessionId);
        assertIdle(session);
        const normalized = normalizeContent(content);
        const userMessage = {
            id: createId(),
            role: 'user',
            content: normalized,
            status: 'complete',
            createdAt: now()
        };
        session.messages.push(userMessage);
        session.conversationRevision += 1;
        const assistantMessage = createAssistantPlaceholder(session, requestId);
        if (session.title === '新对话') {
            session.title = makeTitle(normalized);
        }
        touch(session);
        persist();
        return transactionResult(session, userMessage, assistantMessage, 'send');
    }

    function beginEditAndResend(sessionId, userMessageId, content, requestId) {
        const session = findSession(sessionId);
        assertIdle(session);
        const userIndexes = session.messages
            .map((message, index) => message.role === 'user' ? index : -1)
            .filter((index) => index >= 0);
        const lastUserIndex = userIndexes[userIndexes.length - 1];
        const userMessage = session.messages[lastUserIndex];
        if (!userMessage || userMessage.id !== userMessageId) {
            throw new SessionError('not_last_user_message', '只能编辑最后一条用户消息');
        }

        userMessage.content = normalizeContent(content);
        userMessage.editedAt = now();
        session.messages.splice(lastUserIndex + 1);
        session.conversationRevision += 1;
        const assistantMessage = createAssistantPlaceholder(session, requestId);
        touch(session);
        persist();
        return transactionResult(session, userMessage, assistantMessage, 'edit');
    }

    function beginRegenerate(sessionId, assistantMessageId, requestId) {
        const session = findSession(sessionId);
        assertIdle(session);
        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.id !== assistantMessageId) {
            throw new SessionError('not_last_assistant_message', '只能重新生成最后一条回答');
        }

        let lastUserIndex = -1;
        for (let index = session.messages.length - 2; index >= 0; index -= 1) {
            if (session.messages[index].role === 'user') {
                lastUserIndex = index;
                break;
            }
        }
        if (lastUserIndex < 0) {
            throw new SessionError('no_user_message', '当前会话没有可重新发送的用户消息');
        }

        const userMessage = session.messages[lastUserIndex];
        session.messages.splice(lastUserIndex + 1);
        session.conversationRevision += 1;
        const assistantMessage = createAssistantPlaceholder(session, requestId);
        touch(session);
        persist();
        return transactionResult(session, userMessage, assistantMessage, 'regenerate');
    }

    function findTarget(meta) {
        const session = snapshot.sessions.find((item) => item.id === meta.sessionId);
        if (!session || session.conversationRevision !== meta.conversationRevision) {
            return null;
        }
        const message = session.messages.find((item) => item.id === meta.assistantMessageId);
        if (
            !message ||
            message.role !== 'assistant' ||
            message.status !== 'streaming' ||
            message.requestId !== meta.requestId
        ) {
            return null;
        }
        return { session, message };
    }

    function appendChunk(meta, delta) {
        const target = findTarget(meta);
        if (!target || typeof delta !== 'string' || !delta) {
            return false;
        }
        target.message.content += delta;
        touch(target.session);
        persist();
        return true;
    }

    function completeGeneration(meta, usage = null) {
        const target = findTarget(meta);
        if (!target) {
            return false;
        }
        target.message.status = 'complete';
        target.message.requestId = null;
        target.message.usage = usage;
        target.message.completedAt = now();
        touch(target.session);
        persist();
        return true;
    }

    function stopGeneration(meta) {
        const target = findTarget(meta);
        if (!target) {
            return false;
        }
        target.message.status = 'stopped';
        target.message.requestId = null;
        target.message.completedAt = now();
        touch(target.session);
        persist();
        return true;
    }

    function failGeneration(meta, error) {
        const target = findTarget(meta);
        if (!target) {
            return false;
        }
        target.message.status = 'error';
        target.message.requestId = null;
        target.message.error = {
            kind: String(error?.kind || 'unknown'),
            message: String(error?.message || '生成失败')
        };
        target.message.completedAt = now();
        touch(target.session);
        persist();
        return true;
    }

    function getRequestMessages(meta) {
        const session = findSession(meta.sessionId);
        if (session.conversationRevision !== meta.conversationRevision) {
            throw new SessionError('stale_revision', '会话已更新，请重试');
        }
        const assistantIndex = session.messages.findIndex((message) => message.id === meta.assistantMessageId);
        if (assistantIndex < 0) {
            throw new SessionError('message_not_found', '生成消息不存在');
        }

        const candidates = session.messages
            .slice(0, assistantIndex)
            .filter((message) => (
                message.role === 'user' ||
                (message.role === 'assistant' && message.content.trim())
            ))
            .map((message) => ({ role: message.role, content: message.content }));

        const selected = [];
        let totalChars = 0;
        for (let index = candidates.length - 1; index >= 0; index -= 1) {
            const message = candidates[index];
            if (selected.length >= MAX_CONTEXT_MESSAGES) {
                break;
            }
            if (selected.length > 0 && totalChars + message.content.length > MAX_CONTEXT_CHARS) {
                break;
            }
            selected.unshift(message);
            totalChars += message.content.length;
        }
        return selected;
    }

    function getLastUserContent(sessionId) {
        const session = findSession(sessionId);
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
            if (session.messages[index].role === 'user') {
                return session.messages[index].content;
            }
        }
        throw new SessionError('no_user_message', '当前会话没有用户消息');
    }

    let recoveredInterrupted = false;
    for (const session of snapshot.sessions) {
        for (const message of session.messages) {
            if (message.status === 'streaming') {
                message.status = 'stopped';
                message.requestId = null;
                message.completedAt = now();
                recoveredInterrupted = true;
            }
        }
    }
    if (recoveredInterrupted) {
        persist();
    }

    return {
        appendChunk,
        beginEditAndResend,
        beginRegenerate,
        beginSend,
        clearSessions,
        completeGeneration,
        createSession,
        deleteSession,
        failGeneration,
        getLastUserContent,
        getRequestMessages,
        getSession,
        listSessions,
        stopGeneration
    };
}

module.exports = {
    MAX_CONTEXT_CHARS,
    MAX_CONTEXT_MESSAGES,
    MAX_MESSAGE_CHARS,
    SessionError,
    createSessionService,
    normalizeContent
};
