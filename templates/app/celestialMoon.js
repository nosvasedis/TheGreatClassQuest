// Cartoon moon shared by Award sky + Projector wallpaper.

const MOON_URL = new URL('../../assets/celestial/moon.jpg', import.meta.url).href;

export function celestialMoonHTML() {
    return `<img class="gcq-moon__body" src="${MOON_URL}" alt="" decoding="async" draggable="false" />`;
}
