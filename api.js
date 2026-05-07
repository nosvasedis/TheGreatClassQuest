import { blobToBase64 } from './utils.js';
import { AI_TEXT_PROVIDERS, OPENROUTER_MODEL, cloudflareWorkerUrl } from './constants.js';

const GEMINI_REQUEST_SPACING_MS = 1200;
const DEFAULT_TIMEOUT_MS = 10000;
const FAST_TIMEOUT_MS = 5000;
const CIRCUIT_BREAK_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 120000;

let geminiQueue = Promise.resolve();
let lastGeminiRequestStartedAt = 0;

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
let _circuitState = { consecutiveFailures: 0, openedAt: 0 };

function isAiCircuitOpen() {
    const { consecutiveFailures, openedAt } = _circuitState;
    if (consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
        const elapsed = Date.now() - openedAt;
        if (elapsed < CIRCUIT_COOLDOWN_MS) return true;
        _circuitState.consecutiveFailures = 0;
        _circuitState.openedAt = 0;
    }
    return false;
}

function recordAiSuccess() {
    _circuitState.consecutiveFailures = 0;
    _circuitState.openedAt = 0;
}

function recordAiFailure() {
    if (_circuitState.consecutiveFailures === 0) {
        _circuitState.openedAt = Date.now();
    }
    _circuitState.consecutiveFailures += 1;
}

function createCircuitBreakerError() {
    const remaining = Math.max(0, Math.ceil((CIRCUIT_COOLDOWN_MS - (Date.now() - _circuitState.openedAt)) / 1000));
    const error = new Error(`AI circuit breaker open — ${_circuitState.consecutiveFailures} consecutive failures, retry in ~${remaining}s`);
    error.name = 'CircuitBreakerError';
    error.isCircuitBreaker = true;
    return error;
}

async function enqueueGeminiRequest(task) {
    const runTask = async () => {
        const waitMs = Math.max(0, GEMINI_REQUEST_SPACING_MS - (Date.now() - lastGeminiRequestStartedAt));
        if (waitMs > 0) {
            await new Promise((res) => setTimeout(res, waitMs));
        }

        lastGeminiRequestStartedAt = Date.now();
        return task();
    };

    const queuedTask = geminiQueue.then(runTask, runTask);
    geminiQueue = queuedTask.catch(() => {});
    return queuedTask;
}

function parseRetryAfterMs(response) {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) return null;

    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds)) {
        return Math.max(0, asSeconds * 1000);
    }

    const asDateMs = Date.parse(retryAfter);
    if (Number.isFinite(asDateMs)) {
        return Math.max(0, asDateMs - Date.now());
    }

    return null;
}

function createTimeoutError(timeoutMs) {
    const error = new Error(`Request timed out after ${timeoutMs}ms`);
    error.name = 'TimeoutError';
    return error;
}

function classifyProviderFailure(error) {
    const message = String(error?.message || '');
    const isRateLimited = /status\s*429/i.test(message);
    const isServerFailure = /status\s*5\d{2}/i.test(message);
    const isTimeout = error?.name === 'TimeoutError';
    return {
        isRateLimited,
        isServerFailure,
        isTimeout,
        isRetryable: isRateLimited || isServerFailure || isTimeout
    };
}

function buildProviderPayload(provider, systemPrompt, userPrompt) {
    const payloadMode = provider?.payloadMode || 'openrouter';
    if (payloadMode === 'openrouter') {
        return {
            model: provider?.model || OPENROUTER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        };
    }

    return {
        model: provider?.model || OPENROUTER_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    };
}

function extractProviderText(result) {
    const directText = result?.text;
    if (typeof directText === 'string' && directText.trim()) return directText.trim();

    const openRouterText = result?.choices?.[0]?.message?.content;
    if (typeof openRouterText === 'string' && openRouterText.trim()) return openRouterText.trim();

    if (Array.isArray(openRouterText)) {
        const merged = openRouterText
            .map((part) => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim();
        if (merged) return merged;
    }

    const geminiText = result?.candidates?.[0]?.content?.parts
        ?.map((part) => typeof part?.text === 'string' ? part.text : '')
        .join('')
        .trim();
    if (geminiText) return geminiText;

    throw new Error('Invalid AI response structure');
}

async function requestTextFromProvider(provider, systemPrompt, userPrompt, requestOptions = {}) {
    const response = await enqueueGeminiRequest(() =>
        fetchWithBackoff(provider.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildProviderPayload(provider, systemPrompt, userPrompt))
        }, requestOptions)
    );

    if (!response.ok) {
        throw new Error(`Provider ${provider.id} failed with status ${response.status}`);
    }

    const result = await response.json();
    return {
        providerId: provider.id,
        providerLabel: provider.label,
        content: extractProviderText(result)
    };
}

