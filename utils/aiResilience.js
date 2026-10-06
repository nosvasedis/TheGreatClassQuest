// The Worker sends these when retrying cannot help: the day's Workers AI image
// allowance is spent and only resets at midnight UTC, or this school's own monthly
// allowance is spent / its plan has no AI (scratch/ai-proxy-worker/src/worker.js).
const SCHOOL_AI_LIMIT_MESSAGES = {
    'school-ai-quota': 'Your school has used this month’s AI allowance. It renews on the 1st of next month.',
    'school-ai-plan': 'Your school’s plan does not include this AI feature. Ask the school office about upgrading.'
};
const FINAL_AI_ERROR_SOURCES = new Set(['workers-ai-quota', ...Object.keys(SCHOOL_AI_LIMIT_MESSAGES)]);

export function isFinalAiErrorSource(source) {
    return FINAL_AI_ERROR_SOURCES.has(String(source || ''));
}

/** A plain sentence for a school AI limit, or '' for any other error source. */
export function schoolAiLimitMessage(source) {
    return SCHOOL_AI_LIMIT_MESSAGES[String(source || '')] || '';
}

export function isRetryableHttpStatus(status) {
    const code = Number(status);
    return code === 429 || code >= 500;
}

export function shouldCountAsCircuitFailure(error) {
    if (!error) return true;
    if (error.isCircuitBreaker || error.name === 'CircuitBreakerError') return false;
    if (error.name === 'RateLimitError' || error.status === 429) return false;
    // A spent image allowance must not switch off text AI through the shared breaker.
    if (isFinalAiErrorSource(error.errorSource)) return false;
    return true;
}
