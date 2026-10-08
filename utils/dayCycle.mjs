/**
 * Pure math for the Home greeting's day/night ring: where "now" sits on a
 * 24-hour dial, and what the real moon looks like tonight.
 *
 * Dial convention: angles are degrees clockwise from the top of the ring.
 * Noon sits at the top, midnight at the bottom, so the sun climbs up the left
 * side in the morning and sets down the right side, like the real sky.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNODIC_MONTH_DAYS = 29.530588853;
// A known new moon (2000-01-06 18:14 UTC), the usual reference epoch.
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Minutes since local midnight (0 to 1440). */
export function minutesOfDay(time) {
    const d = new Date(time);
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Degrees clockwise from the top of the dial: noon 0, 18:00 90, midnight 180, 06:00 270. */
export function dialAngle(time) {
    return ((minutesOfDay(time) / 1440) * 360 + 180) % 360;
}

/** Degrees clockwise from the bottom (midnight): what a conic gradient `from 180deg` uses. */
export function dialAngleFromMidnight(time) {
    return (minutesOfDay(time) / 1440) * 360;
}

/**
 * Where we are in the current stretch of daylight or darkness.
 * `start`/`end` are timestamps of the sunrise/sunset that bound it and
 * `progress` runs 0 to 1 across it.
 */
export function currentLightSpan(nowTime, sunrise, sunset) {
    const now = nowTime instanceof Date ? nowTime.getTime() : nowTime;
    const riseMin = minutesOfDay(sunrise);
    const setMin = minutesOfDay(sunset);
    const nowMin = minutesOfDay(now);
    const isDay = nowMin >= riseMin && nowMin < setMin;
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const at = (minutes, dayOffset = 0) => midnight.getTime() + (minutes + dayOffset * 1440) * 60000;

    let start;
    let end;
    if (isDay) {
        start = at(riseMin);
        end = at(setMin);
    } else if (nowMin >= setMin) {
        start = at(setMin);
        end = at(riseMin, 1);
    } else {
        start = at(setMin, -1);
        end = at(riseMin);
    }
    const length = Math.max(1, end - start);
    return {
        isDay,
        start,
        end,
        progress: Math.min(1, Math.max(0, (now - start) / length))
    };
}

/** Moon age as a fraction of the synodic month: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(time) {
    const t = time instanceof Date ? time.getTime() : time;
    const days = (t - REFERENCE_NEW_MOON_MS) / DAY_MS;
    const phase = (days / SYNODIC_MONTH_DAYS) % 1;
    return phase < 0 ? phase + 1 : phase;
}

/** Share of the disc that is lit (0 to 1). */
export function moonIllumination(phase) {
    return (1 - Math.cos(phase * 2 * Math.PI)) / 2;
}

export function moonPhaseName(phase) {
    const names = [
        'New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
        'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'
    ];
    return names[Math.round(phase * 8) % 8];
}

/**
 * SVG path for the lit part of a moon disc of radius r centred on (cx, cy),
 * as seen from the northern hemisphere (waxing lit on the right).
 * Returns '' for a new moon.
 */
export function moonLitPath(phase, r, cx = 0, cy = 0) {
    const illum = moonIllumination(phase);
    if (illum < 0.015) return '';
    const top = `${cx} ${cy - r}`;
    const bottom = `${cx} ${cy + r}`;
    if (illum > 0.985) {
        return `M ${top} A ${r} ${r} 0 1 1 ${bottom} A ${r} ${r} 0 1 1 ${top} Z`;
    }
    const waxing = phase < 0.5;
    // Outer limb: the lit half of the disc.
    const limbSweep = waxing ? 1 : 0;
    // Terminator: an ellipse whose width shrinks to 0 at the quarters.
    const rx = Math.abs(Math.cos(phase * 2 * Math.PI)) * r;
    const gibbous = illum > 0.5;
    const termSweep = waxing === gibbous ? 1 : 0;
    const f = (n) => Math.round(n * 100) / 100;
    return `M ${top} A ${f(r)} ${f(r)} 0 0 ${limbSweep} ${bottom} A ${f(rx)} ${f(r)} 0 0 ${termSweep} ${top} Z`;
}

/**
 * SVG path (evenodd) for the DARK part of a moon disc in a 100×100 box (or radius r at cx, cy):
 * the full disc minus tonight's lit part. Every photo moon in the app is shaded with this.
 */
export function moonShadowPath(phase, r = 50, cx = 50, cy = 50) {
    const lit = moonLitPath(phase, r, cx, cy);
    return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r} Z ${lit}`.trim();
}

/** Point on a circle for a dial angle (degrees clockwise from top). */
export function pointOnDial(angle, radius, cx, cy) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

/** SVG arc path along the dial, clockwise from angle a to angle b (b may exceed 360). */
export function dialArcPath(a, b, radius, cx, cy) {
    let sweep = b - a;
    while (sweep < 0) sweep += 360;
    if (sweep < 0.05) return '';
    if (sweep >= 359.95) sweep = 359.9;
    const p0 = pointOnDial(a, radius, cx, cy);
    const p1 = pointOnDial(a + sweep, radius, cx, cy);
    const f = (n) => Math.round(n * 100) / 100;
    return `M ${f(p0.x)} ${f(p0.y)} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${f(p1.x)} ${f(p1.y)}`;
}
