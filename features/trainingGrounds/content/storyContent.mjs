/**
 * Story Weavers content for every league: Lucky Dip words, sentence starters, structure focus,
 * Story Spark decks (hero, place, problem, and genre from C) with an opening line in the
 * league's grammar, and Twist cards for the middle of a story.
 * Pure data + helpers; lazy-loaded through features/storyWeaverHelpers.js.
 * Tests: tests/training-grounds-content.test.mjs.
 */

import { getLeagueKey } from '../leagueKey.mjs';

const words = (spec) => Object.freeze(spec.split(',').map((s) => {
    const [word, k] = s.trim().split(':');
    return Object.freeze([word.trim(), { n: 'noun', v: 'verb', a: 'adjective' }[k.trim()]]);
}));

// ─── Lucky Dip words (noun / verb / adjective) ───────────────────────────────
export const STORY_WORDS = Object.freeze({
    prejunior: words(`moon:n, star:n, cat:n, frog:n, box:n, cake:n, tree:n, ball:n, fish:n, duck:n, hat:n, sun:n, bus:n, egg:n, bird:n,
        jump:v, run:v, sing:v, swim:v, fly:v, dance:v, eat:v, sleep:v, play:v, clap:v, hop:v, look:v,
        big:a, little:a, happy:a, sad:a, red:a, blue:a, funny:a, sleepy:a, hot:a, cold:a, yellow:a, green:a, fast:a, slow:a`),
    juniorA: words(`castle:n, dragon:n, robot:n, key:n, map:n, island:n, garden:n, monster:n, pirate:n, rocket:n, teddy:n, kite:n, cake:n, owl:n, lion:n,
        whisper:v, climb:v, hide:v, find:v, shout:v, follow:v, laugh:v, cry:v, help:v, open:v, catch:v, kick:v, ride:v, wave:v,
        brave:a, tiny:a, scary:a, shiny:a, hungry:a, magic:a, tall:a, angry:a, noisy:a, quiet:a, kind:a, silly:a, dirty:a, beautiful:a`),
    juniorB: words(`forest:n, treasure:n, wizard:n, cave:n, storm:n, bridge:n, tower:n, giant:n, mermaid:n, compass:n, puppy:n, lantern:n, river:n, ship:n, crown:n,
        explore:v, discover:v, wander:v, crash:v, splash:v, rescue:v, carry:v, build:v, fall:v, invent:v, chase:v, scream:v, borrow:v, swap:v,
        enormous:a, curious:a, gloomy:a, sparkly:a, wild:a, clever:a, dangerous:a, strange:a, broken:a, golden:a, lonely:a, lucky:a, frozen:a, colourful:a`),
    a: words(`potion:n, secret:n, journey:n, volcano:n, compass:n, shadow:n, kingdom:n, desert:n, inventor:n, telescope:n, footprint:n, message:n, knight:n, jungle:n, thief:n,
        escape:v, tremble:v, rescue:v, explore:v, disappear:v, sneak:v, decide:v, guess:v, recognise:v, collect:v, shiver:v, gallop:v, unlock:v, warn:v,
        ancient:a, mysterious:a, sparkling:a, terrified:a, brilliant:a, enormous:a, invisible:a, dusty:a, crowded:a, peaceful:a, nervous:a, proud:a, delicious:a, rusty:a`),
    b: words(`legend:n, labyrinth:n, expedition:n, crystal:n, scroll:n, villain:n, harbour:n, tunnel:n, ghost:n, signal:n, riddle:n, oasis:n, festival:n, avalanche:n, sailor:n,
        vanish:v, struggle:v, whisper:v, investigate:v, panic:v, trap:v, recover:v, glow:v, sink:v, plunge:v, approach:v, protect:v, betray:v, celebrate:v,
        fearless:a, eerie:a, reluctant:a, exhausted:a, furious:a, glorious:a, abandoned:a, enormous:a, suspicious:a, magnificent:a, ordinary:a, fragile:a, precious:a, desperate:a`),
    c: words(`prophecy:n, voyage:n, echo:n, illusion:n, rebellion:n, artefact:n, horizon:n, guardian:n, wilderness:n, compass:n, rumour:n, mirage:n, alliance:n, ruins:n, apprentice:n,
        unravel:v, summon:v, stumble:v, conquer:v, abandon:v, reveal:v, hesitate:v, sacrifice:v, negotiate:v, persuade:v, deceive:v, emerge:v, endure:v, uncover:v,
        luminous:a, bewildered:a, majestic:a, treacherous:a, relentless:a, ominous:a, desolate:a, triumphant:a, cunning:a, solemn:a, peculiar:a, vast:a, weary:a, defiant:a`),
    d: words(`enigma:n, labyrinth:n, catastrophe:n, sanctuary:n, conspiracy:n, legacy:n, revelation:n, exile:n, phenomenon:n, chronicle:n, nemesis:n, threshold:n, dilemma:n, refuge:n, oracle:n,
        decipher:v, unleash:v, contemplate:v, scrutinise:v, elude:v, forsake:v, salvage:v, vanquish:v, falter:v, rekindle:v, unearth:v, intervene:v, defy:v, reconcile:v,
        ethereal:a, formidable:a, enigmatic:a, ruthless:a, resilient:a, foreboding:a, serene:a, perilous:a, elusive:a, haunting:a, audacious:a, poignant:a, indomitable:a, clandestine:a`)
});

