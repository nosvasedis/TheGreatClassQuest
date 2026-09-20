export const SHOP_TIMEZONE = 'Europe/Athens';
export const FESTIVAL_LEAD_DAYS = 22;

export const MONTHLY_SHOP_THEMES = {
    1: {
        id: 'january',
        label: 'January',
        prompt: 'Winter classroom treasures: frost, ice lanterns, wool scarves, silver notebooks, quiet new-year resolve. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, witches, Christmas trees, Santa, Easter eggs, red eggs, carnival masks'
    },
    2: {
        id: 'february',
        label: 'February',
        prompt: 'Late-winter thaw: snowdrops, pale sunlight, friendship tokens, mittens, warm cocoa charms. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas trees, Santa, Easter eggs, carnival masks unless this is the Festival Stall'
    },
    3: {
        id: 'march',
        label: 'March',
        prompt: 'Early spring classroom treasures: sprouts, kites, rain charms, pencils, wind-bells, fresh green. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks'
    },
    4: {
        id: 'april',
        label: 'April',
        prompt: 'Spring classroom treasures: flowers, birds, rain boots charms, nature badges, bright notebooks. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, red eggs, carnival masks'
    },
    5: {
        id: 'may',
        label: 'May',
        prompt: 'Late-spring meadows: bees, blossom charms, picnic tokens, warm sunlight badges. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks'
    },
    6: {
        id: 'june',
        label: 'June',
        prompt: 'Early summer adventure: sun charms, beach tokens, travel compasses, lemonade badges. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks'
    },
    7: {
        id: 'july',
        label: 'July',
        prompt: 'High summer sea treasures: shells, waves, travel trinkets, bright sun medals. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks'
    },
    8: {
        id: 'august',
        label: 'August',
        prompt: 'Late-summer harvest start: ripe fruit charms, travel journals, warm gold sunlight. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks'
    },
    9: {
        id: 'september',
        label: 'September',
        prompt: 'Back-to-school harvest: golden leaves, apples, acorns, new notebooks, pencils, warm amber woods. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, witches, candy corn, Christmas, Easter, carnival masks'
    },
    10: {
        id: 'october',
        label: 'October',
        prompt: 'Deep autumn woods: mushrooms, amber fog, harvest baskets, chestnut charms, wool cloaks. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, witches, candy corn, Christmas, Easter, carnival masks'
    },
    11: {
        id: 'november',
        label: 'November',
        prompt: 'Late autumn classroom treasures: chestnuts, rain lanterns, wool cloaks, storm badges. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, ghosts, witches, candy corn, Christmas, Easter, carnival masks'
    },
    12: {
        id: 'december',
        label: 'December',
        prompt: 'Winter school treasures: frost, cocoa, evergreens, silver notebooks, quiet lanterns. Handheld objects only.',
        forbidden: 'Halloween, pumpkins, Christmas trees, Santa, gifts, Easter eggs, carnival masks'
    }
};

const FESTIVAL_DEFINITIONS = [
    {
        id: 'halloween',
        name: 'Halloween',
        prompt: 'School-safe Halloween treasures: friendly pumpkins, lanterns, costume charms, candy tokens. Playful, not gory.',
        feastYmd(year) {
            return { year, month: 10, day: 31 };
        }
    },
    {
        id: 'christmas',
        name: 'Christmas',
        prompt: 'Christmas classroom treasures: stars, bells, cocoa mugs, evergreen charms, wrapped gifts. Warm and festive.',
        feastYmd(year) {
            return { year, month: 12, day: 25 };
        }
    },
    {
        id: 'easter',
        name: 'Orthodox Easter',
        prompt: 'Orthodox Easter treasures: red eggs, candles, spring lambs, braided bread charms. Gentle and joyful.',
        feastYmd(year) {
            return dateToYmd(getOrthodoxEasterDate(year));
        }
    },
    {
        id: 'carnival',
        name: 'Carnival',
        prompt: 'Greek Carnival / Apokries treasures: colourful masks, confetti charms, costume badges, party lanterns. Costumes, not Halloween pumpkins or ghosts.',
        feastYmd(year) {
            return getCleanMondayYmd(year);
        }
    }
];

export function shopZonedParts(date = new Date()) {
    const instant = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: SHOP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(instant);
    const read = (type) => Number(parts.find((part) => part.type === type)?.value);
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute')
    };
}

export function shopMonthKey(date = new Date()) {
    const { year, month } = shopZonedParts(date);
    return `${year}-${String(month).padStart(2, '0')}`;
}

export function shopDateKey(date = new Date()) {
    const { year, month, day } = shopZonedParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getOrthodoxEasterDate(year) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const julianMonth = Math.floor((d + e + 114) / 31);
    const julianDay = ((d + e + 114) % 31) + 1;
    const easter = new Date(Date.UTC(year, julianMonth - 1, julianDay));
    easter.setUTCDate(easter.getUTCDate() + (year >= 2100 ? 14 : 13));
    return easter;
}

export function getCleanMondayYmd(year) {
    return addDaysYmd(dateToYmd(getOrthodoxEasterDate(year)), -48);
}

export function getMonthlyShopTheme(date = new Date()) {
    const { month } = shopZonedParts(date);
    return MONTHLY_SHOP_THEMES[month] || MONTHLY_SHOP_THEMES[9];
}

export function getFestivalWindow(festivalId, year) {
    const definition = FESTIVAL_DEFINITIONS.find((item) => item.id === festivalId);
    if (!definition) return null;
    const feast = definition.feastYmd(year);
    return {
        id: definition.id,
        name: definition.name,
        prompt: definition.prompt,
        festivalId: `${definition.id}-${year}`,
        feast,
        start: addDaysYmd(feast, -FESTIVAL_LEAD_DAYS),
        end: feast
    };
}

export function getActiveFestival(date = new Date()) {
    const zoned = shopZonedParts(date);
    const today = { year: zoned.year, month: zoned.month, day: zoned.day };
    const years = [today.year - 1, today.year, today.year + 1];
    for (const definition of FESTIVAL_DEFINITIONS) {
        for (const year of years) {
            const window = getFestivalWindow(definition.id, year);
            if (!window) continue;
            if (compareYmd(today, window.start) >= 0 && compareYmd(today, window.end) <= 0) {
                return window;
            }
        }
    }
    return null;
}

export function monthlyShelfPrompt(date = new Date()) {
    const theme = getMonthlyShopTheme(date);
    return `Theme: ${theme.prompt} Do NOT include: ${theme.forbidden}.`;
}

export function festivalShelfPrompt(festival) {
    if (!festival) return '';
    return `Theme: ${festival.prompt} These are limited Festival Stall treasures for ${festival.name} only.`;
}

function dateToYmd(date) {
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
    };
}

function addDaysYmd(ymd, delta) {
    const shifted = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + delta));
    return dateToYmd(shifted);
}

function compareYmd(left, right) {
    if (left.year !== right.year) return left.year - right.year;
    if (left.month !== right.month) return left.month - right.month;
    return left.day - right.day;
}
