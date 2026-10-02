// The Worker sends these when retrying cannot help: the day's Workers AI image
// allowance is spent and only resets at midnight UTC.
const FINAL_AI_ERROR_SOURCES = new Set(['workers-ai-quota']);

export function isFinalAiErrorSource(source) {
    return FINAL_AI_ERROR_SOURCES.has(String(source || ''));
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
