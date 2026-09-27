// /features/familiars.js — Familiars (Pets) System
// Sprite sheets generated via Cloudflare AI, animated with CSS steps()

import { db, doc, getDoc, updateDoc, serverTimestamp } from '../firebase.js';
import * as state from '../state.js';
import { callCloudflareAiImageApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import { playSound } from '../audio.js';
import { showToast } from '../ui/effects.js';
import {
    FAMILIAR_LEVEL_THRESHOLDS,
    deriveLegacyStarsAtHatch,
    getEffectiveStarsAtHatch,
    getUnlockedFamiliarLevel,
    getFamiliarProgress,
    getFamiliarProgressPercent
} from './familiarProgression.mjs';
import { getFamiliarVariant, normalizeFamiliarName } from './familiarIdentity.mjs';

const publicDataPath = 'artifacts/great-class-quest/public/data';
const familiarOps = new Map();
const MAX_SPRITE_GENERATION_ATTEMPTS = 3;
const SPRITE_VALIDATION_SIZE = 128;
const FAMILIAR_ART_DIRECTIONS = {
    emberfang: {
        1: { subject: 'a baby fire dragon hatchling', body: 'round chibi body, stubby legs, tiny wings, short snout', palette: 'warm reds, ember orange, soft gold highlights', features: 'bright orange eyes, small horns, flame-tipped tail', pose: 'standing in a proud but cute three-quarter pose' },
        2: { subject: 'a young flame drake', body: 'sleek medium chibi drake body with broader chest and stronger wings', palette: 'deep red scales, orange membranes, amber glow accents', features: 'confident glowing eyes, sharper horns, brighter flame tail', pose: 'balanced action-ready stance with wings slightly open' },
        3: { subject: 'a mini inferno dragon', body: 'compact powerful dragon with large wings and regal posture', palette: 'dark crimson, molten orange, ember gold', features: 'intense glowing eyes, pronounced horns, flame patterns across the body', pose: 'heroic legendary stance, majestic and imposing but still cute' }
    },
    frostpaw: {
        1: { subject: 'a tiny arctic fox cub spirit', body: 'soft fluffy chibi fox body with oversized tail', palette: 'snow white, icy blue, pale silver', features: 'ice-blue eyes, frosted tail tip, soft ear fluff', pose: 'sitting calmly with head slightly tilted' },
        2: { subject: 'an elegant snow fox spirit', body: 'slender chibi fox with graceful legs and flowing tail', palette: 'white fur, glacier blue, cool teal accents', features: 'bright teal eyes, crystalline ear tips, frosted paws', pose: 'poised standing pose with gentle motion in the tail' },
        3: { subject: 'a majestic frost guardian fox', body: 'larger guardian fox silhouette with ornate tail and proud chest', palette: 'icy white, aurora blue, crystal cyan', features: 'large crystal-like wing forms, glowing markings, luminous eyes', pose: 'regal guardian stance, centered and noble' }
    },
    thornback: {
        1: { subject: 'a tiny mossy forest toad', body: 'round squat chibi toad body with short limbs', palette: 'leaf green, moss green, earthy brown', features: 'amber eyes, moss patches, small leaf crest', pose: 'grounded squat pose, sturdy and adorable' },
        2: { subject: 'a bark bear cub', body: 'chunky bear-like chibi body with thick arms and sturdy paws', palette: 'bark brown, moss green, muted amber', features: 'bark-textured fur, leaf tufts, root-like markings', pose: 'firm forward-facing stance with weight and stability' },
        3: { subject: 'an ancient treant familiar', body: 'compact treant guardian body with root legs and broad shoulders', palette: 'oak brown, forest green, glowing sap green', features: 'glowing green eyes, leafy crown, mushrooms and bark details', pose: 'towering centered stance, ancient and protective' }
    },
    veilshade: {
        1: { subject: 'a tiny shadow wisp creature', body: 'small ghost-cat silhouette with soft rounded form', palette: 'deep charcoal, violet glow, smoky gray', features: 'glowing purple eyes, wispy tail, soft spectral edges', pose: 'floating centered pose with a readable silhouette' },
        2: { subject: 'a phantom cat familiar', body: 'sleek feline chibi body with low stalking posture', palette: 'midnight black, violet, silver mist', features: 'glowing paw tips, luminous eyes, shadow tail', pose: 'quiet stalking pose with elegant tension' },
        3: { subject: 'a void stalker familiar', body: 'panther-like chibi shadow beast with broad shoulders and long tail', palette: 'black-violet shadow, glowing amethyst core, dusky silver', features: 'spectral claws, luminous eyes, mysterious inner glow', pose: 'legendary crouched hero pose, intense and centered' }
    },
    sparkling: {
        1: { subject: 'a tiny sun sprite creature', body: 'small round chibi body with tiny wings', palette: 'sun gold, honey yellow, peach light', features: 'bright cheerful eyes, glowing feather tufts, soft radiant tail', pose: 'light hovering pose, joyful and centered' },
        2: { subject: 'a dawn fairy familiar', body: 'slim fairy-like chibi body with elegant wings', palette: 'gold, peach, warm coral, sunrise cream', features: 'luminous wings, warm glow accents, graceful feather shapes', pose: 'gentle floating pose with confident warmth' },
        3: { subject: 'a solar phoenix familiar', body: 'small majestic phoenix with proud chest and wide wings', palette: 'brilliant gold, warm orange, rose sunrise tones', features: 'radiant eyes, flame-tipped feathers, glowing tail plumes', pose: 'heroic phoenix stance, uplifting and inspiring' }
    }
};

export { FAMILIAR_LEVEL_THRESHOLDS };

// ─── FAMILIAR TYPE DEFINITIONS ────────────────────────────────────────────────

export const FAMILIAR_TYPES = {
    emberfang: {
        id: 'emberfang',
        name: 'Emberfang',
        price: 40,
        eggIcon: '🥚',
        eggColor: '#ef4444',
        eggAccent: '#fca5a5',
        personality: 'Bold and fierce — a flame that never goes out.',
        animClass: 'fam-anim-fast-bounce',
        tapSound: null,
        desc: 'A fire-breathing dragon hatchling that grows into a mighty flame drake.',
        flavorHint: 'Daring • Fierce • Unstoppable',
        levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny cute fire dragon hatchling, red scaly body, big round glowing orange eyes, small stubby wings, flame tail tip, frame 1: idle standing, frame 2: leaning forward curious, frame 3: jumping up with excitement, frame 4: landing pose, consistent character across all frames, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, medium-sized flame drake, sleek red and orange scales, larger wings spread slightly, fire breath wisps, glowing amber eyes, frame 1: standing proud, frame 2: crouching forward, frame 3: leaping with wings open, frame 4: landing with fire puff, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, powerful mini inferno dragon, dark red scales with orange flame patterns, large wings, horns, intense glowing eyes, frame 1: majestic standing pose, frame 2: roaring forward, frame 3: flying leap with fire trail, frame 4: landing with shockwave, consistent character, no text, game asset'
        }
    },
    frostpaw: {
        id: 'frostpaw',
        name: 'Frostpaw',
        price: 35,
        eggIcon: '🥚',
        eggColor: '#3b82f6',
        eggAccent: '#bfdbfe',
        personality: 'Calm and wise — cool as the winter wind.',
        animClass: 'fam-anim-slow-float',
        tapSound: null,
        desc: 'An arctic fox spirit that grows into a mystical frost guardian.',
        flavorHint: 'Serene • Wise • Graceful',
        levelNames: ['Ice Cub', 'Snow Fox', 'Frost Guardian'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny adorable arctic fox cub, white fluffy fur, ice-blue eyes, small curled tail with frost tip, frame 1: sitting cutely, frame 2: tilting head curiously, frame 3: tiny hop, frame 4: soft landing with tail swish, consistent character across all frames, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, elegant snow fox, sleek white and ice-blue fur, crystalline snowflakes around paws, glowing teal eyes, flowing tail, frame 1: graceful standing, frame 2: stepping forward elegantly, frame 3: leaping with snowflake trail, frame 4: gentle landing, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, majestic frost guardian fox, large icy wings of crystal, aurora patterns on fur, powerful glowing runes, frame 1: regal standing with wings folded, frame 2: spreading wings forward, frame 3: soaring leap with ice trail, frame 4: ethereal landing with frost burst, consistent character, no text, game asset'
        }
    },
    thornback: {
        id: 'thornback',
        name: 'Thornback',
        price: 30,
        eggIcon: '🥚',
        eggColor: '#16a34a',
        eggAccent: '#86efac',
        personality: 'Sturdy and loyal — as solid as the ancient oaks.',
        animClass: 'fam-anim-stomp',
        tapSound: null,
        desc: 'A mossy forest toad that evolves into a legendary ancient treant.',
        flavorHint: 'Strong • Loyal • Grounded',
        levelNames: ['Moss Toad', 'Bark Bear', 'Ancient Treant'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny cute mossy forest toad, green warty skin with small moss patches, big round amber eyes, leaf on head, frame 1: squatting idle, frame 2: puffing cheeks, frame 3: jumping with legs spread wide, frame 4: landing with a thud, consistent character across all frames, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, sturdy bark bear cub, brown bark-textured fur, green moss accents, small green leaves growing from shoulders, strong stubby arms, frame 1: standing firm, frame 2: lumbering forward, frame 3: jumping with bark crack effect, frame 4: heavy landing shake, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, ancient treant creature, bark-covered body with thick roots as legs, glowing green eyes, mushrooms and flowers growing on shoulders, leafy crown, frame 1: towering idle pose, frame 2: stomping forward, frame 3: mighty leap with leaf storm, frame 4: earthquake landing, consistent character, no text, game asset'
        }
    },
    veilshade: {
        id: 'veilshade',
        name: 'Veilshade',
        price: 45,
        eggIcon: '🥚',
        eggColor: '#7c3aed',
        eggAccent: '#c4b5fd',
        personality: 'Mysterious and elusive — a whisper between worlds.',
        animClass: 'fam-anim-flicker',
        tapSound: null,
        desc: 'A shadow sprite that grows into the legendary Void Stalker.',
        flavorHint: 'Mysterious • Swift • Ethereal',
        levelNames: ['Shadow Wisp', 'Phantom Cat', 'Void Stalker'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny shadow wisp creature, dark smoky body with glowing purple eyes, wispy tail, semi-transparent ghost-like form, frame 1: floating idle with slight glow, frame 2: drifting forward, frame 3: phasing through a brief flash, frame 4: reappearing with smoke puff, consistent character across all frames, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, phantom cat, sleek dark shadow body, purple glowing eyes and paw tips, shadowy tail with glowing tip, half-visible ethereal form, frame 1: stalking pose, frame 2: creeping forward, frame 3: shadow pounce through a purple flash, frame 4: silent landing with smoke, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny void stalker, dark panther-like shadow beast with glowing violet core, long smoke tendrils, spectral claws, frame 1: crouched ready, frame 2: lunging forward, frame 3: teleport leap with void spark, frame 4: landing in a shadow ring, consistent character, no text, game asset'
        }
    },
    sparkling: {
        id: 'sparkling',
        name: 'Sparkling',
        price: 50,
        eggIcon: '🥚',
        eggColor: '#f59e0b',
        eggAccent: '#fde68a',
        personality: 'Bright and joyful — a burst of sunrise magic.',
        animClass: 'fam-anim-spin-sparkle',
        tapSound: null,
        desc: 'A radiant fairy-phoenix that blossoms into a legendary sun guardian.',
        flavorHint: 'Radiant • Joyful • Inspiring',
        levelNames: ['Sun Sprite', 'Dawn Fairy', 'Solar Phoenix'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny glowing sun sprite, golden round body, bright eyes, tiny light wings, sparkles around feet, frame 1: hovering idle, frame 2: bobbing happily, frame 3: upward hop with sparkles, frame 4: glowing landing, consistent character, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, elegant dawn fairy, warm gold and peach colors, luminous wings, flowing spark trail, gentle halo, frame 1: poised hover, frame 2: twirling forward, frame 3: airborne spin with sparkles, frame 4: soft landing with glow, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, radiant phoenix chick, brilliant golden feathers with flame tips, majestic small wings, blazing tail, brilliant halo, frame 1: standing in radiant glow, frame 2: strutting forward with fire step, frame 3: soaring leap in flames, frame 4: landing with phoenix burst, consistent character, no text, game asset'
        }
    }
};

