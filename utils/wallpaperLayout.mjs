/**
 * Collision-aware placement for Projector Mode (The Director) floating cards.
 * Pure geometry; covered by tests/wallpaper-layout.test.mjs.
 *
 * The screen keeps a central clock hub, a quote dock at the bottom, and small controls in the
 * top corners. Cards float in the free regions around the hub (left, right, above, below) and
 * are scaled down, never clipped, when a region is too small for them.
 */

/** @typedef {{ left: number, top: number, right: number, bottom: number }} Rect */

export const WALLPAPER_LAYOUT_DEFAULTS = Object.freeze({
    margin: 24,
    minScale: 0.45,
    maxScale: 1
});

function rectWidth(rect) {
    return Math.max(0, rect.right - rect.left);
}

function rectHeight(rect) {
    return Math.max(0, rect.bottom - rect.top);
}

export function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Free regions around the hub, trimmed so they stay clear of the top controls and the bottom dock.
 * @param {{ width: number, height: number }} viewport
 * @param {Rect} hub
 * @param {{ topReserve?: number, bottomLimit?: number, margin?: number }} [opts]
 */
export function computeFreeRegions(viewport, hub, { topReserve = 0, bottomLimit = viewport.height, margin = WALLPAPER_LAYOUT_DEFAULTS.margin } = {}) {
    const top = Math.max(margin, topReserve + margin);
    const bottom = Math.min(viewport.height - margin, bottomLimit - margin);
    const regions = [
        { name: 'left', left: margin, right: hub.left - margin, top, bottom },
        { name: 'right', left: hub.right + margin, right: viewport.width - margin, top, bottom },
        { name: 'top', left: margin, right: viewport.width - margin, top, bottom: hub.top - margin },
        { name: 'bottom', left: margin, right: viewport.width - margin, top: hub.bottom + margin, bottom }
    ];
    return regions.filter((region) => rectWidth(region) > 0 && rectHeight(region) > 0);
}

/**
 * Pick where a card of `cardSize` should go.
 * Prefers regions where it fits at full size (random among them, avoiding `avoidRegion`),
 * otherwise the region that allows the largest scale.
 *
 * A card already on screen that only needs refitting (the screen changed size) passes
 * `keepRegion` and its previous `spot`, so it stays where it was as far as the new screen allows.
 *
 * @returns {{ left: number, top: number, scale: number, region: string, spot: { x: number, y: number } } | null}
 */
export function chooseCardPlacement({
    viewport,
    hub,
    cardSize,
    topReserve = 0,
    bottomLimit = viewport?.height,
    avoidRegion = '',
    keepRegion = '',
    spot = null,
    random = Math.random,
    options = {}
} = {}) {
    if (!viewport || !hub || !cardSize?.width || !cardSize?.height) return null;
    const { margin, minScale, maxScale } = { ...WALLPAPER_LAYOUT_DEFAULTS, ...options };
    const regions = computeFreeRegions(viewport, hub, { topReserve, bottomLimit, margin });
    if (!regions.length) return null;

    const scored = regions.map((region) => {
        const scale = Math.min(maxScale, rectWidth(region) / cardSize.width, rectHeight(region) / cardSize.height);
        return { region, scale };
    });

    const fullSize = scored.filter((entry) => entry.scale >= maxScale - 1e-6);
    const kept = keepRegion ? scored.find((entry) => entry.region.name === keepRegion) : null;
    let choice;
    if (kept && (kept.scale >= maxScale - 1e-6 || !fullSize.length)) {
        choice = kept;
    } else if (fullSize.length) {
        const preferred = fullSize.filter((entry) => entry.region.name !== avoidRegion);
        const pool = preferred.length ? preferred : fullSize;
        choice = pool[Math.floor(random() * pool.length) % pool.length];
    } else {
        choice = scored.reduce((best, entry) => (entry.scale > best.scale ? entry : best), scored[0]);
    }

    const scale = Math.max(minScale, Math.min(maxScale, choice.scale));
    const width = cardSize.width * scale;
    const height = cardSize.height * scale;
    const { region } = choice;

    // Float somewhere inside the region (not always dead centre) so cards feel alive.
    const slackX = Math.max(0, rectWidth(region) - width);
    const slackY = Math.max(0, rectHeight(region) - height);
    const keepSpot = choice === kept && spot && Number.isFinite(spot.x) && Number.isFinite(spot.y);
    const x = keepSpot ? spot.x : 0.2 + 0.6 * random();
    const y = keepSpot ? spot.y : 0.2 + 0.6 * random();
    // Clamp to the screen in case the card had to stay larger than the region (minScale).
    const left = Math.min(region.left + slackX * x, viewport.width - margin - width);
    const top = Math.min(region.top + slackY * y, viewport.height - margin - height);

    return {
        left: Math.round(left),
        top: Math.round(top),
        scale: Math.round(scale * 1000) / 1000,
        region: region.name,
        spot: { x, y }
    };
}
