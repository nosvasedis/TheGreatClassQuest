/**
 * The Vanishing Hoard: themed treasure chests, round types and sentence frames for every league.
 * Each treasure is [emoji, word, tier]; tier is the first league that should meet the word
 * (0 Pre-Junior … 6 D, see ../leagueKey.mjs). A league draws mostly from its own tier and the two
 * below it, so older classes meet harder words and the youngest only meet concrete, familiar ones.
 * Pure data; lazy-loaded by features/trainingGrounds.js. Tests: tests/training-grounds-content.test.mjs.
 */

const theme = (id, name, icon, items) => Object.freeze({ id, name, icon, items: Object.freeze(items.map((t) => Object.freeze(t))) });

export const HOARD_THEMES = Object.freeze([
    theme('lair', 'Dragon’s Lair', '🐉', [
        ['⭐', 'star', 0], ['🎁', 'present', 0], ['👑', 'crown', 0], ['💍', 'ring', 0], ['🔑', 'key', 0], ['🔔', 'bell', 0],
        ['🛡️', 'shield', 2], ['🕯️', 'candle', 2], ['🗡️', 'sword', 2], ['💎', 'diamond', 3], ['🪙', 'coin', 3], ['🪞', 'mirror', 3],
        ['🗝️', 'old key', 3], ['💰', 'bag of gold', 3], ['🏆', 'trophy', 4], ['📜', 'scroll', 4], ['🔮', 'crystal ball', 4], ['🧪', 'potion', 4],
        ['🏺', 'vase', 4], ['⏳', 'hourglass', 5], ['🧭', 'compass', 5], ['⚱️', 'urn', 6], ['🧿', 'amulet', 6]
    ]),
    theme('toys', 'Toy Box', '🧸', [
        ['🧸', 'teddy', 0], ['⚽', 'ball', 0], ['🚗', 'car', 0], ['🎈', 'balloon', 0], ['🚂', 'train', 0], ['✈️', 'plane', 0],
        ['🪆', 'doll', 0], ['🪁', 'kite', 0], ['🤖', 'robot', 0], ['🚀', 'rocket', 0], ['🥁', 'drum', 0], ['🪀', 'yo-yo', 2],
        ['🧩', 'puzzle', 2], ['🛴', 'scooter', 2], ['🎨', 'paints', 2], ['🎲', 'dice', 3], ['🧱', 'bricks', 3], ['🛹', 'skateboard', 3],
        ['🎮', 'video game', 3], ['🎯', 'target', 4], ['🃏', 'playing cards', 4], ['♟️', 'chess piece', 5]
    ]),
    theme('farm', 'The Farm', '🐄', [
        ['🐄', 'cow', 0], ['🐷', 'pig', 0], ['🐑', 'sheep', 0], ['🐔', 'chicken', 0], ['🐴', 'horse', 0], ['🦆', 'duck', 0],
        ['🐶', 'dog', 0], ['🐱', 'cat', 0], ['🥚', 'egg', 0], ['🍎', 'apple', 0], ['🐐', 'goat', 0], ['🐇', 'rabbit', 0],
        ['🐝', 'bee', 1], ['🥕', 'carrot', 0], ['🐭', 'mouse', 0], ['🚜', 'tractor', 2], ['🌽', 'corn', 2], ['🦃', 'turkey', 2],
        ['🐓', 'rooster', 3], ['🧺', 'basket', 3], ['🪣', 'bucket', 3], ['🌾', 'wheat', 4], ['🐿️', 'squirrel', 4], ['🥜', 'peanuts', 5]
    ]),
    theme('jungle', 'Jungle & Zoo', '🦁', [
        ['🦁', 'lion', 0], ['🐘', 'elephant', 0], ['🐒', 'monkey', 0], ['🐯', 'tiger', 0], ['🐻', 'bear', 0], ['🦒', 'giraffe', 0],
        ['🦓', 'zebra', 0], ['🐍', 'snake', 0], ['🦜', 'parrot', 0], ['🐢', 'turtle', 0], ['🐼', 'panda', 0], ['🐊', 'crocodile', 2],
        ['🦛', 'hippo', 2], ['🦘', 'kangaroo', 2], ['🦩', 'flamingo', 3], ['🦏', 'rhino', 3], ['🦍', 'gorilla', 3], ['🐆', 'leopard', 4],
        ['🦎', 'lizard', 4], ['🦚', 'peacock', 4], ['🦥', 'sloth', 5], ['🦂', 'scorpion', 5], ['🦦', 'otter', 5], ['🦨', 'skunk', 6]
    ]),
    theme('kitchen', 'The Kitchen', '🍳', [
        ['🍌', 'banana', 0], ['🍰', 'cake', 0], ['🥛', 'milk', 0], ['🍕', 'pizza', 0], ['🍦', 'ice cream', 0], ['🍎', 'apple', 0],
        ['🍞', 'bread', 0], ['🧀', 'cheese', 1], ['🍪', 'biscuit', 1], ['🍓', 'strawberry', 0], ['🍇', 'grapes', 0], ['🍋', 'lemon', 1],
        ['🍉', 'watermelon', 2], ['🍅', 'tomato', 2], ['🥔', 'potato', 2], ['🥄', 'spoon', 2], ['🍯', 'honey', 2], ['🥪', 'sandwich', 2],
        ['🍄', 'mushroom', 2], ['🫖', 'teapot', 3], ['🥥', 'coconut', 3], ['🥦', 'broccoli', 3], ['🍴', 'knife and fork', 3],
        ['🍳', 'frying pan', 4], ['🧂', 'salt', 4], ['🥐', 'croissant', 4], ['🌶️', 'chilli pepper', 5], ['🫑', 'pepper', 5]
    ]),
    theme('clothes', 'Clothes Chest', '👕', [
        ['🧢', 'cap', 0], ['👗', 'dress', 0], ['🎩', 'hat', 0], ['👟', 'shoes', 0], ['👕', 'T-shirt', 0], ['🧦', 'socks', 0],
        ['🧤', 'gloves', 1], ['🧣', 'scarf', 1], ['👓', 'glasses', 1], ['🩳', 'shorts', 1], ['👢', 'boots', 0], ['🧥', 'coat', 0],
        ['☂️', 'umbrella', 1], ['👖', 'jeans', 2], ['⌚', 'watch', 2], ['🕶️', 'sunglasses', 2], ['👜', 'handbag', 3], ['👔', 'tie', 3],
        ['👙', 'swimsuit', 3], ['🥾', 'hiking boots', 4], ['🩴', 'flip-flops', 4], ['🧶', 'ball of wool', 4], ['🧵', 'thread', 5],
        ['🪡', 'needle', 5], ['👘', 'kimono', 6]
    ]),
    theme('school', 'School Bag', '🎒', [
        ['✏️', 'pencil', 0], ['📕', 'book', 0], ['🖍️', 'crayon', 0], ['✂️', 'scissors', 0], ['📏', 'ruler', 1], ['🎒', 'schoolbag', 0],
        ['🖊️', 'pen', 0], ['⏰', 'clock', 0], ['🧃', 'juice', 1], ['📓', 'notebook', 2], ['🖌️', 'paintbrush', 2], ['💻', 'laptop', 3],
        ['📌', 'pin', 3], ['🌍', 'globe', 3], ['📎', 'paper clip', 4], ['🗂️', 'folder', 4], ['📐', 'set square', 5], ['🧮', 'abacus', 5],
        ['🔬', 'microscope', 5], ['🧪', 'test tube', 5], ['🖇️', 'paper clips', 6]
    ]),
    theme('house', 'Around the House', '🏠', [
        ['🛏️', 'bed', 0], ['🚪', 'door', 0], ['📺', 'TV', 0], ['🪑', 'chair', 0], ['🪟', 'window', 0], ['🛁', 'bath', 0],
        ['🕰️', 'clock', 0], ['🛋️', 'sofa', 2], ['🚿', 'shower', 2], ['🖼️', 'picture', 2], ['☎️', 'telephone', 2], ['🪴', 'plant', 2],
        ['🪞', 'mirror', 3], ['🧺', 'basket', 3], ['🔦', 'torch', 3], ['💡', 'light bulb', 4], ['🧹', 'broom', 4], ['🧽', 'sponge', 4],
        ['🪜', 'ladder', 4], ['🧲', 'magnet', 4], ['🔌', 'plug', 5], ['🧯', 'fire extinguisher', 6], ['🗄️', 'filing cabinet', 6]
    ]),
    theme('sea', 'Under the Sea', '🌊', [
        ['🐟', 'fish', 0], ['⛵', 'boat', 0], ['🐬', 'dolphin', 0], ['🐳', 'whale', 0], ['🦈', 'shark', 0], ['🦀', 'crab', 0],
        ['🐚', 'shell', 0], ['🐢', 'turtle', 0], ['🐙', 'octopus', 2], ['🏝️', 'island', 2], ['🧜', 'mermaid', 2], ['🌊', 'wave', 2],
        ['⚓', 'anchor', 3], ['🦭', 'seal', 3], ['🦞', 'lobster', 4], ['🦐', 'prawn', 5], ['🦑', 'squid', 5], ['🤿', 'diving mask', 5],
        ['🦦', 'otter', 5], ['🐡', 'pufferfish', 6]
    ]),
    theme('space', 'Space Station', '🚀', [
        ['🌙', 'moon', 0], ['⭐', 'star', 0], ['☀️', 'sun', 0], ['🚀', 'rocket', 0], ['👽', 'alien', 0], ['🤖', 'robot', 0],
        ['🪐', 'planet', 2], ['🛸', 'UFO', 2], ['🌍', 'Earth', 2], ['👩‍🚀', 'astronaut', 3], ['🛰️', 'satellite', 4], ['🔭', 'telescope', 4],
        ['🌠', 'shooting star', 4], ['🔋', 'battery', 4], ['☄️', 'comet', 5], ['🌌', 'galaxy', 6], ['📡', 'antenna', 6]
    ]),
    theme('nature', 'Weather & Nature', '⛅', [
        ['☁️', 'cloud', 0], ['🌸', 'flower', 0], ['🌳', 'tree', 0], ['☀️', 'sun', 0], ['🌧️', 'rain', 0], ['⛄', 'snowman', 0],
        ['🌈', 'rainbow', 0], ['🐌', 'snail', 0], ['🦋', 'butterfly', 0], ['❄️', 'snowflake', 2], ['🌬️', 'wind', 2], ['🍂', 'leaves', 2],
        ['🌻', 'sunflower', 2], ['🏔️', 'mountain', 2], ['🌹', 'rose', 2], ['🪨', 'rock', 2], ['🐞', 'ladybird', 2], ['⚡', 'lightning', 3],
        ['🌵', 'cactus', 3], ['🌋', 'volcano', 3], ['🐛', 'caterpillar', 3], ['🌫️', 'fog', 4], ['🌪️', 'tornado', 5], ['🌡️', 'thermometer', 5],
        ['🌰', 'chestnut', 5]
    ]),
    theme('sports', 'Sports Shed', '🏅', [
        ['⚽', 'football', 1], ['🚲', 'bike', 1], ['🏀', 'basketball', 2], ['🎾', 'tennis ball', 2], ['🛼', 'roller skates', 3],
        ['🏐', 'volleyball', 3], ['🎿', 'skis', 3], ['🛹', 'skateboard', 3], ['🥇', 'gold medal', 3], ['🥅', 'goal', 3], ['⚾', 'baseball', 3],
        ['🏓', 'table tennis', 4], ['🏒', 'hockey stick', 4], ['⛸️', 'ice skate', 4], ['🥊', 'boxing glove', 4], ['🏆', 'trophy', 4],
        ['🏹', 'bow and arrow', 4], ['⛳', 'golf flag', 4], ['🎳', 'bowling', 4], ['🏸', 'badminton', 5], ['🛶', 'canoe', 5],
        ['🏉', 'rugby ball', 5], ['🤿', 'snorkel', 5], ['🎽', 'running vest', 6]
    ]),
    theme('music', 'Music Room', '🎵', [
        ['🥁', 'drum', 0], ['🎸', 'guitar', 0], ['🎹', 'piano', 0], ['🔔', 'bell', 0], ['🎺', 'trumpet', 2], ['🎻', 'violin', 2],
        ['📻', 'radio', 2], ['🎤', 'microphone', 3], ['🎧', 'headphones', 3], ['🎷', 'saxophone', 4], ['🎶', 'music notes', 4],
        ['🪕', 'banjo', 5], ['📯', 'horn', 5], ['🪗', 'accordion', 6], ['🎼', 'sheet music', 6]
    ]),
    theme('town', 'Town & Jobs', '🏙️', [
        ['🚌', 'bus', 0], ['🚓', 'police car', 0], ['🚕', 'taxi', 0], ['🏫', 'school', 0], ['🏰', 'castle', 0], ['🏪', 'shop', 0],
        ['🧑‍🏫', 'teacher', 0], ['🚒', 'fire engine', 2], ['🚑', 'ambulance', 2], ['🚁', 'helicopter', 2], ['🧑‍⚕️', 'doctor', 2],
        ['🧑‍🍳', 'cook', 2], ['🧑‍🌾', 'farmer', 2], ['🏥', 'hospital', 3], ['⛪', 'church', 3], ['🎡', 'big wheel', 3],
        ['🚦', 'traffic lights', 3], ['🧑‍🚒', 'firefighter', 3], ['👮', 'police officer', 3], ['🏦', 'bank', 4], ['🏟️', 'stadium', 4],
        ['🎢', 'rollercoaster', 4], ['🏭', 'factory', 4], ['⛲', 'fountain', 4], ['🏗️', 'crane', 5], ['🚧', 'roadworks', 6]
    ]),
    theme('wizard', 'Wizard’s Workshop', '🧙', [
        ['🐸', 'frog', 0], ['⭐', 'star', 0], ['🌙', 'moon', 0], ['🎩', 'hat', 0], ['🦉', 'owl', 0], ['🦇', 'bat', 0],
        ['🕷️', 'spider', 0], ['🐉', 'dragon', 0], ['🔥', 'fire', 1], ['🕯️', 'candle', 2], ['🐈‍⬛', 'black cat', 2], ['🪄', 'wand', 3],
        ['🧹', 'broomstick', 3], ['🗝️', 'old key', 3], ['🕸️', 'spider web', 3], ['🔮', 'crystal ball', 4], ['🧪', 'potion', 4],
        ['📜', 'scroll', 4], ['📖', 'spell book', 4], ['⌛', 'hourglass', 5], ['🍄', 'toadstool', 5], ['⚗️', 'flask', 6],
        ['🪶', 'quill', 6], ['🧿', 'charm', 6]
    ]),
    theme('pirate', 'Pirate Ship', '🏴‍☠️', [
        ['🍌', 'banana', 0], ['🐟', 'fish', 0], ['🦜', 'parrot', 0], ['🗺️', 'map', 0], ['⛵', 'ship', 0], ['🦀', 'crab', 0],
        ['🐚', 'shell', 0], ['🏝️', 'island', 2], ['🗡️', 'sword', 2], ['🦴', 'bone', 2], ['🐙', 'octopus', 2], ['⚓', 'anchor', 3],
        ['💰', 'bag of gold', 3], ['💎', 'jewel', 3], ['🪙', 'coin', 3], ['🏴‍☠️', 'pirate flag', 3], ['🪢', 'rope', 3], ['🥥', 'coconut', 3],
        ['🍾', 'bottle', 3], ['🔭', 'telescope', 4], ['🪝', 'hook', 4], ['🛶', 'rowing boat', 4], ['🧭', 'compass', 5], ['🛢️', 'barrel', 5]
    ]),
    theme('museum', 'Museum of Wonders', '🏛️', [
        ['🦖', 'dinosaur', 1], ['👑', 'crown', 0], ['🦴', 'bone', 2], ['🛡️', 'shield', 2], ['🖼️', 'painting', 3], ['🌍', 'globe', 3],
        ['🗝️', 'old key', 3], ['🪙', 'coin', 3], ['🗿', 'statue', 4], ['🚂', 'steam train', 4], ['📜', 'scroll', 4], ['🏛️', 'temple', 5],
        ['🗡️', 'dagger', 5], ['🔬', 'microscope', 5], ['🪃', 'boomerang', 5], ['⏳', 'hourglass', 5], ['🏺', 'amphora', 6],
        ['⚱️', 'urn', 6], ['🎭', 'theatre masks', 6], ['🪔', 'oil lamp', 6], ['⚙️', 'gear', 6], ['🧭', 'compass', 5]
    ]),
    theme('explorer', 'Explorer’s Pack', '🧭', [
        ['💧', 'water', 0], ['🍎', 'apple', 0], ['🗺️', 'map', 0], ['🥾', 'boots', 0], ['🍫', 'chocolate', 0], ['🧢', 'cap', 0],
        ['⛺', 'tent', 2], ['📷', 'camera', 2], ['🕶️', 'sunglasses', 2], ['🔦', 'torch', 3], ['🪢', 'rope', 3], ['🎒', 'rucksack', 4],
        ['🪓', 'axe', 4], ['🔋', 'battery', 4], ['🧭', 'compass', 5], ['🩹', 'plaster', 5], ['🧴', 'sun cream', 5], ['🌡️', 'thermometer', 5],
        ['🥫', 'tin of beans', 6], ['📒', 'logbook', 6]
    ])
]);

