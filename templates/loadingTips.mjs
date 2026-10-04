// templates/loadingTips.mjs
// "Did you know?" lines for the loading screen, and the shuffled deck that
// deals them. Each line must fit the two-line tip card on a phone, so keep
// them under LOADING_TIP_MAX_CHARS (tests/loading-tips.test.mjs checks).

export const LOADING_TIP_MAX_CHARS = 82;

export const LOADING_TIPS = Object.freeze([
    // ── Award Stars and the four virtues ────────────────────────────
    'A Supernova is worth three stars, and it rains stars across the whole cloud.',
    'Teamwork, Creativity, Respect, Focus: four virtues, one shared class language.',
    'Name the virtue the moment you see it. That is when a star means the most.',
    'On a Bonus Day one virtue wears a +1 gem, so every star for it counts extra.',
    'On a 2× Star Day every star counts double.',
    'Spark, Shine and Supernova: each star size is a bigger moment than the last.',
    'Heroes who were away get a warm Welcome Back bonus when they return.',
    'Spending Gold never lowers a hero’s rank. Stars stay put when they shop.',

    // ── Hero of the Day, Campfire and Ember Oaths ───────────────────
    'Crown Today’s Hero in the Adventure Log and the diary writes itself a page.',
    'The Hero of the Day gets a bonus star on their very first award.',
    'Three, five and ten crowns earn legend ranks in the Hall of Heroes.',
    'The Hero Campfire is a two-minute reflection to close the lesson.',
    'An Ember Oath is a small promise a child chooses for themselves.',
    'Oaths are checked with a flame, a candle or a moon. Every try counts.',
    'Every oath kept adds one star to the class constellation above the Campfire.',
    'A kept oath leaves a Star-Ember in the Trophy Room, a keepsake forever.',
    'Each kind of promise draws its own figure in the Campfire sky.',
    '“What we learned today” gathers the day’s quiz, story and quests by itself.',

    // ── Hero Paths and skill trees ──────────────────────────────────
    'There are eight Hero Paths, from the Guardian of Respect to the giving Patron.',
    'Guardians grow through Respect, Sages through Creativity.',
    'Paladins level up with Teamwork, Artificers with Focus.',
    'Vanguards grow stronger with every Training Grounds game the class wins.',
    'A Vanguard climbs from Recruit to Scout, Ranger, Captain and High Vanguard.',
    'Scholars rise with every Scholar’s Bonus earned on a great test.',
    'Nomads level up from Welcome Back. Coming back is its own kind of courage.',
    'Patrons grow by giving Hero’s Boons to classmates, one path point a week.',
    'At each new level a hero picks one of two skills. The other path dims forever.',
    'From level 3 a coloured aura ring shines around a hero on the leaderboards.',
    'When a Skill Tree button pulses on the roster, a hero has a choice waiting.',
    'Some skills share Gold with classmates who earned the same star today.',

    // ── Gold, the Mystic Market and familiars ───────────────────────
    'The Mystic Market restocks with new treasures every month.',
    'Market stock changes with the month and with the age of the league.',
    'Seven Festival Stalls open each year, from Halloween to the End of Year Fair.',
    'During a festival the whole Mystic Market dresses up for the celebration.',
    'Watch the stall marquee: it counts down to the next festival.',
    'New Year’s Luck, May Day Flowers and Carnival each bring their own wares.',
    'The Mask of the Protagonist makes its owner the next Hero of the Day.',
    'Legendary Artifacts can be bought twice per hero each month.',
    'A familiar starts as an egg, then hatches and evolves as its hero learns.',
    'Emberfang, Frostpaw, Thornback, Veilshade and Sparkling are all familiars.',
    'Every familiar egg hatches a creature nobody else has. Some are even Shiny!',
    'Grown-up familiars can hide one wrong Quiz answer, once a month.',
    'A Hero’s Boon lets a classmate spend Gold to give a friend half a star.',
    'Gold belongs to this school year. A fresh year opens a fresh purse.',
    'The Avatar Forge builds a portrait from a creature, a colour and a relic.',

    // ── Guild Hall and the Crown Race ───────────────────────────────
    'The four guilds: Dragon Flame, Grizzly Might, Owl Wisdom and Phoenix Rising.',
    'Dragon Flame says: Fear nothing. Burn bright.',
    'Grizzly Might says: Stand together. Stand strong.',
    'Owl Wisdom says: Knowledge is power.',
    'Phoenix Rising says: Fall down seven, rise up eight.',
    'Every star a hero earns becomes two Glory for their guild.',
    'Each month is a new Chapter of the Crown Race, and every guild starts at zero.',
    'Chapters pay 5, 3, 2 and 1 Crowns. Most Crowns in June wins the year.',
    'Crown Race Chapters are won on Glory per member, so small guilds can win too.',
    'The Unity Seal gives a bonus Crown when nearly every guildmate shines.',
    'A bad month never ends a guild’s year. There is always the next Chapter.',
    'The Sorting Hat asks seven story questions to find each hero’s guild.',
    'Tap a guild crest in the Hall and its banner unfurls to the anthem.',
    'Every guild has its own karaoke anthem. Sing it loud!',
    'In June the Grand Guild Ceremony crowns the guild of the year.',

    // ── Fortune’s Wheel ─────────────────────────────────────────
    'Fortune’s Wheel spins once a week, on the last lesson, for every guild.',
    'Twenty wedges hide treasure, twists, trials and the odd small storm.',
    'Three Chests: two hold treasure, but one hides a Mimic!',
    'Double or Nothing: keep a small prize, or flip the coin for a big one!',
    'Robin Hood takes a little Glory for the guild in last place. Last? It helps you!',
    'The Trickster can dress up a fake jackpot. Look twice before you cheer!',
    'The Mirror of Fates copies whatever the guild before you got, good or bad!',
    'Sphinx’s Riddle, Lightning Round and Hero’s Dare are Wheel trials on a clock.',
    'Wheel trials are gentler for younger leagues.',
    'A storm on the Wheel can be braved. A brave guild may keep its Glory.',
    'Storms never take stars or artifacts, only a little Glory from this month.',
    'A guild hit by a storm gets calmer skies on its next spin.',
    'Fortune’s Favor clears every storm from a guild’s wheel.',
    'The Fortune Ledger in Guild Hall remembers every spin of the year.',

    // ── Training Grounds ────────────────────────────────────────────
    'Training Grounds has four games, one for each of the four virtues.',
    'Story Weavers trains Creativity. The class writes a tale together, page by page.',
    'The Vanishing Hoard trains Focus. Spot which dragon treasure vanished!',
    'The Torn Map trains Teamwork. Each group holds one scrap of the riddle.',
    'The Round Table trains Respect. Pass the Speaking Stone and let nobody interrupt.',
    'One won Training Grounds round per lesson ties a knot on the rope.',
    'Every second knot offers the class half a bonus star in that skill.',
    'Not sure how a Training Grounds game works? Tap its ? card.',

    // ── Quiz of the Week ────────────────────────────────────────────
    'In Quiz of the Week, each right first try earns a hero a star.',
    'A rescue in Quiz of the Week earns half a star. Second chances count!',
    'A brave try in the quiz earns Gold, even when no answer lands.',
    'The Quiz Champion wins a free treasure from this month’s Market stall.',
    'Ties for Quiz Champion go to the hero with the fewest prizes this year.',
    'The class quiz score can add a bonus to your Team Quest.',

    // ── Team Quest, Hero’s Challenge and ceremonies ──────────────────
    'There are three races: Team Quest, Hero’s Challenge and the Guild Hall.',
    'Team Quest is class against class on the map, a new race every month.',
    'Hero’s Challenge crowns a Prodigy of the Month in every class.',
    'When two heroes tie all the way, they share the crown as Co-Prodigies.',
    'Every Prodigy earns a plaque in the Hall of Prodigies.',
    'Once a month ends, the Ceremony of the Month celebrates its heroes.',
    'Pre-Junior classes get a gentle Growth Festival with blooms instead of ranks.',
    'In the Growth Festival, the Golden Bloom reveals the Prodigy of the Month.',
    'A Bounty challenges the whole class: hunt for stars or race the clock.',
    'Special Quests like the Vault and the Saga are one-lesson class adventures.',
    'The Teacher Boon is a gift of two stars, opened in the last week of the month.',
    'Heroes can earn an illuminated Hero Certificate to take home.',

    // ── Scholar’s Scroll and Adventure Log ──────────────────────────
    'A test score of 95% or more can bring a Starfall of bonus stars.',
    'Growth Starfall rewards a big jump above a hero’s own average.',
    'A child who climbs from 50% to 70% is exactly who Growth Starfall is for.',
    'Open the Scholar’s Folio to see a hero’s whole journey of trials.',
    'The Scholar’s Folio marks every Personal Best with a badge.',
    'The Adventure Log keeps your class story alive, one day at a time.',
    'Each day’s diary page can be written by the Chronicler, by you, or later.',
    'The Quest Calendar can plan Bonus Days and Special Quests ahead of time.',

    // ── Classroom tools ─────────────────────────────────────────────
    'Projector Mode turns the board into a living sky with clocks and Sky Cards.',
    'The Director picks from about 160 kinds of Sky Cards for Projector Mode.',
    'The sky in the app follows the real time of day and the weather outside.',
    'Roll Call, Class Roster and Class Report are one tap away on Home.',
    'The Attendance Chronicle keeps a calm register of every lesson.',
    'Every hero has an Adventurer’s Passport, with Birthday and Nameday stamps.',
    'The (i) Adventurer’s Guide can take you straight to any feature.',
    'Families follow their hero’s journey in the Family Portal.',

    // ── A little encouragement ──────────────────────────────────────
    'Every great quest begins with a single step forward.',
    'Small daily wins stack into legendary school adventures.',
    'Great classrooms rise when curiosity leads the quest.',
    'A kind word to a classmate is worth more than any treasure.',
    'Mistakes are just practice wearing a disguise.',
    'Heroes are not born. They are built, one lesson at a time.',
    'The bravest question is the one you were afraid to ask.',
    'A guild is strongest when nobody is left behind.',
    'Today is a fresh page in your class story.',
]);

