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
    modulesLoaded: new Set(),
    startedAt: Date.now()
};

function expose() {
    if (!enabled || typeof window === 'undefined') return;
    window.__GCQ_METRICS__ = {
        ...metrics,
        modulesLoaded: [...metrics.modulesLoaded]
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
