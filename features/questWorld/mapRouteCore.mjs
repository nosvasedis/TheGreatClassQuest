// Team Quest map: the pure maths behind the parties on the road (no DOM, no state).
// Moved out of features/worldMap.js (2026-10-31) so it can be tested; behaviour unchanged.
//
//   cubicBezier(x1, y1, x2, y2)       CSS-style easing curve → (t) => eased t
//   assignStableMapLanes(items)       side-by-side lanes for parties close on the road
//   getRoutePoint(segments, progress) a point on the road (and its normal) at a quest %
//
// Tests: tests/map-route-core.test.mjs.

/** A cubic-bezier easing function, the same curve CSS draws for cubic-bezier(x1, y1, x2, y2). */
export function cubicBezier(x1, y1, x2, y2) {
    const axis = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
    return (x) => {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 24; i += 1) {
            const mid = (lo + hi) / 2;
            if (axis(x1, x2, mid) < x) lo = mid;
            else hi = mid;
        }
        return axis(y1, y2, (lo + hi) / 2);
    };
}

/**
 * Parties within 4% of each other on the road share a cluster; inside a cluster each gets a
 * lane (0, -1, 1, -2, 2, ...) by token key, so the same party keeps the same lane between
 * refreshes. Sets `lane` on each item and returns the same array.
 * @param {Array<{pct: number, tokenKey: string, lane?: number}>} items
 */
export function assignStableMapLanes(items) {
    const laneOrder = [0, -1, 1, -2, 2, -3, 3, -4, 4];
    const ordered = [...items].sort((a, b) => (
        a.pct - b.pct || a.tokenKey.localeCompare(b.tokenKey)
    ));
    let cluster = [];

    const flushCluster = () => {
        cluster
            .sort((a, b) => a.tokenKey.localeCompare(b.tokenKey))
            .forEach((item, index) => {
                item.lane = laneOrder[index] ?? (index % 2 === 0 ? index / 2 : -Math.ceil(index / 2));
            });
        cluster = [];
    };

    ordered.forEach((item) => {
        if (cluster.length && item.pct - cluster[0].pct > 4) flushCluster();
        cluster.push(item);
    });
    flushCluster();
    return items;
}

/**
 * The point on the road at `progress` (0-100) and the road's unit normal there.
 * Each segment covers [minProgress, maxProgress) of the quest and carries a path with
 * getPointAtLength() (an SVG path, or anything shaped like one) and its totalLength.
 */
export function getRoutePoint(routeSegments, progress) {
    const safeProgress = Math.min(100, Math.max(0, Number(progress) || 0));
    const segment = routeSegments.find((candidate, index) => (
        safeProgress >= candidate.minProgress
        && (safeProgress < candidate.maxProgress || index === routeSegments.length - 1)
    )) || routeSegments[routeSegments.length - 1];
    const segmentRange = segment.maxProgress - segment.minProgress || 1;
    const localProgress = Math.min(1, Math.max(0, (safeProgress - segment.minProgress) / segmentRange));
    const length = segment.totalLength * localProgress;
    const point = segment.path.getPointAtLength(length);
    const before = segment.path.getPointAtLength(Math.max(0, length - 1));
    const after = segment.path.getPointAtLength(Math.min(segment.totalLength, length + 1));
    const tangentX = after.x - before.x;
    const tangentY = after.y - before.y;
    const magnitude = Math.hypot(tangentX, tangentY) || 1;
    return {
        x: point.x,
        y: point.y,
        normalX: -tangentY / magnitude,
        normalY: tangentX / magnitude
    };
}
