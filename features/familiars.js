// /features/familiars.js — Familiars (Pets) System
// Sprite sheets generated via Cloudflare AI, animated with CSS steps()

import { db, doc, getDoc, updateDoc, serverTimestamp } from '../firebase.js';
import * as state from '../state.js';
import { callCloudflareAiImageApi } from '../api.js';
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
const SPRITE_FRAME_COUNT = 4;
const MAX_SPRITE_GENERATION_ATTEMPTS = 3;
const SPRITE_VALIDATION_SIZE = 128;

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

export async function generateFamiliarSpriteSheet(typeId, level, variant = null) {
    const type = FAMILIAR_TYPES[typeId];
    if (!type) throw new Error(`Unknown familiar type: ${typeId}`);
    const basePrompt = type.spritePrompts[level];
    if (!basePrompt) throw new Error(`No prompt for ${typeId} level ${level}`);
    let lastError = null;

    for (let attempt = 0; attempt < MAX_SPRITE_GENERATION_ATTEMPTS; attempt += 1) {
        try {
            const prompt = _buildSpritePrompt(basePrompt, variant, attempt);
            const negativePrompt = _buildSpriteNegativePrompt(attempt);
            const base64 = await callCloudflareAiImageApi(prompt, negativePrompt);
            const normalized = await _normalizeAndValidateSpriteSheet(base64);
            const { uploadImageToStorage } = await import('../utils.js');
            const url = await uploadImageToStorage(normalized, `familiars/${typeId}_level${level}_${Date.now()}.webp`);
            return url;
        } catch (error) {
            lastError = error;
            console.warn(`Familiar sprite attempt ${attempt + 1} failed:`, error);
        }
    }

    throw new Error(lastError?.message || 'The generated sprite sheet did not look like a usable 4-frame Familiar sprite.');
}

function _buildSpritePrompt(basePrompt, variant, attempt = 0) {
    const variantPrompt = variant?.promptFlavor
        ? `same familiar variant identity across all frames, ${variant.promptFlavor}`
        : 'same familiar identity across all frames';
    const retryPrompt = attempt > 0
        ? `IMPORTANT RETRY FIX: the previous image was rejected because it looked like a tiled strip or multiple tiny copies. Draw one single familiar only in each frame, centered and large.`
        : '';

    return [
        basePrompt,
        variantPrompt,
        'IMPORTANT: create a retro 2D game sprite sheet asset.',
        'Exactly 4 square animation frames in a single horizontal row.',
        'One single familiar only per frame, centered, large, readable silhouette.',
        'Plain pure white background only.',
        'No repeated rows, no tiled pattern, no many tiny copies, no texture atlas, no abstract streaks, no scenery.',
        'Each frame must show the same character in a slightly different pose for animation.',
        retryPrompt
    ].filter(Boolean).join(', ');
}

function _buildSpriteNegativePrompt(attempt = 0) {
    const retryPenalty = attempt > 0 ? ', tiled pattern, repeating strips, rows of duplicates, many copies of creature' : '';
    return `realistic photo, 3d render, text, watermark, blurry, low quality, extra limbs, deformed, multiple characters, collage, comic page, border grid, background scene, props, texture sheet, abstract pattern${retryPenalty}`;
}

async function _normalizeAndValidateSpriteSheet(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const validation = _validateSpriteSheetImage(img);
            if (!validation.ok) {
                reject(new Error(validation.reason));
                return;
            }

            const targetH = SPRITE_VALIDATION_SIZE;
            const targetW = targetH * SPRITE_FRAME_COUNT;
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not create sprite canvas.'));
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, targetW, targetH);
            resolve(canvas.toDataURL('image/webp', 0.9));
        };
        img.onerror = reject;
    });
}

