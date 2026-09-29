/** @typedef {'sky' | 'cameo'} SkyTheaterStage */

/**
 * @typedef {object} SkyTheaterAct
 * @property {string} id
 * @property {string} family
 * @property {SkyTheaterStage} stage
 * @property {string} art      builder id in `art.js`
 * @property {string} motion   choreography id in `motion.js`
 * @property {string} trail    particle kind left behind ('none' for no trail)
 * @property {number} size     sprite height in rem on the desktop header
 * @property {number} [aspect] sprite width / height (defaults to 1)
 * @property {'date' | 'time'} [anchor] cameo only: which line of the clock it visits
 * @property {string[]} [lines] captions for sprites that carry text (one is picked per flight)
 * @property {number} weekday 0=Sun … 6=Sat (-1 for seasonal guests)
 */

/** @type {Record<number, Omit<SkyTheaterAct, 'weekday'>[]>} */
const CASTS = {
    // Sunday — Calm Wonder
    0: [
        { id: 'sun-rainbow', family: 'rainbow', stage: 'sky', art: 'rainbowCloud', motion: 'glide', trail: 'rainbow', size: 2.4, aspect: 80 / 56 },
        { id: 'sun-dove', family: 'dove', stage: 'sky', art: 'dove', motion: 'swoop', trail: 'feather', size: 2.5, aspect: 72 / 56 },
        { id: 'sun-halo', family: 'halo', stage: 'cameo', art: 'sunCameo', anchor: 'time', motion: 'rise', trail: 'sparkle', size: 2.7 }
    ],
    // Monday — Fresh Launch
    1: [
        { id: 'mon-rocket', family: 'rocket', stage: 'sky', art: 'rocket', motion: 'launch', trail: 'puff', size: 3, aspect: 48 / 80 },
        { id: 'mon-plane', family: 'plane', stage: 'sky', art: 'paperPlane', motion: 'loop', trail: 'dash', size: 1.9, aspect: 72 / 44 },
        { id: 'mon-star', family: 'star', stage: 'cameo', art: 'starCameo', anchor: 'date', motion: 'pop', trail: 'sparkle', size: 2.6 }
    ],
    // Tuesday — Sky Traffic
    2: [
        {
            id: 'tue-prop', family: 'prop', stage: 'sky', art: 'bannerPlane', motion: 'glide', trail: 'none', size: 2.3,
            lines: ['QUEST ON!', 'YOU GOT THIS!', 'LEVEL UP!', 'GO TEAM!', 'KEEP SHINING!', 'BRAVE HEROES!']
        },
        { id: 'tue-balloon', family: 'balloon', stage: 'sky', art: 'hotAirBalloon', motion: 'drift', trail: 'none', size: 3.2, aspect: 56 / 76 },
        { id: 'tue-cloud', family: 'cloud', stage: 'cameo', art: 'cloudCameo', anchor: 'date', motion: 'peek', trail: 'none', size: 2.4, aspect: 72 / 56 }
    ],
    // Wednesday — Midweek Magic
    3: [
        { id: 'wed-owl', family: 'owl', stage: 'sky', art: 'owl', motion: 'swoop', trail: 'sparkle', size: 2.6, aspect: 64 / 60 },
        { id: 'wed-wand', family: 'wand', stage: 'cameo', art: 'wandCameo', anchor: 'time', motion: 'pop', trail: 'sparkle', size: 2.6 },
        { id: 'wed-pegasus', family: 'pegasus', stage: 'sky', art: 'pegasus', motion: 'glide', trail: 'rainbow', size: 2.8, aspect: 80 / 60 }
    ],
    // Thursday — Hero Practice
    4: [
        { id: 'thu-kite', family: 'kite', stage: 'sky', art: 'kite', motion: 'zigzag', trail: 'none', size: 2.7, aspect: 76 / 64 },
        { id: 'thu-comet', family: 'comet', stage: 'sky', art: 'comet', motion: 'streak', trail: 'glow', size: 1.7, aspect: 96 / 40 },
        { id: 'thu-badge', family: 'badge', stage: 'cameo', art: 'medalCameo', anchor: 'date', motion: 'stamp', trail: 'sparkle', size: 2.8, aspect: 60 / 72 }
    ],
    // Friday — Celebration
    5: [
        { id: 'fri-bird', family: 'bird', stage: 'sky', art: 'parrot', motion: 'zigzag', trail: 'confetti', size: 2.5, aspect: 76 / 56 },
        { id: 'fri-blimp', family: 'blimp', stage: 'sky', art: 'blimp', motion: 'drift', trail: 'none', size: 2.5, aspect: 104 / 56 },
        { id: 'fri-highfive', family: 'highfive', stage: 'cameo', art: 'popperCameo', anchor: 'time', motion: 'burst', trail: 'confetti', size: 2.6 }
    ],
    // Saturday — Free Quest
    6: [
        { id: 'sat-ufo', family: 'ufo', stage: 'sky', art: 'ufo', motion: 'hover', trail: 'none', size: 3, aspect: 84 / 78 },
        { id: 'sat-dragon', family: 'dragon', stage: 'sky', art: 'dragon', motion: 'weave', trail: 'ember', size: 2.8, aspect: 84 / 60 },
        { id: 'sat-treasure', family: 'treasure', stage: 'cameo', art: 'treasureCameo', anchor: 'time', motion: 'treasure', trail: 'sparkle', size: 2.6, aspect: 64 / 60 }
    ]
};