// ─── SPRITE GENERATION ───────────────────────────────────────────────────────

export async function generateFamiliarSpriteSheet(typeId, level, variant = null, studentId = '') {
    if (!canUseFeature('eliteAI')) throw new Error('AI image generation requires Elite tier');

    const type = FAMILIAR_TYPES[typeId];
    if (!type) throw new Error(`Unknown familiar type: ${typeId}`);
    const artDirection = FAMILIAR_ART_DIRECTIONS[typeId]?.[level];
    if (!artDirection) throw new Error(`No art direction for ${typeId} level ${level}`);
    let lastError = null;

    for (let attempt = 0; attempt < MAX_SPRITE_GENERATION_ATTEMPTS; attempt += 1) {
        try {
            const prompt = _buildFamiliarPortraitPrompt(type, artDirection, level, variant, attempt);
            const negativePrompt = _buildFamiliarPortraitNegativePrompt(type, level, attempt);
            const base64 = await callCloudflareAiImageApi(prompt, negativePrompt, {
                width: 512,
                height: 512,
                num_steps: 20,
                guidance: 7.5
            });
            const normalized = await _normalizeAndValidateSingleSprite(base64);
            const { uploadImageToStorage } = await import('../utils.js');
            if (!studentId) throw new Error('Student is required for a stable Familiar asset path.');
            const url = await uploadImageToStorage(normalized, `familiars/${studentId}/level-${level}.webp`);
            return url;
        } catch (error) {
            lastError = error;
            console.warn(`Familiar sprite attempt ${attempt + 1} failed:`, error);
        }
    }

    throw new Error(lastError?.message || 'The generated Familiar art did not look like one clean sprite.');
}

