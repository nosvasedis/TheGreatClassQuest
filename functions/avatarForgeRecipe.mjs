// functions/avatarForgeRecipe.mjs
// The Avatar Forge catalogue and prompt builder. Shared by the forgeStudentAvatar
// callable (dynamic import) and the browser fallback in features/avatar.js, so the
// option lists the teacher sees are exactly the ones the server accepts.

// Each option carries the words the image model sees (`look`) next to what the
// modal shows (`label`, `icon`). Values are the stable ids sent over the wire; the
// first 17 creatures, 12 colours and 9 accessories are the original forge list.

export const FORGE_CREATURES = [
    { value: 'Fairy', icon: '🧚', look: 'tiny fairy with shimmering butterfly wings' },
    { value: 'Wizard', icon: '🧙', look: 'young wizard with a starry robe and a long pointed hat' },
    { value: 'Witch', icon: '🧙‍♀️', look: 'friendly young witch with a wide-brimmed hat' },
    { value: 'Elf', icon: '🧝', look: 'nimble elf with pointed ears and a leafy tunic' },
    { value: 'Dwarf', icon: '⛏️', look: 'stout cheerful dwarf with a braided beard' },
    { value: 'Goblin', icon: '👺', look: 'mischievous little goblin with big ears and a cheeky grin' },
    { value: 'Knight', icon: '🗡️', look: 'brave little knight in shiny armour' },
    { value: 'Dragon', icon: '🐉', look: 'baby dragon with small wings and round belly' },
    { value: 'Unicorn', icon: '🦄', look: 'magical unicorn with a spiral horn and flowing mane' },
    { value: 'Robot', icon: '🤖', look: 'round friendly robot with glowing eyes and antenna' },
    { value: 'Alien', icon: '👽', look: 'friendly alien with big curious eyes and little antennae' },
    { value: 'Mermaid', icon: '🧜', look: 'mermaid with a sparkling fish tail and seashell details' },
    { value: 'Gnome', icon: '🍄', look: 'garden gnome with a tall floppy hat and rosy cheeks' },
    { value: 'Prince', icon: '🤴', look: 'young prince with a small crown and royal cape' },
    { value: 'Princess', icon: '👸', look: 'young princess with a small tiara and royal gown' },
    { value: 'Pirate', icon: '🏴‍☠️', look: 'young pirate with a tricorn hat and striped shirt' },
    { value: 'Superhero', icon: '🦸', look: 'young superhero with a flowing cape and emblem on the chest' },
    { value: 'Ninja', icon: '🥷', look: 'young ninja in a wrapped hood and sash' },
    { value: 'Astronaut', icon: '🧑‍🚀', look: 'young astronaut in a rounded space suit with helmet visor up' },
    { value: 'Viking', icon: '🛡️', look: 'young viking with a horned helmet and fur-trimmed cloak' },
    { value: 'Explorer', icon: '🧭', look: 'young jungle explorer with a safari hat and satchel' },
    { value: 'Scientist', icon: '🧪', look: 'young scientist in a lab coat and goggles on the forehead' },
    { value: 'Phoenix', icon: '🔥', look: 'baby phoenix bird with flame-tipped feathers' },
    { value: 'Griffin', icon: '🦅', look: 'baby griffin, half eagle half lion, with fluffy wings' },
    { value: 'Fox', icon: '🦊', look: 'clever little fox with a big fluffy tail' },
    { value: 'Cat', icon: '🐱', look: 'playful kitten with big eyes and a curly tail' },
    { value: 'Owl', icon: '🦉', look: 'wise little owl with round spectacle eyes' },
    { value: 'Panda', icon: '🐼', look: 'chubby panda cub with round black eye patches' },
    { value: 'Lion', icon: '🦁', look: 'lion cub with a fluffy little mane' },
    { value: 'Bunny', icon: '🐰', look: 'bunny with long floppy ears and a cotton tail' },
    { value: 'Yeti', icon: '❄️', look: 'fluffy friendly baby yeti with snowy fur' },
    { value: 'Ghost', icon: '👻', look: 'cute friendly little ghost with a happy face, not scary' },
    { value: 'Ballerina', icon: '🩰', look: 'graceful young ballerina in a tutu and satin ballet slippers, on tiptoe' },
    { value: 'Footballer', icon: '⚽', look: 'young soccer player in a team kit and shin pads, with a round black-and-white soccer ball' },
    { value: 'Rock Star', icon: '🎤', look: 'young rock star with spiky hair, a star-shaped badge and a microphone' },
    { value: 'Detective', icon: '🔍', look: 'young detective with a checked deerstalker cap and a magnifying glass' },
    { value: 'Chef', icon: '🧑‍🍳', look: 'young chef with a puffy white chef hat and an apron' },
    { value: 'Penguin', icon: '🐧', look: 'chubby little penguin chick with fluffy feathers' },
    { value: 'Dog', icon: '🐶', look: 'happy puppy with floppy ears, a wet nose and a wagging tail' },
    { value: 'Horse', icon: '🐴', look: 'friendly pony with a flowing mane and a glossy coat' },
    { value: 'Dolphin', icon: '🐬', look: 'cheerful dolphin with a smooth body and a happy smile' },
    { value: 'Butterfly', icon: '🦋', look: 'colourful butterfly with big patterned wings' },
    { value: 'Dinosaur', icon: '🦖', look: 'friendly little T-rex dinosaur with tiny arms and big feet' },
    { value: 'Hedgehog', icon: '🦔', look: 'small round hedgehog with soft spines and a snuffly nose' },
    { value: 'Otter', icon: '🦦', look: 'playful otter with smooth fur and a long tail' },
    { value: 'Squirrel', icon: '🐿️', look: 'bushy-tailed squirrel with tufty ears and a nut in its paws' }
];

