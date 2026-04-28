export const competitionStart = new Date('2025-11-01');
export const competitionEnd = new Date('2026-06-30');
export const APP_VERSION = '0.0.2';

/** Fallback when school_settings.schoolName is not set. Used everywhere school name is displayed. */
export const DEFAULT_SCHOOL_NAME = 'Your School';

// Use optional config from bootstrap (config.json) when present; otherwise this default (e.g. your school).
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCxpouLYfm8woS8ToK8kRzndRvbIwsPuFU",
  authDomain: "the-great-class-quest.firebaseapp.com",
  projectId: "the-great-class-quest",
  storageBucket: "the-great-class-quest.firebasestorage.app",
  messagingSenderId: "1021026433595",
  appId: "1:1021026433595:web:d1bc4b6f45f01fe25c3a1e",
  measurementId: "G-QJZC4NGX75"
};

export const firebaseConfig =
  (typeof window !== 'undefined' && window.__GCQ_FIREBASE_CONFIG__) || DEFAULT_FIREBASE_CONFIG;

export const cloudflareWorkerUrl = 'https://great-class-quest-ai-proxy.nvasedis-cc5.workers.dev';
export const workerBaseUrl = 'https://great-class-quest-ai-proxy.nvasedis-cc5.workers.dev';
export const geminiApiUrl = workerBaseUrl; 
export const OPENROUTER_MODEL = "z-ai/glm-4.5-air:free";
const runtimeAiTextConfig = (typeof window !== 'undefined' && window.__GCQ_AI_TEXT_CONFIG__) || {};

function normalizeAiProvider(definition, fallback = {}) {
    if (!definition || typeof definition !== 'object') return null;
    const url = String(definition.url || fallback.url || '').trim();
    if (!url) return null;
    return {
        id: String(definition.id || fallback.id || 'ai-provider').trim() || 'ai-provider',
        label: String(definition.label || fallback.label || definition.id || 'AI Provider').trim() || 'AI Provider',
        url,
        model: String(definition.model || fallback.model || OPENROUTER_MODEL).trim() || OPENROUTER_MODEL,
        payloadMode: String(definition.payloadMode || fallback.payloadMode || 'openrouter').trim() || 'openrouter'
    };
}

const defaultAiPrimaryProvider = normalizeAiProvider({
    id: 'gcq-primary',
    label: 'GCQ Primary Proxy',
    url: geminiApiUrl,
    model: OPENROUTER_MODEL,
    payloadMode: 'openrouter'
});

const configuredAiProviders = Array.isArray(runtimeAiTextConfig.providers)
    ? runtimeAiTextConfig.providers
    : [
        runtimeAiTextConfig.primary,
        runtimeAiTextConfig.backup
    ].filter(Boolean);

export const AI_TEXT_PROVIDERS = (() => {
    const providers = [];
    const seen = new Set();

    for (const providerDef of [defaultAiPrimaryProvider, ...configuredAiProviders.map((provider, index) => normalizeAiProvider(provider, {
        id: index === 0 ? 'gcq-primary-runtime' : 'gcq-backup-runtime',
        label: index === 0 ? 'GCQ Runtime Primary' : 'GCQ Runtime Backup',
        payloadMode: 'openrouter'
    }))].filter(Boolean)) {
        const key = `${providerDef.id}::${providerDef.url}::${providerDef.model}`;
        if (seen.has(key)) continue;
        seen.add(key);
        providers.push(providerDef);
    }

    return providers;
})();

/** Billing: base URL of your billing backend (Stripe checkout). When set, upgrade prompts show an "Upgrade" button that redirects to Stripe. Leave empty to keep "Contact me to upgrade". */
export const BILLING_BASE_URL = (typeof window !== 'undefined' && window.__GCQ_BILLING_BASE_URL__) || '';
/** Billing: school id passed to create-checkout-session. If empty, uses firebaseConfig.projectId. */
export const BILLING_SCHOOL_ID = (typeof window !== 'undefined' && window.__GCQ_BILLING_SCHOOL_ID__) || '';
/** Firebase Functions region for the privileged admin runtime. */
export const FIREBASE_FUNCTIONS_REGION = (typeof window !== 'undefined' && window.__GCQ_FIREBASE_FUNCTIONS_REGION__) || 'europe-west1';