function _buildFamiliarPortraitPrompt(type, artDirection, level, variant, attempt = 0) {
    const variantPrompt = variant?.promptFlavor
        ? `Variant identity details: ${variant.promptFlavor}. Keep these markings subtle but clearly visible on the same single creature.`
        : 'Variant identity details: use one consistent magical companion design.';
    const retryPrompt = attempt > 0
        ? 'Retry correction: the previous result looked like a collage, tiled sheet, multiple creatures, or included text. Produce one single centered familiar only, shown from one angle only.'
        : '';

    return [
        `Create one single illustrated familiar character portrait for a school rewards app.`,
        `Subject: ${artDirection.subject}.`,
        `Evolution stage: level ${level}, ${type.levelNames[level - 1] || 'evolved familiar'}.`,
        `Personality: ${type.personality}.`,
        `Species theme: ${type.desc}.`,
        `Body design: ${artDirection.body}.`,
        `Color palette: ${artDirection.palette}.`,
        `Key visible features: ${artDirection.features}.`,
        `Pose: ${artDirection.pose}.`,
        variantPrompt,
        `Style: clean 2D digital character illustration, chibi proportions, readable silhouette, polished game mascot design, not pixel art.`,
        `Composition: square image, single creature centered, full body visible, large subject filling about 70 to 80 percent of the frame, plain white background, no scenery, one pose only, one viewing angle only.`,
        `Rendering goals: crisp edges, clear anatomy, appealing expression, simple readable shape, high contrast from the white background.`,
        `Output rules: exactly one character, no frame sheet, no contact sheet, no repeated copies, no split panels, no turnaround sheet, no model sheet, no multiple angles, no text, no letters, no words, no captions, no logo, no UI elements.`,
        retryPrompt
    ].filter(Boolean).join(' ');
}

function _buildFamiliarPortraitNegativePrompt(type, level, attempt = 0) {
    const retryPenalty = attempt > 0 ? ', mosaic, tiled image, duplicate character, contact sheet, collage layout, text label, character turnaround' : '';
    return [
        'multiple characters',
        'two creatures',
        'crowd',
        'collage',
        'mosaic',
        'contact sheet',
        'sprite sheet',
        'animation sheet',
        'model sheet',
        'turnaround sheet',
        'character sheet',
        'multiple angles',
        'side view',
        'front view and side view',
        'panel layout',
        'grid',
        'comic page',
        'background scene',
        'landscape',
        'room interior',
        'props',
        'text',
        'letters',
        'words',
        'caption',
        'label',
        'title text',
        'watermark',
        'logo',
        'border',
        'cropped body',
        'cut off wings',
        'cut off tail',
        'extra limbs',
        'deformed anatomy',
        'photorealistic',
        '3d render',
        'blurry',
        'low detail'
    ].join(', ') + retryPenalty;
}

async function _normalizeAndValidateSingleSprite(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const validation = _validateSingleSpriteImage(img);
            if (!validation.ok) {
                reject(new Error(validation.reason));
                return;
            }

            const targetSize = SPRITE_VALIDATION_SIZE;
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not create sprite canvas.'));
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetSize, targetSize);
            ctx.imageSmoothingEnabled = false;
            const inset = Math.round(targetSize * 0.08);
            const drawArea = targetSize - (inset * 2);
            const scale = Math.min(drawArea / Math.max(1, img.width), drawArea / Math.max(1, img.height));
            const drawWidth = Math.max(1, Math.round(img.width * scale));
            const drawHeight = Math.max(1, Math.round(img.height * scale));
            const offsetX = Math.floor((targetSize - drawWidth) / 2);
            const offsetY = Math.floor((targetSize - drawHeight) / 2);
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            resolve(canvas.toDataURL('image/webp', 0.9));
        };
        img.onerror = reject;
    });
}