/** Hoard size and speed per league; level 0-9 grows with lit runes and finished vaults. */
export const HOARD_RULES = Object.freeze({
    prejunior: { base: 4, max: 6, growEvery: 3, vanish: [1, 1, 1, 1, 1, 1, 1, 2, 2, 2], watch: 12, shuffleFrom: 99 },
    juniorA: { base: 5, max: 7, growEvery: 3, vanish: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2], watch: 11, shuffleFrom: 99 },
    juniorB: { base: 5, max: 8, growEvery: 2, vanish: [1, 1, 2, 2, 2, 2, 2, 2, 3, 3], watch: 10, shuffleFrom: 99 },
    a: { base: 6, max: 9, growEvery: 2, vanish: [1, 2, 2, 2, 2, 2, 3, 3, 3, 3], watch: 10, shuffleFrom: 6 },
    b: { base: 6, max: 10, growEvery: 2, vanish: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3], watch: 9, shuffleFrom: 4 },
    c: { base: 7, max: 11, growEvery: 2, vanish: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4], watch: 8, shuffleFrom: 3 },
    d: { base: 8, max: 12, growEvery: 2, vanish: [2, 2, 3, 3, 3, 3, 4, 4, 4, 4], watch: 8, shuffleFrom: 2 }
});

/**
 * Round types. vanish: the dragon steals some treasure. intruder: a new treasure sneaks in.
 * moved: two treasures swap places. `from` is the first league index that plays it.
 */
