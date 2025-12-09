import { blobToBase64 } from './utils.js';
import { geminiApiUrl, OPENROUTER_MODEL, cloudflareWorkerUrl } from './constants.js';

async function fetchWithBackoff(url, options, retries = 3, delay = 2000) { // Increased start delay
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            // Specifically handle 429 (Too Many Requests) or Server Errors
            if (response.status === 429 || response.status >= 500) {
                if (retries > 0) {
                    console.warn(`API Error ${response.status}. Retrying in ${delay}ms...`);
                    await new Promise(res => setTimeout(res, delay));
                    // Exponential backoff: 2s -> 4s -> 8s
                    return fetchWithBackoff(url, options, retries - 1, delay * 2);
                }
            }
            throw new Error(`API failed with status ${response.status}`);
        }
        return response;
    } catch (error) {
         if (retries > 0) {
            console.warn("Network error, retrying...", error);
            await new Promise(res => setTimeout(res, delay));
            return fetchWithBackoff(url, options, retries - 1, delay * 2);
        } else {
            console.error('Fetch exhausted retries:', error);
            throw error;
        }
    }
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

export async function callCloudflareAiImageApi(prompt, negativePrompt = "") {
    const payload = {
        prompt: prompt,
        negative_prompt: negativePrompt || "text, watermark, blurry, low quality" // Default safety net
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
