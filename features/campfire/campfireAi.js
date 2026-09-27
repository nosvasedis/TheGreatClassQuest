import { canUseFeature } from '../../utils/subscription.js';
export async function requestCampfireAi(system, data) {
    if (!canUseFeature('eliteAI')) throw new Error('The Oracle is available with Elite.');
    const controller = new AbortController();
    let timer;
    const cancel = () => controller.abort(new Error('The active lesson changed.'));
    window.addEventListener('gcq:campfire-reset', cancel, { once: true });
    const abort = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }));
    timer = setTimeout(() => controller.abort(new Error('The Oracle took too long. Use the prepared question bank.')), 20000);
    try {
        const request = import('../../api.js').then(async ({ callGeminiApiDetailed, extractJsonFromAiText }) => {
            if (controller.signal.aborted) throw controller.signal.reason;
            const result = await callGeminiApiDetailed(system, JSON.stringify(data), { retries: 0, timeoutMs: 20000, maxTokens: 700, signal: controller.signal });
            return extractJsonFromAiText(result.content);
        });
        return await Promise.race([request, abort]);
    } finally { clearTimeout(timer); window.removeEventListener('gcq:campfire-reset', cancel); }
}
