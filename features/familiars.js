// /features/familiars.js — Familiars (Pets) System
// Sprite sheets generated via Cloudflare AI, animated with CSS steps()

import { db, doc, updateDoc, serverTimestamp } from '../firebase.js';
import * as state from '../state.js';
import { callCloudflareAiImageApi } from '../api.js';
// uploadImageToStorage imported dynamically to match avatar.js pattern
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

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
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, phantom cat, sleek dark shadow body, purple glowing eyes and paw tips, shadowy tail with glowing tip, half-visible ethereal form, frame 1: crouching ready, frame 2: creeping forward with glow, frame 3: pouncing with shadow trail, frame 4: landing in shadow burst, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, void stalker, massive shadowy form with void energy, floating in darkness made visible, multiple glowing purple eyes, dimensional rift markings, frame 1: ominous hovering, frame 2: lunging forward with void tear, frame 3: reality-bending leap, frame 4: impact with void explosion, consistent character, no text, game asset'
        }
    },
    sparkling: {
        id: 'sparkling',
        name: 'Sparkling',
        price: 50,
        eggIcon: '🥚',
        eggColor: '#f59e0b',
        eggAccent: '#fde68a',
        personality: 'Joyful and radiant — sunshine in the shape of a friend.',
        animClass: 'fam-anim-spin-sparkle',
        tapSound: null,
        desc: 'A light fairy that grows into a radiant phoenix chick.',
        flavorHint: 'Cheerful • Bright • Magical',
        levelNames: ['Light Fairy', 'Aurora Sprite', 'Phoenix Chick'],
        spritePrompts: {
            1: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, tiny adorable light fairy, glowing golden body, small shimmering wings, star-tipped wand, sparkling aura, frame 1: hovering with sparkles, frame 2: waving wand forward, frame 3: spinning with star trail, frame 4: landing with burst of light, consistent character across all frames, no text, clean outlines, game asset',
            2: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, aurora sprite, larger graceful fairy body with rainbow aurora wings, glowing halo, trailing light ribbons, frame 1: floating in aurora glow, frame 2: gliding forward with light trail, frame 3: spinning leap with rainbow arc, frame 4: landing in shimmer burst, consistent character, no text, game asset',
            3: '2D game sprite sheet, exactly 4 frames in a single horizontal row on a pure white background, no borders between frames, flat chibi pixel-art style, radiant phoenix chick, brilliant golden feathers with flame tips, majestic small wings, blazing tail, brilliant halo, frame 1: standing in radiant glow, frame 2: strutting forward with fire step, frame 3: soaring leap in flames, frame 4: landing with phoenix burst, consistent character, no text, game asset'
        }
    }
};

export const FAMILIAR_LEVEL_THRESHOLDS = {
    hatch: 20,      // stars after purchase to hatch (~1 month)
    level2: 60,     // totalStars earned after hatch to reach level 2 (~3 months after hatch)
    level3: 140     // totalStars earned after hatch to reach level 3 (~7 months after hatch, near year end)
};

// ─── SPRITE GENERATION ───────────────────────────────────────────────────────

export async function generateFamiliarSpriteSheet(typeId, level) {
    const type = FAMILIAR_TYPES[typeId];
    if (!type) throw new Error(`Unknown familiar type: ${typeId}`);
    const prompt = type.spritePrompts[level];
    if (!prompt) throw new Error(`No prompt for ${typeId} level ${level}`);

    const base64 = await callCloudflareAiImageApi(prompt, 'realistic photo, 3d render, text, watermark, blurry, extra limbs, deformed');
    const compressed = await _compressSpriteSheet(base64);
    const { uploadImageToStorage } = await import('../utils.js');
    const url = await uploadImageToStorage(compressed, `familiars/${typeId}_level${level}_${Date.now()}.webp`);
    return url;
}

async function _compressSpriteSheet(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            // Keep aspect ratio but cap height at 128px (4 frames wide × ~128px each)
            const targetH = 128;
            const scale = targetH / img.height;
            const targetW = Math.round(img.width * scale);
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // pixel-art crisp
            ctx.drawImage(img, 0, 0, targetW, targetH);
            resolve(canvas.toDataURL('image/webp', 0.9));
        };
        img.onerror = reject;
    });
}

// ─── HATCH / LEVEL-UP CHECK (fire-and-forget, called after star transaction) ──

