const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_TIMEOUT_MS = 90000;

class ArkClientError extends Error {
    constructor(kind, message, options = {}) {
        super(message);
        this.name = 'ArkClientError';
        this.kind = kind;
        this.httpStatus = options.httpStatus;
    }
}

function mapUsage(usage) {
    if (!usage || typeof usage !== 'object') {
        return null;
    }

    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    return {
        promptTokens,
        completionTokens,
        totalTokens: Number(usage.total_tokens || promptTokens + completionTokens)
    };
}

function describeHttpError(status) {
    if (status === 401 || status === 403) {
        return new ArkClientError('auth', '火山方舟 API Key 无效或无权访问该接入点', { httpStatus: status });
    }
    if (status === 404) {
        return new ArkClientError('model_not_found', '未找到该模型或推理接入点，请检查接入点 ID', { httpStatus: status });
    }
    if (status === 429) {
        return new ArkClientError('rate_limit', '火山方舟请求过于频繁，请稍后再试', { httpStatus: status });
    }
    return new ArkClientError('http_error', `火山方舟返回 HTTP ${status}`, { httpStatus: status });
}

function splitSseEvents(buffer) {
    const events = [];
    let remaining = buffer;
    let match = remaining.match(/\r?\n\r?\n/);

    while (match && match.index !== undefined) {
        events.push(remaining.slice(0, match.index));
        remaining = remaining.slice(match.index + match[0].length);
        match = remaining.match(/\r?\n\r?\n/);
    }

    return { events, remaining };
}

function parseSseEvent(rawEvent) {
    const dataLines = [];
    for (const line of rawEvent.split(/\r?\n/)) {
        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
        }
    }
    return dataLines.join('\n').trim();
}

async function* readBodyChunks(body) {
    if (!body) {
        throw new ArkClientError('empty_response', '火山方舟未返回可读取的响应流');
    }

    if (typeof body.getReader === 'function') {
        const reader = body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                yield value;
            }
        } finally {
            reader.releaseLock?.();
        }
        return;
    }

    if (body[Symbol.asyncIterator]) {
        for await (const chunk of body) {
            yield chunk;
        }
        return;
    }

    throw new ArkClientError('empty_response', '火山方舟响应流格式不可读取');
}

function processEventData(data, handlers, state) {
    if (!data || data === '[DONE]') {
        if (data === '[DONE]') {
            state.doneReceived = true;
        }
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(data);
    } catch {
        throw new ArkClientError('invalid_stream', '火山方舟返回了无法解析的流式数据');
    }

    const delta = parsed?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
        state.content += delta;
        handlers.onDelta?.(delta);
    }
    if (parsed?.usage) {
        state.usage = mapUsage(parsed.usage);
        handlers.onUsage?.(state.usage);
    }
}

function createArkClient(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

    if (typeof fetchImpl !== 'function') {
        throw new TypeError('当前运行时不支持 fetch');
    }

    async function streamChat(input) {
        const controller = new AbortController();
        let timedOut = false;
        const onExternalAbort = () => controller.abort();
        input.signal?.addEventListener('abort', onExternalAbort, { once: true });
        if (input.signal?.aborted) {
            controller.abort();
        }

        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);

        try {
            let response;
            try {
                response = await fetchImpl(`${ARK_BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${input.apiKey}`
                    },
                    body: JSON.stringify({
                        model: input.modelId,
                        messages: [
                            { role: 'system', content: input.systemPrompt },
                            ...input.messages
                        ],
                        stream: true,
                        stream_options: { include_usage: true },
                        tools: []
                    }),
                    signal: controller.signal
                });
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw new ArkClientError(timedOut ? 'timeout' : 'aborted', timedOut
                        ? `火山方舟请求超过 ${Math.round(timeoutMs / 1000)} 秒，请稍后重试`
                        : '生成已停止');
                }
                throw new ArkClientError('network', `无法连接火山方舟：${error?.message || String(error)}`);
            }

            if (!response.ok) {
                throw describeHttpError(response.status);
            }

            const decoder = new TextDecoder('utf-8');
            const state = { content: '', usage: null, doneReceived: false };
            let buffer = '';

            try {
                for await (const chunk of readBodyChunks(response.body)) {
                    buffer += decoder.decode(chunk, { stream: true });
                    const split = splitSseEvents(buffer);
                    buffer = split.remaining;
                    for (const rawEvent of split.events) {
                        processEventData(parseSseEvent(rawEvent), input, state);
                    }
                }
                buffer += decoder.decode();
                if (buffer.trim()) {
                    processEventData(parseSseEvent(buffer), input, state);
                }
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw new ArkClientError(timedOut ? 'timeout' : 'aborted', timedOut
                        ? `火山方舟请求超过 ${Math.round(timeoutMs / 1000)} 秒，请稍后重试`
                        : '生成已停止');
                }
                if (error instanceof ArkClientError) {
                    throw error;
                }
                throw new ArkClientError('stream_error', `读取火山方舟响应失败：${error?.message || String(error)}`);
            }

            if (!state.content.trim()) {
                throw new ArkClientError('empty_response', '火山方舟未返回有效回答，请重试');
            }

            return {
                content: state.content,
                usage: state.usage
            };
        } finally {
            clearTimeout(timer);
            input.signal?.removeEventListener('abort', onExternalAbort);
        }
    }

    return { streamChat };
}

module.exports = {
    ARK_BASE_URL,
    ArkClientError,
    createArkClient,
    mapUsage,
    parseSseEvent,
    splitSseEvents
};