export const questLeagues = ['Junior A', 'Junior B', 'A', 'B', 'C', 'D']; 

// ─── Glory Currency (Guild scoring) ──────────────────────────────────────────
export const GLORY_PER_STAR = 2;
export const GLORY_EMOJI = '⚜️';

/** Composite Guild Power weights (must sum to 1.0) */
export const GUILD_POWER_WEIGHTS = { glory: 0.50, momentum: 0.30, activity: 0.20 };

/** Fortune's Wheel segment rarity weights (probability out of 100) */
export const WHEEL_RARITY_WEIGHTS = {
    common:    40,
    uncommon:  25,
    rare:      20,
    epic:      10,
    legendary:  3,
    mythic:     1,
    cursed:     2,
};

/** Rarity display config */
export const WHEEL_RARITY_CONFIG = {
    common:    { label: 'Common',    color: '#3b82f6', bg: '#1e3a5f', glow: '#3b82f680' },
    uncommon:  { label: 'Uncommon',  color: '#22c55e', bg: '#14532d', glow: '#22c55e80' },
    rare:      { label: 'Rare',      color: '#a855f7', bg: '#3b0764', glow: '#a855f780' },
    epic:      { label: 'Epic',      color: '#f97316', bg: '#7c2d12', glow: '#f9731680' },
    legendary: { label: 'Legendary', color: '#eab308', bg: '#713f12', glow: '#eab30880' },
    mythic:    { label: 'Mythic',    color: '#22d3ee', bg: '#083344', glow: '#22d3ee80' },
    cursed:    { label: 'Cursed',    color: '#ef4444', bg: '#450a0a', glow: '#ef444480' },
};

/** Junior leagues (no cursed or harsh negative segments) */
export const JUNIOR_LEAGUES = ['Junior A', 'Junior B'];

export const classLogos = [
    '⭐', '🚀', '💡', '🏆', '📚', '🧭', '🧪', '🧠', '🧩', '🗺️',
    '🦁', '🐲', '🦄', '🤖', '👑', '💎', '🎨', '💻', '📈', '🌍',
    '🔭', '🦉', '🦊', '💥', '✨', '⚡', '🖋️', '📖', '🍎', '🥇',
    '🌲', '🌊', '🌋', '🍄', '💍', '🛡️', '⚔️', '🏹', '🔮', '💰',
    '⚙️', '🕰️', '🔬', '🔱', '⚓', '🔔', '🦖', '🦕', '🌈', '🌙', 
    '☀️', '☁️', '🗝️', '🗻', '🌃', '🌆', '🏙️', '🏰', '🛸',
    '🪐', '🌌', '🧬', '🧙', '🧚', '🐢', '🦋', '🌵', '🍁', '🐚',
    '🌠', '👾', '📜', '⚗️', '🏺', '🧞', '🧜‍♀️', '🦅', '🐺', '⚛️',
    '🌱', '⏳', '🐼', '🐨', '🦡', '🦔', '🦚', '🪁', '🪀', '🧮', '🧲'
];

export const titleGradients = [
    'from-purple-600 to-pink-500',
    'from-cyan-500 to-blue-600',
    'from-green-500 to-teal-600',
    'from-yellow-500 to-orange-600',
    'from-red-500 to-rose-600'
];

export const juniorCertificateStyles = [
    { name: 'Starlight', borderColor: '#FBBF24', bgColor: '#FFFBEB', titleColor: '#B45309', nameColor: '#D97706', textColor: '#92400E', icon: '⭐' },
    { name: 'Oceanic', borderColor: '#38BDF8', bgColor: '#F0F9FF', titleColor: '#0369A1', nameColor: '#0284C7', textColor: '#075985', icon: '🌊' },
    { name: 'Forest', borderColor: '#4ADE80', bgColor: '#F0FDF4', titleColor: '#15803D', nameColor: '#16A34A', textColor: '#14532D', icon: '🌳' },
    { name: 'Rocket', borderColor: '#F87171', bgColor: '#FEF2F2', titleColor: '#B91C1C', nameColor: '#DC2626', textColor: '#7F1D1D', icon: '🚀' },
    { name: 'Rainbow', borderColor: '#F472B6', bgColor: '#FEF2F5', titleColor: '#BE185D', nameColor: '#DB2777', textColor: '#831843', icon: '🌈' },
    { name: 'Dino', borderColor: '#F97316', bgColor: '#FFF7ED', titleColor: '#9A3412', nameColor: '#C2410C', textColor: '#7C2D12', icon: '🦖' }
];