export async function checkHatchOrLevelUp(studentId) {
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    if (!scoreData?.familiar) return;

    const familiar = scoreData.familiar;
    const totalStars = scoreData.totalStars || 0;

    if (familiar.state === 'egg') {
        const starsSincePurchase = totalStars - (familiar.starsWhenPurchased || 0);
        if (starsSincePurchase >= FAMILIAR_LEVEL_THRESHOLDS.hatch) {
            await _hatchFamiliar(studentId, familiar, totalStars);
        }
    } else if (familiar.state === 'alive' && familiar.level < 3) {
        const starsSinceHatch = totalStars - (familiar.starsWhenHatched || 0);
        const threshold = familiar.level === 1 ? FAMILIAR_LEVEL_THRESHOLDS.level2 : FAMILIAR_LEVEL_THRESHOLDS.level3;
        if (starsSinceHatch >= threshold) {
            await _evolveFamiliar(studentId, familiar, totalStars);
        }
    }
}

async function _hatchFamiliar(studentId, familiar, totalStars) {
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    // Immediately set state = alive, level = 1 so UI shows "Hatching..."
    await updateDoc(scoreRef, {
        'familiar.state': 'alive',
        'familiar.level': 1,
        'familiar.starsWhenHatched': totalStars
    });

    try {
        const url = await generateFamiliarSpriteSheet(familiar.typeId, 1, totalStars, studentId);
        await updateDoc(scoreRef, { 'familiar.spriteSheets.1': url });

        // Show hatch notification
        const student = state.get('allStudents').find(s => s.id === studentId);
        const typeDef = FAMILIAR_TYPES[familiar.typeId];
        if (student && typeDef) {
            import('../ui/effects.js').then(m => {
                m.showPraiseToast(`${student.name.split(' ')[0]}'s ${typeDef.name} has hatched! 🥚✨`, '🎉');
            });
        }
        // Play hatch sound (via Audio element, not Tone.js)
        _playFamiliarSound('hatch');
    } catch (err) {
        console.error('Familiar hatch generation failed:', err);
    }
}

async function _evolveFamiliar(studentId, familiar, totalStars) {
    const newLevel = familiar.level + 1;
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    // Immediately update level so UI shows "Evolving..."
    await updateDoc(scoreRef, {
        'familiar.level': newLevel,
        'familiar.starsWhenHatched': totalStars  // reset milestone counter
    });

    try {
        const url = await generateFamiliarSpriteSheet(familiar.typeId, newLevel, totalStars, studentId);
        await updateDoc(scoreRef, { [`familiar.spriteSheets.${newLevel}`]: url });

        const student = state.get('allStudents').find(s => s.id === studentId);
        const typeDef = FAMILIAR_TYPES[familiar.typeId];
        if (student && typeDef) {
            import('../ui/effects.js').then(m => {
                m.showPraiseToast(`${student.name.split(' ')[0]}'s ${typeDef.name} evolved to ${typeDef.levelNames[newLevel - 1]}! 🌟`, '⬆️');
            });
        }
        _playFamiliarSound('levelup');
    } catch (err) {
        console.error('Familiar evolution generation failed:', err);
    }
}

