import { blobToBase64 } from './utils.js';
import { geminiApiUrl, OPENROUTER_MODEL, cloudflareWorkerUrl } from './constants.js';

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

async function fetchWithBackoff(url, options, retries = 3, baseDelay = 2000) {
    let attempt = 0;

    while (attempt <= retries) {
        try {
            const response = await fetch(url, options);
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
            const hasRetriesLeft = attempt < retries;
            if (!hasRetriesLeft) {
                console.error('Fetch exhausted retries:', error);
                throw error;
            }

            const waitMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
            console.warn('Network error, retrying...', error);
            await new Promise((res) => setTimeout(res, waitMs));
            attempt += 1;
        }
    }

    throw new Error('API failed after retries.');
}

export async function callGeminiApi(systemPrompt, userPrompt) {
    // 1. Prepare Payload for OpenRouter (via Worker)
    const payload = {
        model: OPENROUTER_MODEL, 
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
    };

    try {
        // 2. Call YOUR Worker (No API Key sent here!)
        const response = await fetchWithBackoff(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

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

export async function callCloudflareAiImageApi(prompt, negativePrompt = "", options = {}) {
    const payload = {
        prompt: prompt,
        negative_prompt: negativePrompt || "text, watermark, blurry, low quality", // Default safety net
        ...options
    };
    try {
        const response = await fetch(cloudflareWorkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
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
