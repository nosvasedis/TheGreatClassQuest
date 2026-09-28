/**
 * Single source of truth for day/night and the greeting day part.
 * The home greeting, the home weather card, the header night layer, and the
 * mobile greeting must all resolve night the same way: after sunset or before sunrise.
 */

export const DAY_PART_GREETINGS = {
    morning: 'Good Morning',
    afternoon: 'Good Afternoon',
    evening: 'Good Evening',
    night: 'Good Night'
};

export const DAY_PART_GRADIENTS = {
    morning: 'from-amber-400 via-orange-400 to-rose-400',
    afternoon: 'from-blue-400 via-cyan-400 to-teal-400',
    evening: 'from-indigo-500 via-purple-500 to-pink-500',
    night: 'from-indigo-900 via-purple-900 to-slate-800'
};

/** Fallback sunrise/sunset (06:30 / 20:30) used until the solar API responds. */
export function defaultSolarTimes(now = new Date()) {
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(20, 30, 0, 0);
    return { sunrise: sunrise.getTime(), sunset: sunset.getTime() };
}

export function isNightTime(nowTime, sunrise, sunset) {
    return nowTime >= sunset || nowTime < sunrise;
}

export function resolveDayPart(nowTime, sunrise, sunset) {
    const time = nowTime instanceof Date ? nowTime.getTime() : nowTime;
    if (isNightTime(time, sunrise, sunset)) return 'night';
    const hour = new Date(time).getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

export function greetingForDayPart(part) {
    return DAY_PART_GREETINGS[part] || DAY_PART_GREETINGS.afternoon;
}

export function gradientForDayPart(part) {
    return DAY_PART_GRADIENTS[part] || DAY_PART_GRADIENTS.afternoon;
}