// ─── Sentence starters ───────────────────────────────────────────────────────
export const STORY_STARTERS = Object.freeze({
    prejunior: ['I see a…', 'Look! A…', 'It is…', 'The cat…', 'I like…', 'It can…', 'Hello,…', 'The big…', 'Oh no! The…', 'Yes! The…', 'Where is the…?', 'Wow! A…'],
    juniorA: ['One day,…', 'Then the…', 'The little…', 'Look! There is…', 'At night,…', 'She can…', 'He has got…', 'They are happy because…', 'Oh no!…', 'Every morning,…', 'Suddenly, the…', 'In the garden,…'],
    juniorB: ['Once upon a time,…', 'Suddenly,…', 'There was a…', 'Then they…', 'The next day,…', 'It was very…', 'In the forest,…', 'They were scared because…', 'Next to the…,', 'After that,…', 'Behind the door,…', 'At last,…'],
    a: ['Once upon a time,…', 'Suddenly,…', 'After that,…', 'The next morning,…', 'Luckily,…', 'Unfortunately,…', 'In the end,…', 'There were…', 'It was bigger than…', 'Everyone was surprised when…', 'Later that day,…', 'First,… Then,…'],
    b: ['While they were…', 'Just then,…', 'Meanwhile,…', 'They were going to… but…', 'Without warning,…', 'Because of the storm,…', 'So they decided to…', 'At that moment,…', 'Nobody knew that…', 'As soon as…', 'Although it was late,…', 'In the middle of the night,…'],
    c: ['Without warning,…', 'Meanwhile,…', 'Although they were scared,…', 'Nobody has ever…', 'If they don’t hurry,…', 'The creature, which…,', 'Little did they know that…', 'Despite the storm,…', 'It was the first time that…', 'Ever since that day,…', 'Just as the sun set,…', 'As far as anyone knew,…'],
    d: ['By the time they arrived,…', 'If only they had…', 'Had they known…,', 'No sooner had… than…', 'Little did they suspect that…', 'It was rumoured that…', 'Not once had anyone…', 'Were it not for…,', 'The door had been…', 'Unless they found…,', 'Only then did they realise…', 'Against all odds,…']
});

// ─── Structure focus (one grammar pattern per page) ──────────────────────────
const H = (label, pattern, example) => Object.freeze({ label, pattern, example });