const DECK_STORAGE_KEY = 'gcq-loading-tip-deck';

function shuffled(count, random) {
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function readSavedDeck(storage, count) {
    try {
        const raw = storage && storage.getItem(DECK_STORAGE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (!saved || saved.count !== count || !Array.isArray(saved.order)) return null;
        const valid = saved.order.every((n) => Number.isInteger(n) && n >= 0 && n < count);
        return valid ? { order: saved.order, last: saved.last } : null;
    } catch {
        return null;
    }
}

function saveDeck(storage, count, order, last) {
    try {
        if (storage) storage.setItem(DECK_STORAGE_KEY, JSON.stringify({ count, order, last }));
    } catch {
        /* private window or blocked storage: the deck just restarts next visit */
    }
}

/**
 * Deals tips like a shuffled deck: none repeats until every tip has been
 * shown. The rest of the deck is remembered between visits, so reopening the
 * app carries on where the last loading screen left off.
 */
export function createTipDeck({ tips = LOADING_TIPS, storage, random = Math.random } = {}) {
    const count = tips.length;
    const saved = readSavedDeck(storage, count);
    let order = saved ? saved.order : [];
    let last = saved && Number.isInteger(saved.last) ? saved.last : -1;

    return {
        next() {
            if (!count) return '';
            if (!order.length) {
                order = shuffled(count, random);
                // Never show the same tip twice in a row across a reshuffle.
                if (count > 1 && order[0] === last) order.push(order.shift());
            }
            last = order.shift();
            saveDeck(storage, count, order, last);
            return tips[last];
        },
    };
}
