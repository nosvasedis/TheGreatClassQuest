import { blobToBase64 } from './utils.js';
import { AI_TEXT_PROVIDERS, OPENROUTER_MODEL, cloudflareWorkerUrl } from './constants.js';

const GEMINI_REQUEST_SPACING_MS = 2000;
const DEFAULT_TIMEOUT_MS = 60000;
const FAST_TIMEOUT_MS = 10000;
const CIRCUIT_BREAK_THRESHOLD = 2; // Lowered from 3 to be more conservative
const CIRCUIT_COOLDOWN_MS = 300000; // Increased from 120s to 5 minutes
const PROVIDER_RATE_LIMIT_COOLDOWN_MS = 60000; // 1 minute per-provider rate limit cooldown
const GLOBAL_RATE_LIMIT_COOLDOWN_MS = 60000;

let geminiQueue = Promise.resolve();
let lastGeminiRequestStartedAt = 0;
let _globalRateLimitUntil = 0;

// ─── Provider-level rate limit tracking ──────────────────────────────────────
let _providerRateLimits = new Map(); // { providerId => { rateLimitedAt: timestamp, retryAfterMs: number } }

function recordProviderRateLimit(providerId, retryAfterMs = null) {
    _providerRateLimits.set(providerId, {
        rateLimitedAt: Date.now(),
        retryAfterMs: retryAfterMs || PROVIDER_RATE_LIMIT_COOLDOWN_MS
    });
}

function isProviderRateLimited(providerId) {
    const record = _providerRateLimits.get(providerId);
    if (!record) return false;
    const elapsed = Date.now() - record.rateLimitedAt;
    return elapsed < record.retryAfterMs;
}

function clearProviderRateLimit(providerId) {
    _providerRateLimits.delete(providerId);
}

function recordGlobalRateLimit(retryAfterMs = null) {
    const cooldownMs = Math.max(0, retryAfterMs || GLOBAL_RATE_LIMIT_COOLDOWN_MS);
    _globalRateLimitUntil = Math.max(_globalRateLimitUntil, Date.now() + cooldownMs);
}

function getGlobalRateLimitRemainingMs() {
    return Math.max(0, _globalRateLimitUntil - Date.now());
}

function isGlobalRateLimited() {
    return getGlobalRateLimitRemainingMs() > 0;
}

function clearGlobalRateLimit() {
    _globalRateLimitUntil = 0;
}

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

function createRateLimitError(retryAfterMs = null) {
    const retryMs = Math.max(0, retryAfterMs || 0);
    const error = new Error(`API failed with status 429${retryMs > 0 ? ` (retry after ${retryMs}ms)` : ''}`);
    error.name = 'RateLimitError';
    error.status = 429;
    error.retryAfterMs = retryMs > 0 ? retryMs : undefined;
    return error;
}

function classifyProviderFailure(error) {
    const message = String(error?.message || '');
    const isRateLimited = error?.status === 429 || error?.name === 'RateLimitError' || /status\s*429/i.test(message);
    const isServerFailure = /status\s*5\d{2}/i.test(message);
    const isTimeout = error?.name === 'TimeoutError';
    return {
        isRateLimited,
        isServerFailure,
        isTimeout,
        isRetryable: isRateLimited || isServerFailure || isTimeout
    };
}

function resolveFreeModelId(providerModel) {
    const model = String(providerModel || OPENROUTER_MODEL || '').trim();
    if (!model) {
        throw new Error('No model configured for AI provider.');
    }
    return model;
}

function buildProviderPayload(provider, systemPrompt, userPrompt, requestOptions = {}) {
    const payloadMode = provider?.payloadMode || 'openrouter';
    const modelId = resolveFreeModelId(provider?.model);
    const base = {
        model: modelId,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    };
    return base;
}