export const FORGE_COLORS = [
    { value: 'Red', hex: '#ef4444', look: 'ruby red' },
    { value: 'Blue', hex: '#3b82f6', look: 'bright sapphire blue' },
    { value: 'Green', hex: '#22c55e', look: 'emerald green' },
    { value: 'Yellow', hex: '#eab308', look: 'sunny yellow' },
    { value: 'Purple', hex: '#a855f7', look: 'royal purple' },
    { value: 'Orange', hex: '#f97316', look: 'tangerine orange' },
    { value: 'Pink', hex: '#ec4899', look: 'bubblegum pink' },
    { value: 'Turquoise', hex: '#14b8a6', look: 'turquoise' },
    { value: 'Black', hex: '#374151', look: 'charcoal black with silver accents' },
    { value: 'White', hex: '#e5e7eb', look: 'snowy white with pale blue accents' },
    { value: 'Grey', hex: '#9ca3af', look: 'soft stone grey' },
    { value: 'Rainbow', hex: null, look: 'rainbow' },
    { value: 'Gold', hex: '#d4a017', look: 'shining gold' },
    { value: 'Silver', hex: '#c0c7d1', look: 'gleaming silver' },
    { value: 'Navy', hex: '#1e3a8a', look: 'deep navy blue' },
    { value: 'Mint', hex: '#6ee7b7', look: 'fresh mint green' },
    { value: 'Lavender', hex: '#c4b5fd', look: 'soft lavender' },
    { value: 'Coral', hex: '#fb7185', look: 'warm coral' },
    { value: 'Brown', hex: '#92400e', look: 'warm chestnut brown' },
    { value: 'Teal', hex: '#0d9488', look: 'deep teal' },
    { value: 'Lime', hex: '#a3e635', look: 'zesty lime green' },
    { value: 'Sky', hex: '#38bdf8', look: 'light sky blue' },
    { value: 'Peach', hex: '#ffb07c', look: 'soft peach' },
    { value: 'Rose', hex: '#f43f5e', look: 'deep rose pink' },
    { value: 'Indigo', hex: '#6366f1', look: 'deep indigo' },
    { value: 'Bronze', hex: '#a16207', look: 'antique bronze' },
    { value: 'Copper', hex: '#b45309', look: 'shiny copper' },
    { value: 'Crimson', hex: '#dc2626', look: 'rich crimson' }
];

