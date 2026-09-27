/**
 * Optical camera over the rest-state constellation band.
 * Looking up / zooming must scale that same 1000×260 map — never change the layout box.
 */

export const SKY_ZOOM_REST = 1;
export const SKY_ZOOM_LOOK = 1.28;
export const SKY_ZOOM_MIN = 1;
export const SKY_ZOOM_MAX = 4.6;

export function clampSkyZoom(z) {
    const n = Number(z);
    if (!Number.isFinite(n)) return SKY_ZOOM_LOOK;
    return Math.max(SKY_ZOOM_MIN, Math.min(SKY_ZOOM_MAX, +n.toFixed(3)));
}

export function zoomSky(current, delta) {
    return clampSkyZoom(Number(current) + Number(delta));
}

/** Screen position of a viewBox point after scale around the rest box centre, then pan / look-up lift. */
export function skyStarScreen(svgX, svgY, { box, zoom = 1, panX = 0, panY = 0, lookY = 0, viewW = 1000, viewH = 260 } = {}) {
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    return {
        x: cx + (svgX / viewW - 0.5) * box.width * zoom + panX,
        y: cy + (svgY / viewH - 0.5) * box.height * zoom + panY + lookY
    };
}