/**
 * Seasonal guests: rare visitors that only turn up in their months (0 = January).
 * They join the rotation on top of the weekday cast, never instead of it.
 * @type {(Omit<SkyTheaterAct, 'weekday'> & { months: number[] })[]}
 */
const GUESTS = [
    { id: 'guest-snowflake', family: 'snowflake', stage: 'sky', art: 'snowflake', motion: 'fall', trail: 'snow', size: 2.1, months: [11, 0, 1] },
    { id: 'guest-butterfly', family: 'butterfly', stage: 'sky', art: 'butterfly', motion: 'flutter', trail: 'sparkle', size: 2.2, aspect: 64 / 56, months: [2, 3, 4, 5] },
    { id: 'guest-bee', family: 'bee', stage: 'sky', art: 'bee', motion: 'flutter', trail: 'none', size: 1.9, aspect: 60 / 48, months: [5, 6, 7] },
    { id: 'guest-leaf', family: 'leaf', stage: 'sky', art: 'mapleLeaf', motion: 'fall', trail: 'leaf', size: 2.1, aspect: 56 / 60, months: [8, 9, 10] },
    { id: 'guest-bat', family: 'bat', stage: 'sky', art: 'bat', motion: 'zigzag', trail: 'none', size: 1.9, aspect: 76 / 44, months: [9] }
];

/** @returns {SkyTheaterAct[]} */
export function getActsForWeekday(weekday) {
    const list = CASTS[weekday] || CASTS[1];
    return list.map((act) => ({ ...act, weekday }));
}

/** @returns {SkyTheaterAct[]} */
export function getGuestsForMonth(month) {
    return GUESTS.filter((g) => g.months.includes(month)).map(({ months, ...act }) => ({ ...act, weekday: -1 }));
}

/** @returns {SkyTheaterAct | null} */
export function getActById(id) {
    for (const day of Object.keys(CASTS)) {
        const found = CASTS[Number(day)].find((a) => a.id === id);
        if (found) return { ...found, weekday: Number(day) };
    }
    const guest = GUESTS.find((g) => g.id === id);
    if (guest) {
        const { months, ...act } = guest;
        return { ...act, weekday: -1 };
    }
    return null;
}

/** @returns {SkyTheaterAct[]} */
export function getAllActs() {
    const guests = GUESTS.map(({ months, ...act }) => ({ ...act, weekday: -1 }));
    return [...Object.keys(CASTS).flatMap((day) => getActsForWeekday(Number(day))), ...guests];
}

/**
 * Pick a crossover act from a weekday other than `homeWeekday`.
 * Rerolls once if family collides with `busyFamilies`.
 * @param {number} homeWeekday
 * @param {Set<string>} busyFamilies
 * @param {() => number} [rng]
 */
export function pickCrossoverAct(homeWeekday, busyFamilies = new Set(), rng = Math.random) {
    const others = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== homeWeekday);
    const pick = () => {
        const day = others[Math.floor(rng() * others.length)];
        const acts = getActsForWeekday(day);
        return acts[Math.floor(rng() * acts.length)];
    };
    let act = pick();
    if (busyFamilies.has(act.family)) act = pick();
    return act;
}

/**
 * @param {number} month 0 = January
 * @param {() => number} [rng]
 * @returns {SkyTheaterAct | null}
 */
export function pickGuestAct(month, rng = Math.random) {
    const guests = getGuestsForMonth(month);
    if (!guests.length) return null;
    return guests[Math.floor(rng() * guests.length)];
}