export const FORGE_ACCESSORIES = [
    { value: 'None', icon: '✨', look: '' },
    { value: 'Magic Wand', icon: '🪄', look: 'holding a sparkling magic wand' },
    { value: 'Big Glasses', icon: '👓', look: 'wearing big round glasses' },
    { value: 'Flower Crown', icon: '🌸', look: 'wearing a flower crown' },
    { value: 'Pointy Hat', icon: '🎩', look: 'wearing a tall pointy hat' },
    { value: 'Shiny Sword', icon: '⚔️', look: 'holding a shiny toy sword raised proudly' },
    { value: 'Glowing Book', icon: '📚', look: 'holding a glowing open spellbook' },
    { value: 'Headphones', icon: '🎧', look: 'wearing big cosy headphones' },
    { value: 'Small Backpack', icon: '🎒', look: 'wearing a small adventure backpack' },
    { value: 'Crown', icon: '👑', look: 'wearing a small golden crown' },
    { value: 'Hero Cape', icon: '🦸', look: 'wearing a flowing hero cape' },
    { value: 'Shield', icon: '🛡️', look: 'holding a round shield with a star emblem' },
    { value: 'Telescope', icon: '🔭', look: 'holding a brass telescope' },
    { value: 'Paintbrush', icon: '🖌️', look: 'holding a big paintbrush with a drop of paint' },
    { value: 'Guitar', icon: '🎸', look: 'holding a little guitar' },
    // 'Football' means the round one: the image models paint an American football otherwise.
    { value: 'Football', icon: '⚽', look: 'holding a round black-and-white soccer ball under one arm' },
    { value: 'Lantern', icon: '🏮', look: 'holding a warm glowing lantern' },
    { value: 'Potion', icon: '🧪', look: 'holding a bubbling potion bottle' },
    { value: 'Crystal Ball', icon: '🔮', look: 'holding a glowing crystal ball' },
    { value: 'Cosy Scarf', icon: '🧣', look: 'wearing a long cosy striped scarf' },
    { value: 'Pet Companion', icon: '🐾', look: 'with a tiny pet companion on the shoulder' },
    { value: 'Microphone', icon: '🎤', look: 'holding a shiny microphone' },
    { value: 'Skateboard', icon: '🛹', look: 'holding a colourful skateboard' },
    { value: 'Ballet Slippers', icon: '🩰', look: 'wearing pink satin ballet slippers with ribbons' },
    { value: 'Fairy Wings', icon: '🦋', look: 'with delicate sparkly fairy wings on their back' },
    { value: 'Basketball', icon: '🏀', look: 'holding a round orange basketball' },
    { value: 'Tennis Racket', icon: '🎾', look: 'holding a tennis racket with a tennis ball' },
    { value: 'Balloon', icon: '🎈', look: 'holding a bright balloon on a string' },
    { value: 'Treasure Map', icon: '🗺️', look: 'holding an unfolded treasure map' },
    { value: 'Ice Cream', icon: '🍦', look: 'holding a dripping ice cream cone' },
    { value: 'Kite', icon: '🪁', look: 'holding a colourful kite on a string' },
    { value: 'Compass', icon: '🧭', look: 'holding a small brass compass' }
];

export const FORGE_MOODS = [
    { value: 'Happy', icon: '😊', look: 'big friendly smile' },
    { value: 'Brave', icon: '💪', look: 'brave confident smile, heroic pose' },
    { value: 'Curious', icon: '🤔', look: 'curious wide eyes, head slightly tilted' },
    { value: 'Silly', icon: '😜', look: 'playful silly grin with tongue out' },
    { value: 'Calm', icon: '😌', look: 'calm gentle smile' },
    { value: 'Proud', icon: '😎', look: 'proud cheerful grin, chin up' },
    { value: 'Excited', icon: '🤩', look: 'excited sparkling eyes, open joyful smile' },
    { value: 'Sleepy', icon: '😴', look: 'sleepy half-closed eyes and a gentle smile' },
    { value: 'Surprised', icon: '😲', look: 'surprised wide eyes and a small open mouth' },
    { value: 'Thoughtful', icon: '💭', look: 'thoughtful gentle expression, eyes gazing upward' }
];

// `lead` opens the prompt (the image model weighs the first words most) and
// `tail` closes it; keep both short so SDXL's 77-token window holds the subject.
export const FORGE_STYLES = [
    { value: 'Sticker', icon: '🏷️', label: 'Chibi Sticker', lead: 'cute chibi character sticker, flat 2D vector illustration', tail: 'bold clean outlines, bright solid colours, soft cel shading' },
    { value: 'Storybook', icon: '📖', label: 'Storybook', lead: 'charming storybook watercolour illustration of a chibi character', tail: 'soft painterly textures, gentle warm lighting, hand-painted' },
    { value: 'Toy', icon: '🧸', label: '3D Toy', lead: 'adorable 3D vinyl toy figure of a chibi character', tail: 'smooth glossy materials, soft studio lighting, octane render' },
    { value: 'Pixel', icon: '👾', label: 'Pixel Art', lead: 'cute 16-bit pixel art character portrait', tail: 'crisp pixels, limited vibrant palette, retro video game style' },
    { value: 'Anime', icon: '🌸', label: 'Anime', lead: 'kawaii anime chibi illustration', tail: 'clean line art, cel shading, big sparkling eyes' },
    { value: 'Comic', icon: '💥', label: 'Comic Book', lead: 'bold comic book cartoon character', tail: 'thick ink lines, halftone shading, punchy vibrant colours' },
    { value: 'Clay', icon: '🏺', label: 'Clay', lead: 'handmade claymation chibi character', tail: 'soft clay texture, visible fingerprints, warm studio light' },
    { value: 'Crayon', icon: '🖍️', label: 'Crayon Drawing', lead: 'cheerful child crayon drawing of a chibi character', tail: 'waxy crayon strokes, visible paper texture, bright colours' }
];