function _validateSingleSpriteImage(img) {
    const aspectRatio = img.width / Math.max(1, img.height);
    if (aspectRatio < 0.75 || aspectRatio > 1.33) {
        return { ok: false, reason: 'Generated image is not a square single-sprite image.' };
    }

    if (img.width < 48 || img.height < 48) {
        return { ok: false, reason: 'Generated sprite image is too small to use.' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        return { ok: false, reason: 'Could not inspect generated sprite image.' };
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sceneStats = _measureSingleSubjectLayout(data, width, height);
    if (sceneStats.componentCount >= 4 && sceneStats.largestComponentRatio < 0.58) {
        return { ok: false, reason: 'Generated image looks like a multi-view sheet instead of one familiar.' };
    }
    if (sceneStats.captionBandScore >= 3) {
        return { ok: false, reason: 'Generated image includes text or a caption-like label.' };
    }

    return { ok: true };
}

function _measureSingleSubjectLayout(data, width, height) {
    const gridW = 28;
    const gridH = 28;
    const cells = new Array(gridW * gridH).fill(false);

    for (let gy = 0; gy < gridH; gy += 1) {
        const yStart = Math.floor((gy / gridH) * height);
        const yEnd = Math.max(yStart + 1, Math.floor(((gy + 1) / gridH) * height));
        for (let gx = 0; gx < gridW; gx += 1) {
            const xStart = Math.floor((gx / gridW) * width);
            const xEnd = Math.max(xStart + 1, Math.floor(((gx + 1) / gridW) * width));
            let found = false;
            for (let y = yStart; y < yEnd && !found; y += 1) {
                for (let x = xStart; x < xEnd; x += 1) {
                    const idx = (y * width + x) * 4;
                    if (_isForegroundPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                        found = true;
                        break;
                    }
                }
            }
            if (found) cells[(gy * gridW) + gx] = true;
        }
    }

    const visited = new Array(cells.length).fill(false);
    let componentCount = 0;
    let occupied = 0;
    let largest = 0;

    for (let i = 0; i < cells.length; i += 1) {
        if (!cells[i]) continue;
        occupied += 1;
        if (visited[i]) continue;
        componentCount += 1;
        let size = 0;
        const stack = [i];
        visited[i] = true;

        while (stack.length) {
            const current = stack.pop();
            size += 1;
            const x = current % gridW;
            const y = Math.floor(current / gridW);
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            for (const [nx, ny] of neighbors) {
                if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
                const next = (ny * gridW) + nx;
                if (!cells[next] || visited[next]) continue;
                visited[next] = true;
                stack.push(next);
            }
        }

        if (size > largest) largest = size;
    }

    let captionBandScore = 0;
    const captionStartRow = Math.floor(height * 0.76);
    for (let y = captionStartRow; y < height; y += 2) {
        let transitions = 0;
        let occupiedPixels = 0;
        let prev = false;
        for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            const isForeground = _isForegroundPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
            if (isForeground) occupiedPixels += 1;
            if (x > 0 && isForeground !== prev) transitions += 1;
            prev = isForeground;
        }
        const occupancyRatio = occupiedPixels / Math.max(1, width);
        if (transitions >= 12 && occupancyRatio > 0.08 && occupancyRatio < 0.55) captionBandScore += 1;
    }

    return {
        componentCount,
        largestComponentRatio: largest / Math.max(1, occupied),
        captionBandScore
    };
}

function _isForegroundPixel(r, g, b, a) {
    if (a < 24) return false;
    return !(r > 245 && g > 245 && b > 245);
}

// ─── RECONCILIATION ──────────────────────────────────────────────────────────

export function buildFamiliarInitData(typeId, currentTotalStars, studentId = '') {
    const variant = getFamiliarVariant(typeId, studentId);
    return {
        typeId,
        state: 'egg',
        level: 0,
        starsWhenPurchased: currentTotalStars,
        starsWhenHatched: 0,
        starsAtHatch: null,
        name: '',
        variant,
        spriteSheets: { 1: null, 2: null, 3: null },
        generationStatus: 'idle',
        generationLevel: null,
        generationError: null,
        generationUpdatedAt: null,
        spriteFormat: 'single',
        schemaVersion: 2
    };
}

export function shouldPassivelyReconcileFamiliar(scoreData) {
    if (!scoreData?.familiar) return false;

    const familiar = scoreData.familiar;
    const totalStars = scoreData.totalStars || 0;
    const unlockedLevel = getUnlockedFamiliarLevel(familiar, totalStars);
    const currentLevel = familiar.state === 'egg' ? 0 : (familiar.level || 0);
    const currentSpriteLevel = unlockedLevel || currentLevel;
    const currentSprite = currentSpriteLevel > 0 ? familiar.spriteSheets?.[currentSpriteLevel] : null;
    const hasLegacyMetadata = familiar.schemaVersion !== 2 || (familiar.state !== 'egg' && typeof familiar.starsAtHatch !== 'number');
    const needsLevelSync = unlockedLevel > currentLevel;
    const needsSpriteGeneration = currentSpriteLevel > 0 && !currentSprite && familiar.generationStatus !== 'generating' && familiar.generationStatus !== 'failed';

    return hasLegacyMetadata || needsLevelSync || needsSpriteGeneration;
}

export function checkHatchOrLevelUp(studentId) {
    return reconcileFamiliarLifecycle(studentId, { announce: true, source: 'stars' });
}

export function reconcileFamiliarLifecycle(studentId, options = {}) {
    const existing = familiarOps.get(studentId);
    if (existing) return existing;

    const promise = _reconcileFamiliarLifecycle(studentId, options)
        .catch((error) => {
            console.warn('Familiar reconciliation failed:', error);
            return null;
        })
        .finally(() => {
            familiarOps.delete(studentId);
        });

    familiarOps.set(studentId, promise);
    return promise;
}

export function retryFamiliarSpriteGeneration(studentId) {
    return reconcileFamiliarLifecycle(studentId, { announce: false, source: 'retry', forceRetry: true });
}

export async function regenerateCurrentFamiliarSprite(studentId) {
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    const scoreSnap = await getDoc(scoreRef);
    if (!scoreSnap.exists()) throw new Error('Student score record not found.');

    const familiar = scoreSnap.data()?.familiar;
    if (!familiar || familiar.state !== 'alive' || !(familiar.level > 0)) {
        throw new Error('This student does not have a hatched Familiar to regenerate.');
    }

    await updateDoc(scoreRef, {
        [`familiar.spriteSheets.${familiar.level}`]: null,
        'familiar.generationStatus': 'idle',
        'familiar.generationLevel': null,
        'familiar.generationError': null,
        'familiar.generationUpdatedAt': serverTimestamp()
    });

    _patchLocalFamiliarState(studentId, (current) => ({
        ...current,
        spriteSheets: {
            ...(current.spriteSheets || {}),
            [current.level]: null
        },
        generationStatus: 'idle',
        generationLevel: null,
        generationError: null
    }));

    return reconcileFamiliarLifecycle(studentId, { announce: false, source: 'retry', forceRetry: true });
}

async function _reconcileFamiliarLifecycle(studentId, options = {}) {
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    const scoreSnap = await getDoc(scoreRef);
    if (!scoreSnap.exists()) return null;

    const scoreData = scoreSnap.data();
    if (!scoreData?.familiar) return null;

    let familiar = scoreData.familiar;
    const totalStars = scoreData.totalStars || 0;
    const migrationUpdates = _buildMigrationUpdates(familiar, studentId);
    if (Object.keys(migrationUpdates).length) {
        await updateDoc(scoreRef, migrationUpdates);
        familiar = _mergeFamiliar(familiar, migrationUpdates);
    }

    const currentLevel = familiar.state === 'alive' ? (familiar.level || 0) : 0;
    const unlockedLevel = getUnlockedFamiliarLevel(familiar, totalStars);
    const desiredLevel = Math.max(currentLevel, unlockedLevel);
    const desiredState = desiredLevel > 0 || familiar.state === 'alive' ? 'alive' : 'egg';
    const levelChanged = (familiar.level || 0) !== desiredLevel || familiar.state !== desiredState;
    const progressionUpdates = {};

    if (desiredState === 'alive') {
        const starsAtHatch = getEffectiveStarsAtHatch(familiar, totalStars);
        if (familiar.state !== 'alive') progressionUpdates['familiar.state'] = 'alive';
        if ((familiar.level || 0) !== desiredLevel) progressionUpdates['familiar.level'] = desiredLevel;
        if (familiar.starsWhenHatched !== starsAtHatch) progressionUpdates['familiar.starsWhenHatched'] = starsAtHatch;
        if (familiar.starsAtHatch !== starsAtHatch) progressionUpdates['familiar.starsAtHatch'] = starsAtHatch;
    } else {
        if (familiar.state !== 'egg') progressionUpdates['familiar.state'] = 'egg';
        if ((familiar.level || 0) !== 0) progressionUpdates['familiar.level'] = 0;
    }

    const spriteLevel = desiredLevel;
    const spriteUrl = spriteLevel > 0 ? familiar.spriteSheets?.[spriteLevel] : null;
    const currentStatus = familiar.generationStatus || 'idle';
    const currentGenerationLevel = familiar.generationLevel ?? null;

    if (spriteLevel > 0 && spriteUrl && (currentStatus !== 'idle' || currentGenerationLevel !== null || familiar.generationError)) {
        progressionUpdates['familiar.generationStatus'] = 'idle';
        progressionUpdates['familiar.generationLevel'] = null;
        progressionUpdates['familiar.generationError'] = null;
        progressionUpdates['familiar.generationUpdatedAt'] = serverTimestamp();
    }

    if (Object.keys(progressionUpdates).length) {
        await updateDoc(scoreRef, progressionUpdates);
        familiar = _mergeFamiliar(familiar, progressionUpdates);
    }

    if (spriteLevel <= 0) {
        return { level: desiredLevel, generated: false };
    }

    const autoGenerationBlocked = familiar.generationStatus === 'failed' && !options.forceRetry;
    const alreadyGeneratingThisLevel = familiar.generationStatus === 'generating' && familiar.generationLevel === spriteLevel && !options.forceRetry;
    const targetSpriteUrl = familiar.spriteSheets?.[spriteLevel] || null;

    if (!targetSpriteUrl && !autoGenerationBlocked && !alreadyGeneratingThisLevel) {
        await _generateCurrentStageSprite(scoreRef, studentId, familiar, spriteLevel, options);
    } else if (!targetSpriteUrl && options.source === 'retry') {
        await _markGenerationFailed(scoreRef, spriteLevel, new Error('Retry is unavailable until the previous attempt finishes.'));
    } else if (levelChanged && options.announce) {
        await _announceStageChange(studentId, familiar, desiredLevel);
    }

    return { level: desiredLevel, generated: !targetSpriteUrl };
}

async function _generateCurrentStageSprite(scoreRef, studentId, familiar, spriteLevel, options) {
    await updateDoc(scoreRef, {
        'familiar.generationStatus': 'generating',
        'familiar.generationLevel': spriteLevel,
        'familiar.generationError': null,
        'familiar.generationUpdatedAt': serverTimestamp()
    });

    try {
        const variant = familiar.variant || getFamiliarVariant(familiar.typeId, studentId);
        const url = await generateFamiliarSpriteSheet(familiar.typeId, spriteLevel, variant, studentId);
        await updateDoc(scoreRef, {
            [`familiar.spriteSheets.${spriteLevel}`]: url,
            'familiar.spriteFormat': 'single',
            'familiar.generationStatus': 'idle',
            'familiar.generationLevel': null,
            'familiar.generationError': null,
            'familiar.generationUpdatedAt': serverTimestamp()
        });

        if (options.announce) {
            await _announceStageChange(studentId, familiar, spriteLevel);
        }
    } catch (error) {
        console.error('Familiar sprite generation failed:', error);
        await _markGenerationFailed(scoreRef, spriteLevel, error);
    }
}

async function _markGenerationFailed(scoreRef, spriteLevel, error) {
    await updateDoc(scoreRef, {
        'familiar.generationStatus': 'failed',
        'familiar.generationLevel': spriteLevel,
        'familiar.generationError': _sanitizeGenerationError(error),
        'familiar.generationUpdatedAt': serverTimestamp()
    });
}

function _buildMigrationUpdates(familiar, studentId = '') {
    const updates = {};
    if (!familiar) return updates;

    if (familiar.schemaVersion !== 2) updates['familiar.schemaVersion'] = 2;
    if (!('generationStatus' in familiar)) updates['familiar.generationStatus'] = 'idle';
    if (!('generationLevel' in familiar)) updates['familiar.generationLevel'] = null;
    if (!('generationError' in familiar)) updates['familiar.generationError'] = null;
    if (!('generationUpdatedAt' in familiar)) updates['familiar.generationUpdatedAt'] = null;
    if (!('spriteFormat' in familiar)) updates['familiar.spriteFormat'] = 'sheet4';
    if (!familiar.spriteSheets) {
        updates['familiar.spriteSheets'] = { 1: null, 2: null, 3: null };
    }

    if (familiar.state !== 'egg') {
        const starsAtHatch = deriveLegacyStarsAtHatch(familiar);
        if (typeof starsAtHatch === 'number') {
            if (familiar.starsAtHatch !== starsAtHatch) updates['familiar.starsAtHatch'] = starsAtHatch;
            if (familiar.starsWhenHatched !== starsAtHatch) updates['familiar.starsWhenHatched'] = starsAtHatch;
        }
    }

    if (!('name' in familiar)) updates['familiar.name'] = '';
    if (!familiar.variant) updates['familiar.variant'] = getFamiliarVariant(familiar.typeId, studentId);

    return updates;
}

function _mergeFamiliar(familiar, updates) {
    const merged = typeof structuredClone === 'function'
        ? structuredClone(familiar)
        : JSON.parse(JSON.stringify(familiar));
    for (const [path, value] of Object.entries(updates)) {
        if (!path.startsWith('familiar.')) continue;
        const keys = path.split('.').slice(1);
        let cursor = merged;
        while (keys.length > 1) {
            const key = keys.shift();
            if (!(key in cursor) || typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
            cursor = cursor[key];
        }
        cursor[keys[0]] = value;
    }
    return merged;
}

async function _announceStageChange(studentId, familiar, newLevel) {
    const student = state.get('allStudents').find((s) => s.id === studentId);
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!student || !typeDef) return;
    const familiarLabel = getFamiliarDisplayName(familiar, typeDef);

    if (newLevel <= 1) {
        import('../ui/effects.js').then((m) => {
            m.showPraiseToast(`${student.name.split(' ')[0]}'s ${familiarLabel} has hatched! 🥚✨`, '🎉');
        });
        _playFamiliarSound('hatch');
        return;
    }

    import('../ui/effects.js').then((m) => {
        m.showPraiseToast(`${student.name.split(' ')[0]}'s ${familiarLabel} evolved to ${typeDef.levelNames[newLevel - 1]}! 🌟`, '⬆️');
    });
    _playFamiliarSound('levelup');
}

function _sanitizeGenerationError(error) {
    const message = String(error?.message || error || 'Unknown familiar generation error');
    return message.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function _playFamiliarSound(type) {
    try {
        playSound(type === 'hatch' ? 'familiar_hatch' : 'familiar_levelup');
    } catch (_) {}
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

export function renderFamiliarSprite(familiar, size = 'small', studentId = '') {
    if (!familiar) return '';
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return '';
    const displayName = getFamiliarDisplayName(familiar, typeDef);
    const subtitle = familiar.variant?.label ? `${displayName} • ${familiar.variant.label}` : displayName;
    const safeSubtitle = escapeHtml(subtitle);

    const sizeMap = { small: 40, medium: 64, large: 128 };
    const px = sizeMap[size] || 40;

    if (familiar.state === 'egg') {
        return _renderEgg(typeDef, px, studentId);
    }

    const spriteUrl = familiar.spriteSheets?.[familiar.level] || null;
    if (spriteUrl) {
        const spriteFormat = familiar.spriteFormat || 'sheet4';
        const spriteStyle = spriteFormat === 'single'
            ? `width:${px}px;height:${px}px;background-image:url('${spriteUrl}');background-size:100% 100%;background-position:center center;image-rendering:pixelated;`
            : `width:${px}px;height:${px}px;background-image:url('${spriteUrl}');background-size:400% 100%;background-position:0 0;animation:fam-sprite-walk 0.6s steps(4, end) infinite;image-rendering:pixelated;`;
        return `
            <div class="familiar-container ${typeDef.animClass} enlargeable-familiar"
                 data-student-id="${studentId}"
                 style="width:${px}px;height:${px}px;flex-shrink:0;"
                 title="${safeSubtitle} — ${escapeHtml(typeDef.levelNames[(familiar.level || 1) - 1])}">
                <div class="familiar-sprite"
                     style="${spriteStyle}">
                </div>
            </div>`;
    }

    const isFailed = familiar.generationStatus === 'failed' && familiar.generationLevel === familiar.level;
    const shellClass = isFailed ? 'familiar-status-shell familiar-status-failed' : 'familiar-status-shell familiar-status-generating';
    const icon = isFailed ? '!' : '...';
    const label = isFailed ? 'sprite failed' : 'generating sprite';

    return `
        <div class="familiar-container ${typeDef.animClass} enlargeable-familiar"
             data-student-id="${studentId}"
             style="width:${px}px;height:${px}px;"
             title="${safeSubtitle} — ${escapeHtml(label)}">
            <div class="${shellClass}" style="width:${px}px;height:${px}px;border-color:${typeDef.eggColor};">
                <div class="familiar-status-icon">${icon}</div>
            </div>
        </div>`;
}

function _renderEgg(typeDef, px, studentId) {
    return `
        <div class="familiar-container familiar-egg-wobble enlargeable-familiar"
             data-student-id="${studentId}"
             style="width:${px}px;height:${px}px;flex-shrink:0;"
             title="${typeDef.name} Egg — earn stars to hatch!">
            <div class="familiar-egg"
                 style="width:${px}px;height:${px}px;background:radial-gradient(circle at 35% 35%,${typeDef.eggAccent},${typeDef.eggColor});border-radius:50% 50% 48% 48% / 55% 55% 45% 45%;">
                <div style="font-size:${Math.round(px * 0.45)}px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🥚</div>
            </div>
        </div>`;
}

// ─── FAMILIAR STATS OVERLAY ──────────────────────────────────────────────────

// Element sigil per species; the matching habitat colours live in styles/familiar_modal.css.
const FAMILIAR_DEN_THEMES = {
    emberfang: { sigil: '🔥', element: 'Fire' },
    frostpaw: { sigil: '❄️', element: 'Frost' },
    thornback: { sigil: '🌿', element: 'Wildwood' },
    veilshade: { sigil: '🌙', element: 'Shadow' },
    sparkling: { sigil: '☀️', element: 'Sunlight' }
};

export function openFamiliarStatsOverlay(studentId) {
    const scoreData = state.get('allStudentScores').find((s) => s.id === studentId);
    const student = state.get('allStudents').find((s) => s.id === studentId);
    if (!scoreData?.familiar || !student) return;

    const familiar = scoreData.familiar;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return;

    const existingOverlay = document.querySelector('.familiar-stats-overlay');
    if (existingOverlay) {
        if (existingOverlay.dataset.studentId === studentId) {
            const existingTap = existingOverlay.querySelector('.fam-overlay-tap');
            if (existingTap) {
                existingTap.classList.remove('fam-tap-bump');
                void existingTap.offsetWidth;
                existingTap.classList.add('fam-tap-bump');
            }
            return;
        }
        existingOverlay.remove();
    }

    const level = familiar.level || 1;
    const starsTotal = scoreData.totalStars || 0;
    const starsTogether = Math.max(0, starsTotal - (familiar.starsWhenPurchased || 0));
    const progress = getFamiliarProgress(familiar, starsTotal);
    const progressPercent = getFamiliarProgressPercent(progress);
    const isMaxLevel = progress.phase === 'max';
    const levelName = familiar.state === 'egg' ? 'Egg' : (typeDef.levelNames[level - 1] || 'Unknown');
    const spriteHtml = renderFamiliarSprite(familiar, 'large', studentId);
    const displayName = getFamiliarDisplayName(familiar, typeDef);
    const speciesLabel = familiar.name ? typeDef.name : familiar.variant?.label ? `${typeDef.name} • ${familiar.variant.label}` : typeDef.name;
    const safeDisplayName = escapeHtml(displayName);
    const safeSpeciesLabel = escapeHtml(speciesLabel);
    const safeLevelName = escapeHtml(levelName);
    const safePersonality = escapeHtml(typeDef.personality);
    const safeVariantLabel = escapeHtml(familiar.variant?.label || 'Standard');

    const isFailed = familiar.generationStatus === 'failed' && familiar.generationLevel === familiar.level;
    const isEgg = familiar.state === 'egg';
    const denTheme = FAMILIAR_DEN_THEMES[familiar.typeId] || { sigil: '✨', element: 'Arcane' };

    const overlay = document.createElement('div');
    overlay.dataset.studentId = studentId;
    overlay.className = 'familiar-stats-overlay fixed inset-0 z-[95] flex items-center justify-center';

    // Habitat motes: the per-type CSS makes embers rise, snow fall, leaves drift, wisps flicker, sun motes shimmer.
    const motes = Array.from({ length: 14 }, (_, i) => {
        const left = 4 + ((i * 37) % 92);
        const top = 6 + ((i * 53) % 80);
        const dur = (4.8 + (i % 5) * 0.9).toFixed(1);
        const delay = (-(i * 0.73)).toFixed(2);
        const drift = (i % 2 ? -1 : 1) * (10 + (i % 4) * 7);
        const size = 3 + (i % 4) * 1.5;
        return `<span class="fam-den-mote" style="left:${left}%;top:${top}%;--mote-size:${size}px;--mote-dur:${dur}s;--mote-delay:${delay}s;--mote-drift:${drift}px;"></span>`;
    }).join('');

    const runeMarks = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 86;
        const y = 100 + Math.sin(a) * 86;
        return i % 3 === 0
            ? `<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)}L${(x + 4).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + 5).toFixed(1)}L${(x - 4).toFixed(1)} ${y.toFixed(1)}Z" class="fam-rune-gem"/>`
            : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" class="fam-rune-dot"/>`;
    }).join('');

    // Evolution path: Egg → the three named forms.
    const currentStage = isEgg ? 0 : Math.min(3, level);
    const stages = [{ name: 'Egg', icon: '🥚' }, ...typeDef.levelNames.map((name, i) => ({ name, icon: ['Ⅰ', 'Ⅱ', 'Ⅲ'][i] }))];
    const evolutionTrack = stages.map((stage, i) => {
        const status = i < currentStage ? 'done' : i === currentStage ? 'current' : 'locked';
        return `
            <li class="fam-evo-node fam-evo-node--${status}" style="--evo-i:${i};">
                <span class="fam-evo-gem">${status === 'locked' ? '<i class="fas fa-lock"></i>' : stage.icon}</span>
                <span class="fam-evo-name">${escapeHtml(stage.name)}</span>
            </li>`;
    }).join('');
    const trackFill = Math.round((currentStage / 3) * 100);

    const nextStageName = isMaxLevel ? '' : stages[Math.min(3, currentStage + 1)].name;
    const progressSpan = Math.max(1, progress.max - progress.min);
    const progressDone = Math.max(0, Math.min(progressSpan, progress.current - progress.min));
    const progressVerb = progress.phase === 'egg' ? 'Hatches into' : 'Evolves into';

    const traits = String(typeDef.flavorHint || '').split('•').map((t) => t.trim()).filter(Boolean)
        .map((t) => `<span class="fam-den-trait">${escapeHtml(t)}</span>`).join('');

    overlay.innerHTML = `
        <div class="fam-overlay-backdrop"></div>
        <div class="fam-modal-card fam-den relative w-full" data-fam-type="${escapeHtml(familiar.typeId)}"
             style="--fam-color:${typeDef.eggColor};--fam-accent:${typeDef.eggAccent || typeDef.eggColor};">
            <div class="fam-modal-scroll">
                <button type="button" class="fam-overlay-close" aria-label="Close">&times;</button>

                <div class="fam-den-stage">
                    <div class="fam-den-sky" aria-hidden="true"></div>
                    <div class="fam-den-rays" aria-hidden="true"></div>
                    <div class="fam-den-motes" aria-hidden="true">${motes}</div>
                    <div class="fam-den-sigil" title="${escapeHtml(denTheme.element)} familiar">
                        <span class="fam-den-sigil-icon">${denTheme.sigil}</span>
                        <span>${escapeHtml(denTheme.element)}</span>
                    </div>
                    <div class="fam-den-altar">
                        <svg class="fam-den-runes" viewBox="0 0 200 200" aria-hidden="true">
                            <circle cx="100" cy="100" r="94" class="fam-rune-ring"/>
                            <circle cx="100" cy="100" r="78" class="fam-rune-ring fam-rune-ring--dash"/>
                            <circle cx="100" cy="100" r="64" class="fam-rune-ring fam-rune-ring--faint"/>
                            ${runeMarks}
                        </svg>
                        <div class="fam-modal-sprite-halo" aria-hidden="true"></div>
                        <div class="fam-den-pedestal" aria-hidden="true"></div>
                        <button type="button" class="fam-overlay-tap fam-den-creature" aria-label="Tap familiar">
                            ${spriteHtml}
                        </button>
                    </div>
                </div>

                <div class="fam-den-body">
                    <div class="fam-den-heading">
                        <div class="fam-modal-species">${safeSpeciesLabel}</div>
                        <h3 class="fam-modal-name">${safeDisplayName}</h3>
                        <div class="fam-modal-badge">${isEgg ? '🥚' : '✨'} ${safeLevelName}</div>
                    </div>

                    <blockquote class="fam-modal-quote">${safePersonality}</blockquote>
                    ${traits ? `<div class="fam-den-traits">${traits}</div>` : ''}

                    <section class="fam-den-panel" aria-label="Evolution path">
                        <div class="fam-den-label">Evolution Path</div>
                        <ol class="fam-evo-track" style="--evo-fill:${trackFill}%;">${evolutionTrack}</ol>
                    </section>

                    ${!isMaxLevel ? `
                    <section class="fam-den-panel fam-den-progress">
                        <div class="fam-den-progress-head">
                            <div>
                                <div class="fam-den-label">${progressVerb}</div>
                                <div class="fam-den-next">${escapeHtml(nextStageName)}</div>
                            </div>
                            <div class="fam-den-count"><strong>${progressDone}</strong> / ${progressSpan} ⭐</div>
                        </div>
                        <div class="fam-den-bar">
                            <div class="fam-modal-progress-bar" style="--fam-progress:${progressPercent}%;"></div>
                        </div>
                        <div class="fam-den-hint">${progress.remaining} more ${progress.remaining === 1 ? 'star' : 'stars'} to go · ${progressPercent}%</div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-max">
                        <span class="fam-den-max-crown" aria-hidden="true">👑</span>
                        <div>
                            <div class="fam-den-max-title">Legendary Form</div>
                            <div class="fam-den-hint">Maximum evolution reached</div>
                        </div>
                    </section>`}

                    <div class="fam-den-stats">
                        <div class="fam-modal-stat">
                            <span class="fam-stat-icon" aria-hidden="true">⭐</span>
                            <div>
                                <div class="fam-stat-value">${starsTogether}</div>
                                <div class="fam-den-label">Stars together</div>
                            </div>
                        </div>
                        <div class="fam-modal-stat">
                            <span class="fam-stat-icon" aria-hidden="true">${denTheme.sigil}</span>
                            <div>
                                <div class="fam-stat-value fam-stat-value--sm">${safeVariantLabel}</div>
                                <div class="fam-den-label">${isEgg ? 'Destined variant' : 'Variant'}</div>
                            </div>
                        </div>
                    </div>

                    ${isFailed ? `
                    <section class="fam-den-panel fam-den-failed">
                        <div class="fam-den-label">Sprite generation failed</div>
                        <p>${escapeHtml(familiar.generationError || 'The browser could not create this familiar sprite.')}</p>
                        <button type="button" class="fam-retry-btn" data-student-id="${studentId}">Retry Sprite Generation</button>
                    </section>` : ''}

                    ${familiar.state === 'alive' ? `
                    <section class="fam-den-panel">
                        <div class="fam-den-label">True name</div>
                        <div class="fam-den-name-row">
                            <input type="text" class="fam-name-input" maxlength="24" value="${escapeHtml(familiar.name || '')}" placeholder="Give this familiar a name">
                            <button type="button" class="fam-name-save" data-student-id="${studentId}">Save</button>
                            <button type="button" class="fam-regenerate-btn" data-student-id="${studentId}" title="Regenerate Sprite" aria-label="Regenerate sprite">
                                <i class="fas fa-sync"></i>
                            </button>
                        </div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-egg-note">
                        <span class="fam-stat-icon" aria-hidden="true">🥚</span>
                        <div class="fam-den-hint">This egg can be named after it hatches.</div>
                    </section>`}
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    if (typeDef.tapSound) {
        try { new Audio(typeDef.tapSound).play().catch(() => {}); } catch (_) {}
    }

    const closeOverlay = () => {
        const card     = overlay.querySelector('.fam-modal-card');
        const backdrop = overlay.querySelector('.fam-overlay-backdrop');
        if (card) {
            card.classList.add('fam-modal-card--exit');
            if (backdrop) backdrop.classList.add('fam-overlay-backdrop--exit');
            card.addEventListener('animationend', (e) => { if (e.target === card) overlay.remove(); });
        } else {
            overlay.remove();
        }
    };
    overlay.querySelector('.fam-overlay-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    const tapBtn = overlay.querySelector('.fam-overlay-tap');
    if (tapBtn) {
        tapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tapBtn.classList.remove('fam-tap-bump');
            void tapBtn.offsetWidth;
            tapBtn.classList.add('fam-tap-bump');
        });
    }

    const retryBtn = overlay.querySelector('.fam-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            retryBtn.disabled = true;
            retryBtn.textContent = 'Retrying...';
            await retryFamiliarSpriteGeneration(studentId);
            closeOverlay();
            setTimeout(() => openFamiliarStatsOverlay(studentId), 480);
        });
    }

    const regenerateBtn = overlay.querySelector('.fam-regenerate-btn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            regenerateBtn.disabled = true;
            regenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';
            try {
                await regenerateCurrentFamiliarSprite(studentId);
            } catch (error) {
                console.error('Familiar sprite regeneration failed:', error);
                showToast(error.message || 'Could not regenerate this Familiar sprite.', 'error');
            } finally {
                closeOverlay();
                setTimeout(() => openFamiliarStatsOverlay(studentId), 480);
            }
        });
    }

    const saveBtn = overlay.querySelector('.fam-name-save');
    const nameInput = overlay.querySelector('.fam-name-input');
    if (saveBtn && nameInput) {
        const commitName = async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            try {
                await saveFamiliarName(studentId, nameInput.value);
                closeOverlay();
                setTimeout(() => openFamiliarStatsOverlay(studentId), 480);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };

        saveBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await commitName();
        });

        nameInput.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            await commitName();
        });
    }
}

export async function saveFamiliarName(studentId, rawName) {
    const scoreData = state.get('allStudentScores').find((s) => s.id === studentId);
    if (!scoreData?.familiar || scoreData.familiar.state !== 'alive') {
        showToast('This familiar can be named after it hatches.', 'error');
        return;
    }

    const name = normalizeFamiliarName(rawName);
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    await updateDoc(scoreRef, {
        'familiar.name': name
    });

    _patchLocalFamiliarState(studentId, (familiar) => ({ ...familiar, name }));
    showToast(name ? `Familiar named "${name}"!` : 'Familiar name cleared.', 'success');
}

export function renderFamiliarOptionsUi() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const status = document.getElementById('familiar-maintenance-status');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !status || !button) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Select a student with a Familiar...</option>';

    const teacherClassIds = new Set((state.get('allTeachersClasses') || []).map((item) => item.id));
    const students = (state.get('allStudents') || [])
        .filter((student) => teacherClassIds.has(student.classId))
        .filter((student) => state.get('allStudentScores').some((score) => score.id === student.id && score.familiar))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const student of students) {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = student.name;
        select.appendChild(option);
    }

    select.value = students.some((student) => student.id === currentValue) ? currentValue : '';
    updateFamiliarOptionsState();
}

export function updateFamiliarOptionsState() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const status = document.getElementById('familiar-maintenance-status');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !status || !button) return;

    const studentId = select.value;
    if (!studentId) {
        status.textContent = 'Choose a student to inspect or regenerate their Familiar sprite.';
        button.disabled = true;
        return;
    }

    const student = state.get('allStudents').find((item) => item.id === studentId);
    const familiar = state.get('allStudentScores').find((item) => item.id === studentId)?.familiar;
    if (!student || !familiar) {
        status.textContent = 'No Familiar data found for this student.';
        button.disabled = true;
        return;
    }

    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    const currentSprite = familiar.level > 0 ? familiar.spriteSheets?.[familiar.level] : null;
    const generationText = familiar.generationStatus === 'generating'
        ? 'Generating right now.'
        : familiar.generationStatus === 'failed'
            ? `Last attempt failed: ${familiar.generationError || 'unknown error'}`
            : currentSprite
                ? 'Current sprite is saved.'
                : 'No sprite saved for the current level yet.';
    const stageText = familiar.state === 'egg'
        ? 'Egg stage'
        : `${typeDef?.name || 'Familiar'} • Level ${familiar.level || 1}`;

    status.textContent = `${student.name}: ${stageText}. ${generationText}`;
    button.disabled = familiar.state !== 'alive' || familiar.generationStatus === 'generating';
}

export async function handleRegenerateFamiliarFromOptions() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !button) return;

    const studentId = select.value;
    if (!studentId) {
        showToast('Choose a student first.', 'error');
        return;
    }

    const student = state.get('allStudents').find((item) => item.id === studentId);
    button.disabled = true;
    const originalLabel = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Regenerating...';

    try {
        await regenerateCurrentFamiliarSprite(studentId);
        showToast(`Started a new Familiar sprite generation for ${student?.name || 'this student'}.`, 'success');
    } catch (error) {
        console.error('Familiar sprite regeneration failed:', error);
        showToast(error.message || 'Could not regenerate the Familiar sprite.', 'error');
    } finally {
        button.innerHTML = originalLabel;
        updateFamiliarOptionsState();
    }
}

function _patchLocalFamiliarState(studentId, patcher) {
    const scores = state.get('allStudentScores');
    const index = scores.findIndex((score) => score.id === studentId && score.familiar);
    if (index === -1) return;

    const nextScores = [...scores];
    nextScores[index] = {
        ...nextScores[index],
        familiar: patcher(scores[index].familiar)
    };
    state.setAllStudentScores(nextScores);
}

function getFamiliarDisplayName(familiar, typeDef) {
    return familiar?.name || typeDef?.name || 'Familiar';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
