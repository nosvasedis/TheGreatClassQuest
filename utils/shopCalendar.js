// Mystic Market calendar: what each month's Seasonal Treasures are about, and which
// celebration (if any) opens the Festival Stall. functions/shop/calendar.mjs is an exact
// copy that the Cloud Functions use to brief the merchant; keep the two identical.

export const SHOP_TIMEZONE = 'Europe/Athens';
export const FESTIVAL_LEAD_DAYS = 22;

const NEVER_ON_SEASONAL = 'Halloween, pumpkins, ghosts, witches, Christmas trees, Santa, Easter eggs, red eggs, carnival masks';

// Each month has a mood, a palette the pictures share, motifs the merchant draws from,
// and a few named collections. A fresh stall picks one collection so two restocks in
// the same month feel different, while every item still belongs to the season.
export const MONTHLY_SHOP_THEMES = {
    1: {
        id: 'january',
        label: 'January',
        season: 'deep winter',
        mood: 'crisp, quiet and full of fresh-start resolve',
        palette: 'frost blue, silver, snow white and warm candle gold',
        motifs: ['frost crystals', 'ice lanterns', 'wool scarves', 'mittens', 'silver notebooks', 'snowflakes', 'sleeping owls', 'pine cones', 'star charts', 'warm cocoa charms'],
        greekTouch: 'the calm, sunny Halcyon Days in the middle of winter',
        collections: [
            { name: 'Frost Workshop', idea: 'tools and trinkets made of ice, frost and snowflakes' },
            { name: 'Fresh Start Desk', idea: 'new notebooks, goal charms, shiny pencils and calendars for the new year' },
            { name: 'Winter Night Sky', idea: 'stars, moons, owls and cosy lamps for long winter evenings' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    2: {
        id: 'february',
        label: 'February',
        season: 'late winter thaw',
        mood: 'gentle, hopeful and friendly',
        palette: 'snowdrop white, pale lilac, soft pink and sky blue',
        motifs: ['snowdrops', 'almond blossom', 'pale sunlight', 'friendship tokens', 'mittens', 'umbrellas', 'puddle boots', 'robins', 'letters and envelopes'],
        greekTouch: 'almond trees blooming pink and white while it is still cold',
        collections: [
            { name: 'Almond Blossom', idea: 'the first blossoms of the year: petals, buds and pale pink branches' },
            { name: 'Friendship Post', idea: 'letters, friendship bracelets, twin charms and kind-word tokens' },
            { name: 'Thaw and Drizzle', idea: 'umbrellas, puddle boots and drip-drop charms for rainy days' }
        ],
        forbidden: `${NEVER_ON_SEASONAL}, confetti`
    },
    3: {
        id: 'march',
        label: 'March',
        season: 'early spring',
        mood: 'breezy, fresh and growing',
        palette: 'fresh green, sky blue and daffodil yellow',
        motifs: ['sprouts', 'kites', 'rain charms', 'wind-bells', 'seed packets', 'daffodils', 'watering cans', 'returning swallows', 'pencils'],
        greekTouch: 'the old swallow songs that welcome spring, and windy kite days',
        collections: [
            { name: 'Kite Winds', idea: 'kites, pinwheels, wind-bells and everything that loves a breeze' },
            { name: 'Seed Library', idea: 'seeds, sprouts, watering cans and garden labels' },
            { name: 'Swallow Song', idea: 'swallows coming home, nests, feathers and spring songs' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    4: {
        id: 'april',
        label: 'April',
        season: 'spring in full bloom',
        mood: 'bright, colourful and buzzing',
        palette: 'meadow green, poppy red, lavender and sunshine yellow',
        motifs: ['wildflowers', 'poppies', 'chamomile', 'bees', 'butterflies', 'birds', 'rain boot charms', 'nature badges', 'bright notebooks'],
        greekTouch: 'hillsides covered in poppies and chamomile',
        collections: [
            { name: 'Wildflower Meadow', idea: 'poppies, daisies, chamomile and pressed-flower keepsakes' },
            { name: 'Butterfly Garden', idea: 'butterflies, caterpillars, cocoons and garden finds' },
            { name: 'Spring Showers', idea: 'rainbows, rain boots, raindrops and fresh puddles' }
        ],
        forbidden: `${NEVER_ON_SEASONAL}, Easter candles`
    },
    5: {
        id: 'may',
        label: 'May',
        season: 'late spring',
        mood: 'warm, sweet and sunny',
        palette: 'rose pink, honey gold and leaf green',
        motifs: ['bees', 'honey', 'roses', 'blossom charms', 'cherries', 'picnic tokens', 'warm sunlight badges', 'butterflies', 'ladybirds'],
        greekTouch: 'flower wreaths on front doors and the first cherries of the year',
        collections: [
            { name: 'Honey and Bees', idea: 'beehives, honey pots, bee badges and golden combs' },
            { name: 'Picnic Hill', idea: 'picnic baskets, blankets, cherries and sunny-day games' },
            { name: 'Rose Garden', idea: 'roses, ladybirds, garden gates and petal keepsakes' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    6: {
        id: 'june',
        label: 'June',
        season: 'early summer',
        mood: 'sunny, free and adventurous',
        palette: 'sea turquoise, sun yellow, lemon and white',
        motifs: ['sun charms', 'beach tokens', 'travel compasses', 'lemonade badges', 'seashells', 'cicadas', 'watermelon charms', 'sunhats', 'paper boats'],
        greekTouch: 'the song of the cicadas and the first swim of summer',
        collections: [
            { name: 'Cicada Summer', idea: 'cicadas, sunhats, lemons and lazy hot afternoons' },
            { name: 'Seaside Satchel', idea: 'shells, beach toys, paper boats and sea glass' },
            { name: 'Summer Explorer', idea: 'compasses, maps, binoculars and travel badges' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    7: {
        id: 'july',
        label: 'July',
        season: 'high summer',
        mood: 'bright, salty and carefree',
        palette: 'deep sea blue, white, coral and sand gold',
        motifs: ['shells', 'waves', 'lighthouses', 'sailboats', 'starfish', 'travel trinkets', 'bright sun medals', 'snorkels', 'sea glass'],
        greekTouch: 'island ferries, white houses and blue doors by the sea',
        collections: [
            { name: 'Lighthouse Cove', idea: 'lighthouses, lanterns, ropes and sailor keepsakes' },
            { name: 'Island Hopper', idea: 'ferry tickets, blue-door charms, travel stamps and suitcases' },
            { name: 'Starfish Shore', idea: 'starfish, shells, sandcastles and rock-pool finds' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    8: {
        id: 'august',
        label: 'August',
        season: 'late summer',
        mood: 'golden, slow and starry',
        palette: 'warm gold, fig purple, night blue and sand',
        motifs: ['ripe figs', 'grapes', 'travel journals', 'golden sunlight', 'shooting stars', 'seashells', 'postcards', 'sunset lanterns'],
        greekTouch: 'shooting stars on warm August nights and ripe figs on the trees',
        collections: [
            { name: 'Shooting Star Nights', idea: 'shooting stars, telescopes, star jars and night maps' },
            { name: 'Fig and Grape Harvest', idea: 'figs, grapes, baskets and sunny orchard charms' },
            { name: 'Travel Journal', idea: 'postcards, stamps, journals and souvenirs of a summer trip' }
        ],
        forbidden: NEVER_ON_SEASONAL
    },
    9: {
        id: 'september',
        label: 'September',
        season: 'back-to-school harvest',
        mood: 'fresh, excited and golden',
        palette: 'amber, apple red and warm wood brown',
        motifs: ['golden leaves', 'apples', 'acorns', 'new notebooks', 'pencils', 'pencil cases', 'school bells', 'grapes', 'rulers'],
        greekTouch: 'the first school bell of the year and the grape harvest',
        collections: [
            { name: 'First Bell', idea: 'new pencils, pencil cases, school bells and timetables' },
            { name: 'Grape Harvest', idea: 'grapes, baskets, vines and harvest charms' },
            { name: 'Apple Orchard', idea: 'apples, acorns, golden leaves and orchard keepsakes' }
        ],
        forbidden: `${NEVER_ON_SEASONAL}, candy corn, Christmas, Easter`
    },
    10: {
        id: 'october',
        label: 'October',
        season: 'deep autumn',
        mood: 'cosy, misty and mysterious in a friendly way',
        palette: 'amber, moss green, chestnut brown and fog grey',
        motifs: ['mushrooms', 'amber fog', 'harvest baskets', 'chestnut charms', 'wool cloaks', 'acorns', 'moss', 'owls', 'first rain'],
        greekTouch: 'roasted chestnuts sold on the street and the first autumn rain',
        collections: [
            { name: 'Mushroom Ring', idea: 'mushrooms, moss, toadstools and tiny forest-folk keepsakes' },
            { name: 'Chestnut Fire', idea: 'roasting chestnuts, warm embers, lanterns and cosy cloaks' },
            { name: 'Foggy Forest Library', idea: 'fog, owls, old books and candle-lit reading corners' }
        ],
        forbidden: `${NEVER_ON_SEASONAL}, candy corn, bats, skulls, Christmas, Easter`
    },
    11: {
        id: 'november',
        label: 'November',
        season: 'late autumn',
        mood: 'rainy, warm-hearted and cosy',
        palette: 'olive green, pomegranate red, slate grey and warm brown',
        motifs: ['chestnuts', 'rain lanterns', 'wool cloaks', 'storm badges', 'pomegranates', 'olives', 'umbrellas', 'falling leaves'],
        greekTouch: 'the olive harvest and pomegranates ripening in the garden',
        collections: [
            { name: 'Olive Harvest', idea: 'olive branches, little oil lamps, baskets and harvest charms' },
            { name: 'Storm Watch', idea: 'rain lanterns, umbrellas, lightning in a jar and storm badges' },
            { name: 'Pomegranate Glow', idea: 'pomegranates, ruby seeds, wool cloaks and warm fireside things' }
        ],
        forbidden: `${NEVER_ON_SEASONAL}, candy corn, Christmas`
    },
    12: {
        id: 'december',
        label: 'December',
        season: 'early winter',
        mood: 'snowy, twinkly and calm',
        palette: 'snow white, silver, evergreen and cocoa brown',
        motifs: ['frost', 'cocoa', 'evergreens', 'silver notebooks', 'quiet lanterns', 'snow globes', 'knitted hats', 'pine cones', 'snowmen'],
        greekTouch: 'snow on the mountains and warm cocoa after school',
        collections: [
            { name: 'Snowfall Workshop', idea: 'snow globes, snowmen, frost tools and knitted things' },
            { name: 'Cocoa Corner', idea: 'cocoa mugs, marshmallow charms, blankets and reading lamps' },
            { name: 'Silver Lantern Night', idea: 'silver lanterns, evergreens, stars and quiet winter evenings' }
        ],
        forbidden: 'Halloween, pumpkins, Christmas trees, Santa, wrapped gifts, Easter eggs, carnival masks'
    }
};

for (const theme of Object.values(MONTHLY_SHOP_THEMES)) {
    theme.prompt = `${theme.season} treasures: ${theme.motifs.join(', ')}. Handheld objects only.`;
}

// Order matters: when two windows overlap, the first one listed wins (Easter beats May Day).
const FESTIVAL_DEFINITIONS = [
    {
        id: 'halloween',
        name: 'Halloween',
        tagline: 'Spooky-cute treasures for brave heroes',
        prompt: 'School-safe Halloween treasures: friendly pumpkins, lanterns, costume charms, candy tokens. Playful, not gory.',
        palette: 'pumpkin orange, midnight purple and lime green',
        motifs: ['smiling pumpkins', 'jack-o\'-lanterns', 'friendly ghosts', 'witch hats', 'black cats', 'treat bags', 'costume masks', 'moon lanterns', 'cobweb charms', 'potion bottles'],
        young: 'Everything smiles: happy pumpkins, friendly ghosts with big smiles, sweet treat bags, cute cats. Nothing scary at all.',
        older: 'Spooky fun and friendly mystery are welcome (glowing lanterns, bubbling potion bottles, haunted-house trinkets), but never gore, blood, skeleton bodies or real fear.',
        forbidden: 'Christmas, Easter, gore, blood, skeleton bodies, zombies',
        feastYmd(year) {
            return { year, month: 10, day: 31 };
        }
    },
    {
        id: 'christmas',
        name: 'Christmas',
        tagline: 'Twinkling treasures for the festive season',
        prompt: 'Christmas classroom treasures: stars, bells, cocoa mugs, evergreen charms, wrapped gifts. Warm and festive.',
        palette: 'evergreen, berry red, gold and snow white',
        motifs: ['stars', 'bells', 'cocoa mugs', 'evergreen garlands', 'wrapped gifts', 'decorated Christmas boats', 'carol triangles', 'snow globes', 'gingerbread charms', 'stockings', 'reindeer'],
        greekTouch: 'the decorated Christmas boat (karavaki), singing the kalanta carols with a little triangle, and honey cookies',
        young: 'Cosy and twinkly: cute reindeer, jingle bells, cookies and bright stars.',
        older: 'Elegant and crafted: hand-made ornaments, music boxes, star lanterns and carol gear.',
        forbidden: 'Halloween, pumpkins, ghosts, Easter eggs',
        feastYmd(year) {
            return { year, month: 12, day: 25 };
        }
    },
    {
        id: 'newyear',
        name: 'New Year\'s Luck',
        tagline: 'Lucky charms for a brand-new year',
        prompt: 'Greek New Year luck treasures: the lucky coin from the New Year cake, pomegranates for good luck, lucky charms, wishing jars.',
        palette: 'pomegranate red, shining gold and midnight blue',
        motifs: ['the lucky coin hidden in the New Year cake', 'pomegranates for good luck', 'lucky charms', 'wishing jars', 'golden clocks at midnight', 'sparklers', 'new calendars', 'four-leaf clovers'],
        greekTouch: 'cutting the vasilopita cake at school to find the lucky coin (flouri), and the yearly lucky charm (gouri)',
        young: 'Shiny and happy: gold coins, sparkly stars, red pomegranates with smiles.',
        older: 'Charming and clever: lucky-coin medallions, wish compasses, enchanted calendars.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas trees, Santa, Easter eggs, fireworks explosions',
        feastYmd(year) {
            return { year, month: 1, day: 1 };
        },
        windowYmd(year) {
            return { start: { year, month: 1, day: 2 }, end: { year, month: 1, day: 25 } };
        }
    },
    {
        id: 'carnival',
        name: 'Carnival',
        tagline: 'Masks, confetti and costumes for Apokries',
        prompt: 'Greek Carnival / Apokries treasures: colourful masks, confetti charms, costume badges, party lanterns. Costumes, not Halloween pumpkins or ghosts.',
        palette: 'confetti rainbow, magenta, teal and gold',
        motifs: ['colourful masks', 'confetti', 'paper streamers', 'costume badges', 'party lanterns', 'jester hats', 'kites for Clean Monday', 'parade drums', 'feather boas'],
        greekTouch: 'Apokries costume parades, and flying kites on Clean Monday',
        young: 'Silly and colourful: funny hats, rainbow masks, confetti poppers and party kites.',
        older: 'Dazzling and theatrical: masquerade masks, parade costumes, carnival-float models.',
        forbidden: 'Halloween, pumpkins, ghosts, witches, Christmas, Easter eggs, scary masks',
        feastYmd(year) {
            return getCleanMondayYmd(year);
        }
    },
    {
        id: 'easter',
        name: 'Orthodox Easter',
        tagline: 'Gentle spring treasures for Easter',
        prompt: 'Orthodox Easter treasures: red eggs, candles, spring lambs, braided bread charms. Gentle and joyful.',
        palette: 'egg red, spring green, candle white and gold',
        motifs: ['red eggs for egg-tapping', 'decorated Easter candles', 'spring lambs', 'braided sweet bread charms', 'chicks', 'spring flowers', 'butterflies', 'painted egg baskets'],
        greekTouch: 'red eggs for the egg-tapping game (tsougrisma), decorated Easter candles (lambades) and braided tsoureki bread',
        young: 'Soft and sweet: fluffy lambs, little chicks, bright red eggs and flowers.',
        older: 'Beautifully crafted: hand-painted eggs, ribboned candles, spring keepsakes.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, carnival masks, Easter bunny',
        feastYmd(year) {
            return dateToYmd(getOrthodoxEasterDate(year));
        }
    },
    {
        id: 'mayday',
        name: 'May Day Flowers',
        tagline: 'Wreaths and wildflowers for the first of May',
        prompt: 'Greek May Day (Protomagia) treasures: flower wreaths, daisy chains, wildflower baskets, ribbons and butterflies.',
        palette: 'poppy red, daisy white, buttercup yellow and meadow green',
        motifs: ['flower wreaths for the front door', 'daisy chains', 'wildflower baskets', 'ribbons', 'butterflies', 'picnic blankets', 'watering cans'],
        greekTouch: 'making a May Day flower wreath (Protomagia) to hang on the door',
        young: 'Happy and bright: daisy chains, smiling flowers, butterflies.',
        older: 'Delicate and handmade: woven wreaths, pressed-flower books, botanical keepsakes.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks',
        leadDays: 14,
        feastYmd(year) {
            return { year, month: 5, day: 1 };
        }
    },
    {
        id: 'endofyear',
        name: 'End of Year Fair',
        tagline: 'Trophies and keepsakes for a year of quests',
        prompt: 'End of the school year treasures: medals, rosettes, autograph books, photo frames, ribboned scrolls and summer tickets.',
        palette: 'trophy gold, sky blue and ribbon red',
        motifs: ['medals', 'rosettes', 'autograph books', 'class photo frames', 'small trophies', 'ribboned scrolls', 'summer tickets', 'paper boats', 'memory jars'],
        greekTouch: 'the end-of-year school celebration before the long summer',
        young: 'Proud and happy: shiny medals, gold stars, rosettes and smiley trophies.',
        older: 'Meaningful keepsakes: engraved medals, memory jars, signed autograph books.',
        forbidden: 'Halloween, pumpkins, ghosts, Christmas, Easter eggs, carnival masks',
        feastYmd(year) {
            return { year, month: 6, day: 30 };
        },
        windowYmd(year) {
            return { start: { year, month: 6, day: 1 }, end: { year, month: 6, day: 30 } };
        }
    }
];

export const SHOP_FESTIVAL_IDS = FESTIVAL_DEFINITIONS.map((definition) => definition.id);

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

/** 'early', 'mid' or 'late' in the shop month, so a stall made on the 28th leans into what comes next. */
export function shopMonthPhase(date = new Date()) {
    const { day } = shopZonedParts(date);
    if (day <= 10) return 'early';
    if (day <= 20) return 'mid';
    return 'late';
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
    return getMonthlyShopThemeForMonth(month);
}

/** Theme for a month number (1-12) or a "YYYY-MM" month key. */
export function getMonthlyShopThemeForMonth(month) {
    const value = typeof month === 'string' && month.includes('-')
        ? Number(month.split('-')[1])
        : Number(month);
    return MONTHLY_SHOP_THEMES[value] || MONTHLY_SHOP_THEMES[9];
}

export function getFestivalWindow(festivalId, year) {
    const definition = FESTIVAL_DEFINITIONS.find((item) => item.id === festivalId);
    if (!definition) return null;
    const feast = definition.feastYmd(year);
    const custom = typeof definition.windowYmd === 'function' ? definition.windowYmd(year) : null;
    const leadDays = Number.isFinite(definition.leadDays) ? definition.leadDays : FESTIVAL_LEAD_DAYS;
    return {
        id: definition.id,
        name: definition.name,
        tagline: definition.tagline,
        prompt: definition.prompt,
        festivalId: `${definition.id}-${year}`,
        feast,
        start: custom ? custom.start : addDaysYmd(feast, -leadDays),
        end: custom ? custom.end : feast
    };
}

/** The full festival brief (motifs, palette, age notes) for a festival id or window. */
export function getFestivalDefinition(festival) {
    const id = typeof festival === 'string' ? festival.replace(/-\d{4}$/, '') : festival?.id;
    return FESTIVAL_DEFINITIONS.find((item) => item.id === id) || null;
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
