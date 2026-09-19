// Near-side Moon shared by Award sky + Projector wallpaper.
// Photograph: NASA / Goddard Space Flight Center (public domain),
// image GSFC_20171208_Archive_e001861.

const MOON_NEAR_SIDE_URL = new URL('../../assets/celestial/moon-nearside.jpg', import.meta.url).href;

export function celestialMoonHTML() {
    return `<img class="gcq-moon__body" src="${MOON_NEAR_SIDE_URL}" alt="" decoding="async" draggable="false" />`;
}