export const midCertificateStyles = [
    { name: 'Innovation', borderColor: '#A78BFA', bgColor: '#F5F3FF', titleColor: '#5B21B6', nameColor: '#7C3AED', textColor: '#4C1D95', icon: '💡' },
    { name: 'Victory', borderColor: '#FACC15', bgColor: '#FEFCE8', titleColor: '#854D0E', nameColor: '#A16207', textColor: '#713F12', icon: '🏆' },
    { name: 'Sparkle', borderColor: '#EC4899', bgColor: '#FDF2F8', titleColor: '#9D174D', nameColor: '#BE185D', textColor: '#831843', icon: '✨' },
    { name: 'Explorer', borderColor: '#22D3EE', bgColor: '#ECFEFF', titleColor: '#0E7490', nameColor: '#0891B2', textColor: '#155E75', icon: '🧭' },
    { name: 'Royal', borderColor: '#C084FC', bgColor: '#FAF5FF', titleColor: '#7E22CE', nameColor: '#9333EA', textColor: '#581C87', icon: '👑' }
];

export const seniorCertificateStyles = [
    { name: 'Prestige', borderColor: '#BFDBFE', bgColor: '#EFF6FF', titleColor: '#1E3A8A', nameColor: '#1D4ED8', textColor: '#1E40AF', icon: '🥇' },
    { name: 'Scholarly', borderColor: '#A3A3A3', bgColor: '#FAFAFA', titleColor: '#404040', nameColor: '#525252', textColor: '#262626', icon: '📚' },
    { name: 'Global', borderColor: '#6EE7B7', bgColor: '#F0FDF4', titleColor: '#065F46', nameColor: '#047857', textColor: '#064E3B', icon: '🌍' },
    { name: 'Wisdom', borderColor: '#C4B5FD', bgColor: '#F5F3FF', titleColor: '#4C1D95', nameColor: '#5B21B6', textColor: '#3730A3', icon: '🦉' },
    { name: 'Stately', borderColor: '#D1D5DB', bgColor: '#F9FAFB', titleColor: '#1F2937', nameColor: '#374151', textColor: '#111827', icon: '🏛️' }
];

export const storybookThemes = [
    { name: 'Classic Fairytale', bg: '#FFFBEB', border: '#FBBF24', titleFont: "'Cinzel Decorative', cursive", bodyFont: "'Lora', serif", titleColor: '#B45309', textColor: '#78350F' },
    { name: 'Enchanted Forest', bg: '#F0FDF4', border: '#4ADE80', titleFont: "'Fredoka One', cursive", bodyFont: "'Georgia', serif", titleColor: '#15803D', textColor: '#14532D' },
    { name: 'Cosmic Adventure', bg: '#111827', border: '#6366F1', titleFont: "'Fredoka One', cursive", bodyFont: "'Open Sans', sans-serif", titleColor: '#A5B4FC', textColor: '#E5E7EB' },
    { name: 'Ocean Depths', bg: '#F0F9FF', border: '#38BDF8', titleFont: "'Fredoka One', cursive", bodyFont: "'Lora', serif", titleColor: '#0369A1', textColor: '#075985' },
    { name: 'Modern Comic', bg: '#FEE2E2', border: '#EF4444', titleFont: "'Fredoka One', cursive", bodyFont: "'Open Sans', sans-serif", titleColor: '#991B1B', textColor: '#450A0A', fontWeight: '600' }
];

// FIX 4: Added more color palettes for greater variety in the calendar
export const classColorPalettes = [
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
    { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300' },
    { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' },
    { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' }
];