export const FORGE_BACKDROPS = [
    { value: 'Glow', icon: '🌟', label: 'Soft Glow', look: 'soft glowing gradient background' },
    { value: 'Plain', icon: '⬜', label: 'Plain White', look: 'plain white background' },
    { value: 'Sparkles', icon: '✨', label: 'Sparkles', look: 'magic sparkles background' },
    { value: 'Forest', icon: '🌲', label: 'Enchanted Forest', look: 'enchanted forest background' },
    { value: 'Night', icon: '🌙', label: 'Starry Night', look: 'starry night sky background' },
    { value: 'Castle', icon: '🏰', label: 'Castle', look: 'fairytale castle background' },
    { value: 'Ocean', icon: '🌊', label: 'Ocean', look: 'sunny ocean background' },
    { value: 'Space', icon: '🪐', label: 'Outer Space', look: 'outer space background with planets' },
    { value: 'Beach', icon: '🏖️', label: 'Beach', look: 'sunny beach background' },
    { value: 'Snow', icon: '❄️', label: 'Snowy Day', look: 'snowy winter background' },
    { value: 'Rainbow', icon: '🌈', label: 'Rainbow Sky', look: 'rainbow sky background' }
];

export const FORGE_FRAMINGS = [
    { value: 'Portrait', icon: '🖼️', label: 'Portrait', look: 'head and shoulders portrait, facing viewer' },
    { value: 'Full', icon: '🧍', label: 'Full Hero', look: 'full body, centred, whole character visible' },
    { value: 'Action', icon: '🏃', label: 'Action Pose', look: 'dynamic action pose, full body, mid-motion' }
];

export const FORGE_SPECIAL_MAX = 60;

export const FORGE_DEFAULTS = Object.freeze({
    mood: 'Happy',
    style: 'Sticker',
    backdrop: 'Glow',
    framing: 'Portrait',
    special: ''
});

const LEGACY_CREATURES = new Set(FORGE_CREATURES.slice(0, 17).map((o) => o.value));
const LEGACY_COLORS = new Set(FORGE_COLORS.slice(0, 12).map((o) => o.value));
const LEGACY_ACCESSORIES = new Set(FORGE_ACCESSORIES.slice(0, 9).map((o) => o.value));

export const FORGE_NEGATIVE_PROMPT = [
    'text', 'letters', 'words', 'watermark', 'signature', 'logo', 'frame', 'border',
    'blurry', 'lowres', 'jpeg artifacts', 'noisy', 'deformed', 'disfigured', 'bad anatomy',
    'extra limbs', 'extra fingers', 'missing eyes', 'cross-eyed', 'cropped head',
    'multiple characters', 'duplicate', 'scary', 'creepy', 'horror', 'angry', 'blood', 'gore',
    'realistic photo', 'photorealistic', 'nsfw', 'american football', 'rugby ball'
].join(', ');

export class ForgeRecipeError extends Error {}

function findOption(list, value) {
    const text = String(value ?? '').trim();
    return list.find((option) => option.value === text) || null;
}

function pickRequired(list, value, label) {
    const option = findOption(list, value);
    if (!option) throw new ForgeRecipeError(`Choose a ${label} from the Avatar Forge list.`);
    return option.value;
}

function pickOptional(list, value, fallback, label) {
    if (value === undefined || value === null || value === '') return fallback;
    return pickRequired(list, value, label);
}

/** Keeps the teacher's extra detail to a short, plain phrase. */
export function cleanSpecialTouch(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N} ,.'\-!]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, FORGE_SPECIAL_MAX)
        .trim();
}

/**
 * Validates a recipe from the modal (or an older client that only sends the first
 * three choices) and fills the optional choices with their defaults.
 */
export function normalizeForgeRecipe(input = {}) {
    return {
        creature: pickRequired(FORGE_CREATURES, input.creature, 'creature'),
        color: pickRequired(FORGE_COLORS, input.color, 'colour'),
        accessory: pickRequired(FORGE_ACCESSORIES, input.accessory, 'accessory'),
        mood: pickOptional(FORGE_MOODS, input.mood, FORGE_DEFAULTS.mood, 'mood'),
        style: pickOptional(FORGE_STYLES, input.style, FORGE_DEFAULTS.style, 'art style'),
        backdrop: pickOptional(FORGE_BACKDROPS, input.backdrop, FORGE_DEFAULTS.backdrop, 'backdrop'),
        framing: pickOptional(FORGE_FRAMINGS, input.framing, FORGE_DEFAULTS.framing, 'framing'),
        special: cleanSpecialTouch(input.special)
    };
}

