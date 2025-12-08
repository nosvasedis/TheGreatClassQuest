export const competitionStart = new Date('2025-11-01');
export const competitionEnd = new Date('2026-06-30');

export const firebaseConfig = {
  apiKey: "AIzaSyCxpouLYfm8woS8ToK8kRzndRvbIwsPuFU",
  authDomain: "the-great-class-quest.firebaseapp.com",
  projectId: "the-great-class-quest",
  storageBucket: "the-great-class-quest.firebasestorage.app",
  messagingSenderId: "1021026433595",
  appId: "1:1021026433595:web:d1bc4b6f45f01fe25c3a1e",
  measurementId: "G-QJZC4NGX75"
};

export const workerBaseUrl = 'https://gemini-proxy.nvasedis-cc5.workers.dev';
export const geminiModelPath = '/v1beta/models/gemini-2.5-flash:generateContent';
export const geminiApiUrl = `${workerBaseUrl}${geminiModelPath}`;
export const cloudflareWorkerUrl = 'https://great-class-quest-ai-proxy.nvasedis-cc5.workers.dev/';

export const questLeagues = ['Junior A', 'Junior B', 'A', 'B', 'C', 'D']; 

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