export const STORY_STRUCTURES = Object.freeze({
    prejunior: [
        H('Colours + things', 'a + colour + thing', 'a red apple'),
        H('This is…', 'This is + a/an + thing', 'This is a magic box.'),
        H('Can / can’t', 'It can + verb', 'The bird can fly.'),
        H('In / on / under', 'in / on / under the + place', 'The key is under the bed.'),
        H('Big and little', 'a big / a little + thing', 'a little frog and a big frog'),
        H('Counting', 'number + things', 'Three fish swim.')
    ],
    juniorA: [
        H('Am / is / are', 'I am / He is / They are', 'They are brave friends.'),
        H('Present simple', 'she / he + verb-s', 'The fox runs to the river.'),
        H('Have got', 'has got / have got', 'The wizard has got a blue hat.'),
        H('There is / are', 'There is a… / There are some…', 'There are two dragons in the cave.'),
        H('Can for ability', 'can / can’t + verb', 'The robot can dance, but it can’t swim.'),
        H('Feelings', 'He / She is + feeling', 'The little bear is sad.')
    ],
    juniorB: [
        H('Was / were', 'was / were + adjective', 'The forest was dark and quiet.'),
        H('Articles', 'a / an + noun', 'They found an old map.'),
        H('Prepositions', 'in / on / under / next to / behind', 'The treasure was behind the tree.'),
        H('Past simple', 'verb-ed / irregular past', 'The giant opened the door.'),
        H('Adjective order', 'size + colour + noun', 'a big green dragon'),
        H('And / but', 'idea + and / but + idea', 'It was cold, but they were happy.')
    ],
    a: [
        H('Past simple', 'verb-ed / irregular past', 'The knight opened the door and saw a dragon.'),
        H('There was / were', 'There was a… / There were some…', 'There were three glowing stones.'),
        H('Comparatives', 'bigger / faster / more … than', 'The river was wider than a road.'),
        H('Superlatives', 'the biggest / the most …', 'It was the most beautiful castle in the land.'),
        H('Time words', 'First / Then / After that / Finally', 'First they ran. Then they hid.'),
        H('Because / so', 'reason with because / result with so', 'They were tired, so they stopped.')
    ],
    b: [
        H('Past continuous', 'was/were + verb-ing, when + past', 'They were sleeping when the bell rang.'),
        H('Going to', 'going to + verb', 'We are going to find the lost city.'),
        H('Linking words', 'and / but / because / so', 'It was late, so they lit a torch.'),
        H('While', 'While + past continuous, past simple', 'While she was reading, the lights went out.'),
        H('Adverbs', 'verb + adverb (-ly)', 'The thief crept quietly down the stairs.'),
        H('Direct speech', '“…,” said / shouted / whispered', '“Run!” shouted the captain.')
    ],
    c: [
        H('Present perfect', 'have/has + past participle', 'Nobody has ever opened this gate.'),
        H('1st conditional', 'If + present, … will + verb', 'If we cross the bridge, the troll will wake up.'),
        H('Relative clauses', 'who / which / that', 'The girl who found the key smiled.'),
        H('Used to', 'used to + verb', 'The village used to be full of music.'),
        H('Although / despite', 'Although + clause / Despite + noun', 'Despite the rain, they kept walking.'),
        H('Show, don’t tell', 'action instead of feeling word', 'Her hands shook as she opened the letter.')
    ],
    d: [
        H('Past perfect', 'had + past participle', 'The ship had already left when they arrived.'),
        H('2nd conditional', 'If + past, … would + verb', 'If I had wings, I would fly over the wall.'),
        H('Passive voice', 'was/were + past participle', 'The castle was built by giants.'),
        H('3rd conditional', 'If + had done, … would have done', 'If they had listened, they would have escaped.'),
        H('Inversion', 'Never / No sooner / Little did…', 'Little did they know what was waiting.'),
        H('Modal deduction', 'must / can’t / might have + past participle', 'Someone must have opened the gate.')
    ]
});