function _playFamiliarSound(type) {
    try {
        playSound(type === 'hatch' ? 'familiar_hatch' : 'familiar_levelup');
    } catch (_) {}
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

/**
 * Returns the HTML for rendering a familiar on leaderboard / avatar overlay.
 * @param {object} familiar - the familiar object from student_scores
 * @param {'small'|'medium'|'large'} size - 'small' = 40px, 'medium' = 64px, 'large' = 128px
 * @param {string} studentId
 */
export function renderFamiliarSprite(familiar, size = 'small', studentId = '') {
    if (!familiar) return '';
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return '';

    const sizeMap = { small: 40, medium: 64, large: 128 };
    const px = sizeMap[size] || 40;

    if (familiar.state === 'egg') {
        return _renderEgg(typeDef, px, studentId);
    }

    const spriteUrl = familiar.spriteSheets?.[familiar.level] || null;

    if (!spriteUrl) {
        // Generating — show shimmer placeholder
        return `
            <div class="familiar-container ${typeDef.animClass} enlargeable-familiar" 
                 data-student-id="${studentId}"
                 style="width:${px}px;height:${px}px;"
                 title="${typeDef.name} — hatching...">
                <div class="familiar-shimmer" style="width:${px}px;height:${px}px;border-radius:50%;"></div>
            </div>`;
    }

    // Animated sprite sheet (4 frames wide)
    return `
        <div class="familiar-container ${typeDef.animClass} enlargeable-familiar"
             data-student-id="${studentId}"
             style="width:${px}px;height:${px}px;flex-shrink:0;"
             title="${typeDef.name} — ${typeDef.levelNames[(familiar.level || 1) - 1]}">
            <div class="familiar-sprite"
                 style="width:${px}px;height:${px}px;background-image:url('${spriteUrl}');background-size:400% 100%;image-rendering:pixelated;">
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
    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!scoreData?.familiar || !student) return;

    const familiar = scoreData.familiar;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return;

    // Close any existing
    document.querySelector('.familiar-stats-overlay')?.remove();

    const level = familiar.level || 1;
    const starsTotal = scoreData.totalStars || 0;
    const starsTogether = starsTotal - (familiar.starsWhenPurchased || 0);
    const isMaxLevel = level >= 3;
    const starsToNext = isMaxLevel
        ? null
        : level === 1
            ? Math.max(0, FAMILIAR_LEVEL_THRESHOLDS.level2 - (starsTotal - (familiar.starsWhenHatched || 0)))
            : Math.max(0, FAMILIAR_LEVEL_THRESHOLDS.level3 - (starsTotal - (familiar.starsWhenHatched || 0)));

    const levelName = familiar.state === 'egg' ? 'Egg' : (typeDef.levelNames[level - 1] || 'Unknown');
    const spriteHtml = renderFamiliarSprite(familiar, 'large', studentId);

    const overlay = document.createElement('div');
    overlay.className = 'familiar-stats-overlay fixed inset-0 z-[95] flex items-center justify-center bg-black/80 pop-in';
    overlay.innerHTML = `
        <div class="relative bg-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 border-2 shadow-2xl text-center" style="border-color:${typeDef.eggColor};">
            <button class="fam-overlay-close absolute top-3 right-4 text-white/40 hover:text-white text-2xl">&times;</button>
            <div class="flex justify-center mb-4">${spriteHtml}</div>
            <h3 class="font-title text-2xl text-white mb-1">${typeDef.name}</h3>
            <div class="inline-block px-3 py-0.5 rounded-full text-xs font-bold text-white mb-3" style="background:${typeDef.eggColor}">${levelName}</div>
            <p class="text-sm text-white/60 italic mb-4">"${typeDef.personality}"</p>
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
            ${!isMaxLevel && familiar.state === 'alive' ? `
            <div class="bg-white/5 rounded-xl p-3 mb-4">
                <div class="text-xs text-white/40 uppercase mb-1">Stars to next evolution</div>
                <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div class="h-2 rounded-full transition-all" style="background:${typeDef.eggColor};width:${Math.min(100, Math.round(((level === 1 ? FAMILIAR_LEVEL_THRESHOLDS.level2 - starsToNext : FAMILIAR_LEVEL_THRESHOLDS.level3 - starsToNext) / (level === 1 ? FAMILIAR_LEVEL_THRESHOLDS.level2 : FAMILIAR_LEVEL_THRESHOLDS.level3)) * 100))}%"></div>
                </div>
                <div class="text-xs text-white/50 mt-1">${starsToNext} more stars needed</div>
            </div>` : isMaxLevel ? `<div class="text-xs text-amber-400 font-bold mb-4">✨ MAX EVOLUTION REACHED</div>` : ''}
            <p class="text-[10px] text-white/30 italic">${typeDef.flavorHint}</p>
        </div>`;

    document.body.appendChild(overlay);

    // Play tap sound if available
    if (typeDef.tapSound) {
        try { new Audio(typeDef.tapSound).play().catch(() => {}); } catch (_) {}
    }

    overlay.querySelector('.fam-overlay-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ─── PURCHASE HELPER ─────────────────────────────────────────────────────────

export function buildFamiliarInitData(typeId, currentTotalStars) {
    return {
        typeId,
        state: 'egg',
        level: 0,
        starsWhenPurchased: currentTotalStars,
        starsWhenHatched: 0,
        spriteSheets: { 1: null, 2: null, 3: null }
    };
}
