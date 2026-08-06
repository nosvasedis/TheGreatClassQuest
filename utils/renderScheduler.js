import { recordMetric } from './runtimeMetrics.js';

const pending = new Map();
let frameId = null;

function flush() {
    frameId = null;
    const jobs = [...pending.values()];
    pending.clear();
    for (const job of jobs) {
        try {
            recordMetric('renders');
            job();
        } catch (error) {
            console.error('Scheduled render failed:', error);
        }
    }
}

export function scheduleRender(key, render) {
    if (typeof render !== 'function') return;
    pending.set(String(key), render);
    if (frameId !== null) return;
    if (typeof requestAnimationFrame === 'function') {
        frameId = requestAnimationFrame(flush);
    } else {
        frameId = setTimeout(flush, 0);
    }
}

export function cancelScheduledRenders() {
    pending.clear();
    if (frameId === null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
    else clearTimeout(frameId);
    frameId = null;
}