// ─── Story Spark decks ───────────────────────────────────────────────────────
// Each league writes its cards to fit its own opening line (see SPARK_OPENINGS).
export const STORY_SPARK = Object.freeze({
    prejunior: {
        hero: ['a little frog', 'a big bear', 'a happy cat', 'a red robot', 'a funny duck', 'a little fish', 'a pink pig', 'a sleepy owl', 'a baby dragon', 'a yellow chick', 'a small mouse', 'a brave bunny', 'a blue bird', 'a tall giraffe', 'a magic teddy'],
        place: ['in the garden', 'in the park', 'at the beach', 'in a big box', 'on a bus', 'in the sea', 'on a farm', 'in a castle', 'in the snow', 'in a tree', 'at school', 'on the moon', 'in a forest', 'in the kitchen', 'at the zoo'],
        problem: ['The ball is lost!', 'It is raining!', 'The cake is gone!', 'The door is closed!', 'It is very dark!', 'The hat is in the tree!', 'A friend is sad!', 'The balloon flies away!', 'It is very cold!', 'The toy is broken!', 'There is a big hole!', 'The shoes are gone!', 'The car is stuck!', 'It is very hot!', 'The fish is hungry!']
    },
    juniorA: {
        hero: ['A brave little robot', 'A shy dragon', 'A funny monkey', 'A tiny pirate', 'A kind giant', 'A silly wizard', 'A clever cat', 'A lost puppy', 'A happy ghost', 'A young princess', 'A singing frog', 'A sleepy lion', 'A friendly alien', 'A little knight', 'A magic unicorn'],
        place: ['in a tall tower', 'on a little island', 'in a big city', 'in a dark cave', 'in a toy shop', 'on a pirate ship', 'in a sweet shop', 'in a snowy forest', 'in a funny house', 'under the sea', 'in a magic garden', 'on a farm', 'in a castle', 'next to a volcano', 'on the moon'],
        problem: ['a big wind takes its hat.', 'the dragon eats all the cake.', 'the door does not open.', 'the moon falls into the sea.', 'all the colours go away.', 'a monster sits on the bridge.', 'the music box stops.', 'the stars are not in the sky.', 'a little bird cannot fly.', 'the shoes start to dance.', 'it snows in the summer.', 'the map is in the river.', 'a giant takes the bus.', 'the clock stops at twelve.', 'the robot loses its key.']
    },
    juniorB: {
        hero: ['a brave girl', 'a little dragon', 'a curious robot', 'a clever fox', 'a young knight', 'a lonely giant', 'a funny wizard', 'a tiny mermaid', 'a lost puppy', 'a brave pirate', 'a sleepy bear', 'a kind witch', 'a little prince', 'a strong elephant', 'a cheeky monkey'],
        place: ['in a dark forest', 'on a sunny island', 'in an old castle', 'in a busy town', 'under the sea', 'on a high mountain', 'in a magic garden', 'in a snowy village', 'near a big river', 'in a desert', 'in a tall tower', 'on a pirate ship', 'in a toy shop', 'in a jungle', 'in a cloud'],
        problem: ['the bridge was broken.', 'the sun did not come up.', 'a storm took the roof away.', 'all the sweets were missing.', 'the dragon was sick.', 'the river was empty.', 'the magic key was lost.', 'everybody was very small.', 'the trees started to talk.', 'the school was full of frogs.', 'a giant was in the garden.', 'the music was gone.', 'the boat had a hole in it.', 'the map was wet.', 'the snow was pink.']
    },
    a: {
        hero: ['a brave young knight', 'a curious inventor', 'a shy dragon', 'a clever detective', 'a lonely lighthouse keeper', 'a young explorer', 'a talking parrot', 'a nervous wizard', 'a kind pirate captain', 'a little robot', 'a famous chef', 'a lost astronaut', 'a cheerful farmer', 'a mysterious stranger', 'a fearless princess'],
        place: ['in a village by the sea', 'in an enormous castle', 'on a tiny island', 'in a busy city', 'in the middle of a jungle', 'in a quiet mountain town', 'under the ocean', 'in a crooked old house', 'on a faraway planet', 'next to a volcano', 'in a magical forest', 'in a desert oasis', 'on a floating island', 'in a snowy kingdom', 'inside a giant tree'],
        problem: ['a strange map appeared under the door.', 'all the clocks in town stopped.', 'the king’s crown disappeared.', 'a dragon landed in the square.', 'the river turned to chocolate.', 'every book in the library went blank.', 'a giant footprint appeared in the garden.', 'the moon did not come out.', 'a message arrived in a bottle.', 'the animals stopped talking.', 'the bridge to the mainland fell down.', 'the colours drained out of the sky.', 'a robot knocked on the door.', 'the magic potion exploded.', 'the stars started falling.']
    },
    b: {
        hero: ['A young detective', 'A clumsy wizard', 'A brave sailor', 'A lonely robot', 'A curious scientist', 'A runaway prince', 'A famous explorer', 'A shy dragon', 'A clever thief', 'A brave firefighter', 'A friendly ghost', 'A young astronaut', 'A street musician', 'A retired pirate', 'A talking cat'],
        place: ['through a dark forest', 'along a quiet beach', 'across a frozen lake', 'through a busy market', 'along an old railway line', 'through the castle gardens', 'across a rope bridge', 'through a sandy desert', 'along a misty river', 'through the city at night', 'up a steep mountain path', 'through a field of sunflowers', 'along a narrow tunnel', 'across the school playground', 'through a snowy village'],
        problem: ['a mysterious light appeared in the sky.', 'the ground started to shake.', 'a strange voice called their name.', 'a giant shadow passed overhead.', 'all the lights in town went out.', 'a dragon egg rolled out of a bush.', 'a door opened in the middle of nowhere.', 'the river began to flow backwards.', 'an old woman handed them a key.', 'a balloon carrying a letter landed at their feet.', 'the clock tower struck thirteen.', 'a wolf ran past with a crown in its mouth.', 'the snow turned gold.', 'a boat with no crew drifted past.', 'their reflection waved back.']
    },
    c: {
        hero: ['a reluctant hero', 'an inventor nobody believed', 'a dragon who hated fire', 'a detective who never slept', 'a girl who could hear the wind', 'a knight who had lost his sword', 'a robot that wanted to dream', 'a thief with a good heart', 'an apprentice wizard', 'a ghost who couldn’t remember', 'a lighthouse keeper', 'a young queen', 'an explorer with no map', 'a boy who could talk to birds', 'a pirate who was afraid of water'],
        place: ['a village at the edge of the world', 'a city built on the back of a whale', 'a lighthouse on a lonely cliff', 'an abandoned theme park', 'a library that never closes', 'a kingdom under the ice', 'a forest where it is always autumn', 'a train that never stops', 'a castle in the clouds', 'a desert of glass', 'a market that opens only at midnight', 'an island that moves', 'a school for spies', 'a town where nobody can lie', 'a mountain monastery'],
        problem: ['the river has turned to stone.', 'the last dragon egg has been stolen.', 'every mirror in town has gone dark.', 'the sun has set and hasn’t risen again.', 'a stranger has arrived with a warning.', 'all the town’s memories have disappeared.', 'the ancient gate has opened by itself.', 'the stars have started to go out, one by one.', 'someone has replaced the king with a double.', 'the music has stopped everywhere.', 'a map has appeared that shows tomorrow.', 'the animals have all left the forest.', 'a voice has started speaking from the well.', 'the tide has gone out and hasn’t come back.', 'the colours have faded from the world.'],
        genre: ['Mystery', 'Adventure', 'Legend', 'Science fiction', 'Comedy', 'Fairy tale', 'Ghost story (not too scary!)', 'Fable']
    },
    d: {
        hero: ['A disgraced knight', 'A cartographer with a secret', 'A scientist who had broken the rules', 'An exiled princess', 'A detective haunted by one unsolved case', 'A thief who stole only books', 'An android learning to feel', 'A storm chaser', 'A translator of forgotten languages', 'A ship’s doctor', 'An apprentice who knew too much', 'A street artist', 'A retired spy', 'A beekeeper who could hear the hive', 'A clockmaker’s daughter'],
        place: ['the lighthouse on Raven Rock', 'the drowned city of Velmar', 'the observatory above the clouds', 'the monastery carved into the cliff', 'the last library on Earth', 'the frozen harbour of Nordhavn', 'the abandoned research station', 'the island no map records', 'the mountain village of Kallisto', 'the desert caravan city', 'the clockwork palace', 'the forest of silent bells', 'the orbital colony Helios', 'the underground archive', 'the old harbour of Chania'],
        problem: ['a letter arrived, written in their own handwriting.', 'the bells rang although nobody had touched them.', 'a stranger arrived carrying a torn map.', 'every compass began pointing south.', 'the archive’s oldest book was found rewritten.', 'the sea froze in the middle of summer.', 'a child appeared who claimed to be from the future.', 'the town woke to find the bridge gone.', 'a signal began repeating from the dead satellite.', 'the oracle fell silent.', 'a painting changed overnight.', 'the river carried a message in a bottle.', 'the old clock started running backwards.', 'a ship returned that had been lost for fifty years.', 'the stars rearranged themselves into a word.'],
        genre: ['Mystery', 'Thriller', 'Myth retold', 'Science fiction', 'Historical adventure', 'Dark fairy tale', 'Comedy of errors', 'Survival story']
    }
});