function extractProviderText(result) {
    const directText = result?.text;
    if (typeof directText === 'string' && directText.trim()) return directText.trim();

    const message = result?.choices?.[0]?.message;
    const openRouterText = message?.content;
    if (typeof openRouterText === 'string' && openRouterText.trim()) return openRouterText.trim();

    if (Array.isArray(openRouterText)) {
        const merged = openRouterText
            .map((part) => typeof part?.text === 'string' ? part.text : '')
            .join('')
            .trim();
        if (merged) return merged;
    }

    // Thinking models (e.g. MiniMax, DeepSeek-R1) may return content=null with
    // the actual answer in reasoning_content or thinking_content.
    const reasoningText = message?.reasoning_content || message?.thinking_content;
    if (typeof reasoningText === 'string' && reasoningText.trim()) return reasoningText.trim();

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
            body: JSON.stringify(buildProviderPayload(provider, systemPrompt, userPrompt, requestOptions))
        }, requestOptions)
    );

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`Provider ${provider.id} failed with status ${response.status}:`, detail);
        throw new Error(`Provider ${provider.id} failed with status ${response.status}: ${detail}`);
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
    if (isGlobalRateLimited()) {
        const waitMs = getGlobalRateLimitRemainingMs();
        throw createRateLimitError(waitMs);
    }

    const providers = AI_TEXT_PROVIDERS.filter((provider) => provider?.url);
    if (providers.length === 0) {
        throw new Error('No AI text providers are configured.');
    }

    const failures = [];
    let hasRateLimitFailure = false;

    for (const provider of providers) {
        // Skip providers that are currently rate limited
        if (isProviderRateLimited(provider.id)) {
            failures.push({
                providerId: provider.id,
                providerLabel: provider.label,
                message: 'Provider is rate limited, skipping',
                isRateLimited: true,
                isRetryable: false
            });
            continue;
        }

        try {
            const result = await requestTextFromProvider(provider, systemPrompt, userPrompt, requestOptions);
            recordAiSuccess();
            // Clear rate limit on success
            clearProviderRateLimit(provider.id);
            clearGlobalRateLimit();
            return {
                ...result,
                providerFailures: failures
            };
        } catch (error) {
            const failureMeta = classifyProviderFailure(error);
            
            // Track rate limit failures at provider level
            if (failureMeta.isRateLimited) {
                hasRateLimitFailure = true;
                const retryAfterMs = Number.isFinite(error?.retryAfterMs) ? error.retryAfterMs : null;
                recordProviderRateLimit(provider.id, retryAfterMs);
                recordGlobalRateLimit(retryAfterMs);
            }

            failures.push({
                providerId: provider.id,
                providerLabel: provider.label,
                message: String(error?.message || 'Unknown AI provider error'),
                ...failureMeta
            });

            // 429 usually applies account-wide for free-tier usage. Stop chain to avoid bursts.
            if (failureMeta.isRateLimited) {
                break;
            }
        }
    }

    recordAiFailure();
    
    // If we hit rate limits, be extra conservative with circuit breaker
    if (hasRateLimitFailure) {
        recordAiFailure(); // Record extra failure to trigger circuit break faster
    }

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
        retries = 1, // Reduced from 3 to 1 for free models — they have strict rate limits
        baseDelay = 3000, // Increased from 2000ms to 3 seconds
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
                if (response.status === 429) {
                    throw createRateLimitError(parseRetryAfterMs(response));
                }
                throw new Error(`API failed with status ${response.status}`);
            }

            const retryAfterMs = parseRetryAfterMs(response);
            const expDelayMs = baseDelay * Math.pow(2, attempt);
            const jitterMs = Math.floor(Math.random() * 500);
            const waitMs = Math.max(retryAfterMs || 0, expDelayMs + jitterMs);

            // For 429, log more aggressively
            if (response.status === 429) {
                console.warn(`⚠️ RATE LIMITED (429). Waiting ${waitMs}ms before retry...`, { attempt, maxRetries: retries });
            } else {
                console.warn(`API Error ${response.status}. Retrying in ${waitMs}ms...`);
            }
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

/**
 * Extracts the first valid JSON array or object from an AI response string.
 * Strips markdown fences and any preamble/postamble text the model may have added.
 * @param {string} text - Raw AI response text.
 * @returns {any} Parsed JSON value.
 * @throws {SyntaxError} If no valid JSON structure is found.
 */
export function extractJsonFromAiText(text) {
    // 1. Strip markdown code fences
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // 2. Try parsing the cleaned string directly first
    try {
        return JSON.parse(cleaned);
    } catch (_) { /* fall through */ }

    // 3. Extract the outermost [...] array
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
        try {
            return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
        } catch (_) { /* fall through */ }
    }

    // 4. Extract the outermost {...} object
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
        try {
            return JSON.parse(cleaned.slice(objStart, objEnd + 1));
        } catch (_) { /* fall through */ }
    }

    // 5. Try to find the first valid JSON array/object anywhere in the string
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '[') {
            for (let j = cleaned.length - 1; j > i; j--) {
                if (cleaned[j] === ']') {
                    try {
                        return JSON.parse(cleaned.slice(i, j + 1));
                    } catch (_) { /* keep searching */ }
                }
            }
        } else if (cleaned[i] === '{') {
            for (let j = cleaned.length - 1; j > i; j--) {
                if (cleaned[j] === '}') {
                    try {
                        return JSON.parse(cleaned.slice(i, j + 1));
                    } catch (_) { /* keep searching */ }
                }
            }
        }
    }
    // 6. Nothing worked — throw a descriptive error
    throw new SyntaxError(`Could not extract JSON from AI response: ${cleaned.slice(0, 120)}`);
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
