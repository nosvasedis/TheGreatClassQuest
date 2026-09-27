/** Injectable hardware hints: no DOM access at module evaluation time. */
export function getDevicePerformance({ cores, memory, reducedMotion = false, coarsePointer = false, narrowViewport = false, userAgent = '' } = {}) {
    const low = reducedMotion || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4)
        || /Android/i.test(userAgent) || (coarsePointer && narrowViewport);
    const tier = low ? 'low' : (cores >= 8 && memory >= 8 ? 'high' : 'mid');
    return { tier, reducedMotion, particles: { low: 50, mid: 90, high: 140 }[tier], fps: low ? 30 : 60, dpr: low ? 1 : 1.5 };
}
export function detectDevicePerformance() {
    try {
        const media = query => Boolean(globalThis.matchMedia?.(query).matches);
        return getDevicePerformance({ cores: globalThis.navigator?.hardwareConcurrency, memory: globalThis.navigator?.deviceMemory,
            reducedMotion: media('(prefers-reduced-motion: reduce)'), coarsePointer: media('(pointer: coarse)'),
            narrowViewport: media('(max-width: 1023px)'), userAgent: globalThis.navigator?.userAgent || '' });
    } catch { return getDevicePerformance(); }
}
export function detectLowPowerTier() { return detectDevicePerformance().tier === 'low'; }