/** True when a forge from before the finishing touches would paint this recipe the same way. */
export function isLegacyForgeRecipe(recipe) {
    return LEGACY_CREATURES.has(recipe.creature)
        && LEGACY_COLORS.has(recipe.color)
        && LEGACY_ACCESSORIES.has(recipe.accessory)
        && recipe.mood === FORGE_DEFAULTS.mood
        && recipe.style === FORGE_DEFAULTS.style
        && recipe.backdrop === FORGE_DEFAULTS.backdrop
        && recipe.framing === FORGE_DEFAULTS.framing
        && !recipe.special;
}

function colourPhrase(recipe) {
    const color = findOption(FORGE_COLORS, recipe.color);
    return recipe.color === 'Rainbow'
        ? 'colourful rainbow outfit'
        : `${color.look} colour scheme`;
}

/** A complete, model-free description, used when the writer is unavailable. */
export function describeForgeSubject(recipe) {
    const creature = findOption(FORGE_CREATURES, recipe.creature);
    const accessory = findOption(FORGE_ACCESSORIES, recipe.accessory);
    const mood = findOption(FORGE_MOODS, recipe.mood);
    return [creature.look, colourPhrase(recipe), accessory.look, mood.look]
        .filter(Boolean)
        .join(', ');
}

/** System and user messages for the text model that writes the subject description. */
export function buildForgeWriterMessages(recipe) {
    const creature = findOption(FORGE_CREATURES, recipe.creature);
    const color = findOption(FORGE_COLORS, recipe.color);
    const accessory = findOption(FORGE_ACCESSORIES, recipe.accessory);
    const mood = findOption(FORGE_MOODS, recipe.mood);
    const style = findOption(FORGE_STYLES, recipe.style);

    const system = [
        'You write the subject line of a text-to-image prompt for a classroom avatar that children aged 7 to 13 will see.',
        'Reply with ONE line of 14 to 26 words: comma-separated visual phrases, most important first. No sentences, no quotes, no lists, no preamble.',
        'Start with the character. Then give 2 or 3 distinctive visual details (outfit, hair or fur, markings) in the main colour, then the item, then the facial expression.',
        'Only describe the character. Do not mention art style, lighting, background, camera, text, letters, logos, real people, brands or names.',
        'Keep it wholesome, friendly and age-appropriate. Weapons are toy-like and never threatening. If the extra detail is unsafe, off-topic or not visual, ignore it.'
    ].join(' ');

    const lines = [
        `Character: ${recipe.creature} (${creature.look})`,
        `Main colour: ${recipe.color === 'Rainbow' ? 'rainbow, many bright colours' : color.look}`,
        `Item: ${accessory.look || 'none, hands free'}`,
        `Expression: ${mood.look}`,
        `It will be drawn as: ${style.label}`
    ];
    if (recipe.special) lines.push(`Extra detail from the teacher: ${recipe.special}`);

    return { system, user: lines.join('\n') };
}

/** Tidies the writer's reply; returns '' when it is unusable. */
export function cleanWriterSubject(text) {
    const line = String(text ?? '')
        .replace(/```[a-z]*|```/gi, ' ')
        .split(/\r?\n/)
        .map((part) => part.trim())
        .find(Boolean) || '';
    const cleaned = line
        .replace(/^(prompt|subject|description)\s*:\s*/i, '')
        .replace(/["“”]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[.\s]+$/, '')
        .trim();
    const words = cleaned.split(' ').filter(Boolean);
    if (words.length < 4) return '';
    return words.slice(0, 32).join(' ');
}

/** The final image prompt: style lead, subject, framing, backdrop, style finish. */
export function composeForgeImagePrompt(recipe, subject) {
    const style = findOption(FORGE_STYLES, recipe.style);
    const backdrop = findOption(FORGE_BACKDROPS, recipe.backdrop);
    const framing = findOption(FORGE_FRAMINGS, recipe.framing);
    const body = cleanWriterSubject(subject) || describeForgeSubject(recipe);
    return [
        style.lead,
        body,
        framing.look,
        backdrop.look,
        style.tail,
        'high quality'
    ].join(', ');
}

/** Square output: SDXL is trained at 1024px and loses detail when asked for 512. */
export const FORGE_IMAGE_OPTIONS = Object.freeze({ width: 1024, height: 1024, num_steps: 20, guidance: 7 });