export async function callGeminiApiDetailed(systemPrompt, userPrompt, requestOptions = {}) {
    if (isAiCircuitOpen()) throw createCircuitBreakerError();

    const providers = AI_TEXT_PROVIDERS.filter((provider) => provider?.url);
    if (providers.length === 0) {
        throw new Error('No AI text providers are configured.');
    }

    const failures = [];

    for (const provider of providers) {
        try {
            const result = await requestTextFromProvider(provider, systemPrompt, userPrompt, requestOptions);
            recordAiSuccess();
            return {
                ...result,
                providerFailures: failures
            };
        } catch (error) {
            const failureMeta = classifyProviderFailure(error);
            failures.push({
                providerId: provider.id,
                providerLabel: provider.label,
                message: String(error?.message || 'Unknown AI provider error'),
                ...failureMeta
            });
        }
    }

    recordAiFailure();
    const aggregateError = new Error(
        failures.length > 0
            ? failures.map((failure) => `${failure.providerLabel}: ${failure.message}`).join(' | ')
            : 'AI request failed.'
    );
    aggregateError.name = 'AiProviderChainError';
    aggregateError.providerFailures = failures;
    aggregateError.isRateLimited = failures.some((failure) => failure.isRateLimited);
    aggregateError.isRetryable = failures.some((failure) => failure.isRetryable);
    throw aggregateError;
}

async function fetchWithBackoff(url, options, config = {}) {
    const {
        retries = 3,
        baseDelay = 2000,
        timeoutMs = DEFAULT_TIMEOUT_MS
    } = config;
    let attempt = 0;

    while (attempt <= retries) {
        let timeoutId = null;
        let abortCleanup = null;

        try {
            const controller = typeof AbortController !== 'undefined' && (timeoutMs > 0 || options?.signal)
                ? new AbortController()
                : null;

            if (controller && options?.signal) {
                if (options.signal.aborted) {
                    controller.abort(options.signal.reason ?? new DOMException('Request aborted', 'AbortError'));
                } else {
                    const forwardAbort = () => {
                        controller.abort(options.signal.reason ?? new DOMException('Request aborted', 'AbortError'));
                    };
                    options.signal.addEventListener('abort', forwardAbort, { once: true });
                    abortCleanup = () => options.signal.removeEventListener('abort', forwardAbort);
                }
            }

            const requestOptions = controller ? { ...options, signal: controller.signal } : options;

            if (controller && timeoutMs > 0 && !controller.signal.aborted) {
                const timeoutError = createTimeoutError(timeoutMs);
                timeoutId = setTimeout(() => controller.abort(timeoutError), timeoutMs);
            }

            const response = await fetch(url, requestOptions);

            if (response.ok) return response;

            const isRetryableStatus = response.status === 429 || response.status >= 500;
            const hasRetriesLeft = attempt < retries;

            if (!isRetryableStatus || !hasRetriesLeft) {
                throw new Error(`API failed with status ${response.status}`);
            }

            const retryAfterMs = parseRetryAfterMs(response);
            const expDelayMs = baseDelay * Math.pow(2, attempt);
            const jitterMs = Math.floor(Math.random() * 500);
            const waitMs = Math.max(retryAfterMs || 0, expDelayMs + jitterMs);

            console.warn(`API Error ${response.status}. Retrying in ${waitMs}ms...`);
            await new Promise((res) => setTimeout(res, waitMs));
            attempt += 1;
        } catch (error) {
            const normalizedError = error?.name === 'AbortError' && options?.signal?.aborted
                ? (options.signal.reason ?? error)
                : error?.name === 'AbortError' && typeof AbortController !== 'undefined'
                    ? error
                    : error;
            const isTimeout = normalizedError?.name === 'TimeoutError';
            const isCallerAbort = options?.signal?.aborted && !isTimeout;

            if (isCallerAbort) {
                throw normalizedError;
            }

            const hasRetriesLeft = attempt < retries;
            if (!hasRetriesLeft) {
                console.error(isTimeout ? 'Fetch exhausted retries after timeout:' : 'Fetch exhausted retries:', normalizedError);
                throw normalizedError;
            }

            const waitMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
            console.warn(isTimeout ? `Request timed out after ${timeoutMs}ms, retrying...` : 'Network error, retrying...', normalizedError);
            await new Promise((res) => setTimeout(res, waitMs));
            attempt += 1;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (abortCleanup) abortCleanup();
        }
    }

    throw new Error('API failed after retries.');
}

export async function callGeminiApi(systemPrompt, userPrompt, requestOptions = {}) {
    try {
        const result = await callGeminiApiDetailed(systemPrompt, userPrompt, requestOptions);
        return result.content;
    } catch (error) {
        console.error('Error in callGeminiApi (Proxy):', error);
        throw error;
    }
}

export async function callCloudflareAiImageApi(prompt, negativePrompt = "", options = {}, requestOptions = {}) {
    if (isAiCircuitOpen()) throw createCircuitBreakerError();

    const payload = {
        prompt: prompt,
        negative_prompt: negativePrompt || "text, watermark, blurry, low quality",
        ...options
    };
    try {
        const response = await fetchWithBackoff(cloudflareWorkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }, {
            retries: requestOptions.retries ?? 2,
            baseDelay: requestOptions.baseDelay ?? 1500,
            timeoutMs: requestOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare AI API error! status: ${response.status}, message: ${errorText}`);
        }

        const imageBlob = await response.blob();
        const result = await blobToBase64(imageBlob);
        recordAiSuccess();
        return result;

    } catch (error) {
        recordAiFailure();
        console.error('Error in callCloudflareAiImageApi:', error);
        throw error;
    }
}