function _validateSpriteSheetImage(img) {
    const aspectRatio = img.width / Math.max(1, img.height);
    if (aspectRatio < 3.2 || aspectRatio > 4.8) {
        return { ok: false, reason: 'Generated image is not a horizontal 4-frame sprite sheet.' };
    }

    const frameWidth = Math.floor(img.width / SPRITE_FRAME_COUNT);
    if (frameWidth < 24 || img.height < 24) {
        return { ok: false, reason: 'Generated sprite sheet is too small to use.' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        return { ok: false, reason: 'Could not inspect generated sprite sheet.' };
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for (let frameIndex = 0; frameIndex < SPRITE_FRAME_COUNT; frameIndex += 1) {
        const frameStartX = frameIndex * frameWidth;
        const stats = _collectFrameStats(data, width, height, frameStartX, frameWidth);
        if (!stats.valid) return { ok: false, reason: stats.reason };
    }

    return { ok: true };
}

function _collectFrameStats(data, width, height, frameStartX, frameWidth) {
    let foregroundCount = 0;
    let minX = frameWidth;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let horizontalEdgeHits = 0;
    let verticalEdgeHits = 0;

    for (let y = 0; y < height; y += 1) {
        for (let localX = 0; localX < frameWidth; localX += 1) {
            const x = frameStartX + localX;
            const idx = (y * width + x) * 4;
            if (!_isForegroundPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) continue;

            foregroundCount += 1;
            if (localX < minX) minX = localX;
            if (localX > maxX) maxX = localX;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (localX <= 1 || localX >= frameWidth - 2) horizontalEdgeHits += 1;
            if (y <= 1 || y >= height - 2) verticalEdgeHits += 1;
        }
    }

    const frameArea = frameWidth * height;
    const coverage = foregroundCount / Math.max(1, frameArea);
    if (coverage < 0.02) {
        return { valid: false, reason: 'Generated sprite frame is too empty.' };
    }
    if (coverage > 0.48) {
        return { valid: false, reason: 'Generated sprite frame is too busy and does not resemble a single sprite.' };
    }

    const bboxWidthRatio = (maxX - minX + 1) / Math.max(1, frameWidth);
    const bboxHeightRatio = (maxY - minY + 1) / Math.max(1, height);
    if (bboxWidthRatio > 0.86 || bboxHeightRatio > 0.95) {
        return { valid: false, reason: 'Generated frame spreads across the whole cell like a texture strip.' };
    }

    const centerX = ((minX + maxX) / 2) / Math.max(1, frameWidth);
    const centerY = ((minY + maxY) / 2) / Math.max(1, height);
    if (Math.abs(centerX - 0.5) > 0.28 || Math.abs(centerY - 0.52) > 0.3) {
        return { valid: false, reason: 'Generated sprite is not centered in the frame.' };
    }

    if ((horizontalEdgeHits / foregroundCount) > 0.18 || (verticalEdgeHits / foregroundCount) > 0.14) {
        return { valid: false, reason: 'Generated frame looks clipped or tiled against the borders.' };
    }

    const shapeStats = _measureFrameShapeComplexity(data, width, height, frameStartX, frameWidth);
    if (shapeStats.componentCount > 12) {
        return { valid: false, reason: 'Generated frame contains too many disconnected pieces.' };
    }
    if (shapeStats.largestComponentRatio < 0.35) {
        return { valid: false, reason: 'Generated frame does not contain one clear main creature silhouette.' };
    }

    return { valid: true };
}

function _measureFrameShapeComplexity(data, width, height, frameStartX, frameWidth) {
    const gridW = 24;
    const gridH = 24;
    const cells = new Array(gridW * gridH).fill(false);

    for (let gy = 0; gy < gridH; gy += 1) {
        const yStart = Math.floor((gy / gridH) * height);
        const yEnd = Math.max(yStart + 1, Math.floor(((gy + 1) / gridH) * height));
        for (let gx = 0; gx < gridW; gx += 1) {
            const xStart = frameStartX + Math.floor((gx / gridW) * frameWidth);
            const xEnd = frameStartX + Math.max(Math.floor(((gx + 1) / gridW) * frameWidth), Math.floor((gx / gridW) * frameWidth) + 1);
            let foundForeground = false;

            for (let y = yStart; y < yEnd && !foundForeground; y += 1) {
                for (let x = xStart; x < xEnd; x += 1) {
                    const idx = (y * width + x) * 4;
                    if (_isForegroundPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                        foundForeground = true;
                        break;
                    }
                }
            }

            if (foundForeground) cells[(gy * gridW) + gx] = true;
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
        let componentSize = 0;
        const stack = [i];
        visited[i] = true;

        while (stack.length) {
            const current = stack.pop();
            componentSize += 1;
            const x = current % gridW;
            const y = Math.floor(current / gridW);
            const neighbors = [
                [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
            ];

            for (const [nx, ny] of neighbors) {
                if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
                const next = (ny * gridW) + nx;
                if (!cells[next] || visited[next]) continue;
                visited[next] = true;
                stack.push(next);
            }
        }

        if (componentSize > largest) largest = componentSize;
    }

    return {
        componentCount,
        largestComponentRatio: largest / Math.max(1, occupied)
    };
}

function _isForegroundPixel(r, g, b, a) {
    if (a < 24) return false;
    return !(r > 242 && g > 242 && b > 242);
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
        const url = await generateFamiliarSpriteSheet(familiar.typeId, spriteLevel, variant);
        await updateDoc(scoreRef, {
            [`familiar.spriteSheets.${spriteLevel}`]: url,
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
        return `
            <div class="familiar-container ${typeDef.animClass} enlargeable-familiar"
                 data-student-id="${studentId}"
                 style="width:${px}px;height:${px}px;flex-shrink:0;"
                 title="${safeSubtitle} — ${escapeHtml(typeDef.levelNames[(familiar.level || 1) - 1])}">
                <div class="familiar-sprite"
                     style="width:${px}px;height:${px}px;background-image:url('${spriteUrl}');background-size:400% 100%;image-rendering:pixelated;">
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

    let progressTitle = 'Stars to hatch';
    let progressSubtitle = `${progress.remaining} more stars needed`;
    if (progress.phase === 'level1') {
        progressTitle = 'Stars to Level 2';
        progressSubtitle = `${progress.remaining} more stars needed`;
    } else if (progress.phase === 'level2') {
        progressTitle = 'Stars to Level 3';
        progressSubtitle = `${progress.remaining} more stars needed`;
    } else if (progress.phase === 'max') {
        progressSubtitle = 'Maximum evolution reached';
    }

    const isFailed = familiar.generationStatus === 'failed' && familiar.generationLevel === familiar.level;

    const overlay = document.createElement('div');
    overlay.dataset.studentId = studentId;
    overlay.className = 'familiar-stats-overlay fixed inset-0 z-[95] flex items-center justify-center bg-black/80 pop-in';
    overlay.innerHTML = `
        <div class="relative bg-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 border-2 shadow-2xl text-center" style="border-color:${typeDef.eggColor};">
            <button class="fam-overlay-close absolute top-3 right-4 text-white/40 hover:text-white text-2xl">&times;</button>
            <div class="flex justify-center mb-4">
                <button type="button" class="fam-overlay-tap" aria-label="Tap familiar">
                    ${spriteHtml}
                </button>
            </div>
            <h3 class="font-title text-2xl text-white mb-1">${safeDisplayName}</h3>
            <div class="text-[11px] text-white/45 uppercase tracking-[0.2em] mb-2">${safeSpeciesLabel}</div>
            <div class="inline-block px-3 py-0.5 rounded-full text-xs font-bold text-white mb-3" style="background:${typeDef.eggColor}">${safeLevelName}</div>
            <p class="text-sm text-white/60 italic mb-4">"${safePersonality}"</p>
            <div class="grid grid-cols-2 gap-3 text-left mb-4">
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-xs text-white/40 uppercase tracking-wider">Stars Together</div>
                    <div class="text-xl font-bold text-white">${starsTogether} ⭐</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-xs text-white/40 uppercase tracking-wider">Evolution</div>
                    <div class="text-xl font-bold text-white">${familiar.state === 'egg' ? '🥚 Egg' : `Lv. ${level}`}</div>
                </div>
            </div>
            ${!isMaxLevel ? `
            <div class="bg-white/5 rounded-xl p-3 mb-4">
                <div class="text-xs text-white/40 uppercase mb-1">${progressTitle}</div>
                <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div class="h-2 rounded-full transition-all" style="background:${typeDef.eggColor};width:${progressPercent}%"></div>
                </div>
                <div class="text-xs text-white/50 mt-1">${progressSubtitle}</div>
            </div>` : `<div class="text-xs text-amber-400 font-bold mb-4">✨ MAX EVOLUTION REACHED</div>`}
            ${isFailed ? `
            <div class="bg-red-500/10 border border-red-400/30 rounded-xl p-3 mb-4 text-left">
                <div class="text-xs font-bold uppercase tracking-wider text-red-300 mb-1">Sprite generation failed</div>
                <p class="text-xs text-red-100/80 mb-3">${familiar.generationError || 'The browser could not create this familiar sprite.'}</p>
                <button type="button" class="fam-retry-btn w-full rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-sm py-2" data-student-id="${studentId}">
                    Retry Sprite Generation
                </button>
            </div>` : ''}
            ${familiar.state === 'alive' ? `
            <div class="bg-white/5 rounded-xl p-3 mb-4 text-left">
                <div class="text-xs text-white/40 uppercase tracking-wider mb-2">Familiar Name</div>
                <div class="flex gap-2">
                    <input type="text" class="fam-name-input flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25" maxlength="24" value="${escapeHtml(familiar.name || '')}" placeholder="Give this familiar a name">
                    <button type="button" class="fam-name-save rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-sm px-3 py-2" data-student-id="${studentId}">
                        Save
                    </button>
                </div>
                <div class="text-[10px] text-white/35 mt-2">Variant: ${safeVariantLabel}</div>
                <button type="button" class="fam-regenerate-btn mt-3 w-full rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm py-2" data-student-id="${studentId}">
                    Regenerate Sprite
                </button>
            </div>` : `
            <div class="bg-white/5 rounded-xl p-3 mb-4 text-left">
                <div class="text-xs text-white/40 uppercase tracking-wider mb-1">Naming</div>
                <div class="text-xs text-white/50">This egg can be named after it hatches.</div>
                <div class="text-[10px] text-white/35 mt-2">Destined variant: ${safeVariantLabel}</div>
            </div>`}
            <p class="text-[10px] text-white/30 italic">${typeDef.flavorHint}</p>
        </div>`;

    document.body.appendChild(overlay);

    if (typeDef.tapSound) {
        try { new Audio(typeDef.tapSound).play().catch(() => {}); } catch (_) {}
    }

    const closeOverlay = () => overlay.remove();
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
            setTimeout(() => openFamiliarStatsOverlay(studentId), 200);
        });
    }

    const regenerateBtn = overlay.querySelector('.fam-regenerate-btn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = 'Regenerating...';
            try {
                await regenerateCurrentFamiliarSprite(studentId);
            } catch (error) {
                console.error('Familiar sprite regeneration failed:', error);
                showToast(error.message || 'Could not regenerate this Familiar sprite.', 'error');
            } finally {
                closeOverlay();
                setTimeout(() => openFamiliarStatsOverlay(studentId), 200);
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
                setTimeout(() => openFamiliarStatsOverlay(studentId), 120);
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
