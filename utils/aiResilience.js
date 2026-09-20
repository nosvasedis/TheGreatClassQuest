export function isRetryableHttpStatus(status) {
    const code = Number(status);
    return code === 429 || code >= 500;
}

export function shouldCountAsCircuitFailure(error) {
    if (!error) return true;
    if (error.isCircuitBreaker || error.name === 'CircuitBreakerError') return false;
    if (error.name === 'RateLimitError' || error.status === 429) return false;
    return true;
}