/** Opening lines that put the three cards together in the league's grammar. */
const SPARK_OPENINGS = Object.freeze({
    prejunior: (h, p, x) => `Look! It’s ${h}. It is ${p}. Oh no! ${x}`,
    juniorA: (h, p, x) => `${h} lives ${p}. One day, ${x}`,
    juniorB: (h, p, x) => `Once upon a time, there was ${h} ${p}. One day, ${x}`,
    a: (h, p, x) => `Once upon a time, ${h} lived ${p}. One morning, ${x}`,
    b: (h, p, x) => `${h} was walking ${p} when ${x}`,
    c: (h, p, x) => `For as long as anyone can remember, ${h} has lived in ${p}. But today, ${x}`,
    d: (h, p, x) => `${h} had never left ${p} until the day ${x}`
});

function cap(text) {
    const s = String(text || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The opening line for a spark. */
export function sparkOpening(league, spark) {
    const key = getLeagueKey(league);
    if (!spark?.hero || !spark?.place || !spark?.problem) return '';
    return cap(SPARK_OPENINGS[key](spark.hero, spark.place, spark.problem));
}

/** Draws one card from a deck, avoiding the current one. */
export function drawSparkCard(league, deck, { current = '', random = Math.random } = {}) {
    const cards = STORY_SPARK[getLeagueKey(league)]?.[deck] || [];
    if (!cards.length) return '';
    const pool = cards.length > 1 ? cards.filter((c) => c !== current) : cards;
    return pool[Math.floor(random() * pool.length) % pool.length];
}

/** A whole new spark: hero, place, problem (and genre where the league has one). */
export function drawSpark(league, { random = Math.random } = {}) {
    const decks = STORY_SPARK[getLeagueKey(league)];
    const spark = {
        hero: drawSparkCard(league, 'hero', { random }),
        place: drawSparkCard(league, 'place', { random }),
        problem: drawSparkCard(league, 'problem', { random })
    };
    if (decks.genre) spark.genre = drawSparkCard(league, 'genre', { random });
    return spark;
}

export function sparkDecks(league) {
    return Object.keys(STORY_SPARK[getLeagueKey(league)]);
}

// ─── Twist cards ─────────────────────────────────────────────────────────────
export const STORY_TWISTS = Object.freeze({
    prejunior: ['Oh no! It is raining!', 'Look! A big dragon!', 'The cat is hungry!', 'Splash! Into the water!', 'Wow! A rainbow!', 'Oh no! It is dark!', 'Look! A little egg!', 'Boom! A big noise!', 'Yay! A party!', 'Oh no! The hat flies away!', 'Look! A friend!', 'Wow! Snow!', 'Oops! It falls down!', 'Look! A magic box!', 'Shh! The baby is sleeping!'],
    juniorA: ['Suddenly, a big wind blows.', 'Then, a dragon comes to the door.', 'Oh no! The bridge is broken.', 'Look! There is a door in the tree.', 'Suddenly, everybody is very small.', 'Then, it starts to snow.', 'Oh no! The cake is gone!', 'A little bird can talk!', 'Suddenly, the lights go out.', 'A giant sits on the house.', 'The teddy can walk!', 'Then, the music stops.', 'Look! The moon is very big tonight.', 'Oh no! The robot is sad.', 'Suddenly, a monkey takes the key!'],
    juniorB: ['Suddenly, the ground started to shake.', 'Then, a little dragon fell out of the sky.', 'Oh no! The map flew away in the wind.', 'Suddenly, there was a knock at the door.', 'Behind the tree, there was a secret door.', 'Then, all the animals started to sing.', 'The boat had a big hole in it!', 'Suddenly, everything was purple.', 'A giant footprint was in the garden.', 'The old man was really a wizard!', 'Then, the river was full of fish… with wings!', 'The castle door was open.', 'Suddenly, it was night in the middle of the day.', 'A note under the door said: “Help!”', 'The treasure box was empty!'],
    a: ['Suddenly, the floor disappeared.', 'Unfortunately, the bridge broke into pieces.', 'Luckily, a friendly dragon arrived.', 'Then they found a message in an old bottle.', 'Everyone was surprised when the statue moved.', 'The map was wrong: the treasure was somewhere else!', 'A storm was bigger than anything they had seen.', 'The thief was the person they trusted most!', 'Suddenly, the animals started talking.', 'Their shadows ran away.', 'The door opened by itself.', 'A rocket landed in the garden.', 'The potion made them invisible!', 'The friendly guide was really a fox!', 'It was the strangest day of their lives.'],
    b: ['Just then, the lights went out.', 'While they were sleeping, someone took the map.', 'Without warning, the ground began to shake.', 'They were going to leave, but the door was locked.', 'Meanwhile, the villain was watching from the tower.', 'At that moment, a voice whispered their name.', 'As soon as they opened the box, it started to glow.', 'Nobody knew that the old cat was a wizard.', 'Because of the storm, the ship was going to sink.', 'While they were running, the bridge began to fall.', 'Suddenly, they realised they were not alone.', 'A letter arrived, but it was dated next year.', 'Just then, the clock struck thirteen.', 'The river was flowing uphill!', 'Their best friend was the spy all along!'],
    c: ['It turns out the map has been a fake all along.', 'Without warning, the bridge they have just crossed has vanished.', 'The friend who has helped them is the villain in disguise.', 'If they don’t hurry, the door will close forever.', 'A stranger who knows their names has appeared.', 'The creature, which everyone has feared, is actually lost.', 'Despite the storm, a light has appeared on the horizon.', 'Nobody has noticed that the clock is running backwards.', 'The treasure they have searched for is a single seed.', 'Little did they know that the castle was moving.', 'The letter they have received is in their own handwriting.', 'Ever since they opened the box, it has been snowing indoors.', 'The legend they have heard is only half the story.', 'If anyone speaks, the spell will break.', 'The guide who has led them here can’t remember the way back.'],
    d: ['It was then that they realised the map had been drawn by their own hand.', 'Little did they suspect that they had been followed from the start.', 'No sooner had they opened the door than the lights failed.', 'The message, it turned out, had been sent from the future.', 'Had they listened to the old woman, none of this would have happened.', 'The one person they had trusted had been lying all along.', 'Only then did they realise the castle had no doors.', 'The treasure had already been taken, and a note had been left in its place.', 'Not once had anyone noticed that the portrait’s eyes moved.', 'If they had arrived a minute earlier, they would have been trapped.', 'The storm, it seemed, had been summoned deliberately.', 'Unless they solved the riddle by dawn, the city would fall silent forever.', 'The villain, they discovered, was trying to save the world too.', 'Everything they had believed about the legend was wrong.', 'The voice on the radio was their own.']
});

/** One twist card for the league, avoiding the last one shown. */
export function drawTwist(league, { current = '', random = Math.random } = {}) {
    const cards = STORY_TWISTS[getLeagueKey(league)] || [];
    const pool = cards.length > 1 ? cards.filter((c) => c !== current) : cards;
    return pool[Math.floor(random() * pool.length) % pool.length] || '';
}

/** Three Lucky Dip words for the league: a noun, a verb and an adjective, never repeating `exclude`. */
export function pickLeagueStoryWords(league, { exclude = [], random = Math.random } = {}) {
    const skip = new Set(exclude.map((w) => String(w || '').toLowerCase()));
    const bank = STORY_WORDS[getLeagueKey(league)] || STORY_WORDS.a;
    return ['noun', 'verb', 'adjective'].map((kind) => {
        const pool = bank.filter(([word, k]) => k === kind && !skip.has(word));
        const [word] = pool[Math.floor(random() * pool.length) % pool.length] || [''];
        return word ? { word, kind } : null;
    }).filter(Boolean);
}

export function getLeagueStarters(league) {
    return [...(STORY_STARTERS[getLeagueKey(league)] || STORY_STARTERS.a)];
}

export function getLeagueStructures(league) {
    return [...(STORY_STRUCTURES[getLeagueKey(league)] || STORY_STRUCTURES.a)];
}