export const HOARD_MODES = Object.freeze({
    vanish: Object.freeze({ id: 'vanish', label: 'What vanished?', icon: 'fa-dragon', from: 0 }),
    intruder: Object.freeze({ id: 'intruder', label: 'Who sneaked in?', icon: 'fa-user-ninja', from: 0 }),
    moved: Object.freeze({ id: 'moved', label: 'What moved?', icon: 'fa-right-left', from: 2 })
});

/** Sentence frames per league and round type, built on that league's grammar. */
export const HOARD_FRAMES = Object.freeze({
    prejunior: {
        vanish: ['The … ! The … is not here!', 'Where is the …?'],
        intruder: ['Look! A …!', 'A new …!'],
        moved: ['The … moved!', 'Look at the …!']
    },
    juniorA: {
        vanish: ['Where is the …? It isn’t here!', 'The dragon has got the …!'],
        intruder: ['There is a new … in the hoard!', 'Look! It’s a …!'],
        moved: ['The … and the … are in a new place.', 'The … is next to the … now.']
    },
    juniorB: {
        vanish: ['There was a … but now there isn’t.', 'The … was here. Now it’s gone!'],
        intruder: ['There wasn’t a … before!', 'The … wasn’t in the hoard.'],
        moved: ['The … was next to the …', 'The … and the … swapped places.']
    },
    a: {
        vanish: ['The dragon took the …', 'I remember the … It isn’t there now.'],
        intruder: ['The … wasn’t there before. It sneaked in!', 'The dragon brought a …'],
        moved: ['The … moved. It was on the left / right.', 'The dragon swapped the … and the …']
    },
    b: {
        vanish: ['While we were watching, the dragon took the …', 'I think the … is missing because…'],
        intruder: ['While we were blinking, a … sneaked in.', 'I’m sure there wasn’t a … before.'],
        moved: ['The … was next to the … when we looked.', 'The … used to be in the top / bottom row.']
    },
    c: {
        vanish: ['The dragon has taken the …', 'I’ve looked twice: the … has vanished.'],
        intruder: ['Someone has added a …', 'The … has appeared out of nowhere.'],
        moved: ['The … and the … have swapped places.', 'The … has moved from … to …']
    },
    d: {
        vanish: ['The … has been stolen.', 'The dragon must have taken the …'],
        intruder: ['A … has been slipped into the hoard.', 'The … can’t have been there before.'],
        moved: ['The … had been next to the … before the dragon came.', 'The … and the … must have been swapped.']
    }
});
