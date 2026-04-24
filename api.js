import { blobToBase64 } from './utils.js';
import { geminiApiUrl, OPENROUTER_MODEL, cloudflareWorkerUrl } from './constants.js';

const GEMINI_REQUEST_SPACING_MS = 1200;

let geminiQueue = Promise.resolve();
let lastGeminiRequestStartedAt = 0;

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

async function fetchWithBackoff(url, options, config = {}) {
    const {
        retries = 3,
        baseDelay = 2000,
        timeoutMs = 20000
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
    // 1. Prepare Payload for OpenRouter (via Worker)
    const payload = {
        model: OPENROUTER_MODEL, 
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
    };

    try {
        const response = await enqueueGeminiRequest(() =>
            fetchWithBackoff(geminiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, requestOptions)
        );

        if (!response.ok) throw new Error(`Proxy error! status: ${response.status}`);

        const result = await response.json();
        
        // 3. Extract content (OpenRouter structure)
        const content = result.choices?.[0]?.message?.content;
        
        if (content) return content;
        else throw new Error('Invalid AI response structure');

    } catch (error) {
        console.error('Error in callGeminiApi (Proxy):', error);
        throw error;
    }
}

export async function callCloudflareAiImageApi(prompt, negativePrompt = "", options = {}, requestOptions = {}) {
    const payload = {
        prompt: prompt,
        negative_prompt: negativePrompt || "text, watermark, blurry, low quality", // Default safety net
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
            retries: requestOptions.retries ?? 1,
            baseDelay: requestOptions.baseDelay ?? 1200,
            timeoutMs: requestOptions.timeoutMs ?? 20000
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare AI API error! status: ${response.status}, message: ${errorText}`);
        }

        const imageBlob = await response.blob();
        return await blobToBase64(imageBlob);

    } catch (error) {
        console.error('Error in callCloudflareAiImageApi:', error);
        throw error;
    }
}
