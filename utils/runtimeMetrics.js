let localMetricsEnabled = false;
if (typeof window !== 'undefined') {
    try {
        localMetricsEnabled = window.localStorage.getItem('gcq_debug_metrics') === '1';
    } catch (_) {
        localMetricsEnabled = false;
    }
}
const enabled = typeof window !== 'undefined' && (import.meta.env?.DEV || localMetricsEnabled);

const metrics = {
    queriesStarted: 0,
    listenersAttached: 0,
    listenersDetached: 0,
    documentsDelivered: 0,
    writesAttempted: 0,
    renders: 0,
    softFailures: 0,
    modulesLoaded: new Set(),
    startedAt: Date.now()
};

const recentSoftFailures = [];

function expose() {
    if (!enabled || typeof window === 'undefined') return;
    window.__GCQ_METRICS__ = {
        ...metrics,
        modulesLoaded: [...metrics.modulesLoaded],
        recentSoftFailures: [...recentSoftFailures]
    };
}

export function recordMetric(name, amount = 1) {
    if (!enabled || !(name in metrics) || typeof metrics[name] !== 'number') return;
    metrics[name] += amount;
    expose();
}

export function recordModuleLoaded(name) {
    if (!enabled) return;
    metrics.modulesLoaded.add(String(name));
    expose();
}

export function getRuntimeMetrics() {
    return {
        ...metrics,
        modulesLoaded: [...metrics.modulesLoaded]
    };
}

expose();

/**
 * A catch handler for fire-and-forget work whose failure must not bother the teacher
 * (an optional sound, a lazy module warming up, a best-effort cleanup).
 * In production it stays silent, exactly like .catch(() => {}); in development, or with
 * localStorage gcq_debug_metrics = 1, it counts the failure and logs it at debug level,
 * so a quiet failure can still be found. Usage: promise.catch(quietly('features/home.js')).
 * @param {string} label where the failure happened
 * @returns {(error: unknown) => void}
 */
export function quietly(label) {
    return (error) => {
        if (!enabled) return;
        metrics.softFailures += 1;
        recentSoftFailures.push({ label: String(label), message: String(error?.message || error || '').slice(0, 160), at: Date.now() });
        if (recentSoftFailures.length > 20) recentSoftFailures.shift();
        console.debug(`[quiet failure] ${label}`, error);
        expose();
    };
}
