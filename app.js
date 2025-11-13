// v7.0.1: MAJOR UPDATE - Scholar Scroll Fixes, Trial History UI, Avatar Enhancements, Move Student Feature
// v6.9.1: NEW AVATAR MAKER & STARFALL REVAMP
// v7.0.0: AWARD CEREMONY & DAY PLANNER
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc, 
    getDoc, 
    getDocs, 
    deleteDoc, 
    updateDoc,
    collection, 
    query, 
    where, 
    onSnapshot,
    serverTimestamp,
    writeBatch,
    setLogLevel,
    increment,
    runTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL STATE ---
let app, auth, db;
let currentUserId = null;
let currentTeacherName = null;
let allTeachersClasses = [];
let allSchoolClasses = [];
let allStudents = [];
let allStudentScores = [];   
let allAwardLogs = [];       
let allAdventureLogs = [];
let allQuestEvents = []; 
let allQuestAssignments = [];
let allWrittenScores = [];
let allAttendanceRecords = [];
let allScheduleOverrides = [];
// FIX #7: Sync Selected Class Across Tabs - Add global state variables
let globalSelectedClassId = null;
let globalSelectedLeague = null;
let isProgrammaticSelection = false;

let ceremonyState = {
    isActive: false,
    type: null,
    league: null,
    monthKey: null,
    data: [],
    step: -1,
    isFinalShowdown: false
};


let todaysAwardLogs = {};    

let todaysStars = {};
let todaysStarsDate = new Date().toLocaleDateString('en-GB');

let currentManagingClassId = null;

let studentLeaderboardView = 'class';
let studentStarMetric = 'monthly';

let allMonthlyHistory = {};

let currentlySelectedDayCell = null;

let currentLogFilter = { classId: null, month: '' };

let currentStoryData = {}; 
let unsubscribeStoryData = {}; 
let storyWeaverLockedWord = null; 

let allCompletedStories = [];
let currentStorybookAudio = null;

let avatarMakerData = {
    studentId: null,
    creature: null,
    color: null,
    accessory: null,
    generatedImage: null
};

let unsubscribeClasses = () => {};
let unsubscribeStudents = () => {};
let unsubscribeStudentScores = () => {}; 
let unsubscribeTodaysStars = () => {}; 
let unsubscribeAwardLogs = () => {};   
let unsubscribeQuestEvents = () => {}; 
let unsubscribeAdventureLogs = () => {};
let unsubscribeQuestAssignments = () => {};
let unsubscribeCompletedStories = () => {};
let unsubscribeWrittenScores = () => {};
let unsubscribeAttendance = () => {};
let unsubscribeScheduleOverrides = () => {};

let sounds = {};
let soundsReady = false;

let currentNarrativeAudio = null;

let ceremonyMusic = {};
let winnerFanfare = {};
let showdownSting = {};

const competitionStart = new Date('2025-11-01');
const competitionEnd = new Date('2026-06-30');
let calendarCurrentDate = new Date();
if (calendarCurrentDate < competitionStart) {
    calendarCurrentDate = new Date(competitionStart);
}

const firebaseConfig = {
  apiKey: "AIzaSyCxpouLYfm8woS8ToK8kRzndRvbIwsPuFU",
  authDomain: "the-great-class-quest.firebaseapp.com",
  projectId: "the-great-class-quest",
  storageBucket: "the-great-class-quest.firebasestorage.app",
  messagingSenderId: "1021026433595",
  appId: "1:1021026433595:web:d1bc4b6f45f01fe25c3a1e",
  measurementId: "G-QJZC4NGX75"
};

const workerBaseUrl = 'https://gemini-proxy.nvasedis-cc5.workers.dev';
const geminiModelPath = '/v1beta/models/gemini-2.5-flash-lite:generateContent';
const geminiApiUrl = `${workerBaseUrl}${geminiModelPath}`;

const elevenLabsVoiceId = "Xb7hH8MSUJpSbSDYk0k2"; // Alice - Clear and engaging
const elevenLabsApiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`;

const cloudflareWorkerUrl = 'https://great-class-quest-ai-proxy.nvasedis-cc5.workers.dev/';


const questLeagues = ['Junior A', 'Junior B', 'A', 'B', 'C', 'D']; 

const classLogos = [
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

const titleGradients = [
    'from-purple-600 to-pink-500',
    'from-cyan-500 to-blue-600',
    'from-green-500 to-teal-600',
    'from-yellow-500 to-orange-600',
    'from-red-500 to-rose-600'
];

const juniorCertificateStyles = [
    { name: 'Starlight', borderColor: '#FBBF24', bgColor: '#FFFBEB', titleColor: '#B45309', nameColor: '#D97706', textColor: '#92400E', icon: '⭐' },
    { name: 'Oceanic', borderColor: '#38BDF8', bgColor: '#F0F9FF', titleColor: '#0369A1', nameColor: '#0284C7', textColor: '#075985', icon: '🌊' },
    { name: 'Forest', borderColor: '#4ADE80', bgColor: '#F0FDF4', titleColor: '#15803D', nameColor: '#16A34A', textColor: '#14532D', icon: '🌳' },
    { name: 'Rocket', borderColor: '#F87171', bgColor: '#FEF2F2', titleColor: '#B91C1C', nameColor: '#DC2626', textColor: '#7F1D1D', icon: '🚀' },
    { name: 'Rainbow', borderColor: '#F472B6', bgColor: '#FEF2F5', titleColor: '#BE185D', nameColor: '#DB2777', textColor: '#831843', icon: '🌈' },
    { name: 'Dino', borderColor: '#F97316', bgColor: '#FFF7ED', titleColor: '#9A3412', nameColor: '#C2410C', textColor: '#7C2D12', icon: '🦖' }
];

const midCertificateStyles = [
    { name: 'Innovation', borderColor: '#A78BFA', bgColor: '#F5F3FF', titleColor: '#5B21B6', nameColor: '#7C3AED', textColor: '#4C1D95', icon: '💡' },
    { name: 'Victory', borderColor: '#FACC15', bgColor: '#FEFCE8', titleColor: '#854D0E', nameColor: '#A16207', textColor: '#713F12', icon: '🏆' },
    { name: 'Sparkle', borderColor: '#EC4899', bgColor: '#FDF2F8', titleColor: '#9D174D', nameColor: '#BE185D', textColor: '#831843', icon: '✨' },
    { name: 'Explorer', borderColor: '#22D3EE', bgColor: '#ECFEFF', titleColor: '#0E7490', nameColor: '#0891B2', textColor: '#155E75', icon: '🧭' },
    { name: 'Royal', borderColor: '#C084FC', bgColor: '#FAF5FF', titleColor: '#7E22CE', nameColor: '#9333EA', textColor: '#581C87', icon: '👑' }
];

const seniorCertificateStyles = [
    { name: 'Prestige', borderColor: '#BFDBFE', bgColor: '#EFF6FF', titleColor: '#1E3A8A', nameColor: '#1D4ED8', textColor: '#1E40AF', icon: '🥇' },
    { name: 'Scholarly', borderColor: '#A3A3A3', bgColor: '#FAFAFA', titleColor: '#404040', nameColor: '#525252', textColor: '#262626', icon: '📚' },
    { name: 'Global', borderColor: '#6EE7B7', bgColor: '#F0FDF4', titleColor: '#065F46', nameColor: '#047857', textColor: '#064E3B', icon: '🌍' },
    { name: 'Wisdom', borderColor: '#C4B5FD', bgColor: '#F5F3FF', titleColor: '#4C1D95', nameColor: '#5B21B6', textColor: '#3730A3', icon: '🦉' },
    { name: 'Stately', borderColor: '#D1D5DB', bgColor: '#F9FAFB', titleColor: '#1F2937', nameColor: '#374151', textColor: '#111827', icon: '🏛️' }
];

const storybookThemes = [
    { name: 'Classic Fairytale', bg: '#FFFBEB', border: '#FBBF24', titleFont: "'Cinzel Decorative', cursive", bodyFont: "'Lora', serif", titleColor: '#B45309', textColor: '#78350F' },
    { name: 'Enchanted Forest', bg: '#F0FDF4', border: '#4ADE80', titleFont: "'Fredoka One', cursive", bodyFont: "'Georgia', serif", titleColor: '#15803D', textColor: '#14532D' },
    { name: 'Cosmic Adventure', bg: '#111827', border: '#6366F1', titleFont: "'Fredoka One', cursive", bodyFont: "'Open Sans', sans-serif", titleColor: '#A5B4FC', textColor: '#E5E7EB' },
    { name: 'Ocean Depths', bg: '#F0F9FF', border: '#38BDF8', titleFont: "'Fredoka One', cursive", bodyFont: "'Lora', serif", titleColor: '#0369A1', textColor: '#075985' },
    { name: 'Modern Comic', bg: '#FEE2E2', border: '#EF4444', titleFont: "'Fredoka One', cursive", bodyFont: "'Open Sans', sans-serif", titleColor: '#991B1B', textColor: '#450A0A', fontWeight: '600' }
];

const classColorPalettes = [
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' }
];

// --- HELPER FUNCTIONS ---
function simpleHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function getDDMMYYYY(date = new Date()) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function parseDDMMYYYY(dateString) {
    if (!dateString || typeof dateString !== 'string') return new Date();
    const parts = dateString.split(/[-/]/);
    if (parts.length !== 3) return new Date();
    // Handle both YYYY-MM-DD and DD-MM-YYYY
    if (parts[0].length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
}

function getAgeGroupForLeague(league) {
    const leagueAges = {
        'Junior A': '7-8', 'Junior B': '8-9', 'A': '9-10', 'B': '10-11',
        'C': '11-12', 'D': '12-13'
    };
    return leagueAges[league] || 'all ages';
}

function getAgeCategoryForLeague(league) {
    if (league === 'Junior A' || league === 'Junior B') return 'junior';
    if (league === 'A' || league === 'B') return 'mid';
    return 'senior';
}

function getTodayDateString() {
     return getDDMMYYYY(new Date());
}

function getStartOfMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = month < 10 ? '0' + month : month;
    return `${year}-${monthStr}-01`;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function compressImageBase64(base64, maxWidth = 512, maxHeight = 512, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (error) => reject(error);
    });
}

function compressAvatarImageBase64(base64, targetSize = 256, quality = 0.85) { // CHANGED: Increased targetSize to 256 and quality to 0.85
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
            resolve(canvas.toDataURL('image/webp', quality));
        };
        img.onerror = (error) => reject(error);
    });
}

function getClassesOnDay(dateString) {
    const day = parseDDMMYYYY(dateString).getDay().toString();
    let classes = allSchoolClasses.filter(c => c.scheduleDays && c.scheduleDays.includes(day));
    const overridesForDay = allScheduleOverrides.filter(o => o.date === dateString);
    const cancelledClassIds = overridesForDay.filter(o => o.type === 'cancelled').map(o => o.classId);
    classes = classes.filter(c => !cancelledClassIds.includes(c.id));
    const oneTimeClassIds = overridesForDay.filter(o => o.type === 'one-time').map(o => o.classId);
    oneTimeClassIds.forEach(classId => {
        if (!classes.some(c => c.id === classId)) {
            const classToAdd = allSchoolClasses.find(c => c.id === classId);
            if (classToAdd) classes.push(classToAdd);
        }
    });
    return classes.sort((a, b) => (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99'));
}

// --- SOUND FUNCTIONS ---
async function setupSounds() {
    try {
        await Tone.start();
        const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.3 }).toDestination();
        sounds.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05 } }).toDestination();
        sounds.confirm = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.0, release: 0.2 }, volume: -15 }).toDestination();
        sounds.star_remove = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.01, release: 0.3 }, volume: -10 }).toDestination();
        sounds.click.volume.value = -25;
        
        sounds.writing = new Tone.NoiseSynth({ noise: { type: "white", playbackRate: 0.5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -20 }).toDestination();
        sounds.magic_chime = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 2000, resonance: 0.9, volume: -12 }).connect(reverb);

        sounds.star1 = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.7, volume: -10 }).connect(reverb);
        sounds.star2 = new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.8, volume: -8 }).connect(reverb);
        
        sounds.star3 = new Tone.FMSynth({
            harmonicity: 3,
            modulationIndex: 10,
            detune: 0,
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
            modulation: { type: "square" },
            modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.4 },
            volume: -5 
        }).connect(reverb);
        
        ceremonyMusic = new Tone.Player({
            url: "ceremony_reveal.mp3",
            loop: true,
            volume: -12,
        }).toDestination();

        winnerFanfare = new Tone.Player({
            url: "ceremony_winner.mp3",
            volume: -3,
        }).toDestination();

        
        showdownSting = new Tone.Player({
            url: "ceremony_showdown.mp3",
            volume: -6,
        }).toDestination();
        
        await Tone.loaded();

        soundsReady = true;
    } catch (e) {
        console.error('Failed to initialize sounds:', e);
        soundsReady = false;
    }
}

function playSound(sound) {
    if (!soundsReady || Tone.context.state !== 'running') return;
    if (!sounds[sound]) return;
    try {
        if (sound === 'click') sounds.click.triggerAttackRelease('C5', '8n');
        else if (sound === 'star1') sounds.star1.triggerAttackRelease('C6', '16n');
        else if (sound === 'star2') {
            sounds.star2.triggerAttackRelease('E6', '16n', Tone.now());
            sounds.star2.triggerAttackRelease('G6', '16n', Tone.now() + 0.05);
        } else if (sound === 'star3') {
            sounds.star3.triggerAttackRelease('C6', '16n', Tone.now());
            sounds.star3.triggerAttackRelease('E6', '16n', Tone.now() + 0.05);
            sounds.star3.triggerAttackRelease('G6', '16n', Tone.now() + 0.1);
            sounds.star3.triggerAttackRelease('C7', '16n', Tone.now() + 0.15);
        } else if (sound === 'star_remove') sounds.star_remove.triggerAttackRelease('8n');
        else if (sound === 'confirm') sounds.confirm.triggerAttackRelease('E4', '8n');
        else if (sound === 'writing') sounds.writing.triggerAttackRelease('4n');
        else if (sound === 'magic_chime') sounds.magic_chime.triggerAttackRelease('C7', '8n');
    } catch (e) { console.error('Sound play error:', e); }
}

// --- API CALL FUNCTIONS ---
async function callGeminiApi(systemPrompt, userPrompt) {
    const payload = { contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, };
    try {
        const response = await fetchWithBackoff(geminiApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) return candidate.content.parts[0].text;
        else throw new Error('Invalid AI response structure');
    } catch (error) {
        console.error('Error in callGeminiApi:', error);
        console.log("--- FAILED AI PROMPT ---");
        console.log("System Prompt:", systemPrompt);
        console.log("User Prompt:", userPrompt);
        console.log("-----------------------");
        throw error;
    }
}

async function callElevenLabsTtsApi(textToSpeak) {
    const payload = {
        text: textToSpeak,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true
        }
    };

    try {
        const response = await fetch(cloudflareWorkerUrl, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TTS Worker API error: ${response.status} - ${errorText || 'Unknown error'}`);
        }
        return await response.blob();
    } catch (error) {
        console.error('Error in callElevenLabsTtsApi (via worker):', error);
        throw error;
    }
}

async function callCloudflareAiImageApi(prompt) {
    const payload = {
        prompt: prompt
    };
    try {
        const response = await fetch(cloudflareWorkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare AI API error! status: ${response.status}, message: ${errorText}`);
        }

        const imageBlob = await response.blob();
        return await blobToBase64(imageBlob);

    } catch (error) {
        console.error('Error in callCloudflareAiImageApi:', error);
        throw error;
    }
}


async function fetchWithBackoff(url, options, retries = 3, delay = 1000) {
    try {
        const response = await fetch(url, options);
        if (response.status === 429 || response.status >= 500) {
            if (retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return fetchWithBackoff(url, options, retries - 1, delay * 2);
            } else throw new Error('API call failed after retries');
        }
        return response;
    } catch (error) {
         if (retries > 0) {
            await new Promise(res => setTimeout(res, delay));
            return fetchWithBackoff(url, options, retries - 1, delay * 2);
        } else {
            console.error('Fetch error:', error);
            throw error;
        }
    }
}

function activateAudioContext() {
    if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
        Tone.start().catch(e => console.error('Failed to resume audio context:', e));
    }
}

// --- AUTHENTICATION ---
function setupAuthListeners() {
    document.body.addEventListener('mousedown', activateAudioContext, { once: true });
    document.body.addEventListener('touchstart', activateAudioContext, { once: true });

    document.getElementById('toggle-auth-mode').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') playSound('click'); 
        const login = document.getElementById('login-form');
        const signup = document.getElementById('signup-form');
        const title = document.getElementById('auth-title');
        const toggleBtn = document.getElementById('toggle-auth-mode');
        
        if (login.classList.contains('hidden')) {
            login.classList.remove('hidden');
            signup.classList.add('hidden');
            title.innerText = 'Teacher Login';
            toggleBtn.innerText = 'Need an account? Sign Up';
        } else {
            login.classList.add('hidden');
            signup.classList.remove('hidden');
            title.innerText = 'Teacher Sign Up';
            toggleBtn.innerText = 'Already have an account? Login';
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        playSound('click'); 
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        playSound('click'); 
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            currentTeacherName = name;
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        playSound('click');
        await signOut(auth);
    });

    onAuthStateChanged(auth, async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        const authScreen = document.getElementById('auth-screen');
        const appScreen = document.getElementById('app-screen');
        
        if (user) {
            currentUserId = user.uid;
            currentTeacherName = user.displayName;
            document.getElementById('teacher-greeting').innerText = `Welcome, ${currentTeacherName || 'Teacher'}!`;
            if (document.getElementById('teacher-name-input')) document.getElementById('teacher-name-input').value = currentTeacherName || '';
            const newDate = getTodayDateString();
            await archivePreviousDayStars(user.uid, newDate);
            if (newDate !== todaysStarsDate) {
                todaysStars = {};
                todaysStarsDate = newDate;
            }
            setupDataListeners(user.uid, newDate);
            appScreen.classList.remove('hidden');
            authScreen.classList.add('hidden');
            showTab('about-tab'); 
            renderCalendarTab();
            
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);
        } else {
            currentUserId = null;
            currentTeacherName = null;
            allTeachersClasses = [];
            allSchoolClasses = [];
            allStudents = [];
            allStudentScores = []; 
            allQuestEvents = [];
            allAdventureLogs = [];
            allQuestAssignments = [];
            allCompletedStories = [];
            allWrittenScores = [];
            allAttendanceRecords = [];
            allScheduleOverrides = [];
            todaysStars = {};
            allAwardLogs = []; 
            todaysAwardLogs = {}; 
            currentStoryData = {};
            Object.values(unsubscribeStoryData).forEach(unsub => unsub());
            unsubscribeStoryData = {};
            unsubscribeClasses();
            unsubscribeStudents();
            unsubscribeStudentScores(); 
            unsubscribeTodaysStars();
            unsubscribeAwardLogs(); 
            unsubscribeQuestEvents();
            unsubscribeAdventureLogs();
            unsubscribeQuestAssignments();
            unsubscribeCompletedStories();
            unsubscribeWrittenScores();
            unsubscribeAttendance();
            unsubscribeScheduleOverrides();
            appScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
            
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);
        }
    });
}

// --- UI (MODALS, TABS, ETC) ---
function setupUIListeners() {
    document.body.addEventListener('click', (e) => {
        // FIX #6: Enlarge Avatar on Click
        handleAvatarClick(e);

        let target = e.target;
        while (target && target !== document.body) {
            if (target.classList && (target.classList.contains('bubbly-button') || target.classList.contains('about-tab-switcher'))) {
                if (!target.classList.contains('star-award-btn') && target.type !== 'submit') playSound('click');
                return;
            }
            target = target.parentNode;
        }
    });

    document.getElementById('bottom-nav-bar').addEventListener('click', (e) => {
        const target = e.target.closest('.nav-button');
        if (target) {
            playSound('click'); 
            showTab(target.dataset.tab);
        }
    });

    const studentBtn = document.getElementById('about-btn-students');
    const teacherBtn = document.getElementById('about-btn-teachers');

    studentBtn.addEventListener('click', () => {
        document.getElementById('about-students').classList.remove('hidden');
        document.getElementById('about-teachers').classList.add('hidden');
        
        studentBtn.classList.add('bg-cyan-500', 'text-white', 'shadow-md');
        studentBtn.classList.remove('text-cyan-700', 'bg-white');

        teacherBtn.classList.remove('bg-green-500', 'text-white', 'shadow-md');
        teacherBtn.classList.add('text-green-700', 'bg-white');
    });

    teacherBtn.addEventListener('click', () => {
        document.getElementById('about-teachers').classList.remove('hidden');
        document.getElementById('about-students').classList.add('hidden');

        teacherBtn.classList.add('bg-green-500', 'text-white', 'shadow-md');
        teacherBtn.classList.remove('text-green-700', 'bg-white');

        studentBtn.classList.remove('bg-cyan-500', 'text-white', 'shadow-md');
        studentBtn.classList.add('text-cyan-700', 'bg-white');
    });

    document.getElementById('back-to-classes-btn').addEventListener('click', () => showTab('my-classes-tab'));
    document.getElementById('modal-cancel-btn').addEventListener('click', () => hideModal('confirmation-modal'));
    
    // FIX #7: Sync Selected Class Across Tabs - Update League Pickers to use global state
    document.getElementById('leaderboard-league-picker-btn').addEventListener('click', () => showLeaguePicker(true));
    document.getElementById('student-leaderboard-league-picker-btn').addEventListener('click', () => showLeaguePicker(true));
    document.getElementById('league-picker-close-btn').addEventListener('click', () => hideModal('league-picker-modal'));
    
    document.getElementById('logo-picker-btn').addEventListener('click', () => showLogoPicker('create'));
    document.getElementById('edit-logo-picker-btn').addEventListener('click', () => showLogoPicker('edit'));
    document.getElementById('logo-picker-close-btn').addEventListener('click', () => hideModal('logo-picker-modal'));

    document.getElementById('add-class-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddClass(); });
    document.getElementById('add-student-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddStudent(); });
    document.getElementById('edit-class-form').addEventListener('submit', (e) => { e.preventDefault(); handleEditClass(); });
    document.getElementById('edit-class-cancel-btn').addEventListener('click', () => hideModal('edit-class-modal'));
    
    document.getElementById('prev-month-btn').addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('next-month-btn').addEventListener('click', () => changeCalendarMonth(1));
    
    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('gemini-idea-btn').addEventListener('click', handleGenerateIdea);
    document.getElementById('gemini-class-select').addEventListener('change', (e) => {
        document.getElementById('gemini-idea-btn').disabled = !e.target.value;
        setGlobalSelectedClass(e.target.value, true);
    });
    document.getElementById('copy-idea-btn').addEventListener('click', () => copyToClipboard('gemini-idea-output'));
    
    document.getElementById('generate-class-name-btn').addEventListener('click', handleGenerateClassName);
    document.getElementById('class-level').addEventListener('change', () => { document.getElementById('generate-class-name-btn').disabled = !document.getElementById('class-level').value; });
    document.getElementById('class-name-suggestions').addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            document.getElementById('class-name').value = e.target.innerText;
            document.getElementById('class-name-suggestions').innerHTML = '';
        }
    });

    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('award-class-dropdown-btn').addEventListener('click', toggleAwardClassDropdown);
    document.getElementById('award-class-list').addEventListener('click', (e) => {
        const target = e.target.closest('.award-class-item');
        if (target) {
            playSound('click');
            setGlobalSelectedClass(target.dataset.id, true);
            toggleAwardClassDropdown();
        }
    });
    
    document.getElementById('overview-modal-close-btn').addEventListener('click', () => hideModal('overview-modal'));
    document.getElementById('overview-modal-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.overview-tab-btn');
        if (btn) {
            const classId = document.getElementById('overview-modal').dataset.classId;
            const view = btn.dataset.view;
            
            document.querySelectorAll('.overview-tab-btn').forEach(b => {
                b.classList.remove('border-purple-500', 'text-purple-600');
                b.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            btn.classList.add('border-purple-500', 'text-purple-600');
            btn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            
            renderOverviewContent(classId, view);
        }
    });
    
    document.getElementById('award-stars-student-list').addEventListener('click', async (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const studentCard = actionBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const student = allStudents.find(s => s.id === studentId);
            
            if (actionBtn.dataset.action === 'mark-absent') {
                playSound('click');
                await handleMarkAbsent(studentId, student.classId, true);
                return;
            }

            if (actionBtn.dataset.action === 'mark-present') {
                playSound('click');
                await handleMarkAbsent(studentId, student.classId, false);
                return;
            }

            if (actionBtn.dataset.action === 'welcome-back') {
                const stars = Math.random() < 0.5 ? 0.5 : 1;
                const firstName = student.name.split(' ')[0];
                playSound('star2');
                
                try {
                    const publicDataPath = "artifacts/great-class-quest/public/data";
                    const lastLessonDate = getLastLessonDate(student.classId);
                    const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`), where("studentId", "==", studentId), where("date", "==", lastLessonDate));
                    const attendanceSnapshot = await getDocs(attendanceQuery);

                    await runTransaction(db, async (transaction) => {
                        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
                        const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));
                        
                        attendanceSnapshot.forEach(doc => transaction.delete(doc.ref));

                        transaction.update(scoreRef, {
                            totalStars: increment(stars),
                            monthlyStars: increment(stars)
                        });

                        const logData = {
                            studentId, classId: student.classId, teacherId: currentUserId,
                            stars: stars, reason: 'welcome_back', date: getTodayDateString(),
                            createdAt: serverTimestamp(), createdBy: { uid: currentUserId, name: currentTeacherName }
                        };
                        transaction.set(newLogRef, logData);
                    });
                    
                    showWelcomeBackMessage(firstName, stars);

                } catch (error) {
                    console.error("Welcome back bonus transaction failed:", error);
                    showToast('Could not apply welcome back bonus. Please try again.', 'error');
                }
                
                return;
            }
        }
        
        const reasonBtn = e.target.closest('.reason-btn');
        const starBtn = e.target.closest('.star-award-btn');
        const undoBtn = e.target.closest('.post-award-undo-btn');

        if (undoBtn) {
            const studentId = undoBtn.closest('.student-cloud-card').dataset.studentid;
            await setStudentStarsForToday(studentId, 0, null);
            playSound('star_remove');
            return;
        }

        if (reasonBtn) {
            const studentCard = reasonBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            
            if (todaysStars[studentId]?.stars > 0) {
                showToast('Please use the undo button to change today\'s stars.', 'info');
                return;
            }

            const starSelector = studentCard.querySelector('.star-selector-container');
            const allReasonBtns = studentCard.querySelectorAll('.reason-btn');

            if (reasonBtn.classList.contains('active')) {
                reasonBtn.classList.remove('active');
                starSelector.classList.remove('visible');
            } else {
                allReasonBtns.forEach(btn => btn.classList.remove('active'));
                reasonBtn.classList.add('active');
                starSelector.classList.add('visible');
                reasonBtn.classList.add('animate-reason-select');
                const randomAngle = Math.random() * 2 * Math.PI;
                reasonBtn.style.setProperty('--x', `${Math.cos(randomAngle) * 60}px`);
                reasonBtn.style.setProperty('--y', `${Math.sin(randomAngle) * 60}px`);
                reasonBtn.addEventListener('animationend', () => {
                    reasonBtn.classList.remove('animate-reason-select');
                }, { once: true });
            }
            return;
        }

        if (starBtn) {
            const studentCard = starBtn.closest('.student-cloud-card');
            const studentId = studentCard.dataset.studentid;
            const activeReasonBtn = studentCard.querySelector('.reason-btn.active');
            
            if (!activeReasonBtn) {
                 showToast('Please select a reason first!', 'info');
                 return;
            }

            const reason = activeReasonBtn.dataset.reason;
            const starValue = parseInt(starBtn.dataset.stars);
            const student = allStudents.find(s => s.id === studentId);

            triggerAwardEffects(starBtn, starValue);

            await setStudentStarsForToday(studentId, starValue, reason);
            triggerDynamicPraise(student.name, starValue, reason);
            
            updateAwardCardState(studentId, todaysStars[studentId]?.stars || starValue, reason);
            
            return;
        }
    });

    document.getElementById('save-teacher-name-btn').addEventListener('click', (e) => { e.preventDefault(); handleSaveTeacherName(); });

    document.getElementById('star-manager-student-select').addEventListener('change', handleStarManagerStudentSelect);
    document.getElementById('star-manager-add-btn').addEventListener('click', handleAddStarsManually);
    document.getElementById('star-manager-purge-btn').addEventListener('click', handlePurgeStudentStars);
    document.getElementById('star-manager-override-btn').addEventListener('click', handleSetStudentScores);

    document.getElementById('view-by-league').addEventListener('click', () => {
        studentLeaderboardView = 'league';
        renderStudentLeaderboardTab();
        document.getElementById('view-by-league').classList.add('bg-purple-500', 'text-white');
        document.getElementById('view-by-class').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('view-by-class').classList.add('bg-gray-300', 'text-gray-800');
    });
    document.getElementById('view-by-class').addEventListener('click', () => {
        studentLeaderboardView = 'class';
        renderStudentLeaderboardTab();
        document.getElementById('view-by-class').classList.add('bg-purple-500', 'text-white');
        document.getElementById('view-by-league').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('view-by-league').classList.add('bg-gray-300', 'text-gray-800');
    });
    
    document.getElementById('metric-monthly').addEventListener('click', () => {
        studentStarMetric = 'monthly';
        renderStudentLeaderboardTab();
        document.getElementById('metric-monthly').classList.add('bg-purple-500', 'text-white');
        document.getElementById('metric-total').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('metric-total').classList.add('bg-gray-300', 'text-gray-800');
    });
    document.getElementById('metric-total').addEventListener('click', () => {
        studentStarMetric = 'total';
        renderStudentLeaderboardTab();
        document.getElementById('metric-total').classList.add('bg-purple-500', 'text-white');
        document.getElementById('metric-monthly').classList.remove('bg-purple-500', 'text-white');
        document.getElementById('metric-monthly').classList.add('bg-gray-300', 'text-gray-800');
    });

    document.getElementById('logbook-modal-close-btn').addEventListener('click', () => hideModal('logbook-modal'));
    document.getElementById('logbook-modal-content').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-log-btn');
        if (deleteBtn) {
            const { logId, studentId, stars } = deleteBtn.dataset;
            handleDeleteAwardLog(logId, studentId, parseInt(stars));
        }
        const noteBtn = e.target.closest('.note-log-btn');
        if(noteBtn) {
            openAwardNoteModal(noteBtn.dataset.logId);
        }
    });
    
    document.getElementById('calendar-grid').addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day-cell');
        const deleteBtn = e.target.closest('.delete-event-btn');
    
        if (deleteBtn) {
            e.stopPropagation();
            const eventId = deleteBtn.dataset.id;
            const eventName = deleteBtn.dataset.name;
            showModal('Delete Event?', `Are you sure you want to delete the "${eventName}" event?`, () => handleDeleteQuestEvent(eventId));
            return;
        }
    
        if (!dayCell) return;
        
        if (dayCell.classList.contains('future-day')) {
            openDayPlannerModal(dayCell.dataset.date, dayCell);
        } else if (dayCell.classList.contains('logbook-day-btn')) {
            showLogbookModal(dayCell.dataset.date);
        }
    });

    document.getElementById('day-planner-close-btn').addEventListener('click', () => hideModal('day-planner-modal'));
    document.getElementById('day-planner-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.day-planner-tab-btn');
        if (btn) {
            switchDayPlannerTab(btn.dataset.tab);
        }
    });
    document.getElementById('add-onetime-lesson-btn').addEventListener('click', () => {
        const dateString = document.getElementById('day-planner-modal').dataset.date;
        handleAddOneTimeLesson(dateString);
    });

    document.getElementById('purge-logs-btn').addEventListener('click', () => {
        showModal('Purge All My Logs?', 'Are you sure you want to delete all your historical award log entries? This cannot be undone.', () => handlePurgeAwardLogs());
    });
    document.getElementById('erase-today-btn').addEventListener('click', () => {
        showModal('Erase Today\'s Stars?', 'Are you sure you want to remove all stars you awarded today?', () => handleEraseTodaysStars());
    });

    document.getElementById('class-history-btn').addEventListener('click', () => openHistoryModal());
    document.getElementById('student-history-btn').addEventListener('click', () => openHistoryModal());
    document.getElementById('history-modal-close-btn').addEventListener('click', () => hideModal('history-modal'));
    document.getElementById('history-month-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value));

    document.getElementById('quest-event-form').addEventListener('submit', (e) => { e.preventDefault(); handleAddQuestEvent(); });
    
    document.getElementById('quest-event-type').addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const description = selectedOption.dataset.description;
        const descriptionEl = document.getElementById('quest-event-description');
        
        if (description) {
            descriptionEl.textContent = description;
            descriptionEl.classList.remove('hidden');
        } else {
            descriptionEl.classList.add('hidden');
        }
        renderQuestEventDetails();
    });
    
    document.getElementById('report-modal-close-btn').addEventListener('click', () => hideModal('report-modal'));

    document.getElementById('certificate-modal-close-btn').addEventListener('click', () => hideModal('certificate-modal'));
    document.getElementById('download-certificate-btn').addEventListener('click', downloadCertificateAsPdf);

    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('oracle-class-select').addEventListener('change', (e) => {
        document.getElementById('oracle-insight-btn').disabled = !e.target.value;
        setGlobalSelectedClass(e.target.value, true);
    });
    document.getElementById('oracle-insight-btn').addEventListener('click', handleGetOracleInsight);

    document.getElementById('get-quest-update-btn').addEventListener('click', handleGetQuestUpdate);
    document.getElementById('play-narrative-btn').addEventListener('click', playNarrative);
    document.getElementById('quest-update-close-btn').addEventListener('click', () => hideModal('quest-update-modal'));
    
    document.getElementById('milestone-modal-close-btn').addEventListener('click', () => hideModal('milestone-details-modal'));

    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('adventure-log-class-select').addEventListener('change', (e) => {
        setGlobalSelectedClass(e.target.value, true);
        document.getElementById('log-adventure-btn').disabled = !e.target.value;
        document.getElementById('quest-assignment-btn').disabled = !e.target.value;
        document.getElementById('attendance-chronicle-btn').disabled = !e.target.value;
        currentLogFilter.classId = e.target.value;
        renderAdventureLog();
    });
    document.getElementById('adventure-log-month-filter').addEventListener('change', (e) => {
        currentLogFilter.month = e.target.value;
        renderAdventureLog();
    });
    document.getElementById('log-adventure-btn').addEventListener('click', handleLogAdventure);
    document.getElementById('attendance-chronicle-btn').addEventListener('click', openAttendanceChronicle);
    document.getElementById('attendance-chronicle-close-btn').addEventListener('click', () => hideModal('attendance-chronicle-modal'));

    document.getElementById('adventure-log-feed').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.log-delete-btn');
        const noteBtn = e.target.closest('.log-note-btn');
        if (deleteBtn) {
            handleDeleteLog(deleteBtn.dataset.logId);
        }
        if (noteBtn) {
            openNoteModal(noteBtn.dataset.logId);
        }
    });
    document.getElementById('quest-assignment-btn').addEventListener('click', openQuestAssignmentModal);

    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('scroll-class-select').addEventListener('change', (e) => {
        setGlobalSelectedClass(e.target.value, true);
        renderScholarsScrollTab(e.target.value);
    });
    document.getElementById('log-trial-btn').addEventListener('click', () => openLogTrialModal(document.getElementById('scroll-class-select').value));
    document.getElementById('log-trial-form').addEventListener('submit', (e) => { e.preventDefault(); handleLogTrial(); });
    document.getElementById('log-trial-cancel-btn').addEventListener('click', () => hideModal('log-trial-modal'));
    document.getElementById('log-trial-type').addEventListener('change', renderLogTrialScoreInput);
    document.getElementById('log-trial-date').addEventListener('change', (e) => {
        const classId = document.getElementById('log-trial-class-id').value;
        const date = e.target.value;
        const titleInput = document.getElementById('log-trial-title');
        if (titleInput) {
            const existingScore = allWrittenScores.find(s => s.classId === classId && s.date === date && s.type === 'test' && s.title);
            if (existingScore) {
                titleInput.value = existingScore.title;
            }
        }
    });
    document.getElementById('starfall-cancel-btn').addEventListener('click', () => hideModal('starfall-modal'));
    
    document.getElementById('view-trial-history-btn').addEventListener('click', () => openTrialHistoryModal(document.getElementById('scroll-class-select').value));
    document.getElementById('trial-history-close-btn').addEventListener('click', () => hideModal('trial-history-modal'));


    document.getElementById('edit-student-name-cancel-btn').addEventListener('click', () => hideModal('edit-student-name-modal'));
    document.getElementById('edit-student-name-confirm-btn').addEventListener('click', handleEditStudentName);
    document.getElementById('note-cancel-btn').addEventListener('click', () => hideModal('note-modal'));
    document.getElementById('note-confirm-btn').addEventListener('click', handleSaveNote);
    document.getElementById('award-note-cancel-btn').addEventListener('click', () => hideModal('award-note-modal'));
    document.getElementById('award-note-confirm-btn').addEventListener('click', handleSaveAwardNote);
    document.getElementById('story-input-cancel-btn').addEventListener('click', () => hideModal('story-input-modal'));
    document.getElementById('story-input-confirm-btn').addEventListener('click', handleLockInSentence);
    document.getElementById('quest-assignment-cancel-btn').addEventListener('click', () => hideModal('quest-assignment-modal'));
    document.getElementById('quest-assignment-confirm-btn').addEventListener('click', handleSaveQuestAssignment);

    document.getElementById('story-weavers-word-input').addEventListener('input', (e) => {
        if (e.target.value.trim() !== '') {
            showWordEditorControls();
        } else {
            hideWordEditorControls();
        }
    });
    document.getElementById('story-weavers-confirm-word-btn').addEventListener('click', () => {
        const input = document.getElementById('story-weavers-word-input');
        storyWeaverLockedWord = input.value.trim();
        if (storyWeaverLockedWord) {
            input.classList.add('bg-green-100', 'border-green-400', 'font-bold');
            document.getElementById('story-weavers-suggest-word-btn').disabled = true;
            document.getElementById('story-weavers-lock-in-btn').disabled = false;
            document.getElementById('story-weavers-end-btn').disabled = false;
            hideWordEditorControls(true);
            playSound('confirm');
        }
    });
    document.getElementById('story-weavers-clear-word-btn').addEventListener('click', () => {
        resetStoryWeaverWordUI();
        playSound('click');
    });

    // FIX #7: Sync Selected Class Across Tabs
    document.getElementById('story-weavers-class-select').addEventListener('change', (e) => {
        setGlobalSelectedClass(e.target.value, true);
        handleStoryWeaversClassSelect();
    });
    document.getElementById('story-weavers-suggest-word-btn').addEventListener('click', handleSuggestWord);
    document.getElementById('story-weavers-lock-in-btn').addEventListener('click', openStoryInputModal);
    document.getElementById('story-weavers-end-btn').addEventListener('click', handleEndStory);
    document.getElementById('story-weavers-reveal-btn').addEventListener('click', handleRevealStory);
    document.getElementById('story-weavers-history-btn').addEventListener('click', handleShowStoryHistory);
    document.getElementById('story-weavers-archive-btn').addEventListener('click', openStoryArchiveModal);
    document.getElementById('story-weavers-reset-btn').addEventListener('click', handleResetStory);
    document.getElementById('story-reveal-close-btn').addEventListener('click', () => hideModal('story-reveal-modal'));
    document.getElementById('story-history-close-btn').addEventListener('click', () => hideModal('story-history-modal'));
    document.getElementById('story-archive-close-btn').addEventListener('click', () => hideModal('story-archive-modal'));
    document.getElementById('storybook-viewer-close-btn').addEventListener('click', () => hideModal('storybook-viewer-modal'));
    
    document.getElementById('story-archive-list').addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-storybook-btn');
        if (viewBtn) {
            openStorybookViewer(viewBtn.dataset.storyId);
        }
    });

    document.getElementById('avatar-maker-close-btn').addEventListener('click', () => hideModal('avatar-maker-modal'));
    document.getElementById('avatar-creature-pool').addEventListener('click', (e) => handleAvatarOptionSelect(e, 'creature'));
    document.getElementById('avatar-color-pool').addEventListener('click', (e) => handleAvatarOptionSelect(e, 'color'));
    document.getElementById('avatar-accessory-pool').addEventListener('click', (e) => handleAvatarOptionSelect(e, 'accessory'));
    document.getElementById('avatar-generate-btn').addEventListener('click', handleGenerateAvatar);
    document.getElementById('avatar-retry-btn').addEventListener('click', handleGenerateAvatar);
    document.getElementById('avatar-save-btn').addEventListener('click', handleSaveAvatar);
    document.getElementById('avatar-delete-btn').addEventListener('click', handleDeleteAvatar);

    // New listener for moving a student
    document.getElementById('move-student-confirm-btn').addEventListener('click', handleMoveStudent);
    document.getElementById('move-student-cancel-btn').addEventListener('click', () => hideModal('move-student-modal'));
}

// --- DATA LISTENERS (Real-time) ---
function setupDataListeners(userId, dateString) {
    unsubscribeClasses();
    unsubscribeStudents();
    unsubscribeStudentScores();
    unsubscribeTodaysStars();
    unsubscribeAwardLogs();
    unsubscribeQuestEvents();
    unsubscribeAdventureLogs();
    unsubscribeQuestAssignments();
    unsubscribeCompletedStories();
    unsubscribeWrittenScores();
    unsubscribeAttendance();
    unsubscribeScheduleOverrides();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const classesQuery = query(collection(db, `${publicDataPath}/classes`));
    const studentsQuery = query(collection(db, `${publicDataPath}/students`));
    const scoresQuery = query(collection(db, `${publicDataPath}/student_scores`));
    const awardLogsQuery = query(collection(db, `${publicDataPath}/award_log`));
    const todaysStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where('teacherId', '==', userId));
    const questEventsQuery = query(collection(db, `${publicDataPath}/quest_events`));
    const adventureLogsQuery = query(collection(db, `${publicDataPath}/adventure_logs`), orderBy('date', 'desc'));
    const questAssignmentsQuery = query(collection(db, `${publicDataPath}/quest_assignments`), where('createdBy.uid', '==', userId));
    const completedStoriesQuery = query(collection(db, `${publicDataPath}/completed_stories`), orderBy('completedAt', 'desc'));
    const writtenScoresQuery = query(collection(db, `${publicDataPath}/written_scores`), orderBy('date', 'desc'));
    const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`));
    const overridesQuery = query(collection(db, `${publicDataPath}/schedule_overrides`));

    unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
        allSchoolClasses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        allTeachersClasses = allSchoolClasses.filter(c => c.createdBy?.uid === userId);
        findAndSetCurrentLeague();
        renderClassLeaderboardTab();
        renderManageClassesTab();
        renderCalendarTab();
        renderAwardStarsTab(); 
        renderIdeasTabSelects(); 
        renderAdventureLogTab();
        renderScholarsScrollTab();
        if (!document.getElementById('options-tab').classList.contains('hidden')) renderStarManagerStudentSelect();
    }, (error) => console.error("Error listening to classes:", error));

    unsubscribeStudents = onSnapshot(studentsQuery, async (snapshot) => {
        let listNeedsRebuild = false;
        snapshot.docChanges().forEach(change => {
            const studentData = { id: change.doc.id, ...change.doc.data() };
            listNeedsRebuild = true;
            if (change.type === "added") allStudents.push(studentData);
            if (change.type === "removed") allStudents = allStudents.filter(s => s.id !== studentData.id);
            if (change.type === "modified") {
                const index = allStudents.findIndex(s => s.id === studentData.id);
                if (index > -1) allStudents[index] = studentData;
                else allStudents.push(studentData); 
            }
        });
        
        if (listNeedsRebuild) {
            allStudents.sort((a,b) => a.name.localeCompare(b.name));
            renderStudentLeaderboardTab();
            renderClassLeaderboardTab();
            renderManageStudentsTab();
            renderAwardStarsStudentList(document.getElementById('award-class-dropdown-btn')?.dataset.selectedId); 
            renderScholarsScrollTab(document.getElementById('scroll-class-select')?.value);
            if (!document.getElementById('options-tab').classList.contains('hidden')) renderStarManagerStudentSelect();
        }
    }, (error) => console.error("Error listening to students:", error));

    unsubscribeStudentScores = onSnapshot(scoresQuery, (snapshot) => {
        const currentMonthStart = getStartOfMonthString();
        snapshot.docChanges().forEach(change => {
            const scoreData = { id: change.doc.id, ...change.doc.data() };
            const studentId = scoreData.id;
            const index = allStudentScores.findIndex(s => s.id === studentId);
            if (change.type === "removed") { if (index > -1) allStudentScores.splice(index, 1); }
            else {
                if (index > -1) allStudentScores[index] = scoreData;
                else allStudentScores.push(scoreData);
            }
            if (scoreData.lastMonthlyResetDate !== currentMonthStart) checkAndResetMonthlyStars(studentId, currentMonthStart);
            const monthlyEl = document.getElementById(`monthly-stars-${studentId}`);
            const totalEl = document.getElementById(`total-stars-${studentId}`);
            if (monthlyEl && monthlyEl.textContent != (scoreData.monthlyStars || 0)) {
                monthlyEl.textContent = scoreData.monthlyStars || 0;
                monthlyEl.closest('.counter-bubble')?.classList.add('counter-animate');
            }
            if (totalEl && totalEl.textContent != (scoreData.totalStars || 0)) {
                totalEl.textContent = scoreData.totalStars || 0;
                totalEl.closest('.counter-bubble')?.classList.add('counter-animate');
            }
        });
        renderStudentLeaderboardTab();
        renderClassLeaderboardTab();
        handleStarManagerStudentSelect();
    }, (error) => console.error("Error listening to student_scores:", error));

    unsubscribeTodaysStars = onSnapshot(todaysStarsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const starData = change.doc.data();
            const studentId = starData.studentId;
            const isForToday = starData.date === dateString;
            
            if (change.type === "removed") {
                if (todaysStars[studentId]) {
                    delete todaysStars[studentId];
                    updateAwardCardState(studentId, 0, null);
                }
            } else { 
                if (isForToday) {
                    todaysStars[studentId] = { docId: change.doc.id, stars: starData.stars, reason: starData.reason };
                    updateAwardCardState(studentId, starData.stars, starData.reason);
                } else {
                     if (todaysStars[studentId]) {
                        delete todaysStars[studentId];
                        updateAwardCardState(studentId, 0, null);
                     }
                }
            }
        });
        handleStarManagerStudentSelect();
    }, (error) => console.error("Error listening to today_stars:", error));

    unsubscribeAwardLogs = onSnapshot(awardLogsQuery, (snapshot) => {
        allAwardLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        todaysAwardLogs = {};
        const today = getTodayDateString();
        allAwardLogs.filter(l => l.teacherId === currentUserId && l.date === today).forEach(log => {
            todaysAwardLogs[log.studentId] = log.id;
        });
        renderCalendarTab();
    }, (error) => console.error("Error listening to award logs:", error));

    unsubscribeQuestEvents = onSnapshot(questEventsQuery, (snapshot) => {
        allQuestEvents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendarTab();
    }, (error) => console.error("Error listening to quest events:", error));

    unsubscribeAdventureLogs = onSnapshot(adventureLogsQuery, (snapshot) => {
        allAdventureLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdventureLog();
    }, (error) => console.error("Error listening to adventure logs:", error));

    unsubscribeQuestAssignments = onSnapshot(questAssignmentsQuery, (snapshot) => {
        allQuestAssignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }, (error) => console.error("Error listening to quest assignments:", error));

    unsubscribeCompletedStories = onSnapshot(completedStoriesQuery, (snapshot) => {
        allCompletedStories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!document.getElementById('story-archive-modal').classList.contains('hidden')) {
            renderStoryArchive();
        }
    }, (error) => console.error("Error listening to completed stories:", error));

    unsubscribeWrittenScores = onSnapshot(writtenScoresQuery, (snapshot) => {
        allWrittenScores = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const scrollClassId = document.getElementById('scroll-class-select')?.value;
        if (scrollClassId) {
            renderScholarsScrollTab(scrollClassId);
        }
        const trialHistoryModal = document.getElementById('trial-history-modal');
        if (!trialHistoryModal.classList.contains('hidden')) {
            const classId = trialHistoryModal.dataset.classId;
            const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
            renderTrialHistoryContent(classId, activeView);
        }
    }, (error) => console.error("Error listening to written scores:", error));

    unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
        allAttendanceRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        snapshot.docChanges().forEach(change => {
            const attendanceData = change.doc.data();
            const lastLessonDate = getLastLessonDate(attendanceData.classId);
            if (attendanceData.date === lastLessonDate) {
                const isAbsent = change.type !== 'removed';
                updateStudentCardAttendanceState(attendanceData.studentId, isAbsent);
            }
        });
    }, (error) => console.error("Error listening to attendance:", error));

    unsubscribeScheduleOverrides = onSnapshot(overridesQuery, (snapshot) => {
        allScheduleOverrides = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendarTab();
        updateCeremonyStatus();
    }, (error) => console.error("Error listening to schedule overrides:", error));
}

// --- TAB & UI RENDERING ---
function showTab(tabName) {
    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;
    const nextTab = document.getElementById(tabId);
    
    const currentTab = document.querySelector('.app-tab:not(.hidden)');

    if (!nextTab || (currentTab && currentTab.id === tabId)) {
        return;
    }

    document.querySelectorAll('.nav-button[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    if (tabId === 'manage-students-tab') {
        document.querySelector('.nav-button[data-tab="my-classes-tab"]').classList.add('active');
    }

    const animationDuration = 350;

    if (currentTab) {
        currentTab.classList.add('tab-animate-out');
        
        setTimeout(() => {
            currentTab.classList.add('hidden');
            currentTab.classList.remove('tab-animate-out');

            nextTab.classList.remove('hidden');
            nextTab.classList.add('tab-animate-in');
            
            setTimeout(() => {
                nextTab.classList.remove('tab-animate-in');
            }, animationDuration);

        }, animationDuration);
    } else {
        nextTab.classList.remove('hidden');
        nextTab.classList.add('tab-animate-in');
        setTimeout(() => {
            nextTab.classList.remove('tab-animate-in');
        }, animationDuration);
    }

    if (tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab') {
        findAndSetCurrentLeague();
    }
    if(tabId === 'class-leaderboard-tab') renderClassLeaderboardTab();
    if(tabId === 'student-leaderboard-tab') renderStudentLeaderboardTab();
    if(tabId === 'my-classes-tab') renderManageClassesTab();
    if(tabId === 'manage-students-tab') renderManageStudentsTab();
    if(tabId === 'award-stars-tab') { renderAwardStarsTab(); findAndSetCurrentClass(); }
    if(tabId === 'adventure-log-tab') { renderAdventureLogTab(); findAndSetCurrentClass('adventure-log-class-select'); }
    if(tabId === 'scholars-scroll-tab') { renderScholarsScrollTab(); findAndSetCurrentClass('scroll-class-select'); }
    if(tabId === 'calendar-tab') renderCalendarTab();
    if(tabId === 'reward-ideas-tab') renderIdeasTabSelects();
    if(tabId === 'options-tab') {
        if (document.getElementById('teacher-name-input')) document.getElementById('teacher-name-input').value = currentTeacherName || '';
        renderStarManagerStudentSelect(); 
    }
    updateCeremonyStatus();
}

function renderClassLeaderboardTab() {
    const list = document.getElementById('class-leaderboard-list');
    const questUpdateBtn = document.getElementById('get-quest-update-btn');
    if (!list) return;

    // FIX #7: Use global league state
    const league = globalSelectedLeague;
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the Team Quest map.</p></div>`;
        questUpdateBtn.disabled = true;
        return;
    }

    const classesInLeague = allSchoolClasses.filter(c => c.questLevel === league);
    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        questUpdateBtn.disabled = true;
        return;
    }
    
    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    
    const classScores = classesInLeague.map(c => {
        const studentsInClass = allStudents.filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;

        const goals = {
            bronze: Math.round(studentCount * GOAL_PER_STUDENT.BRONZE),
            silver: Math.round(studentCount * GOAL_PER_STUDENT.SILVER),
            gold: Math.round(studentCount * GOAL_PER_STUDENT.GOLD),
            diamond: studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18
        };
        
        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
            const scoreData = allStudentScores.find(score => score.id === s.id);
            return sum + (scoreData?.monthlyStars || 0);
        }, 0);

        const progress = goals.diamond > 0 ? (currentMonthlyStars / goals.diamond) * 100 : 0;
        
        return { ...c, studentCount, goals, currentMonthlyStars, progress, questCompletedAt: c.questCompletedAt || null };
    }).sort((a, b) => {
        if (b.progress !== a.progress) {
            return b.progress - a.progress;
        }
        if (a.progress >= 100 && b.progress >= 100) {
            if (a.questCompletedAt && b.questCompletedAt) {
                return a.questCompletedAt.toMillis() - b.questCompletedAt.toMillis();
            }
            if (a.questCompletedAt) return -1;
            if (b.questCompletedAt) return 1;
        }
        return b.currentMonthlyStars - a.currentMonthlyStars;
    });

    questUpdateBtn.disabled = classScores.filter(c => c.currentMonthlyStars > 0).length < 2;

    let lastUniqueScore = -1, currentRank = 0;
    list.innerHTML = classScores.map((c, index) => {
        const uniqueScoreIdentifier = `${c.progress}-${c.questCompletedAt?.toMillis()}`;
        if (uniqueScoreIdentifier !== lastUniqueScore) {
            currentRank = index + 1;
            lastUniqueScore = uniqueScoreIdentifier;
        }
        const rankDisplay = currentRank;

        const bronzeAchieved = c.currentMonthlyStars >= c.goals.bronze;
        const silverAchieved = c.currentMonthlyStars >= c.goals.silver;
        const goldAchieved = c.currentMonthlyStars >= c.goals.gold;
        const diamondAchieved = c.currentMonthlyStars >= c.goals.diamond;
        
        let progressBarColor = 'bg-gradient-to-r from-gray-300 to-gray-400';
        if (bronzeAchieved) progressBarColor = 'bg-gradient-to-r from-stone-400 to-stone-500';
        if (silverAchieved) progressBarColor = 'bg-gradient-to-r from-slate-400 to-slate-500';
        if (goldAchieved) progressBarColor = 'bg-gradient-to-r from-amber-400 to-amber-500';
        if (diamondAchieved) progressBarColor = 'bg-gradient-to-r from-cyan-400 to-blue-500';

        const starsTo = {
            bronze: Math.max(0, c.goals.bronze - c.currentMonthlyStars),
            silver: Math.max(0, c.goals.silver - c.currentMonthlyStars),
            gold: Math.max(0, c.goals.gold - c.currentMonthlyStars),
            diamond: Math.max(0, c.goals.diamond - c.currentMonthlyStars)
        };
        
        const progressPositions = {
            bronze: c.goals.diamond > 0 ? (c.goals.bronze / c.goals.diamond) * 100 : 25,
            silver: c.goals.diamond > 0 ? (c.goals.silver / c.goals.diamond) * 100 : 50,
            gold: c.goals.diamond > 0 ? (c.goals.gold / c.goals.diamond) * 100 : 75,
        };
        
        let progressTier = 'low';
        if (c.progress >= 66) progressTier = 'high';
        else if (c.progress >= 33) progressTier = 'mid';

        const displayProgress = Math.min(100, c.progress);

        return `
        <div class="quest-card bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-xl border-2 border-white/50 space-y-3" 
            data-class-id="${c.id}">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="font-title text-4xl text-gray-400 w-8 text-center">${rankDisplay}</span>
                    <div>
                        <h3 class="font-title text-2xl text-gray-800">${c.logo} ${c.name}</h3>
                        <p class="text-sm text-gray-600">Teacher: ${c.createdBy.name} | Students: ${c.studentCount}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-title text-4xl text-amber-500">${c.currentMonthlyStars} ⭐</p>
                    <p class="text-xs text-gray-500 -mt-1">Goal: ${c.goals.diamond} Stars</p>
                </div>
            </div>
            <div class="quest-track-path relative w-full h-10 bg-gray-200 rounded-full shadow-inner flex items-center">
                <div class="quest-track-progress h-full rounded-full ${progressBarColor}" data-progress="${displayProgress}" style="width: 0%;"></div>
                <div class="milestone-marker absolute top-1/2 ${bronzeAchieved ? 'achieved' : ''}" style="left: ${progressPositions.bronze}%;">
                    🛡️
                    <div class="milestone-tooltip">
                        <p class="tooltip-main-text">${starsTo.bronze > 0 ? `${starsTo.bronze} more stars!` : 'Milestone Achieved!'}</p>
                        ${starsTo.bronze > 0 ? `<p class="tooltip-sub-text">Total needed: ${c.goals.bronze} ⭐</p>` : ''}
                    </div>
                </div>
                <div class="milestone-marker absolute top-1/2 ${silverAchieved ? 'achieved' : ''}" style="left: ${progressPositions.silver}%;">
                    🏆
                    <div class="milestone-tooltip">
                        <p class="tooltip-main-text">${starsTo.silver > 0 ? `${starsTo.silver} more stars!` : 'Milestone Achieved!'}</p>
                        ${starsTo.silver > 0 ? `<p class="tooltip-sub-text">Total needed: ${c.goals.silver} ⭐</p>` : ''}
                    </div>
                </div>
                <div class="milestone-marker absolute top-1/2 ${goldAchieved ? 'achieved' : ''}" style="left: ${progressPositions.gold}%;">
                    👑
                    <div class="milestone-tooltip">
                        <p class="tooltip-main-text">${starsTo.gold > 0 ? `${starsTo.gold} more stars!` : 'Milestone Achieved!'}</p>
                        ${starsTo.gold > 0 ? `<p class="tooltip-sub-text">Total needed: ${c.goals.gold} ⭐</p>` : ''}
                    </div>
                </div>
                <div class="milestone-marker is-diamond absolute top-1/2 ${diamondAchieved ? 'achieved' : ''}" style="left: 100%;">
                    💎
                    <div class="milestone-tooltip">
                        <p class="tooltip-main-text">${starsTo.diamond > 0 ? `${starsTo.diamond} more stars!` : 'QUEST COMPLETE!'}</p>
                    </div>
                </div>
                <div class="quest-track-avatar absolute top-1/2 text-4xl ${c.progress >= 100 ? 'quest-complete' : ''}" data-progress="${displayProgress}" data-progress-tier="${progressTier}" style="left: 0%;">
                    <span>${c.logo}</span>
                    ${c.progress < 100 ? `<div class="avatar-tooltip">${c.progress.toFixed(1)}% Complete ⭐</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    setTimeout(() => {
        list.querySelectorAll('.quest-track-progress, .quest-track-avatar').forEach(el => {
            const progress = el.dataset.progress;
            if (el.classList.contains('quest-track-progress')) {
                el.style.width = `${progress}%`;
            } else {
                el.style.left = `${progress}%`;
            }
        });
        list.querySelectorAll('.milestone-marker').forEach(marker => {
            marker.addEventListener('click', () => openMilestoneModal(marker));
        });
    }, 10);
}

function renderStudentLeaderboardTab() {
    const list = document.getElementById('student-leaderboard-list');
    if (!list) return;

    // FIX #7: Use global league state
    const league = globalSelectedLeague;
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the leaderboard.</p></div>`;
        return;
    }

    const classesInLeague = allSchoolClasses.filter(c => c.questLevel === league);
    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        return;
    }
    
    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    let studentsInLeague = allStudents
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => {
            const studentClass = allSchoolClasses.find(c => c.id === s.classId);
            const scoreData = allStudentScores.find(sc => sc.id === s.id) || {};
            const score = studentStarMetric === 'monthly' ? (scoreData.monthlyStars || 0) : (scoreData.totalStars || 0);
            return { ...s, score, className: studentClass?.name || '?', classLogo: studentClass?.logo || '📚' };
        });
    
    if (studentsInLeague.length === 0) {
         list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No students have been added to classes in this league yet.</p>`;
         return;
    }
    
    let outputHtml = '';
    if (studentLeaderboardView === 'league') {
        studentsInLeague.sort((a, b) => b.score - a.score);
        let lastScore = -1, currentRank = 0;
        studentsInLeague.slice(0, 50).forEach((s, index) => {
            if (s.score !== lastScore) {
                currentRank = index + 1;
                lastScore = s.score;
            }
            const rankDisplay = currentRank;
            const trophyColors = ['text-amber-400', 'text-gray-400', 'text-amber-600'];
            const rankBGs = {
                1: 'bg-gradient-to-r from-amber-100 to-white',
                2: 'bg-gradient-to-r from-gray-200 to-white',
                3: 'bg-gradient-to-r from-orange-100 to-white'
            };
            const rankBG = rankDisplay <= 3 && s.score > 0 ? rankBGs[rankDisplay] : 'bg-white';
            
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('en-GB');
            const currentMonthStr = new Date().toLocaleDateString('en-GB').substring(0, 7);
            
            const monthlyLogs = allAwardLogs.filter(log => log.studentId === s.id && log.date.startsWith(currentMonthStr));
            const weeklyStars = monthlyLogs.filter(log => log.date >= oneWeekAgoStr).reduce((sum, log) => sum + log.stars, 0);
            
            const reasonCounts = monthlyLogs.reduce((acc, log) => {
                if (log.reason) { acc[log.reason] = (acc[log.reason] || 0) + log.stars; }
                return acc;
            }, {});
            const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
            const topSkill = topReasonEntry ? topReasonEntry[0] : null;

            let statsHtml = '';
            if (topSkill) {
                statsHtml += `<div class="text-center text-xs text-gray-500" title="Top Skill: ${reasonInfo[topSkill]?.name || ''}">
                                <i class="fas ${reasonInfo[topSkill]?.icon || 'fa-star'} ${reasonInfo[topSkill]?.color || 'text-gray-500'} text-lg"></i>
                                <div>Top Skill</div>
                              </div>`;
            }
            if (weeklyStars > 0) {
                 statsHtml += `<div class="text-center text-xs text-gray-500" title="${weeklyStars} stars this week">
                                <i class="fas fa-fire text-orange-400 text-lg"></i>
                                <div>${weeklyStars} This Week</div>
                              </div>`;
            }
            
            // FIX #6: Enlarge Avatar on Click - Add class
            const avatarHtml = s.avatar ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar large-avatar mr-3 enlargeable-avatar">` : '';

            outputHtml += `
                <div class="student-leaderboard-card p-4 rounded-2xl shadow-lg border-2 border-purple-100 flex items-center justify-between ${rankBG} transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl" style="animation-delay: ${Math.random() * -6}s;">
                    <div class="flex items-center">
                        ${rankDisplay <= 3 && s.score > 0 ? `<i class="fas fa-trophy ${trophyColors[rankDisplay - 1]} text-4xl mr-4"></i>` : `<span class="font-bold text-3xl text-gray-400 w-12 text-center mr-3">${rankDisplay}</span>`}
                        ${avatarHtml}
                        <div>
                            <h3 class="font-bold text-xl text-gray-800">${s.classLogo} ${s.name}</h3>
                            <p class="text-sm text-purple-500">${s.className}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 md:gap-6">
                        ${statsHtml}
                        <div class="font-title text-4xl text-purple-600">${s.score} ⭐</div>
                    </div>
                </div>`;
        });
    } else {
        const classesMap = studentsInLeague.reduce((acc, student) => {
            if (!acc[student.classId]) acc[student.classId] = { name: student.className, logo: student.classLogo, students: [] };
            acc[student.classId].students.push(student);
            return acc;
        }, {});

        const allClassIdsInView = Object.keys(classesMap);
        const myClassIds = allClassIdsInView.filter(classId => allTeachersClasses.some(c => c.id === classId));
        const otherClassIds = allClassIdsInView.filter(classId => !myClassIds.includes(classId));
        
        const sortByName = (a, b) => (classesMap[a]?.name || '').localeCompare(classesMap[b]?.name || '');
        myClassIds.sort(sortByName);
        otherClassIds.sort(sortByName);

        const sortedClassIds = [...myClassIds, ...otherClassIds];

        for (const classId of sortedClassIds) {
            const classData = classesMap[classId];
            classData.students.sort((a, b) => b.score - a.score);
            
            const randomGradient = titleGradients[simpleHashCode(classData.name) % titleGradients.length];
            outputHtml += `<h3 class="font-title text-4xl mt-8 mb-3 flex items-center gap-3" style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);"><span class="text-4xl">${classData.logo}</span><span class="text-transparent bg-clip-text bg-gradient-to-r ${randomGradient}">${classData.name}</span></h3>`;

            let lastScore = -1, currentRank = 0;
            classData.students.forEach((s, index) => {
                if (s.score !== lastScore) {
                    currentRank = index + 1;
                    lastScore = s.score;
                }
                const rankDisplay = currentRank; 
                const medalColors = { 1: 'text-amber-400', 2: 'text-gray-400', 3: 'text-amber-600' };
                const rankBGs = { 1: 'bg-amber-100 border-amber-300', 2: 'bg-gray-200 border-gray-400', 3: 'bg-orange-100 border-orange-300' };
                const medalHtml = rankDisplay <= 3 && s.score > 0 ? `<i class="fas fa-medal ${medalColors[rankDisplay]} text-2xl mr-3"></i>` : `<span class="font-bold text-gray-400 w-6 text-left mr-3">${rankDisplay}</span>`;
                const rankBG = rankDisplay <= 3 && s.score > 0 ? rankBGs[rankDisplay] : 'bg-gray-50 border-purple-200';

                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('en-GB');
                const currentMonthStr = new Date().toLocaleDateString('en-GB').substring(0, 7);
                const monthlyLogs = allAwardLogs.filter(log => log.studentId === s.id && log.date.startsWith(currentMonthStr));
                const weeklyStars = monthlyLogs.filter(log => log.date >= oneWeekAgoStr).reduce((sum, log) => sum + log.stars, 0);
                const reasonCounts = monthlyLogs.reduce((acc, log) => { if (log.reason) { acc[log.reason] = (acc[log.reason] || 0) + log.stars; } return acc; }, {});
                const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
                const topSkill = topReasonEntry ? topReasonEntry[0] : null;

                let statsHtml = '';
                if (topSkill) {
                    statsHtml += `<span title="Top Skill: ${reasonInfo[topSkill]?.name || ''}"><i class="fas ${reasonInfo[topSkill]?.icon || 'fa-star'} ${reasonInfo[topSkill]?.color || 'text-gray-500'}"></i></span>`;
                }
                if (weeklyStars > 0) {
                    statsHtml += `<span title="${weeklyStars} stars this week" class="font-semibold text-orange-500"><i class="fas fa-fire mr-1"></i>${weeklyStars}</span>`;
                }
                
                // FIX #6: Enlarge Avatar on Click - Add class
                const avatarHtml = s.avatar ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar mr-2 enlargeable-avatar">` : '';

                outputHtml += `
                    <div class="student-leaderboard-card p-3 rounded-xl shadow-sm border ${rankBG} flex items-center justify-between transition-all duration-200 hover:shadow-md" style="animation-delay: ${Math.random() * -6}s;">
                        <div class="flex items-center flex-grow">
                            ${medalHtml}
                            ${avatarHtml}
                            <span class="font-semibold text-gray-800 flex-1">${s.name}</span>
                        </div>
                        <div class="flex items-center gap-4 text-lg">
                            ${statsHtml}
                            <div class="font-title text-xl text-purple-600">${s.score} ⭐</div>
                        </div>
                    </div>`;
            });
        }
    }
    list.innerHTML = outputHtml;
}

function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (allTeachersClasses.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet. Add one above!</p>`;
        return;
    }
    list.innerHTML = allTeachersClasses.sort((a,b) => a.name.localeCompare(b.name)).map(c => {
        const schedule = (c.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const time = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
        return `
            <div class="bg-white p-4 rounded-2xl shadow-lg border-2 border-gray-100 transform transition hover:shadow-xl hover:scale-[1.02]">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-bold text-2xl text-gray-800">${c.logo || '📚'} ${c.name}</h3>
                        <p class="text-sm text-green-700 font-semibold">${c.questLevel || 'Uncategorized'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-calendar-day mr-1"></i> ${schedule || 'No days set'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-clock mr-1"></i> ${time}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <button data-id="${c.id}" class="report-class-btn bg-green-100 text-green-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-magic mr-0 sm:mr-2"></i><span class="hidden sm:inline">Report</span></button>
                        <button data-id="${c.id}" class="overview-class-btn bg-purple-100 text-purple-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-chart-line mr-0 sm:mr-2"></i><span class="hidden sm:inline">Overview</span></button>
                        <button data-id="${c.id}" class="edit-class-btn bg-cyan-100 text-cyan-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-pencil-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Edit</span></button>
                        <button data-id="${c.id}" data-name="${c.name.replace(/'/g, "\\'")}" class="manage-students-btn bg-teal-100 text-teal-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-users mr-0 sm:mr-2"></i><span class="hidden sm:inline">Students</span></button>
                        <button data-id="${c.id}" class="delete-class-btn bg-red-100 text-red-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-trash-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Delete</span></button>
                    </div>
                </div>
            </div>`;
    }).join('');
    
    list.querySelectorAll('.manage-students-btn').forEach(btn => btn.addEventListener('click', () => {
        currentManagingClassId = btn.dataset.id;
        document.getElementById('manage-class-name').innerText = btn.dataset.name;
        document.getElementById('manage-class-id').value = btn.dataset.id;
        showTab('manage-students-tab');
    }));
    list.querySelectorAll('.delete-class-btn').forEach(btn => btn.addEventListener('click', () => showModal('Delete Class?', 'Are you sure you want to delete this class and all its students? This cannot be undone.', () => deleteClass(btn.dataset.id))));
    list.querySelectorAll('.edit-class-btn').forEach(btn => btn.addEventListener('click', () => openEditClassModal(btn.dataset.id)));
    list.querySelectorAll('.report-class-btn').forEach(btn => btn.addEventListener('click', () => handleGenerateReport(btn.dataset.id)));
    list.querySelectorAll('.overview-class-btn').forEach(btn => btn.addEventListener('click', () => openOverviewModal(btn.dataset.id)));
}

function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    if (!list || !currentManagingClassId) return;
    const studentsInClass = allStudents.filter(s => s.classId === currentManagingClassId).sort((a,b) => a.name.localeCompare(b.name));
    if (studentsInClass.length === 0) {
        list.innerHTML = `<p class="text-sm text-center text-gray-500">No students in this class yet. Add one!</p>`;
        return;
    }
    list.innerHTML = studentsInClass.map(s => {
        // FIX #6: Enlarge Avatar on Click - Add class
        const avatarHtml = s.avatar 
            ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar large-avatar enlargeable-avatar">` 
            : `<div class="student-avatar large-avatar flex items-center justify-center bg-gray-300 text-gray-600 font-bold">${s.name.charAt(0)}</div>`;

        return `
        <div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
            <div class="flex items-center gap-3">
                ${avatarHtml}
                <span class="font-medium text-gray-700">${s.name}</span>
            </div>
            <div class="flex gap-2">
                <button data-id="${s.id}" class="move-student-btn bg-yellow-100 text-yellow-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Move Student"><i class="fas fa-people-arrows text-xs"></i></button>
                <button data-id="${s.id}" class="avatar-maker-btn font-bold w-8 h-8 rounded-full bubbly-button" title="Create/Edit Avatar"><i class="fas fa-user-astronaut text-xs"></i></button>
                <button data-id="${s.id}" class="certificate-student-btn bg-indigo-100 text-indigo-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Generate Certificate"><i class="fas fa-award text-xs"></i></button>
                <button data-id="${s.id}" data-name="${s.name.replace(/"/g, '&quot;')}" class="edit-student-btn bg-cyan-100 text-cyan-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Edit Name"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button data-id="${s.id}" class="delete-student-btn bg-red-100 text-red-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Delete Student"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
        </div>`;
    }).join('');
    
    list.querySelectorAll('.delete-student-btn').forEach(btn => btn.addEventListener('click', () => showModal('Delete Student?', 'Are you sure you want to delete this student?', () => deleteStudent(btn.dataset.id))));
    list.querySelectorAll('.certificate-student-btn').forEach(btn => btn.addEventListener('click', () => handleGenerateCertificate(btn.dataset.id)));
    list.querySelectorAll('.edit-student-btn').forEach(btn => btn.addEventListener('click', () => openEditStudentNameModal(btn.dataset.id, btn.dataset.name)));
    list.querySelectorAll('.avatar-maker-btn').forEach(btn => btn.addEventListener('click', () => openAvatarMaker(btn.dataset.id)));
    list.querySelectorAll('.move-student-btn').forEach(btn => btn.addEventListener('click', () => openMoveStudentModal(btn.dataset.id)));
}

function renderAwardStarsTab() {
    const dropdownList = document.getElementById('award-class-list');
    const studentListContainer = document.getElementById('award-stars-student-list');
    if (!dropdownList) return;
    
    // FIX #7: Use global class ID
    const selectedClassId = globalSelectedClassId;

    if (allTeachersClasses.length === 0) {
         dropdownList.innerHTML = '';
         document.getElementById('selected-class-name').innerText = 'No classes created';
         document.getElementById('selected-class-level').innerText = 'Create one in "My Classes"';
         document.getElementById('selected-class-logo').innerText = '😢';
         studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">You must create a class first.</p>`;
         return;
    }
    
    dropdownList.innerHTML = allTeachersClasses
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(c => `
        <div class="award-class-item flex items-center gap-3 p-3 hover:bg-rose-50 cursor-pointer" data-id="${c.id}">
            <span class="text-3xl">${c.logo}</span>
            <div class="text-left">
                <div class="font-bold text-md text-rose-800">${c.name}</div>
                <div class="text-xs text-rose-500 -mt-1">${c.questLevel}</div>
            </div>
        </div>
    `).join('');

    if (selectedClassId) {
        renderAwardStarsStudentList(selectedClassId);
    } else {
         studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
    }
}

function renderAwardStarsStudentList(selectedClassId, fullRender = true) {
    const listContainer = document.getElementById('award-stars-student-list');
    if (!listContainer) return;

    const renderContent = () => {
        if (!selectedClassId) {
            listContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
            return;
        }

        let studentsInClass = allStudents.filter(s => s.classId === selectedClassId);
        
        if (fullRender) {
            for (let i = studentsInClass.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [studentsInClass[i], studentsInClass[j]] = [studentsInClass[j], studentsInClass[i]];
            }
        }

        if (studentsInClass.length === 0) {
            listContainer.innerHTML = `<p class="text-sm text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl col-span-full">No students in this class. Add some in "My Classes"!</p>`;
        } else {
            const lastLessonDate = getLastLessonDate(selectedClassId);
            const todaysAbsences = allAttendanceRecords.filter(r => r.date === lastLessonDate && r.classId === selectedClassId).map(r => r.studentId);
            const cloudShapes = ['cloud-shape-1', 'cloud-shape-2', 'cloud-shape-3', 'cloud-shape-4'];
            listContainer.innerHTML = studentsInClass.map((s, index) => {
                const scoreData = allStudentScores.find(score => score.id === s.id) || {}; 
                const totalStars = scoreData.totalStars || 0; 
                const monthlyStars = scoreData.monthlyStars || 0; 
                const starsToday = todaysStars[s.id]?.stars || 0;
                const cloudShape = cloudShapes[index % cloudShapes.length];
                const isAbsent = todaysAbsences.includes(s.id);

                let absenceButtonHtml = '';
                if (starsToday === 0) {
                    if (isAbsent) {
                        absenceButtonHtml = `
                        <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                            <i class="fas fa-user-check pointer-events-none"></i>
                        </button>`;
                    } else {
                        absenceButtonHtml = `
                        <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                            <i class="fas fa-user-slash pointer-events-none"></i>
                        </button>`;
                    }
                }
                
                const studentClass = allSchoolClasses.find(c => c.id === s.classId);
                const isLessonToday = (studentClass?.scheduleDays || []).includes(new Date().getDay().toString());
                const welcomeBackVisible = isAbsent && isLessonToday;

                // FIX #6 & #5: Enlarge Avatar on Click - Add class, ensure hover is handled by CSS
                const avatarHtml = s.avatar 
                    ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar-cloud enlargeable-avatar">` 
                    : `<div class="student-avatar-cloud-placeholder">${s.name.charAt(0)}</div>`;

                return `
                <div class="student-cloud-card ${cloudShape} ${isAbsent ? 'is-absent' : ''}" data-studentid="${s.id}" style="animation: float-card ${4 + Math.random() * 4}s ease-in-out infinite;">
                    <div class="absence-controls">
                        ${absenceButtonHtml}
                        <button class="welcome-back-btn ${welcomeBackVisible ? '' : 'hidden'}" data-action="welcome-back" title="Welcome Back Bonus!">
                            <i class="fas fa-hand-sparkles pointer-events-none"></i>
                        </button>
                    </div>
                    ${avatarHtml}
                    <button id="post-award-undo-${s.id}" class="post-award-undo-btn bubbly-button ${starsToday > 0 ? '' : 'hidden'}" title="Undo Award"><i class="fas fa-times"></i></button>
                    
                    <div class="card-content-wrapper">
                        <h3 class="font-title text-2xl text-gray-800 text-center">${s.name}</h3>
                        <div class="flex gap-2 text-center justify-center items-center p-2">
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-pink-300 rounded-full shadow-md border-b-4 border-pink-400 text-pink-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TODAY</span>
                                <span class="font-title text-3xl" id="today-stars-${s.id}">${starsToday}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-yellow-300 rounded-full shadow-md border-b-4 border-yellow-400 text-yellow-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">MONTH</span>
                                <span class="font-title text-3xl" id="monthly-stars-${s.id}">${monthlyStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-cyan-300 rounded-full shadow-md border-b-4 border-cyan-400 text-cyan-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TOTAL</span>
                                <span class="font-title text-3xl" id="total-stars-${s.id}">${totalStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                        </div>
                        <div class="reason-selector flex justify-center items-center gap-2 ${starsToday > 0 ? 'pointer-events-none opacity-50' : ''}">
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-purple-200" data-reason="teamwork" title="Teamwork"><i class="fas fa-users text-purple-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-pink-200" data-reason="creativity" title="Creativity"><i class="fas fa-lightbulb text-pink-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-green-200" data-reason="respect" title="Respect"><i class="fas fa-hands-helping text-green-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-yellow-200" data-reason="focus" title="Focus/Effort"><i class="fas fa-brain text-yellow-600 pointer-events-none"></i></button>
                        </div>
                        <div class="star-selector-container flex items-center justify-center space-x-2">
                            <button data-stars="1" class="star-award-btn star-btn-1"><i class="fas fa-star"></i></button>
                            <button data-stars="2" class="star-award-btn star-btn-2"><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                            <button data-stars="3" class="star-award-btn star-btn-3"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    };

    if (fullRender) {
        listContainer.classList.remove('fade-in');
        listContainer.classList.add('fade-out');
        setTimeout(() => {
            renderContent();
            listContainer.classList.remove('fade-out');
            listContainer.classList.add('fade-in');
        }, 300);
    } else {
        renderContent();
    }
}

function updateStudentCardAttendanceState(studentId, isAbsent) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;

    studentCard.classList.toggle('is-absent', isAbsent);
    const controlsDiv = studentCard.querySelector('.absence-controls');
    if (!controlsDiv) return;

    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const studentClass = allSchoolClasses.find(c => c.id === student.classId);
    const isLessonToday = (studentClass?.scheduleDays || []).includes(new Date().getDay().toString());
    const welcomeBackVisible = isAbsent && isLessonToday;

    if (isAbsent) {
        controlsDiv.innerHTML = `
            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                <i class="fas fa-user-check pointer-events-none"></i>
            </button>
            <button class="welcome-back-btn ${welcomeBackVisible ? '' : 'hidden'}" data-action="welcome-back" title="Welcome Back Bonus!">
                <i class="fas fa-hand-sparkles pointer-events-none"></i>
            </button>
        `;
    } else {
        controlsDiv.innerHTML = `
            <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                <i class="fas fa-user-slash pointer-events-none"></i>
            </button>
        `;
    }
}

function updateAwardCardState(studentId, starsToday, reason) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;

    const todayStarsEl = studentCard.querySelector(`#today-stars-${studentId}`);
    const undoBtn = studentCard.querySelector(`#post-award-undo-${studentId}`);
    const reasonSelector = studentCard.querySelector('.reason-selector');
    const starSelector = studentCard.querySelector('.star-selector-container');
    const absenceControls = studentCard.querySelector('.absence-controls');

    if (todayStarsEl) {
        if (parseInt(todayStarsEl.textContent) !== starsToday) {
            todayStarsEl.textContent = starsToday;
            todayStarsEl.closest('.counter-bubble')?.classList.add('counter-animate');
        }
    }

    if (starsToday > 0) {
        undoBtn?.classList.remove('hidden');
        reasonSelector?.classList.add('pointer-events-none', 'opacity-50');
        starSelector?.classList.remove('visible');
        reasonSelector?.querySelectorAll('.reason-btn.active').forEach(b => b.classList.remove('active'));
        if(absenceControls) absenceControls.innerHTML = '';
    } else {
        undoBtn?.classList.add('hidden');
        reasonSelector?.classList.remove('pointer-events-none', 'opacity-50');
        if(absenceControls) {
            const student = allStudents.find(s => s.id === studentId);
            if (!student) return;
            const lastLessonDate = getLastLessonDate(student.classId);
            const isAbsent = allAttendanceRecords.some(r => r.studentId === studentId && r.date === lastLessonDate);
            updateStudentCardAttendanceState(studentId, isAbsent);
        }
    }
}

function findAndSetCurrentClass(targetSelectId = null) {
    // FIX #7: If a class is already selected globally, don't override it.
    if (globalSelectedClassId) return;

    const todayString = getTodayDateString();
    const classesToday = getClassesOnDay(todayString);
    const myClassesToday = classesToday.filter(c => allTeachersClasses.some(tc => tc.id === c.id));

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const c of myClassesToday) {
        if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
            // FIX #7: Use the global setter function
            setGlobalSelectedClass(c.id);
            return;
        }
    }
}


function findAndSetCurrentLeague(shouldRender = true) {
    // FIX #7: If a league is already selected globally, don't override it.
    if (globalSelectedLeague) return;

    const now = new Date();
    const currentDay = now.getDay().toString();
    const currentTime = now.toTimeString().slice(0, 5);
    for (const c of allTeachersClasses) {
        if (c.scheduleDays && c.scheduleDays.includes(currentDay)) {
            if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
                // FIX #7: Use the global setter function
                setGlobalSelectedLeague(c.questLevel);
                if (shouldRender) {
                    renderClassLeaderboardTab();
                    renderStudentLeaderboardTab();
                }
                return;
            }
        }
    }
}

function renderCalendarTab() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = `<div class="text-center font-bold text-gray-600">Mon</div><div class="text-center font-bold text-gray-600">Tue</div><div class="text-center font-bold text-gray-600">Wed</div><div class="text-center font-bold text-gray-600">Thu</div><div class="text-center font-bold text-gray-600">Fri</div><div class="text-center font-bold text-gray-600">Sat</div><div class="text-center font-bold text-gray-600">Sun</div>`; 
    const month = calendarCurrentDate.getMonth(), year = calendarCurrentDate.getFullYear();
    document.getElementById('calendar-month-year').innerText = calendarCurrentDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0); 
    document.getElementById('prev-month-btn').disabled = calendarCurrentDate <= competitionStart;
    document.getElementById('next-month-btn').disabled = calendarCurrentDate.getMonth() === competitionEnd.getMonth() && calendarCurrentDate.getFullYear() === competitionEnd.getFullYear();
    
    for (let i = 0; i < firstDayIndex; i++) grid.innerHTML += `<div class="border rounded-md bg-gray-50/70 calendar-day-cell"></div>`;
    
    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const isFuture = day > today, isToday = today.toDateString() === day.toDateString();
        const dateString = getDDMMYYYY(day);
        
        const classesOnThisDay = getClassesOnDay(dateString);
        const logsForThisDay = allAwardLogs.filter(log => getDDMMYYYY(parseDDMMYYYY(log.date)) === dateString);
        const totalStarsThisDay = logsForThisDay.reduce((sum, log) => sum + (log.stars || 0), 0);
        
        let eventsHtml = classesOnThisDay.map(c => {
            const color = c.color || classColorPalettes[simpleHashCode(c.id) % classColorPalettes.length];
            const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart}-${c.timeEnd}` : (c.timeStart || '');
            return `<div class="text-xs px-1.5 py-1 rounded ${color.bg} ${color.text} border-l-4 ${color.border} shadow-sm" title="${c.name} (${timeDisplay})"><span class="font-bold">${c.logo} ${timeDisplay}</span><span class="truncate block">${c.name}</span></div>`;
        }).join('');
        
        const questEventsOnThisDay = allQuestEvents.filter(e => e.date === dateString);
        let questEventsHtml = questEventsOnThisDay.map(e => {
            const title = e.details?.title || e.type; 
            
            let icon = 'fas fa-flag-checkered';
            switch(e.type) {
                case '2x Star Day': icon = 'fas fa-bolt'; break;
                case 'Reason Bonus Day': icon = 'fas fa-award'; break;
                case 'Vocabulary Vault': icon = 'fas fa-gem'; break;
                case 'The Unbroken Chain': icon = 'fas fa-link'; break;
                case 'Grammar Guardians': icon = 'fas fa-shield-alt'; break;
                case 'The Scribe\'s Sketch': icon = 'fas fa-pencil-ruler'; break;
                case 'Five-Sentence Saga': icon = 'fas fa-book'; break;
            }

            return `<div class="relative text-xs px-1.5 py-1 rounded bg-purple-200 text-purple-800 border-l-4 border-purple-400 shadow-sm" title="${title}">
                        <i class="${icon} mr-1"></i><span class="font-bold">${title}</span>
                        ${e.createdBy.uid === currentUserId ? `<button data-id="${e.id}" data-name="${title.replace(/'/g, "\\'")}" class="delete-event-btn"><i class="fas fa-times"></i></button>` : ''}
                    </div>`;
        }).join('');
        
        const dayClasses = `border rounded-md p-1 calendar-day-cell ${isFuture ? 'bg-white future-day' : 'bg-white logbook-day-btn'}`;
        const dayNumberHtml = isToday ? `<span class="today-date-highlight">${i}</span>` : i;

        grid.innerHTML += `
            <div class="${dayClasses}" data-date="${dateString}">
                <div class="font-bold text-right text-gray-800">${dayNumberHtml}</div>
                ${totalStarsThisDay > 0 ? `<div class="text-center text-amber-600 font-bold mt-1 text-sm"><i class="fas fa-star"></i> ${totalStarsThisDay}</div>` : ''}
                <div class="flex flex-col gap-1 mt-1 overflow-y-auto" style="max-height: 150px;">
                    ${questEventsHtml}
                    ${eventsHtml}
                </div>
            </div>`;
    }
}

function renderIdeasTabSelects() {
    const geminiSelect = document.getElementById('gemini-class-select');
    const oracleSelect = document.getElementById('oracle-class-select');
    const storySelect = document.getElementById('story-weavers-class-select');
    if (!geminiSelect || !oracleSelect || !storySelect) return;
    
    // FIX #7: Selections are now handled by the global state setter
    // This function now just populates the lists, the value is set by updateAllClassSelectors
    const optionsHtml = allTeachersClasses.sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.name} (${c.questLevel})</option>`).join('');
    
    const currentGeminiVal = geminiSelect.value;
    geminiSelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    geminiSelect.value = currentGeminiVal;
    document.getElementById('gemini-idea-btn').disabled = !geminiSelect.value;
    
    const currentOracleVal = oracleSelect.value;
    oracleSelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    oracleSelect.value = currentOracleVal;
    document.getElementById('oracle-insight-btn').disabled = !oracleSelect.value;

    const currentStoryVal = storySelect.value;
    storySelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    storySelect.value = currentStoryVal;
}

function renderStarManagerStudentSelect() {
    const select = document.getElementById('star-manager-student-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a student...</option>';

    if (allTeachersClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }
    
    const classesMap = allTeachersClasses.reduce((acc, c) => {
        acc[c.id] = { name: c.name, students: [] };
        return acc;
    }, {});
    
    const studentsInMyClasses = allStudents.filter(s => classesMap[s.classId]);
    
    if (studentsInMyClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }

    studentsInMyClasses.forEach(s => {
        classesMap[s.classId].students.push(s);
    });

    const sortedClassIds = Object.keys(classesMap).sort((a, b) => classesMap[a].name.localeCompare(b.name));
    sortedClassIds.forEach(classId => {
        const classData = classesMap[classId];
        if (classData.students.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = classData.name;
            classData.students.sort((a,b) => a.name.localeCompare(b.name));
            classData.students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    });
    select.value = currentVal;
    handleStarManagerStudentSelect(); 
}

// --- MODAL & PICKER LOGIC ---
function showModal(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        playSound('click');
        if (onConfirm) onConfirm();
        hideModal('confirmation-modal');
    });
    document.getElementById('confirmation-modal').classList.remove('hidden');
}

function hideModal(modalId) {
    if (modalId === 'quest-update-modal' || modalId === 'storybook-viewer-modal') {
        const audio = modalId === 'quest-update-modal' ? currentNarrativeAudio : currentStorybookAudio;
        const btn = modalId === 'quest-update-modal' ? document.getElementById('play-narrative-btn') : document.getElementById('storybook-viewer-play-btn');
        if (audio && !audio.paused) {
            audio.pause();
            if(btn) btn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> ${btn.textContent.includes('Narrate') ? 'Narrate Story' : 'Play Narrative'}`;
        }
        if (modalId === 'quest-update-modal') currentNarrativeAudio = null;
        else currentStorybookAudio = null;
    }

    const modal = document.getElementById(modalId);
    if (!modal) return;
    const innerContent = modal.querySelector('.pop-in');

    if (innerContent) {
        innerContent.classList.add('pop-out');
        setTimeout(() => {
            modal.classList.add('hidden');
            innerContent.classList.remove('pop-out');
        }, 200);
    } else {
        modal.classList.add('hidden');
    }

    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
        currentlySelectedDayCell = null;
    }
}

function showLeaguePicker(isManualSelection = false) {
    const list = document.getElementById('league-picker-list');
    list.innerHTML = questLeagues.map(league => `<button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${league}">${league}</button>`).join('');
    list.querySelectorAll('.league-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        // FIX #7: Use the global setter function
        if (isManualSelection) {
            setGlobalSelectedLeague(btn.dataset.league, true);
        } else {
            globalSelectedLeague = btn.dataset.league;
            updateAllLeagueSelectors();
        }
        renderClassLeaderboardTab();
        renderStudentLeaderboardTab();
        updateCeremonyStatus();
        hideModal('league-picker-modal');
    }));
    document.getElementById('league-picker-modal').classList.remove('hidden');
}

function showLogoPicker(target) {
    const list = document.getElementById('logo-picker-list');
    list.innerHTML = classLogos.map(logo => `<button class="logo-select-btn p-2 rounded-lg transition hover:bg-gray-200 bubbly-button" data-logo="${logo}">${logo}</button>`).join('');
    list.querySelectorAll('.logo-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        const logo = btn.dataset.logo;
        if (target === 'create') {
            document.getElementById('class-logo').value = logo;
            document.getElementById('logo-picker-btn').innerText = logo;
        } else if (target === 'edit') {
            document.getElementById('edit-class-logo').value = logo;
            document.getElementById('edit-logo-picker-btn').innerText = logo;
        }
        hideModal('logo-picker-modal');
    }));
    document.getElementById('logo-picker-modal').classList.remove('hidden');
}

function openDayPlannerModal(dateString, dayCell) {
    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
    }
    currentlySelectedDayCell = dayCell;
    dayCell.classList.add('day-selected');

    const modal = document.getElementById('day-planner-modal');
    const displayDate = parseDDMMYYYY(dateString).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('day-planner-title').innerText = `Planner for ${displayDate}`;
    modal.dataset.date = dateString;
    
    document.getElementById('quest-event-date').value = dateString;

    renderScheduleManagerList(dateString);
    document.getElementById('quest-event-form').reset();
    renderQuestEventDetails();
    
    switchDayPlannerTab('schedule');
    modal.classList.remove('hidden');
}

function switchDayPlannerTab(tabName) {
    document.querySelectorAll('.day-planner-tab-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        btn.classList.toggle('border-blue-500', isSelected && tabName === 'schedule');
        btn.classList.toggle('text-blue-600', isSelected && tabName === 'schedule');
        btn.classList.toggle('border-purple-500', isSelected && tabName === 'event');
        btn.classList.toggle('text-purple-600', isSelected && tabName === 'event');
        btn.classList.toggle('border-transparent', !isSelected);
        btn.classList.toggle('text-gray-500', !isSelected);
    });
    document.querySelectorAll('.day-planner-tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`day-planner-${tabName}-content`).classList.remove('hidden');
}

function renderScheduleManagerList(dateString) {
    const listEl = document.getElementById('schedule-manager-list');
    const selectEl = document.getElementById('add-onetime-lesson-select');
    const classesOnDay = getClassesOnDay(dateString);
    const allTeacherClassIds = allTeachersClasses.map(c => c.id);

    if (classesOnDay.length === 0) {
        listEl.innerHTML = `<p class="text-center text-gray-500">No lessons scheduled for this day.</p>`;
    } else {
        listEl.innerHTML = classesOnDay.map(c => {
            const cancelButton = allTeacherClassIds.includes(c.id)
                ? `<button class="cancel-lesson-btn bg-red-100 text-red-700 font-bold py-1 px-3 rounded-full bubbly-button" data-class-id="${c.id}">Cancel</button>`
                : `<span class="text-xs text-gray-400">By ${c.createdBy.name}</span>`;
            return `<div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg"><span>${c.logo} ${c.name}</span>${cancelButton}</div>`;
        }).join('');
    }

    const scheduledIds = classesOnDay.map(c => c.id);
    const availableToAdd = allTeachersClasses.filter(c => !scheduledIds.includes(c.id));
    selectEl.innerHTML = availableToAdd.map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    document.getElementById('add-onetime-lesson-btn').disabled = availableToAdd.length === 0;

    listEl.querySelectorAll('.cancel-lesson-btn').forEach(btn => {
        btn.onclick = () => handleCancelLesson(dateString, btn.dataset.classId);
    });
}

// --- DATABASE CRUD OPERATIONS ---
async function handleAddClass() {
    const form = document.getElementById('add-class-form');
    const name = document.getElementById('class-name').value, level = document.getElementById('class-level').value;
    if (!name || !level) { showToast('Please fill in both Class Name and Quest Level.', 'error'); return; }
    const logo = document.getElementById('class-logo').value;
    const timeStart = document.getElementById('class-time-start').value, timeEnd = document.getElementById('class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="schedule-day"]:checked')).map(cb => cb.value);
    const randomColor = classColorPalettes[simpleHashCode(name) % classColorPalettes.length];
    try {
        await addDoc(collection(db, "artifacts/great-class-quest/public/data/classes"), { name, questLevel: level, logo, scheduleDays, timeStart, timeEnd, color: randomColor, createdBy: { uid: currentUserId, name: currentTeacherName }, createdAt: serverTimestamp() });
        showToast('Class created successfully!', 'success');
        form.reset();
        document.getElementById('logo-picker-btn').innerText = '📚';
        document.getElementById('class-logo').value = '📚';
        document.getElementById('class-name-suggestions').innerHTML = '';
    } catch (error) { console.error("Error adding class: ", error); showToast(`Error: ${error.message}`, 'error'); }
}

async function deleteClass(classId) {
    try {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        const studentsQuery = query(collection(db, `${publicDataPath}/students`), where("classId", "==", classId));
        const studentSnapshot = await getDocs(studentsQuery);
        const studentIdsInClass = studentSnapshot.docs.map(d => d.id);
        const batch = writeBatch(db);
        studentSnapshot.forEach(doc => batch.delete(doc.ref));
        studentIdsInClass.forEach(studentId => batch.delete(doc(db, `${publicDataPath}/student_scores`, studentId)));
        if (studentIdsInClass.length > 0) {
            const todayStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "in", studentIdsInClass));
            const todayStarsSnapshot = await getDocs(todayStarsQuery);
            todayStarsSnapshot.forEach(doc => batch.delete(doc.ref));
            
            const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`), where("studentId", "in", studentIdsInClass));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
        }
        batch.delete(doc(db, `${publicDataPath}/classes`, classId));
        batch.delete(doc(db, `${publicDataPath}/story_data`, classId));
        const historySnapshot = await getDocs(collection(db, `${publicDataPath}/story_data/${classId}/story_history`));
        historySnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        showToast('Class and all associated data deleted.', 'success');
    } catch (error) {
        console.error("Error deleting class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function openEditClassModal(classId) {
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;
    document.getElementById('edit-class-id').value = classId;
    document.getElementById('edit-class-name').value = classData.name;
    document.getElementById('edit-class-logo').value = classData.logo || '📚';
    document.getElementById('edit-logo-picker-btn').innerText = classData.logo || '📚';
    document.getElementById('edit-class-time-start').value = classData.timeStart || '';
    document.getElementById('edit-class-time-end').value = classData.timeEnd || '';
    const levelSelect = document.getElementById('edit-class-level');
    levelSelect.innerHTML = questLeagues.map(l => `<option value="${l}" ${l === classData.questLevel ? 'selected' : ''}>${l}</option>`).join('');
    const daysContainer = document.getElementById('edit-schedule-days');
    const days = [{ v: "1", l: "Mon" }, { v: "2", l: "Tue" }, { v: "3", l: "Wed" }, { v: "4", l: "Thu" }, { v: "5", l: "Fri" }, { v: "6", l: "Sat" }, { v: "0", l: "Sun" }];
    daysContainer.innerHTML = days.map(d => `<label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input type="checkbox" name="edit-schedule-day" value="${d.v}" ${(classData.scheduleDays || []).includes(d.v) ? 'checked' : ''}><span>${d.l}</span></label>`).join('');
    document.getElementById('edit-class-modal').classList.remove('hidden');
}

async function handleEditClass() {
    const classId = document.getElementById('edit-class-id').value;
    const name = document.getElementById('edit-class-name').value, level = document.getElementById('edit-class-level').value;
    if (!name || !level) { showToast('Please fill in all fields.', 'error'); return; }
    const logo = document.getElementById('edit-class-logo').value;
    const timeStart = document.getElementById('edit-class-time-start').value, timeEnd = document.getElementById('edit-class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="edit-schedule-day"]:checked')).map(cb => cb.value);
    try {
        const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
        await updateDoc(classRef, { name, questLevel: level, logo, timeStart, timeEnd, scheduleDays });
        showToast('Class updated successfully!', 'success');
        hideModal('edit-class-modal');
    } catch (error) { console.error("Error updating class: ", error); showToast(`Error: ${error.message}`, 'error'); }
}

async function handleAddStudent() {
    const input = document.getElementById('student-name');
    const name = input.value.trim();
    const classId = document.getElementById('manage-class-id').value;
    if (!name || !classId) { showToast('Please enter a student name.', 'error'); return; }
    const btn = document.querySelector('#add-student-form button[type="submit"]');
    try {
        input.disabled = true; btn.disabled = true; btn.innerHTML = 'Adding...';
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const newStudentRef = doc(collection(db, `${publicDataPath}/students`));
            const studentData = { name, classId, createdBy: { uid: currentUserId, name: currentTeacherName }, createdAt: serverTimestamp() };
            transaction.set(newStudentRef, studentData);
            const newScoreRef = doc(db, `${publicDataPath}/student_scores`, newStudentRef.id);
            transaction.set(newScoreRef, { totalStars: 0, monthlyStars: 0, lastMonthlyResetDate: getStartOfMonthString(), createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name } });
        });
        input.value = '';
    } catch (error) { console.error("Error adding student: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { input.disabled = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Student'; }
}

async function deleteStudent(studentId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    try {
        await runTransaction(db, async (transaction) => {
            transaction.delete(doc(db, `${publicDataPath}/students`, studentId));
            transaction.delete(doc(db, `${publicDataPath}/student_scores`, studentId));
            if (todaysStars[studentId]) transaction.delete(doc(db, `${publicDataPath}/today_stars`, todaysStars[studentId].docId));
        });
    } catch (error) { console.error("Error deleting student: ", error); showToast(`Error: ${error.message}`, 'error'); }
}

function openEditStudentNameModal(studentId, currentName) {
    playSound('click');
    document.getElementById('edit-student-id-input').value = studentId;
    document.getElementById('edit-student-name-input').value = currentName;
    document.getElementById('edit-student-name-modal').classList.remove('hidden');
}

async function handleEditStudentName() {
    const studentId = document.getElementById('edit-student-id-input').value;
    const newName = document.getElementById('edit-student-name-input').value.trim();
    
    if (!newName) {
        showToast('Name cannot be empty.', 'error');
        return;
    }
    
    try {
        const studentRef = doc(db, "artifacts/great-class-quest/public/data/students", studentId);
        await updateDoc(studentRef, { name: newName });
        showToast('Student name updated successfully!', 'success');
    } catch (error) {
        console.error("Error updating student name: ", error);
        showToast(`Failed to update name: ${error.message}`, 'error');
    } finally {
        hideModal('edit-student-name-modal');
    }
}

async function archivePreviousDayStars(userId, todayDateString) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const allStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where('teacherId', '==', userId));
    const snapshot = await getDocs(allStarsQuery);
    const oldDocs = snapshot.docs.filter(doc => doc.data().date !== todayDateString);
    if (oldDocs.length === 0) return;
    try {
        const batch = writeBatch(db);
        oldDocs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Archived and deleted ${oldDocs.length} old daily entries.`);
    } catch (error) { console.error('Error archiving stars:', error); }
}

async function checkAndResetMonthlyStars(studentId, currentMonthStart) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    try {
        await runTransaction(db, async (transaction) => {
            const scoreDoc = await transaction.get(scoreRef);
            
            if (!scoreDoc.exists()) return;
            
            const scoreData = scoreDoc.data();
            
            if (scoreData.lastMonthlyResetDate !== currentMonthStart) {
                
                const lastMonthScore = scoreData.monthlyStars || 0;
                const lastMonthDateString = scoreData.lastMonthlyResetDate; 
                const yearMonthKey = lastMonthDateString.substring(0, 7); 
                const historyRef = doc(db, `${publicDataPath}/student_scores/${studentId}/monthly_history/${yearMonthKey}`);
                
                if (lastMonthScore > 0) {
                    transaction.set(historyRef, { 
                    stars: lastMonthScore, 
                    month: yearMonthKey 
                });
                }
                
                transaction.update(scoreRef, { 
                    monthlyStars: 0, 
                    lastMonthlyResetDate: currentMonthStart 
                });
            }
        });
    } catch (error) { 
        console.error(`Failed monthly reset & archive for ${studentId}:`, error); 
    }
}

async function setStudentStarsForToday(studentId, starValue, reason = null) {
    const today = getTodayDateString();
    const publicDataPath = "artifacts/great-class-quest/public/data";
    
    let finalStarValue = starValue;
    const activeEvent = allQuestEvents.find(e => e.date === today);
    if (activeEvent) {
        if (activeEvent.type === '2x Star Day') {
            finalStarValue *= 2;
        } else if (activeEvent.type === 'Reason Bonus Day' && activeEvent.details?.reason === reason) {
            finalStarValue += 1;
        }
    }
    
    if (starValue > 0 && reason !== 'welcome_back' && reason !== 'story_weaver') {
         if (starValue === 1) playSound('star1');
         else if (starValue === 2) playSound('star2');
         else playSound('star3');
    }
    
    let studentClassId = null;
    let difference = 0;

    try {
        await runTransaction(db, async (transaction) => {
            const studentRef = doc(db, `${publicDataPath}/students`, studentId);
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

            const todayStarsQuery = query(
                collection(db, `${publicDataPath}/today_stars`),
                where("studentId", "==", studentId),
                where("teacherId", "==", currentUserId),
                where("date", "==", today)
            );
            const todayStarsSnapshot = await getDocs(todayStarsQuery);
            
            let todayDocRef = null;
            let oldStars = 0;
            if (!todayStarsSnapshot.empty) {
                const todayDoc = todayStarsSnapshot.docs[0];
                todayDocRef = todayDoc.ref;
                oldStars = todayDoc.data().stars || 0;
            }
            
            difference = finalStarValue - oldStars;

            if (difference === 0 && finalStarValue > 0) {
                const logId = todaysAwardLogs[studentId];
                if (logId) {
                    const logRef = doc(db, `${publicDataPath}/award_log`, logId);
                    transaction.update(logRef, { reason });
                }
                return;
            }
            
            if (difference === 0) return;

            const studentDoc = await transaction.get(studentRef);
            if (!studentDoc.exists()) throw new Error("Student not found!");
            const studentData = studentDoc.data();
            studentClassId = studentData.classId;

            const scoreDoc = await transaction.get(scoreRef);
            
            if (!scoreDoc.exists()) {
                transaction.set(scoreRef, {
                    totalStars: difference > 0 ? difference : 0,
                    monthlyStars: difference > 0 ? difference : 0,
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: { uid: studentData.createdBy.uid, name: studentData.createdBy.name }
                });
            } else {
                transaction.update(scoreRef, {
                    totalStars: increment(difference),
                    monthlyStars: increment(difference)
                });
            }

            if (todayDocRef) {
                if (finalStarValue === 0) {
                    transaction.delete(todayDocRef);
                } else {
                    transaction.update(todayDocRef, { stars: finalStarValue, reason: reason });
                }
            } else if (finalStarValue > 0) {
                const newTodayDocRef = doc(collection(db, `${publicDataPath}/today_stars`));
                transaction.set(newTodayDocRef, {
                    studentId, stars: finalStarValue, date: today, reason: reason,
                    teacherId: currentUserId, createdBy: { uid: currentUserId, name: currentTeacherName }
                });
            }

            const logId = todaysAwardLogs[studentId];
            if (finalStarValue === 0) {
                if (logId) transaction.delete(doc(db, `${publicDataPath}/award_log`, logId));
            } else if (finalStarValue > 0) {
                const logData = {
                    studentId, classId: studentData.classId, teacherId: currentUserId,
                    stars: finalStarValue, reason, date: today, createdAt: serverTimestamp(),
                    createdBy: { uid: currentUserId, name: currentTeacherName }
                };
                if (logId) {
                     transaction.update(doc(db, `${publicDataPath}/award_log`, logId), { stars: finalStarValue, reason });
                } else {
                     transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);
                }
            }
        });

        if (studentClassId && difference > 0) {
            await checkAndRecordQuestCompletion(studentClassId);
        }

    } catch (error) {
        console.error('Star update transaction failed:', error);
        showToast('Error saving stars! Please try again.', 'error');
    }
}

async function checkAndRecordQuestCompletion(classId) {
    const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
    const classDoc = await getDoc(classRef);
    if (!classDoc.exists() || classDoc.data().questCompletedAt) {
        return;
    }

    const GOAL_PER_STUDENT = { DIAMOND: 18 };
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    if (studentCount === 0) return;

    const diamondGoal = Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND);
    
    const studentIds = studentsInClass.map(s => s.id);
    const scoresQuery = query(collection(db, `artifacts/great-class-quest/public/data/student_scores`), where(documentId(), 'in', studentIds));
    const scoreSnapshot = await getDocs(scoresQuery);
    
    let currentMonthlyStars = 0;
    scoreSnapshot.forEach(doc => {
        currentMonthlyStars += doc.data().monthlyStars || 0;
    });

    if (currentMonthlyStars >= diamondGoal) {
        console.log(`Class ${classDoc.data().name} has completed the quest! Recording timestamp.`);
        await updateDoc(classRef, {
            questCompletedAt: serverTimestamp()
        });
    }
}

// --- OPTIONS TAB FUNCTIONS ---
async function handleSaveTeacherName() {
    const input = document.getElementById('teacher-name-input');
    const newName = input.value.trim();
    if (!newName) { showToast('Name cannot be empty.', 'error'); return; }
    if (newName === currentTeacherName) { showToast('Name is already set to this!', 'info'); return; }
    const btn = document.getElementById('save-teacher-name-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    try {
        await updateProfile(auth.currentUser, { displayName: newName });
        await updateTeacherNameInClasses(newName);
        await updateTeacherNameInStudents(newName);
        currentTeacherName = newName;
        document.getElementById('teacher-greeting').innerText = `Welcome, ${newName}!`;
        showToast('Name updated successfully!', 'success');
    } catch (error) { console.error("Error updating name: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Name'; }
}

async function updateTeacherNameInClasses(newName) {
    const q = query(collection(db, `artifacts/great-class-quest/public/data/classes`), where("createdBy.uid", "==", currentUserId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.update(doc.ref, { "createdBy.name": newName }));
    await batch.commit();
}

async function updateTeacherNameInStudents(newName) {
    const q = query(collection(db, `artifacts/great-class-quest/public/data/students`), where("createdBy.uid", "==", currentUserId));const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.update(doc.ref, { "createdBy.name": newName }));
    await batch.commit();
}

// --- STAR MANAGER FUNCTIONS ---
function handleStarManagerStudentSelect() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const logFormElements = [
        document.getElementById('star-manager-date'),
        document.getElementById('star-manager-stars-to-add'),
        document.getElementById('star-manager-reason'),
        document.getElementById('star-manager-add-btn'),
        document.getElementById('star-manager-purge-btn')
    ];
    const overrideFormElements = [
        document.getElementById('override-today-stars'),
        document.getElementById('override-monthly-stars'),
        document.getElementById('override-total-stars'),
        document.getElementById('star-manager-override-btn')
    ];
    
    if (studentId) {
        logFormElements.forEach(el => el.disabled = false);
        overrideFormElements.forEach(el => el.disabled = false);
        document.getElementById('star-manager-date').value = new Date().toISOString().split('T')[0];

        const scoreData = allStudentScores.find(s => s.id === studentId) || {};
        const todayData = todaysStars[studentId] || {};
        
        document.getElementById('override-today-stars').value = todayData.stars || 0;
        document.getElementById('override-monthly-stars').value = scoreData.monthlyStars || 0;
        document.getElementById('override-total-stars').value = scoreData.totalStars|| 0;

    } else {
        logFormElements.forEach(el => el.disabled = true);
        overrideFormElements.forEach(el => { el.disabled = true; if(el.tagName === 'INPUT') el.value = 0; });
    }
}

async function handleAddStarsManually() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const date = document.getElementById('star-manager-date').value;
    const starsToAdd = parseFloat(document.getElementById('star-manager-stars-to-add').value);
    const reason = document.getElementById('star-manager-reason').value;

    if (!studentId || !date || !starsToAdd || starsToAdd <= 0 || !reason) {
        showToast('Please fill out all fields correctly.', 'error');
        return;
    }

    const student = allStudents.find(s => s.id === studentId);
    if (!student) {
        showToast('Selected student not found.', 'error');
        return;
    }

    const btn = document.getElementById('star-manager-add-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Adding...';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            
            const scoreDoc = await transaction.get(scoreRef);
            if (!scoreDoc.exists()) throw new Error("Student score record not found. Cannot add stars.");

            const logData = {
                studentId, classId: student.classId, teacherId: currentUserId,
                stars: starsToAdd, reason, date: parseDDMMYYYY(date).toISOString().split('T')[0], createdAt: serverTimestamp(),
                createdBy: { uid: currentUserId, name: currentTeacherName }
            };
            transaction.set(doc(collection(db, `${publicDataPath}/award_log`)), logData);

            const awardMonth = date.substring(0, 7); 
            const currentMonth = getDDMMYYYY(new Date()).substring(3);
            
            const updates = { totalStars: increment(starsToAdd) };
            if (awardMonth === currentMonth) {
                updates.monthlyStars = increment(starsToAdd);
            }
            transaction.update(scoreRef, updates);
        });
        showToast(`${starsToAdd} star(s) for ${reason} added to ${student.name}'s log for ${date}.`, 'success');
    } catch (error) {
        console.error("Error adding stars manually: ", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Add Stars to Log';
    }
}

async function handleSetStudentScores() {
    const studentId = document.getElementById('star-manager-student-select').value;
    if (!studentId) return;

    const todayStarsVal = parseFloat(document.getElementById('override-today-stars').value);
    const monthlyStarsVal = parseFloat(document.getElementById('override-monthly-stars').value);
    const totalStarsVal = parseFloat(document.getElementById('override-total-stars').value);

    if (isNaN(todayStarsVal) || isNaN(monthlyStarsVal) || isNaN(totalStarsVal)) {showToast('Please enter valid numbers for all scores.', 'error');
        return;
    }

    const btn = document.getElementById('star-manager-override-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Setting...';

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const todayDocId = todaysStars[studentId]?.docId;
            const todayDocRef = todayDocId ? doc(db, `${publicDataPath}/today_stars`, todayDocId) : null;
            
            transaction.update(scoreRef, {
                monthlyStars: monthlyStarsVal,
                totalStars: totalStarsVal
            });

            if (todayStarsVal > 0) {
                const todayData = {
                    studentId, stars: todayStarsVal, date: getTodayDateString(),
                    teacherId: currentUserId, createdBy: { uid: currentUserId, name: currentTeacherName }
                };
                if (todayDocRef) {
                    transaction.update(todayDocRef, { stars: todayStarsVal });
                } else {
                    transaction.set(doc(collection(db, `${publicDataPath}/today_stars`)), todayData);
                }
            } else {
                if (todayDocRef) {
                    transaction.delete(todayDocRef);
                }
            }
        });
        const student = allStudents.find(s => s.id === studentId);
        showToast(`Scores for ${student.name} have been updated.`, 'success');

    } catch (error) {
        console.error("Error overriding scores: ", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wrench mr-2"></i> Set Student Scores';
    }
}

function handlePurgeStudentStars() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    showModal('Purge All Score Data?', `Are you sure you want to delete ALL star score data for ${student.name}? This will reset their scores to zero but will NOT delete their award logs. This cannot be undone.`, async () => {
        const btn = document.getElementById('star-manager-purge-btn');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Purging...';
        try {
            await runTransaction(db, async (transaction) => {
                const scoreRef = doc(db, `artifacts/great-class-quest/public/data/student_scores`, studentId);
                const todayDocId = todaysStars[studentId]?.docId;

                if ((await transaction.get(scoreRef)).exists()) transaction.update(scoreRef, { monthlyStars: 0, totalStars: 0, lastMonthlyResetDate: getStartOfMonthString() });
                if (todayDocId) transaction.delete(doc(db, `artifacts/great-class-quest/public/data/today_stars`, todayDocId));
            });
            showToast('All star scores purged for student!', 'success');
        } catch (error) { console.error("Error purging stars: ", error); showToast(`Error: ${error.message}`, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Purge All Score Data for Student'; }
    });
}

async function handlePurgeAwardLogs() {
    const btn = document.getElementById('purge-logs-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Purging...';
    try {
        const logsToPurge = allAwardLogs.filter(log => log.teacherId === currentUserId);
        if (logsToPurge.length === 0) { showToast('You have no logs to purge!', 'info'); return; }
        const batch = writeBatch(db);
        logsToPurge.forEach(log => batch.delete(doc(db, `artifacts/great-class-quest/public/data/award_log`, log.id)));
        await batch.commit();
        showToast('All your award logs have been purged! Student scores are not affected.', 'success');
    } catch (error) { console.error("Error purging award logs: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Purge All My Award Logs'; }
}

async function handleEraseTodaysStars() {
    const btn = document.getElementById('erase-today-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Erasing...';
    try {
        const studentIdsToReset = Object.keys(todaysStars);
        if (studentIdsToReset.length === 0) { showToast('You have not awarded any stars today!', 'info'); return; }
        const resetPromises = studentIdsToReset.map(id => setStudentStarsForToday(id, 0, null));
        await Promise.all(resetPromises);
        showToast('All stars awarded by you today have been erased!', 'success');
    } catch (error) { console.error("Error erasing today's stars: ", error); showToast(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-undo mr-2"></i> Erase Today\'s Stars'; }
}

function showLogbookModal(dateString) {
    const logs = allAwardLogs.filter(log => getDDMMYYYY(parseDDMMYYYY(log.date)) === dateString);
    const titleEl = document.getElementById('logbook-modal-title');
    const contentEl = document.getElementById('logbook-modal-content');
    const displayDate = parseDDMMYYYY(dateString);
    titleEl.innerText = `Log for ${displayDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    
    const reasonColors = { teamwork: 'text-purple-600', creativity: 'text-pink-600', respect: 'text-green-600', focus: 'text-yellow-600', correction: 'text-gray-500', welcome_back: 'text-cyan-600', story_weaver: 'text-cyan-600', scholar_s_bonus: 'text-amber-700' };

    if (logs.length === 0) {
        contentEl.innerHTML = '<p class="text-gray-600 text-center py-8">No stars were awarded in the school on this day.</p>';
    } else {
        const teacherNameMap = allSchoolClasses.reduce((acc, c) => {
            if (c.createdBy?.uid && c.createdBy?.name) {
                acc[c.createdBy.uid] = c.createdBy.name;
            }
            return acc;
        }, {});
        teacherNameMap[currentUserId] = currentTeacherName;

        const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
        const reasonCounts = logs.reduce((acc, log) => { if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
        const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const classStarCounts = logs.reduce((acc, log) => { acc[log.classId] = (acc[log.classId] || 0) + log.stars; return acc; }, {});

        const GOAL_PER_STUDENT = { DIAMOND: 18 };
        const classProgressIncreases = Object.entries(classStarCounts).map(([classId, starsToday]) => {
        const studentsInClass = allStudents.filter(s => s.classId === classId);
        const studentCount = studentsInClass.length;
        if (studentCount === 0) return { classId, progressIncrease: 0 };

        const diamondGoal = Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND);
        if (diamondGoal === 0) return { classId, progressIncrease: 0 };

        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = allStudentScores.find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

       const monthlyStarsBefore = currentMonthlyStars - starsToday;
       const progressIncrease = ((currentMonthlyStars / diamondGoal) * 100) - ((monthlyStarsBefore / diamondGoal) * 100);

        return { classId, progressIncrease };
      });

        const topClassEntry = classProgressIncreases.length > 0 ? classProgressIncreases.sort((a, b) => b.progressIncrease - a.progressIncrease)[0] : null;
        const topClassId = topClassEntry ? topClassEntry.classId : null;
        const topClass = topClassId ? allSchoolClasses.find(c => c.id === topClassId) : null;
        
        let summaryHtml = `<div class="grid grid-cols-3 gap-4 text-center mb-6 p-4 bg-gray-50 rounded-2xl border">
            <div><div class="text-sm text-gray-500">Total Stars</div><div class="font-title text-3xl text-amber-600 flex items-center justify-center gap-2">${totalStars} <i class="fas fa-star"></i></div></div>
            <div><div class="text-sm text-gray-500">Top Skill</div><div class="font-title text-3xl ${reasonColors[topReason] || 'text-purple-600'} capitalize">${topReason.replace(/_/g, ' ')}</div></div>
            <div><div class="text-sm text-gray-500">Top Class</div><div class="font-title text-xl text-green-600 truncate">${topClass ? `${topClass.logo} ${topClass.name}` : 'N/A'}</div></div>
        </div>`;

        const groupedByClass = logs.reduce((acc, log)=> { (acc[log.classId] = acc[log.classId] || []).push(log); return acc; }, {});
        
        let detailsHtml = '';
        for (const classId in groupedByClass) {
            const classInfo = allSchoolClasses.find(c => c.id === classId);
            if (!classInfo) continue;
            detailsHtml += `<div class="mb-4 bg-white p-4 rounded-xl shadow-md border"><h3 class="font-title text-xl text-gray-800 border-b pb-2 mb-2 flex justify-between items-center"><span>${classInfo.logo} ${classInfo.name}</span> <span class="text-amber-500 font-sans font-bold text-lg">${classStarCounts[classId]} ⭐</span></h3><div class="space-y-2 mt-2">`;
            
            groupedByClass[classId].sort((a, b) => {
                const nameA = allStudents.find(s => s.id === a.studentId)?.name || 'Z';
                const nameB = allStudents.find(s => s.id === b.studentId)?.name || 'Z';
                return nameA.localeCompare(nameB);
            }).forEach(log => {
                const student = allStudents.find(s => s.id === log.studentId);
                const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
                const colorClass = reasonColors[log.reason] || 'text-gray-500';
                const noteHtml = log.note ? `<p class="text-xs text-gray-600 italic pl-4 border-l-2 border-gray-300 ml-1 mt-1">"${log.note}"</p>` : '';
                detailsHtml += `<div class="bg-gray-50 p-3 rounded-lg min-h-[50px] flex flex-col justify-center" id="log-entry-${log.id}">
                            <div class="flex justify-between items-center">
                                <div class="flex-grow">
                                    <span class="font-semibold">${student?.name || '?'}</span>
                                    <span class="text-sm text-gray-500"> - for <b class="${colorClass} capitalize">${(log.reason || '').replace(/_/g, ' ')}</b> from ${teacherName}</span>
                                </div>
                                <div class="flex items-center flex-shrink-0">
                                    <span class="font-title text-lg text-amber-600">${log.stars} ⭐</span>
                                    ${log.teacherId === currentUserId ? `<button class="note-log-btn" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>` : ''}
                                    ${log.teacherId === currentUserId && log.reason !== 'story_weaver' && log.reason !== 'scholar_s_bonus' ? `<button class="delete-log-btn ml-2" data-log-id="${log.id}" data-student-id="${log.studentId}" data-stars="${log.stars}" title="Delete this log entry">&times;</button>` : ''}
                                </div>
                            </div>
                            ${noteHtml}
                         </div>`;
            });
            detailsHtml += `</div></div>`;
        }
        contentEl.innerHTML = summaryHtml + detailsHtml;
    }
    document.getElementById('logbook-modal').classList.remove('hidden');
}

async function handleDeleteAwardLog(logId, studentId, stars) {
    showModal('Delete Log Entry?', `Are you sure you want to delete this award? The student's score will be updated.`, async () => {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        try {
            await runTransaction(db, async (transaction) => {
                const logRef = doc(db, `${publicDataPath}/award_log`, logId);
                const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);

                const logDoc = await transaction.get(logRef);
                if (!logDoc.exists()) {
                    console.log("Log already deleted, nothing to do.");
                    return; 
                }
                const logData = logDoc.data();
                const actualStars = logData.stars;

                const scoreDoc = await transaction.get(scoreRef);
                if (scoreDoc.exists()) {
                    const awardMonth = logData.date.substring(0, 7);
                    const currentMonth = getDDMMYYYY(new Date()).substring(3);
                    const updates = { totalStars: increment(-actualStars) };
                    if (awardMonth === currentMonth) {
                        updates.monthlyStars = increment(-actualStars);
                    }
                    transaction.update(scoreRef, updates);
                }

                transaction.delete(logRef);

                if (logData.date === getTodayDateString()) {
                    const todayStarsQuery = query(
                        collection(db, `${publicDataPath}/today_stars`), 
                        where("studentId", "==", studentId), 
                        where("teacherId", "==", currentUserId)
                    );
                    const todayStarsSnapshot = await getDocs(todayStarsQuery);
                    todayStarsSnapshot.forEach(doc => {
                        transaction.delete(doc.ref);
                    });
                }
            });

            showToast('Log entry deleted successfully!', 'success');
            
            const logElement = document.getElementById(`log-entry-${logId}`);
            if (logElement) {
                logElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                logElement.style.opacity = '0';
                logElement.style.transform = 'scale(0.9)';
                setTimeout(() => {logElement.remove();
                   const contentEl = document.getElementById('logbook-modal-content');
                   if (contentEl.querySelectorAll('[id^="log-entry-"]').length === 0) {
                       hideModal('logbook-modal');
                   }
                }, 300);
            }

        } catch (error) {
            console.error('Error deleting award log:', error);
            showToast(`Failed to delete log entry: ${error.message}`, 'error');
        }
    });
}

function openAwardNoteModal(logId) {
    const log = allAwardLogs.find(l => l.id === logId);
    if (!log) return;
    document.getElementById('award-note-log-id-input').value = logId;
    document.getElementById('award-note-textarea').value = log.note || '';
    document.getElementById('award-note-modal').classList.remove('hidden');
}

async function handleSaveAwardNote() {
    const logId = document.getElementById('award-note-log-id-input').value;
    const newNote = document.getElementById('award-note-textarea').value;

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/award_log", logId), {
            note: newNote,
        });
        showToast('Note saved!', 'success');
        hideModal('award-note-modal');
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast('Failed to save note.', 'error');
    }
}

// --- AI "QUEST MASTER" FUNCTIONS ---
async function triggerDynamicPraise(studentName, starCount, reason) {
    const firstName = studentName.split(' ')[0];
    const starText = starCount === 1 ? "1 star" : `${starCount} stars`;
    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, game-like single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive praise message to a student who just earned stars for a specific reason. The praise should be one sentence only.";
    const userPrompt = `Generate a one-sentence praise for a student named ${firstName} who just earned ${starText} for demonstrating excellent ${reason}.`;
    try {
        const praise = await callGeminiApi(systemPrompt, userPrompt);
        if (praise) showPraiseToast(praise, '✨');
    } catch (error) { console.error('Gemini Praise Error:', error); }
}

async function handleGenerateClassName() {
    const level = document.getElementById('class-level').value;
    if (!level) { showToast('Please select a Quest Level first.', 'error'); return; }
    const ageGroup = getAgeGroupForLeague(level);
    const btn = document.getElementById('generate-class-name-btn');
    const suggestionsContainer = document.getElementById('class-name-suggestions');
    btn.disabled = true;
    suggestionsContainer.innerHTML = `<span class="text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Thinking of cool names...</span>`;

    const systemPrompt = "You are a creative assistant for a teacher. Generate 5 fun, child-appropriate team names for a classroom. The names should be themed around adventure, learning, or positive concepts. Crucially, the names must be suitable for the specified age group. Do NOT use markdown or any formatting other than a new line for each name. Just provide the list of names.";
    const userPrompt = `Generate 5 team names for a class of students aged ${ageGroup}.`;

    try {
        const names = await callGeminiApi(systemPrompt, userPrompt);
        const nameArray = names.split('\n').filter(n => n.trim() !== '');
        suggestionsContainer.innerHTML = nameArray.map(name => 
            `<button type="button" class="suggestion-btn bg-gray-200 text-gray-800 text-sm font-semibold py-1 px-3 rounded-full hover:bg-green-200 bubbly-button">${name.trim()}</button>`
        ).join('');
    } catch (error) {
        console.error('Gemini Class Name Error:', error);
        suggestionsContainer.innerHTML = `<span class="text-red-500">Oops! The Quest Master is busy. Please try again.</span>`;
    } finally {
        btn.disabled = false;
    }
}

async function handleGenerateIdea() {
    const classId = document.getElementById('gemini-class-select').value;
    if (!classId) { showToast('Please select a class first.', 'error'); return; }
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) { showToast('Could not find selected class data.', 'error'); return; }
    const ageGroup = getAgeGroupForLeague(classData.questLevel);

    const btn = document.getElementById('gemini-idea-btn'), output = document.getElementById('gemini-idea-output'), copyBtn = document.getElementById('copy-idea-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Thinking...';
    output.value = ''; copyBtn.disabled = true; copyBtn.classList.add('opacity-50');

    const systemPrompt = `You are the 'Quest Master,' a helpful AI assistant for a teacher's classroom competition. You are creative, fun, and concise. Do NOT use markdown or asterisks. You will be asked to generate a 'special lesson experience' reward idea. The teacher will provide an age group. Make the idea fun, educational, and achievable in a classroom setting, and ensure it is perfectly suited for the specified age group. Format the response with a title and a 2-3 sentence description.`;
    const userPrompt = `Generate a 'special lesson experience' reward idea for students in the ${ageGroup} age group.`;
    try {
        const idea = await callGeminiApi(systemPrompt, userPrompt);
        output.value = idea;
        copyBtn.disabled = false; copyBtn.classList.remove('opacity-50');
    } catch (error) { console.error('Gemini Idea Error:', error); output.value = 'Oops! The Quest Master is busy. Please try again in a moment.'; }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lightbulb mr-2"></i> Generate New Idea'; }
}

// --- CALENDAR & HISTORY LOGIC ---
function changeCalendarMonth(change) {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + change);
    if (calendarCurrentDate < competitionStart) calendarCurrentDate = new Date(competitionStart);
    if (calendarCurrentDate > competitionEnd) calendarCurrentDate = new Date(competitionEnd);
    renderCalendarTab();
}

function openHistoryModal() {
    populateHistoryMonthSelector();
    renderHistoricalLeaderboard("");
    document.getElementById('history-modal').classList.remove('hidden');
}

function populateHistoryMonthSelector() {
    const select = document.getElementById('history-month-select');
    select.innerHTML = '<option value="">--Choose a month--</option>';

    const now = new Date();
    let loopDate = new Date(competitionStart);

    while (loopDate < now) {
        if (loopDate.getFullYear() < now.getFullYear() || (loopDate.getFullYear() === now.getFullYear() && loopDate.getMonth() < now.getMonth())) {const monthKey = loopDate.toISOString().substring(0, 7);
            const displayString = loopDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
            select.innerHTML += `<option value="${monthKey}">${displayString}</option>`;
        }
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
}

async function renderHistoricalLeaderboard(monthKey) {
    const contentEl = document.getElementById('history-modal-content');
    if (!monthKey) {
        contentEl.innerHTML = '<p class="text-center text-gray-500">Select a month to view historical rankings.</p>';
        return;
    }

    // FIX #7: Use global league state
    const league = globalSelectedLeague;
    if (!league) {
        contentEl.innerHTML = '<p class="text-center text-red-500">Please select a league on the main tab first.</p>';
        return;
    }

    await fetchMonthlyHistory(monthKey);
    const monthlyScores = allMonthlyHistory[monthKey] || {};
    
    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const classesInLeague = allSchoolClasses.filter(c => c.questLevel === league);
    
    const classScores = classesInLeague.map(c => {
        const studentsInClass = allStudents.filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18;
        const totalStars = studentsInClass.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100).toFixed(1) : 0;
        
        let milestone = "None";
        if (totalStars >= (studentCount * GOAL_PER_STUDENT.DIAMOND)) milestone = "💎 Diamond";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.GOLD)) milestone = "👑 Gold";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.SILVER)) milestone = "🏆 Silver";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.BRONZE)) milestone = "🛡️ Bronze";

        return { ...c, totalStars, progress, milestone };
    }).sort((a, b) => b.progress - a.progress || b.totalStars - a.totalStars);

    let html = `<h3 class="font-title text-2xl text-amber-700">Class Quest Map for ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>`;
    if (classScores.length === 0 || classScores.every(c => c.totalStars === 0)) {
        html += `<p class="text-gray-600 mt-2">No Quest Map data was recorded for this league during ${monthKey}.</p>`;
    } else {
        html += `<div class="mt-2 space-y-2">`;
        classScores.forEach((c, index) => {
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 border-amber-300">
                    <span class="font-bold text-lg">${index + 1}. ${c.logo} ${c.name}</span> 
                    <div class="text-right">
                        <span class="font-bold text-amber-600">${c.totalStars} ⭐ (${c.progress}%)</span>
                        <span class="block text-xs text-gray-500">Highest Milestone: ${c.milestone}</span>
                        </div>
                </div>`;
        });
        html += `</div>`;
    }

    html += `<h3 class="font-title text-2xl text-purple-700 mt-6">"Prodigy of the Month" Race for ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>`;
    const studentsInLeague = allStudents
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => ({ ...s, score: monthlyScores[s.id] || 0 }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

    if (studentsInLeague.length === 0) {
        html += `<p class="text-gray-600 mt-2">No students earned stars in this league during ${monthKey}.</p>`;
    } else {
        html += `<div class="mt-2 space-y-2">`;
        studentsInLeague.slice(0, 50).forEach((s, index) => {
            const classInfo = allSchoolClasses.find(c => c.id === s.classId);
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 border-purple-300">
                    <span class="font-bold text-lg">${index + 1}. ${classInfo.logo} ${s.name}</span> 
                    <span class="font-bold text-purple-600">${s.score} ⭐</span>
                </div>`;
        });
         html += `</div>`;
    }
    
    contentEl.innerHTML = html;
}

async function fetchMonthlyHistory(monthKey) {
    if (allMonthlyHistory[monthKey]) return;
    const contentEl = document.getElementById('history-modal-content');
    if(contentEl) contentEl.innerHTML = `<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading historical data...</p>`;
    
    const historyQuery = query(collectionGroup(db, 'monthly_history'), where("month", "==", monthKey));
    try {
        const snapshot = await getDocs(historyQuery);
        const scores = {};
        snapshot.forEach(doc => {
            const studentId = doc.ref.parent.parent.id;
            scores[studentId] = doc.data().stars || 0;
        });
        allMonthlyHistory[monthKey] = scores;
    } catch (error) {
        console.error("Error fetching monthly history:", error);
        allMonthlyHistory[monthKey] = {};
    }
}

function openMilestoneModal(markerElement) {
    const questCard = markerElement.closest('.quest-card');
    const classId = questCard.dataset.classId;
    const classInfo = allSchoolClasses.find(c => c.id === classId);
    if (!classInfo) return;

    const studentsInClass = allStudents.filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = allStudentScores.find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const goals = {
        bronze: Math.round(studentCount * GOAL_PER_STUDENT.BRONZE),
        silver: Math.round(studentCount * GOAL_PER_STUDENT.SILVER),
        gold: Math.round(studentCount * GOAL_PER_STUDENT.GOLD),
        diamond: studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18
    };

    const modalTitle = document.getElementById('milestone-modal-title');
    const modalContent = document.getElementById('milestone-modal-content');
    
    let milestoneName, goal, icon;
    if (markerElement.innerText.includes('🛡️')) { milestoneName = "Bronze Shield"; goal = goals.bronze; icon = '🛡️'; } 
    else if (markerElement.innerText.includes('🏆')) { milestoneName = "Silver Trophy"; goal = goals.silver; icon = '🏆'; }
    else if (markerElement.innerText.includes('👑')) { milestoneName = "Golden Crown"; goal = goals.gold; icon = '👑'; } 
    else { milestoneName = "Diamond Quest"; goal = goals.diamond; icon = '💎'; }

   
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    const relevantLogs = allAwardLogs.filter(log => {
        if (log.classId !== classId) return false;
        
        const logDate = parseDDMMYYYY(log.date); 
        
        return logDate.getMonth() === currentMonthIndex && logDate.getFullYear() === currentYear;
    });


    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyStars = relevantLogs
    .filter(log => parseDDMMYYYY(log.date) >= startOfWeek)
    .reduce((sum, log) => sum + log.stars, 0);

    const reasonCounts = relevantLogs.reduce((acc, log) => {
        acc[log.reason || 'other'] = (acc[log.reason || 'other'] || 0) + log.stars;
        return acc;
    }, {});
    const topReasonEntry = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0];
    const topReason = topReasonEntry ? `${topReasonEntry[0].charAt(0).toUpperCase() + topReasonEntry[0].slice(1)}` : "N/A";

    const studentScores = studentsInClass.map(s => {
        const score = allStudentScores.find(sc => sc.id === s.id)?.monthlyStars || 0;
        return { name: s.name, score };
    }).filter(s => s.score > 0);
    
    let topAdventurers = "None yet this month!";
    if(studentScores.length > 0) {
        const topStudents = studentScores.sort((a, b) => b.score - a.score).slice(0, 5).map(s => `${s.name} (${s.score}⭐)`);
        topAdventurers = topStudents.join(', ');
    }
    
    modalTitle.innerHTML = `${icon} ${milestoneName}`;
    const starsNeeded = Math.max(0, goal - currentMonthlyStars);
    const progressPercent = goal > 0 ? Math.min(100, (currentMonthlyStars / goal) * 100).toFixed(1) : 0;

    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div class="text-center">
                <h3 class="font-title text-4xl text-gray-800">${classInfo.logo} ${classInfo.name}</h3>
                <p class="text-lg text-gray-600 -mt-2">Progress towards the ${milestoneName}</p>
                
                <div class="text-2xl my-4">
                    <p><span class="font-bold text-amber-500 text-5xl">${currentMonthlyStars}</span> / <span class="font-bold text-3xl text-gray-500">${goal}</span></p>
                    <p class="text-sm text-gray-500 -mt-1">Total Stars Collected</p>
                    <div class="w-full bg-gray-200 rounded-full h-6 shadow-inner mt-2 border-2 border-gray-300">
                        <div class="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full flex items-center justify-center text-white font-bold text-sm" style="width: ${progressPercent}%">
                            ${progressPercent > 10 ? `${progressPercent}%` : ''}
                        </div>
                    </div>
                </div>
                
                ${starsNeeded > 0 
                    ? `<p class="mt-4 text-blue-600 font-bold text-3xl animate-pulse">${starsNeeded} more stars to go!</p>` 
                    : `<p class="mt-4 text-green-600 font-bold text-3xl title-sparkle">Milestone Achieved! Well done!</p>`
                }
            </div>
            <div class="text-left bg-gray-50 p-6 rounded-2xl border-2 border-gray-200 space-y-4">
                 <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-bolt text-yellow-500"></i> Weekly Momentum</p>
                    <p class="font-bold text-2xl text-yellow-600">${weeklyStars} stars this week</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-award text-green-500"></i> Top Skill This Month</p>
                    <p class="font-bold text-2xl text-green-600">${topReason}</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-crown text-purple-500"></i> Top Adventurers (Monthly)</p>
                    <p class="font-semibold text-lg text-purple-600" title="${topAdventurers}">${topAdventurers}</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('milestone-details-modal').classList.remove('hidden');
}


// --- QUEST EVENT FUNCTIONS ---
function renderQuestEventDetails() {
    const type = document.getElementById('quest-event-type').value;
    const container = document.getElementById('quest-event-details-container');
    let html = '';
    
    const completionBonusField = `
        <div>
            <label for="quest-completion-bonus" class="block text-sm font-medium text-gray-700">Completion Bonus (Stars per student)</label>
            <input type="number" id="quest-completion-bonus" value="1" min="0.5" step="0.5" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
        </div>
    `;

    const goalTargetField = (label) => `
        <div>
            <label for="quest-goal-target" class="block text-sm font-medium text-gray-700">${label}</label>
            <input type="number" id="quest-goal-target" value="10" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
        </div>
    `;
    
    switch(type) {
        case 'Vocabulary Vault':
        case 'Grammar Guardians':
            html = goalTargetField('Goal Target (# of Uses/Sentences)') + completionBonusField;
            break;
        case 'The Unbroken Chain':
        case 'The Scribe\'s Sketch':
        case 'Five-Sentence Saga':
            html = completionBonusField;
            break;
        case 'Reason Bonus Day':
            html = `<div>
                        <label for="quest-event-reason" class="block text-sm font-medium text-gray-700">Bonus Reason</label>
                        <select id="quest-event-reason" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
                            <option value="teamwork">Teamwork</option>
                            <option value="creativity">Creativity</option>
                            <option value="respect">Respect</option>
                            <option value="focus">Focus/Effort</option>
                        </select>
                     </div>`;
            break;
        default:
            html = '';
            break;
    }
    container.innerHTML = html;
}

async function handleAddQuestEvent() {
    const date = document.getElementById('quest-event-date').value;
    const type = document.getElementById('quest-event-type').value;
    if (!type) {
        showToast('Please select an event type.', 'error');
        return;
    }

    let details = {};
    const title = document.getElementById('quest-event-type').options[document.getElementById('quest-event-type').selectedIndex].text;
    details.title = title;

    try {
        switch(type) {
            case 'Vocabulary Vault':
            case 'Grammar Guardians':
                details.goalTarget = parseInt(document.getElementById('quest-goal-target').value);
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.goalTarget) || isNaN(details.completionBonus) || details.goalTarget <= 0 || details.completionBonus <= 0) {
                    throw new Error("Please enter valid numbers for the goal and bonus.");
                }
                break;
            case 'The Unbroken Chain':
            case 'The Scribe\'s Sketch':
            case 'Five-Sentence Saga':
                details.completionBonus = parseFloat(document.getElementById('quest-completion-bonus').value);
                if (isNaN(details.completionBonus) || details.completionBonus <= 0) {
                    throw new Error("Please enter a valid bonus amount.");
                }
                break;
            case 'Reason Bonus Day':
                const reason = document.getElementById('quest-event-reason').value;
                details.reason = reason;
                details.title = `${reason.charAt(0).toUpperCase() + reason.slice(1)} Bonus Day`;
                break;
            case '2x Star Day':
                break;
            default:
                throw new Error("Invalid event type selected.");
        }

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_events"), {
            date, type, details,
            createdBy: { uid: currentUserId, name: currentTeacherName },
            createdAt: serverTimestamp()
        });
        showToast('Quest Event added to calendar!', 'success');
        hideModal('day-planner-modal');

    } catch (error) {
        console.error("Error adding quest event:", error);
        showToast(error.message || 'Failed to save event.', 'error');
    }
}

async function handleDeleteQuestEvent(eventId) {
    try {
        await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/quest_events", eventId));
        showToast('Event deleted!', 'success');
    } catch (error) {
        console.error("Error deleting event:", error);
        showToast('Could not delete event.', 'error');
    }
}

async function handleCancelLesson(dateString, classId) {
    const override = allScheduleOverrides.find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'one-time') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { date: dateString, classId, type: 'cancelled', createdBy: { uid: currentUserId, name: currentTeacherName }, createdAt: serverTimestamp() });
        }
        showToast("Lesson cancelled for this day.", "success");
        renderScheduleManagerList(dateString);
    } catch (e) { showToast("Error updating schedule.", "error"); }
}

async function handleAddOneTimeLesson(dateString) {
    const classId = document.getElementById('add-onetime-lesson-select').value;
    if (!classId) return;
    const override = allScheduleOverrides.find(o => o.date === dateString && o.classId === classId);
    try {
        if (override && override.type === 'cancelled') {
            await deleteDoc(doc(db, `artifacts/great-class-quest/public/data/schedule_overrides`, override.id));
        } else {
            await addDoc(collection(db, `artifacts/great-class-quest/public/data/schedule_overrides`), { date: dateString, classId, type: 'one-time', createdBy: { uid: currentUserId, name: currentTeacherName }, createdAt: serverTimestamp() });
        }
        showToast("One-time lesson added.", "success");
        renderScheduleManagerList(dateString);
    } catch (e) { showToast("Error updating schedule.", "error"); }
}

// --- AI REPORT & CERTIFICATE FUNCTIONS ---
async function handleGenerateReport(classId) {
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;
    const contentEl = document.getElementById('report-modal-content');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating your report from the Quest Log...</p>`;
    document.getElementById('report-modal').classList.remove('hidden');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('en-GB');

    const logs = allAwardLogs.filter(log => log.classId === classId && log.date >= oneWeekAgoStr);
    const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const reasonCounts = logs.reduce((acc, log) => { acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
    const reasonsString = Object.entries(reasonCounts).map(([reason, count]) => `${reason}: ${count}`).join(', ');
    const behaviorNotes = logs.filter(log => log.note).map(log => `On ${log.date}, a note mentioned: "${log.note}"`).join('. ');
    
    const academicScores = allWrittenScores.filter(score => score.classId === classId && score.date >= oneWeekAgoStr);
    const academicNotes = academicScores.filter(score => score.note).map(score => `For a ${score.type} on ${score.date}, a note said: "${score.note}"`).join('. ');
    const academicSummary = academicScores.map(s => `A ${s.type} score of ${s.scoreNumeric || s.scoreQualitative}`).join(', ');

    const systemPrompt = "You are the 'Quest Master,' a helpful AI assistant. You write encouraging, insightful reports for teachers. Do not use markdown. Format your response into two paragraphs with clear headings. The first paragraph is a 'Weekly Summary,' and the second is a 'Suggested Mini-Quest.' Your analysis must be based on ALL provided data: behavioral (stars) and academic (scores), including any teacher notes.";
    const userPrompt = `Class "${classData.name}" (League: ${classData.questLevel}) this week:
- Behavior Data: Earned ${totalStars} stars. Breakdown: ${reasonsString || 'None'}. Notes: ${behaviorNotes || 'None'}.
- Academic Data: Recent scores: ${academicSummary || 'None'}. Notes on scores: ${academicNotes || 'None'}.
Write a 2-paragraph summary highlighting connections between behavior and academics, and suggest a 'mini-quest' for next week based on this combined data.`;
    
    try {
        const report = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<h3 class="font-title text-2xl text-green-600 mb-2">${classData.logo} ${classData.name}</h3>` + report.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    } catch (error) {
        console.error("AI Report Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">The Quest Master is currently on another adventure. Please try again later.</p>`;
    }
}

async function handleGenerateCertificate(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    const studentClass = allSchoolClasses.find(c => c.id === student.classId);
    if (!student || !studentClass) return;

    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating unique certificate...</p>`;
    downloadBtn.classList.add('hidden');
    document.getElementById('certificate-modal').classList.remove('hidden');

    const ageCategory = getAgeCategoryForLeague(studentClass.questLevel);
    let stylePool = midCertificateStyles;
    if (ageCategory === 'junior') stylePool = juniorCertificateStyles;
    if (ageCategory === 'senior') stylePool = seniorCertificateStyles;
    const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
    
    const certTemplate = document.getElementById('certificate-template');
    certTemplate.style.borderColor = randomStyle.borderColor;
    certTemplate.style.backgroundColor = randomStyle.bgColor;
    certTemplate.style.color = randomStyle.textColor;
    
    // Handle Avatar
    const certAvatarEl = document.getElementById('cert-avatar');
    if (student.avatar) {
        certAvatarEl.src = student.avatar;
        certAvatarEl.style.display = 'block';
    } else {
        certAvatarEl.style.display = 'none';
    }

    document.getElementById('cert-icon').innerText = randomStyle.icon;
    document.getElementById('cert-icon').style.color = randomStyle.borderColor;
    document.getElementById('cert-title').style.color = randomStyle.titleColor;
    document.getElementById('cert-student-name').style.color = randomStyle.nameColor;
    document.getElementById('cert-teacher-name').style.borderTopColor = randomStyle.borderColor;
    document.getElementById('cert-date').style.borderTopColor = randomStyle.borderColor;

    const startOfMonth = new Date(new Date().setDate(1)).toLocaleDateString('en-GB');
    const logs = allAwardLogs.filter(log => log.studentId === studentId && log.teacherId === currentUserId && log.date >= startOfMonth);
    const monthlyStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const topReason = Object.entries(logs.reduce((acc, log) => {
        acc[log.reason] = (acc[log.reason] || 0) + 1;
        return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all-around excellence';
    
    const academicScores = allWrittenScores.filter(score => score.studentId === studentId && score.date >= startOfMonth);
    const topScore = academicScores.sort((a, b) => (b.scoreNumeric / b.maxScore) - (a.scoreNumeric / a.scoreNumeric))[0];
    const topScoreString = topScore ? `a top score of ${topScore.scoreNumeric || topScore.scoreQualitative}` : "";
    const academicNotes = academicScores.filter(s => s.note).map(s => `(Academic note: '${s.note}')`).join(' ');

    let systemPrompt = "";
    if (ageCategory === 'junior') { 
        systemPrompt = "You are an AI writing for a young child's (ages 7-9) achievement certificate. Use very simple English, short sentences, and a cheerful tone. Do NOT use markdown. Write 1-2 brief, simple sentences. Focus on being encouraging. If specific notes are provided, try to incorporate their theme simply.";
    } else if (ageCategory === 'mid') { 
        systemPrompt = "You are an AI writing for a pre-teen's (ages 9-12) certificate. Use positive, encouraging language that sounds cool and acknowledges their effort. Do NOT use markdown. Write 2 brief, well-structured sentences. Refer to specific achievements if notes are provided.";
    } else {
        systemPrompt = "You are an AI writing for a teenager's (ages 12+) certificate. The student is an English language learner. Use clear, positive, and inspiring language, avoiding overly complex vocabulary. The tone should respect their effort. Do NOT use markdown. Write 2 brief, powerful sentences. Use the teacher's notes and academic scores to make the message specific and impactful.";
    }
    const userPrompt = `Write a short certificate message for ${student.name}. This month they showed great ${topReason}, earned ${monthlyStars} stars, and achieved ${topScoreString || 'good results on their trials'}. Teacher's academic notes: ${academicNotes || 'None'}. Keep it brief.`;

    try {
        const text = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<p class="text-lg text-center p-4">${text}</p>`;
        document.getElementById('cert-student-name').innerText = student.name;
        document.getElementById('cert-text').innerText = text;
        document.getElementById('cert-teacher-name').innerText = currentTeacherName;
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' });
        downloadBtn.classList.remove('hidden');
    } catch (error) {
        console.error("AI Certificate Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">There was an error generating the certificate text. Please try again.</p>`;
    }
}

async function downloadCertificateAsPdf() {
    const btn = document.getElementById('download-certificate-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Preparing PDF...`;
    
    const { jsPDF } = window.jspdf;
    const certificateElement = document.getElementById('certificate-template');
    const studentName = document.getElementById('cert-student-name').innerText;

    try {
        const canvas = await html2canvas(certificateElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        pdf.save(`${studentName}_Certificate_of_Achievement.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast('Could not generate PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-download mr-2"></i> Download as PDF`;
    }
}

// --- GENERAL UTILITY FUNCTIONS ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let bgColor, icon;
    if (type === 'success') { bgColor = 'bg-green-500'; icon = '<i class="fas fa-check-circle"></i>'; }
    else if (type === 'error') { bgColor = 'bg-red-500'; icon = '<i class="fas fa-exclamation-triangle"></i>'; }
    else { bgColor = 'bg-blue-500'; icon = '<i class="fas fa-info-circle"></i>'; }
    toast.className = `transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0 ${bgColor} text-white font-bold py-3 px-5 rounded-lg shadow-lg flex items-center space-x-3 pointer-events-auto ml-auto`;
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showPraiseToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    const wrapper = document.createElement('div');
    const isLeft = Math.random() > 0.5;
    wrapper.className = `w-full flex ${isLeft ? 'justify-start' : 'justify-end'} mb-3`;

    const toast = document.createElement('div');
    toast.className = "praise-toast pointer-events-auto";
    toast.innerHTML = `
        <div class="praise-toast-content">
            <div class="praise-toast-icon">${icon}</div>
            <div class="praise-toast-text">${message}</div>
        </div>
        <button class="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-lg">&times;</button>
    `;
    
    wrapper.appendChild(toast);
    container.appendChild(wrapper);
    
    const animateOut = (el) => {
        if (!el) return;
        const innerToast = el.querySelector('.praise-toast');
        if (!innerToast || innerToast.classList.contains('disappearing')) return;
        innerToast.classList.add('disappearing');
        setTimeout(() => el.remove(), 400);
    };

    toast.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        animateOut(wrapper);
    });
    setTimeout(() => animateOut(wrapper), 5000);
}

async function showWelcomeBackMessage(firstName, stars) {
    const modal = document.getElementById('welcome-back-modal');
    const messageEl = document.getElementById('welcome-back-message');
    const starsEl = document.getElementById('welcome-back-stars');

    starsEl.textContent = stars;
    messageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    modal.classList.remove('hidden');

    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive welcome back message to a student who was absent. It must be one sentence only.";
    const userPrompt = `Generate a one-sentence welcome back message for a student named ${firstName}.`;

    try {
        const message = await callGeminiApi(systemPrompt, userPrompt);
        messageEl.textContent = message;
    } catch (e) {
        messageEl.textContent = `We're so glad you're back, ${firstName}!`;
    }
    
    setTimeout(() => {
        hideModal('welcome-back-modal');
    }, 4000);
}


function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!', 'success');
}

function updateDateTime() {
    const now = new Date(), dateEl = document.getElementById('current-date'), timeEl = document.getElementById('current-time');
    if (dateEl && timeEl) {
        const dayClassMap = { 0: 'shadow-sun', 1: 'shadow-mon', 2: 'shadow-tue', 3: 'shadow-wed', 4: 'shadow-thu', 5: 'shadow-fri', 6: 'shadow-sat' };
        const shadowClass = dayClassMap[now.getDay()];
        const rawDateString = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        dateEl.className = 'text-3xl font-bold ' + shadowClass;
        dateEl.innerHTML = Array.from(rawDateString).map((char, i) => `<span class="date-char" style="animation-delay: ${i * 0.05}s">${char === ' ' ? '&nbsp;' : char}</span>`).join('');
        const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        timeEl.className = 'text-3xl pulse-subtle ' + shadowClass;
        timeEl.innerHTML = Array.from(timeString).map((char, i) => `<span class="date-char" style="animation-delay: ${i * 0.05}s">${char}</span>`).join('');
    }
}

function toggleAwardClassDropdown() {
    const panel = document.getElementById('award-class-dropdown-panel');
    const icon = document.querySelector('#award-class-dropdown-btn i');
    panel.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
}

function selectAwardClass(classId, toggle = true) {
    const selectedClass = allTeachersClasses.find(c => c.id === classId);
    if (!selectedClass) return;

    const btn = document.getElementById('award-class-dropdown-btn');
    document.getElementById('selected-class-logo').innerText = selectedClass.logo;
    document.getElementById('selected-class-name').innerText = selectedClass.name;
    document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
    btn.dataset.selectedId = classId;

    if (toggle) {
        toggleAwardClassDropdown();
    }
    renderAwardStarsStudentList(classId, true);
}

async function handleGetOracleInsight() {
    const classId = document.getElementById('oracle-class-select').value;
    const question = document.getElementById('oracle-question-input').value.trim();
    if (!classId || !question) {
        showToast('Please select a class and ask a question.', 'error');
        return;
    }
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData) return;

    const btn = document.getElementById('oracle-insight-btn');
    const output = document.getElementById('oracle-insight-output');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Consulting the Oracle...';
    output.value = '';

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toLocaleDateString('en-GB');

    const relevantLogs = allAwardLogs.filter(log => log.classId === classId && log.date >= oneMonthAgoStr).map(log => {
        const student = allStudents.find(s => s.id === log.studentId);
        const noteText = log.note ? ` (Note: ${log.note})` : '';
        return `On ${log.date}, ${student?.name || 'A student'} received ${log.stars} star(s) for ${log.reason}${noteText}.`;
    }).join('\n');
    
    // FIX #9: Smarter Oracle - Add academic and attendance data
    const academicScores = allWrittenScores.filter(score => score.classId === classId && score.date >= oneMonthAgoStr).map(score => {
        const student = allStudents.find(s => s.id === score.studentId);
        const noteText = score.note ? ` (Note: ${score.note})` : '';
        return `On ${score.date}, ${student?.name || 'A student'} scored ${score.scoreNumeric || score.scoreQualitative} on a ${score.type}${noteText}.`;
    }).join('\n');
    
    const attendanceRecords = allAttendanceRecords.filter(rec => rec.classId === classId && rec.date >= oneMonthAgoStr);
    const absenceCount = attendanceRecords.length;
    const absentStudents = attendanceRecords.reduce((acc, rec) => {
        const student = allStudents.find(s => s.id === rec.studentId);
        if (student) acc.push(student.name);
        return acc;
    }, []);
    const attendanceSummary = absenceCount > 0 ? `There were ${absenceCount} absences recorded. Students absent include: ${[...new Set(absentStudents)].join(', ')}.` : 'Attendance has been perfect.';

    if (relevantLogs.length === 0 && academicScores.length === 0 && absenceCount === 0) {
        output.value = "The Oracle has no records for this class in the past month. Award some stars, log some trial scores, or mark attendance to gather insights!";
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
        return;
    }

    const systemPrompt = "You are 'The Oracle,' a wise and encouraging AI data analyst for a teacher. Your goal is to analyze raw award log data, academic scores, and attendance records, including any teacher notes, and answer the teacher's questions in plain English. Provide concise, actionable, and positive insights based ONLY on the data provided. If the data is insufficient, say so kindly. Format your response clearly in 2-3 sentences. Do not use markdown.";
    const userPrompt = `Here is the data for the class "${classData.name}" over the last 30 days:
- Behavioral Star Data:
${relevantLogs || 'None.'}
- Academic Score Data:
${academicScores || 'None.'}
- Attendance Data:
${attendanceSummary}

Based on ALL this data, please answer the teacher's question: "${question}"`;

    try {
        const insight = await callGeminiApi(systemPrompt, userPrompt);
        output.value = insight;
    } catch (error) {
        console.error("Oracle Insight Error:", error);
        output.value = 'The Oracle is pondering other mysteries right now. Please try again in a moment.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
    }
}

async function handleGetQuestUpdate() {
    const narrativeContainer = document.getElementById('narrative-text-container');
    const playBtn = document.getElementById('play-narrative-btn');
    
    // FIX #7: Use global league state
    if (!globalSelectedLeague) {
        showToast('Please select a league first!', 'error');
        return;
    }

    playBtn.classList.add('hidden');
    narrativeContainer.innerHTML = `<i class="fas fa-spinner fa-spin text-4xl text-purple-400"></i>`;
    document.getElementById('quest-update-modal').classList.remove('hidden');

    const GOAL_PER_STUDENT = { DIAMOND: 18 };
    const classesInLeague = allSchoolClasses.filter(c => c.questLevel === globalSelectedLeague);
    const classScores = classesInLeague.map(c => {
        const studentsInClass = allStudents.filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18;
        const totalStars = studentsInClass.reduce((sum, s) => sum + (allStudentScores.find(score => score.id === s.id)?.monthlyStars || 0), 0);
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100).toFixed(1) : 0;
        return { name: c.name, totalStars, progress };
    }).sort((a, b) => b.progress - a.progress);

    const topClasses = classScores.filter(c => c.totalStars > 0).slice(0, 3);

    if (topClasses.length < 2) {
        narrativeContainer.innerHTML = `<p class="text-xl text-center">Not enough Quest data yet! At least two classes need to earn stars for a rivalry to begin!</p>`;
        return;
    }

    const classDataString = topClasses.map(c => `'${c.name}' is at ${c.progress}% of their goal with ${c.totalStars} stars`).join('. ');
    const systemPrompt = "You are a fun, exciting quest announcer for a classroom game. Do not use markdown or asterisks. Your response must be only the narrative text. You will be given the names, progress percentage, and star counts of the top classes. Write a short, exciting, 2-sentence narrative about their race to the top. IMPORTANT: The class with the highest progress percentage is in the lead, NOT the class with the most stars. Make this distinction clear in your narrative.";
    const userPrompt = `The top classes are: ${classDataString}. The first class in this list is in the lead. Write the narrative.`;

    try {
        const narrative = await callGeminiApi(systemPrompt, userPrompt);
        narrativeContainer.innerHTML = `<p>${narrative}</p>`;
        narrativeContainer.dataset.text = narrative;
        playBtn.classList.remove('hidden');
        playBtn.disabled = false;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-3"></i> Play Narrative`;

    } catch (error) {
        console.error("Quest Update Narrative Error:", error);
        narrativeContainer.innerHTML = `<p class="text-xl text-center text-red-500">The Quest Announcer is taking a break. Please try again in a moment!</p>`;
    }
}

async function playNarrative() {
    const playBtn = document.getElementById('play-narrative-btn');
    const narrativeText = document.getElementById('narrative-text-container').dataset.text;

    if (currentNarrativeAudio && !currentNarrativeAudio.paused) {
        currentNarrativeAudio.pause();
        currentNarrativeAudio = null;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-3"></i> Play Narrative`;
        return;
    }

    playBtn.disabled = true;
    playBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-3"></i> Generating Audio...`;

    try {
        const audioBlob = await callElevenLabsTtsApi(narrativeText);
        const audioUrl = URL.createObjectURL(audioBlob);
        currentNarrativeAudio = new Audio(audioUrl);
        
        currentNarrativeAudio.onplay = () => {
            playBtn.innerHTML = `<i class="fas fa-pause-circle mr-3"></i> Pause`;
            playBtn.disabled = false;
        };
        currentNarrativeAudio.onended = () => {
            playBtn.innerHTML = `<i class="fas fa-redo-alt mr-3"></i> Play Again`;
            currentNarrativeAudio = null;
        };
        currentNarrativeAudio.play();
    } catch (error) {
        console.error("ElevenLabs TTS Playback Error:", error);
        showToast('Could not generate or play audio.', 'error');
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-3"></i> Play Narrative`;
        playBtn.disabled = false;
    }
}

function triggerAwardEffects(button, starCount) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const colors = {
        1: ['#06b6d4', '#38bdf8', '#7dd3fc'],
        2: ['#a855f7', '#d8b4fe', '#f472b6'],
        3: ['#f97316', '#fbbf24', '#fde047']
    };

    const effectConfig = {
        1: { particles: 15, size: [2, 5], distance: [30, 60] },
        2: { particles: 30, size: [3, 7], distance: [50, 100], shockwave: 'rgba(216, 180, 254, 0.7)' },
        3: { particles: 60, size: [4, 9], distance: [80, 150], flash: 'rgba(249, 115, 22, 0.3)', shockwave: 'rgba(251, 191, 36, 0.8)' }
    };

    const config = effectConfig[starCount];
    const particleColors = colors[starCount];

    for (let i = 0; i < config.particles; i++) {
        const particle = document.createElement('div');
        particle.className = 'award-particle';
        document.body.appendChild(particle);

        const size = Math.random() * (config.size[1] - config.size[0]) + config.size[0];
        const angle = Math.random() * 360;
        const distance = Math.random() * (config.distance[1] - config.distance[0]) + config.distance[0];
        const tx = Math.cos(angle * (Math.PI / 180)) * distance;
        const ty = Math.sin(angle * (Math.PI / 180)) * distance;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = particleColors[Math.floor(Math.random() * particleColors.length)];
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        particle.addEventListener('animationend', () => particle.remove());
    }

    if (config.flash) {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        flash.style.setProperty('--flash-color', config.flash);
        document.body.appendChild(flash);
        flash.addEventListener('animationend', () => flash.remove());
    }

    if (config.shockwave) {
        const shockwave = document.createElement('div');
        shockwave.className = 'shockwave';
        shockwave.style.left = `${x}px`;
        shockwave.style.top = `${y}px`;
        shockwave.style.setProperty('--shockwave-color', config.shockwave);
        document.body.appendChild(shockwave);
        shockwave.addEventListener('animationend', () => shockwave.remove());
    }
}

// --- ADVENTURE LOG & QUEST ASSIGNMENT ---
function renderAdventureLogTab() {
    const classSelect = document.getElementById('adventure-log-class-select');
    const monthFilter = document.getElementById('adventure-log-month-filter');

    if (!classSelect || !monthFilter) return;

    // FIX #7: Use global class ID
    const classVal = globalSelectedClassId;
    const optionsHtml = allTeachersClasses.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">Select a class to view its log...</option>' + optionsHtml;
    if (classVal) classSelect.value = classVal;
    currentLogFilter.classId = classSelect.value;
    document.getElementById('log-adventure-btn').disabled = !classSelect.value;
    document.getElementById('quest-assignment-btn').disabled = !classSelect.value;
    document.getElementById('attendance-chronicle-btn').disabled = !classSelect.value;
    
    const monthVal = monthFilter.value;
    const availableMonths = [...new Set(allAdventureLogs.map(log => {
    const dateObj = parseDDMMYYYY(log.date);
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${month}-${year}`;
}))];
    availableMonths.sort().reverse();
    const currentMonth = getDDMMYYYY(new Date()).substring(3);
    if (!availableMonths.includes(currentMonth)) {
        availableMonths.unshift(currentMonth);
    }
    monthFilter.innerHTML = availableMonths.map(monthKey => {
        const d = parseDDMMYYYY('01-' + monthKey);
        const display = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        return `<option value="${monthKey}">${display}</option>`;
    }).join('');
    monthFilter.value = monthVal || currentMonth;
    currentLogFilter.month = monthFilter.value;

    renderAdventureLog();
}

function renderAdventureLog() {
    const feed = document.getElementById('adventure-log-feed');
    if (!feed) return;

    if (!currentLogFilter.classId) {
        feed.innerHTML = `<p class="text-center text-gray-500 bg-white/50 p-6 rounded-2xl">Please select one of your classes to see its Adventure Log.</p>`;
        return;
    }
    
    const logsForClass = allAdventureLogs.filter(log => {
         if (log.classId !== currentLogFilter.classId) return false;
        const dateObj = parseDDMMYYYY(log.date);
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObj.getFullYear();
        const logMonthKey = `${month}-${year}`;
        return logMonthKey === currentLogFilter.month;
    });
    
    // FIX #4: New Adventure Log page-like style
    if (logsForClass.length === 0) {
        const selectedMonthDisplay = document.getElementById('adventure-log-month-filter').options[document.getElementById('adventure-log-month-filter').selectedIndex]?.text;
        feed.innerHTML = `<div class="diary-page empty"><p class="text-center text-gray-500">The diary is empty for ${selectedMonthDisplay}.<br>Award some stars and then 'Log Today's Adventure'!</p></div>`;
        return;
    }

    feed.innerHTML = logsForClass.map(log => {
        const displayDate = parseDDMMYYYY(log.date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
        const keywordsHtml = (log.keywords || []).map(kw => `<span class="diary-keyword">#${kw}</span>`).join('');
        
        const noteHtml = log.note ? `
            <div class="diary-note">
                <p>"${log.note}"</p>
                <span class="diary-note-author">- Note by ${log.noteBy || 'the Teacher'}</span>
            </div>
        ` : '';

        return `
            <div class="diary-page">
                <div class="diary-header">
                    <h3 class="diary-date">${displayDate}</h3>
                    <div class="diary-hero">
                        <i class="fas fa-crown mr-1"></i> Hero: ${log.hero}
                    </div>
                </div>
                <div class="diary-body">
                    <div class="diary-image-container">
                        <img src="${log.imageBase64 || ''}" alt="Image for ${log.keywords.join(', ')}" class="diary-image">
                    </div>
                    <div class="diary-text-content">
                        <p class="diary-text">${log.text}</p>
                        ${noteHtml}
                    </div>
                </div>
                <div class="diary-footer">
                    <div class="diary-keywords">
                        ${keywordsHtml}
                    </div>
                    <div class="flex gap-2">
                        <button class="log-note-btn bubbly-button bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>
                        <button class="log-delete-btn bubbly-button bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="Delete Log Entry"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const pages = feed.querySelectorAll('.diary-page');
    pages.forEach((page, index) => {
        page.style.opacity = 0; 
        setTimeout(() => {
            page.classList.add('pop-in');
        }, index * 50);
    });
}

async function handleLogAdventure() {
    const classId = currentLogFilter.classId;
    if (!classId) return;

    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    const today = getTodayDateString();
    
    const existingLog = allAdventureLogs.find(log => log.classId === classId && log.date === today);
    if (existingLog) {
        showToast("Today's adventure has already been chronicled for this class!", 'info');
        return;
    }

    const btn = document.getElementById('log-adventure-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Writing History...`;

    const todaysAwards = allAwardLogs.filter(log => log.classId === classId && log.date === today);
    const totalStars = todaysAwards.reduce((sum, award) => sum + award.stars, 0);

    // FIX #4: Adventure log is more useful even without stars, so we allow logging
    if (todaysAwards.length === 0 && allWrittenScores.filter(s => s.classId === classId && s.date === today).length === 0) {
        showToast("No stars or scores were recorded for this class today. Nothing to log!", 'info');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
        return;
    }
    
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    const todaysAbsences = allAttendanceRecords.filter(r => r.date === today && r.classId === classId);
    const absentStudentNames = todaysAbsences.map(absence => allStudents.find(s => s.id === absence.studentId)?.name).filter(Boolean);
    const attendanceSummary = absentStudentNames.length > 0 ? `${absentStudentNames.join(', ')} were absent.` : `Everyone was present.`;

    const reasonCounts = todaysAwards.reduce((acc, award) => {
        if (award.reason) acc[award.reason] = (acc[award.reason] || 0) + 1;
        return acc;
    }, {});
    const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0][0] : "great work";

    const studentStars = todaysAwards.reduce((acc, award) => {
        acc[award.studentId] = (acc[award.studentId] || 0) + award.stars;
        return acc;
    }, {});
    const topStudentId = Object.keys(studentStars).length > 0 ? Object.entries(studentStars).sort((a,b) => b[1] - a[1])[0][0] : null;
    const heroOfTheDay = topStudentId ? allStudents.find(s => s.id === topStudentId)?.name : "the whole team";
    const ageCategory = getAgeGroupForLeague(classData.questLevel);
    const notesString = todaysAwards.filter(log => log.note).map(log => `(Note for a ${log.reason} award: "${log.note}")`).join(' ');
    
    // FIX #4: Smarter AI - Include academic data
    const todaysScores = allWrittenScores.filter(s => s.classId === classId && s.date === today);
    const academicSummary = todaysScores.map(s => {
        const studentName = allStudents.find(stu => stu.id === s.studentId)?.name || 'a student';
        const score = s.scoreQualitative || `${s.scoreNumeric}/${s.maxScore}`;
        const note = s.notes ? ` (Note: ${s.notes})` : '';
        return `${studentName} scored ${score} on a ${s.type}${note}.`;
    }).join(' ');

    try {
        let textSystemPrompt = "";
        if (ageCategory === 'junior') { 
            textSystemPrompt = "You are 'The Chronicler,' an AI historian for a fun classroom game. Write a short, exciting diary entry (2-3 sentences) about a class's adventure for the day. Use a storytelling tone with VERY simple words and short sentences suitable for young beginner English learners (ages 7-9). Do NOT use markdown. Incorporate all provided data (stars, scores, attendance, notes) into a cohesive, positive narrative.";
        } else { 
            textSystemPrompt = "You are 'The Chronicler,' an AI historian for a fun classroom game. Write a short, exciting diary entry (2-3 sentences) about a class's adventure for the day. Use a storytelling tone with engaging but still relatively simple English for non-native speakers. Do NOT use markdown. Incorporate all provided data (stars, scores, attendance, notes) into a cohesive, positive narrative.";
        }
        // FIX #4: Smarter AI - Expanded user prompt
        const textUserPrompt = `Write a diary entry for the class '${classData.name}'. Today's data:
- Stars: ${totalStars} stars awarded. Their strongest skill was '${topReason}'. The Hero of the Day was ${heroOfTheDay}.
- Academics: ${academicSummary || 'No trials today.'}
- Attendance: ${attendanceSummary}.
- Teacher's star notes: ${notesString || 'None'}.
Combine these points into a short, engaging story.`;
        const text = await callGeminiApi(textSystemPrompt, textUserPrompt);

        const keywordSystemPrompt = "Analyze the provided text. Extract 2-3 single-word, visually descriptive, abstract nouns or concepts that capture the feeling of the text (e.g., harmony, energy, focus, joy). Output them as a comma-separated list. For example: 'Keywords: unity, discovery, celebration'.";
        const keywordResponse = await callGeminiApi(keywordSystemPrompt, `Text: ${text}`);
        const keywords = keywordResponse.replace('Keywords:', '').split(',').map(kw => kw.trim().toLowerCase());

        // FIX #5: Better image prompts
        const imagePromptSystemPrompt = "You are an expert AI art prompt engineer. Your task is to convert a story and keywords into a short, effective, simplified English prompt for an image generator, under 75 tokens. The style MUST be: 'whimsical children's storybook illustration, watercolor and ink, simple characters, vibrant and cheerful colors, symbolic'. The prompt must be a single, structured paragraph. Focus on the feeling and key symbols, not a literal scene. Conclude with '(Token count: X)'.";
        const imagePromptUserPrompt = `Refactor the following into a high-quality, short image prompt. Story: "${text}". Keywords: ${keywords.join(', ')}.`;
        const imagePrompt = await callGeminiApi(imagePromptSystemPrompt, imagePromptUserPrompt);

        const imageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressedImageBase64 = await compressImageBase64(imageBase64);

        await addDoc(collection(db, "artifacts/great-class-quest/public/data/adventure_logs"), {
            classId, date: today, text, keywords, imageBase64: compressedImageBase64,
            hero: heroOfTheDay, topReason, totalStars,
            createdBy: { uid: currentUserId, name: currentTeacherName },
            createdAt: serverTimestamp()
        });
        showToast("Today's adventure has been chronicled!", 'success');
    } catch (error) {
        console.error("Adventure Log generation error:", error);
        showToast("The Chronicler seems to have lost their ink. Please try again.", 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
    }
}

function handleDeleteLog(logId) {
    showModal('Delete Log Entry?', 'Are you sure you want to permanently delete this entry from the Adventure Log?', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId));
            showToast('Log entry deleted.', 'success');
        } catch (error) {
            console.error("Error deleting log entry:", error);
            showToast('Could not delete the log entry.', 'error');
        }
    });
}

function openNoteModal(logId) {
    const log = allAdventureLogs.find(l => l.id === logId);
    if (!log) return;
    document.getElementById('note-log-id-input').value = logId;
    document.getElementById('note-textarea').value = log.note || '';
    document.getElementById('note-modal').classList.remove('hidden');
}

async function handleSaveNote() {
    const logId = document.getElementById('note-log-id-input').value;
    const newNote = document.getElementById('note-textarea').value;
    const log = allAdventureLogs.find(l => l.id === logId);

    try {
        await updateDoc(doc(db, "artifacts/great-class-quest/public/data/adventure_logs", logId), {
            note: newNote,
            noteBy: currentTeacherName
        });
        showToast('Note saved!', 'success');
        hideModal('note-modal');
        if (newNote.trim() !== '' && newNote !== log.note) {
            triggerNoteToast(log.text, newNote);
        }
    } catch (error) {
        console.error("Error saving note:", error);
        showToast('Failed to save note.', 'error');
    }
}

async function triggerNoteToast(logText, noteText) {
    const systemPrompt = "You are the 'Quest Master's Assistant', a whimsical character in a classroom game. Your job is to read the teacher's note about a day's adventure and provide a short, encouraging, one-sentence comment. Do NOT use markdown. Be positive and brief.";
    const userPrompt = `The AI's log said: "${logText}". The teacher added this note: "${noteText}". What is your one-sentence comment?`;
    try {
        const comment = await callGeminiApi(systemPrompt, userPrompt);
        showPraiseToast(comment, '📝');
    } catch (error) {
        console.error("Note Toast AI error:", error);
    }
}

async function openQuestAssignmentModal() {
    const classId = document.getElementById('adventure-log-class-select').value;
    if (!classId) return;

    document.getElementById('quest-assignment-class-id').value = classId;
    const previousAssignmentTextEl = document.getElementById('previous-assignment-text');
    const currentAssignmentTextarea = document.getElementById('quest-assignment-textarea');

    previousAssignmentTextEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    currentAssignmentTextarea.value = '';

    document.getElementById('quest-assignment-modal').classList.remove('hidden');

    try {
        const q = query(
            collection(db, `artifacts/great-class-quest/public/data/quest_assignments`),
            where("classId", "==", classId),
            where("createdBy.uid", "==", currentUserId),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastAssignment = snapshot.docs[0].data();
            previousAssignmentTextEl.textContent = lastAssignment.text;
        } else {
            previousAssignmentTextEl.textContent = "No previous assignment was set for this class.";
        }

    } catch (error) {
        console.error("Error loading previous assignment:", error);
        previousAssignmentTextEl.textContent = "Could not load the previous assignment.";
    }
}

async function handleSaveQuestAssignment() {
    const classId = document.getElementById('quest-assignment-class-id').value;
    const text = document.getElementById('quest-assignment-textarea').value.trim();

    if (!text) {
        showToast("Please write an assignment before saving.", "info");
        return;
    }

    const btn = document.getElementById('quest-assignment-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        await addDoc(collection(db, "artifacts/great-class-quest/public/data/quest_assignments"), {
            classId,
            text,
            createdAt: serverTimestamp(),
            createdBy: { uid: currentUserId, name: currentTeacherName }
        });
        showToast("Quest assignment saved for next lesson!", "success");
        hideModal('quest-assignment-modal');
    } catch (error) {
        console.error("Error saving quest assignment:", error);
        showToast("Failed to save assignment.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Assignment';
    }
}


// --- v5.5.6: THE STORY WEAVERS (UPGRADED) ---
function handleStoryWeaversClassSelect() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const mainContent = document.getElementById('story-weavers-main-content');
    const placeholder = document.getElementById('story-weavers-placeholder');
    // FIX #10: Smooth resizing of Idea Forge boxes
    const ideaForgeGrid = document.querySelector('#reward-ideas-tab .grid');
    
    const currentUnsub = unsubscribeStoryData.current;
    if (currentUnsub) {
        currentUnsub();
        delete unsubscribeStoryData.current;
    }

    resetStoryWeaverWordUI();

    if (classId) {
        mainContent.classList.remove('hidden');
        placeholder.classList.add('hidden');
        if (ideaForgeGrid) ideaForgeGrid.classList.add('story-weavers-active');
        
        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        unsubscribeStoryData.current = onSnapshot(storyDocRef, (doc) => {
            currentStoryData[classId] = doc.exists() ? doc.data() : null;
            renderStoryWeaversUI(classId);
        }, (error) => console.error("Error listening to story data:", error));
    } else {
        mainContent.classList.add('hidden');
        placeholder.classList.remove('hidden');
        if (ideaForgeGrid) ideaForgeGrid.classList.remove('story-weavers-active');
    }
}

function renderStoryWeaversUI(classId) {
    const story = currentStoryData[classId];
    const textEl = document.getElementById('story-weavers-text');
    const imageEl = document.getElementById('story-weavers-image');
    const imagePlaceholder = document.getElementById('story-weavers-image-placeholder');
    const imageLoader = document.getElementById('story-weavers-image-loader');
    const lockInBtn = document.getElementById('story-weavers-lock-in-btn');
    const endBtn = document.getElementById('story-weavers-end-btn');

    if (story && story.currentSentence) {
        lockInBtn.innerHTML = 'Continue...';
        endBtn.disabled = false;
        textEl.textContent = story.currentSentence;
        imageLoader.classList.add('hidden');
        if (story.currentImageBase64) {
            imageEl.src = story.currentImageBase64;
            imageEl.classList.remove('hidden');
            imagePlaceholder.classList.add('hidden');
        } else {
            imageEl.classList.add('hidden');
            imagePlaceholder.classList.remove('hidden');
        }
    } else {
        lockInBtn.innerHTML = 'Start Story...';
        endBtn.disabled = true;
        textEl.textContent = "A new story awaits! Suggest and lock in a 'Word of the Day' to begin.";
        imageEl.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
        imageLoader.classList.add('hidden');
    }
}

async function handleSuggestWord() {
    playSound('magic_chime');
    const classId = document.getElementById('story-weavers-class-select').value;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;
    const ageGroup = getAgeGroupForLeague(classData.questLevel);
    const currentStory = currentStoryData[classId]?.currentSentence || "A brand new story";
    const btn = document.getElementById('story-weavers-suggest-word-btn');
    const input = document.getElementById('story-weavers-word-input');
    btn.disabled = true;

    const systemPrompt = `You are a creative writing assistant for a teacher. Suggest a single, interesting, and slightly challenging English vocabulary word suitable for a language learner in the ${ageGroup} age group. The word should fit the theme of the ongoing story. Provide only the word, no definitions or extra text. Vary your suggestions; provide a mix of nouns, verbs, and adjectives.`;
    const userPrompt = `The current story is: "${currentStory}". Suggest one new, creative word to continue the story.`;
    try {
        const word = await callGeminiApi(systemPrompt, userPrompt);
        input.value = word.replace(/[\n."]/g, '').trim();
        showWordEditorControls();
    } catch (error) {
        showToast("The AI is busy, please try again!", "error");
    } finally {
        btn.disabled = false;
    }
}

function openStoryInputModal() {
    const classId = document.getElementById('story-weavers-class-select').value;
    if (!classId) return;
    
    const story = currentStoryData[classId];
    const isNewStory = !story || !story.currentSentence;
    
    document.getElementById('story-input-textarea').value = isNewStory ? '' : (story.currentSentence || '');
    document.getElementById('story-input-modal').classList.remove('hidden');
}

async function handleLockInSentence() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const wordOfTheDay = storyWeaverLockedWord;
    const newSentence = document.getElementById('story-input-textarea').value.trim();
    const currentStory = currentStoryData[classId] || {};
    const isNewStory = !currentStory.currentSentence;
    const storyHistoryQuery = query(collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`), orderBy("createdAt", "desc"), limit(3));
    const historySnapshot = await getDocs(storyHistoryQuery);
    const recentHistory = historySnapshot.docs.map(d => d.data().sentence).join(' ');

    if (newSentence === (currentStory.currentSentence || '')) {
        showToast("No changes made to the story.", "info");
        hideModal('story-input-modal');
        return;
    }
    if (!newSentence) {
        showToast("The story cannot be empty.", "error");
        return;
    }

    hideModal('story-input-modal');
    playSound('writing');

    const btn = document.getElementById('story-weavers-lock-in-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Chronicling...`;

    document.getElementById('story-weavers-image-loader').classList.remove('hidden');
    document.getElementById('story-weavers-image').classList.add('hidden');
    document.getElementById('story-weavers-image-placeholder').classList.add('hidden');

    try {
        const imagePromptSystemPrompt = "You are an expert AI art prompt engineer. Your task is to convert a story's context into a short, effective, simplified English prompt for an image generator, under 75 tokens. The image type must be a 'whimsical children's storybook illustration'. The style should be 'simple shapes, vibrant and cheerful colors, friendly characters'. Use progressive detailing and relative descriptions. The prompt must be a single, structured paragraph. Conclude with '(Token count: X)'.";
        const imagePromptUserPrompt = `Refactor the following into a high-quality, short image prompt. Previous context: '${recentHistory}'. The new, most important sentence is: "${newSentence}". The image should focus on the new sentence while staying consistent with the previous context.`;
        const imagePrompt = await callGeminiApi(imagePromptSystemPrompt, imagePromptUserPrompt);
        
        const rawImageBase64 = await callCloudflareAiImageApi(imagePrompt);
        const compressedImageBase64 = await compressImageBase64(rawImageBase64);

        const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
        const historyCollectionRef = collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`);
        
        const batch = writeBatch(db);
        const storyDataToSet = { 
            currentSentence: newSentence, 
            currentImageBase64: compressedImageBase64,
            currentWord: wordOfTheDay,
            storyAdditionsCount: increment(1),
            updatedAt: serverTimestamp(),
            createdBy: currentStory.createdBy || { uid: currentUserId, name: currentTeacherName }
        };

        if (isNewStory) {
            batch.set(storyDocRef, storyDataToSet);
        } else {
            batch.update(storyDocRef, storyDataToSet);
        }

        const newHistoryDoc = doc(historyCollectionRef);
        batch.set(newHistoryDoc, {
            sentence: newSentence,
            word: wordOfTheDay,
            imageBase64: compressedImageBase64,
            createdAt: serverTimestamp(),
            createdBy: { uid: currentUserId, name: currentTeacherName }
        });

        await batch.commit();
        
        const newAdditionsCount = (currentStory.storyAdditionsCount || 0) + 1;
        if (newAdditionsCount > 0 && newAdditionsCount % 2 === 0) {
            showModal('Story Milestone!', 'Award a +0.5 Creativity Bonus Star to every student in the class?', () => awardStoryWeaverBonusStarToClass(classId), 'Yes, Award Bonus!', 'No, Thanks');
        } else {
            showToast("Story updated successfully!", "success");
        }
    } catch (error) {
        console.error("Error locking in sentence:", error);
        showToast("Failed to save the story. The image might be too large or there was a network issue. Please try again.", "error");
        renderStoryWeaversUI(classId);
    } finally {
        resetStoryWeaverWordUI();
    }
}

function handleRevealStory() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const storyText = currentStoryData[classId]?.currentSentence || "Select a class to see the story.";
    document.getElementById('story-reveal-text').textContent = storyText;
    document.getElementById('story-reveal-modal').classList.remove('hidden');
}

async function handleShowStoryHistory() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    document.getElementById('story-history-title').innerText = `${classData.logo} ${classData.name}'s Current Chronicle`;
    const contentEl = document.getElementById('story-history-content');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Loading chronicle...</p>`;
    document.getElementById('story-history-modal').classList.remove('hidden');

    const historyQuery = query(collection(db, `artifacts/great-class-quest/public/data/story_data/${classId}/story_history`), orderBy("createdAt", "asc"));
    try {
        const snapshot = await getDocs(historyQuery);
        if (snapshot.empty) {
            contentEl.innerHTML = `<p class="text-center text-gray-500">This story is just beginning!</p>`;
        } else {
            contentEl.innerHTML = snapshot.docs.map((doc, index) => {
                const data = doc.data();
                return `<div class="story-history-card">
                            <img src="${data.imageBase64}" alt="Chapter ${index + 1} illustration">
                            <div class="text-content">
                                <p class="text-xs text-gray-500 font-bold">CHAPTER ${index + 1} (Word: <span class="text-cyan-600">${data.word || 'N/A'}</span>)</p>
                                <p class="text-gray-800 mt-2 flex-grow">${data.sentence}</p>
                            </div>
                        </div>`;
            }).join('');
        }
    } catch (error) {
        console.error("Error fetching story history:", error);
        contentEl.innerHTML = `<p class="text-center text-red-500">Could not load story history.</p>`;
    }
}

function handleResetStory() {
    const classId = document.getElementById('story-weavers-class-select').value;
    if (!classId) return;
    showModal('Start a New Story?', "This will reset the current story progress. The old story's history will be kept, but you will start from a blank page. Are you sure?", async () => {
        try {
            const storyDocRef = doc(db, `artifacts/great-class-quest/public/data/story_data`, classId);
            await setDoc(storyDocRef, {
                currentSentence: "",
                currentImageBase64: null,
                currentWord: null,
                storyAdditionsCount: 0,
                updatedAt: serverTimestamp(),
                createdBy: { uid: currentUserId, name: currentTeacherName }
            });
            resetStoryWeaverWordUI();
            showToast("A new chapter begins!", "success");
        } catch (error) {
            console.error("Error resetting story:", error);
            showToast("Failed to start a new story.", "error");
        }
    });
}

async function awardStoryWeaverBonusStarToClass(classId) {
    playSound('star2');
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    if (studentsInClass.length === 0) {
        showToast("No students in class to award bonus stars to.", "info");
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const publicDataPath = "artifacts/great-class-quest/public/data";

        studentsInClass.forEach(student => {
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, student.id);
            batch.update(scoreRef, {
                monthlyStars: increment(0.5),
                totalStars: increment(0.5)
            });

            const logRef = doc(collection(db, `${publicDataPath}/award_log`));
            batch.set(logRef, {
                studentId: student.id,
                classId: classId,
                teacherId: currentUserId,
                stars: 0.5,
                reason: "story_weaver",
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: currentUserId, name: currentTeacherName }
            });
        });

        await batch.commit();
        showToast("Story Weaver bonus stars awarded!", "success");

        const word = currentStoryData[classId]?.currentWord || "a new idea";
        const systemPrompt = "You are the 'Quest Master's Assistant'. A class just successfully added to their story. Write a very short, single-sentence, celebratory message for the whole class. Do not use markdown.";
        const userPrompt = `The new part of their story involves the word "${word}". Write the celebratory message.`;
        callGeminiApi(systemPrompt, userPrompt).then(comment => showPraiseToast(comment, '✒️')).catch(console.error);

    } catch (error) {
        console.error("Error awarding bonus stars:", error);
        showToast("Failed to award bonus stars.", "error");
    }
}

async function handleEndStory() {
    const classId = document.getElementById('story-weavers-class-select').value;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData || !currentStoryData[classId]) {
        showToast("There is no active story to end.", "info");
        return;
    }

    showModal('Finish this Storybook?', 'This will mark the story as complete and move it to the archive. You will start with a blank page. Are you sure?', async () => {
        const endBtn = document.getElementById('story-weavers-end-btn');
        endBtn.disabled = true;
        endBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;

        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/story_data`, classId);
            const historyCollectionRef = collection(db, `${storyDocRef.path}/story_history`);
            const historySnapshot = await getDocs(query(historyCollectionRef, orderBy("createdAt", "asc")));

            if (historySnapshot.empty) {
                showToast("Cannot end an empty story.", "error");
                return;
            }

            const storyChapters = historySnapshot.docs.map(d => d.data());
            const storyTitle = await callGeminiApi(
                "You are an AI that creates short, creative book titles. Based on the story, create a title that is 2-5 words long. Provide only the title, no extra text or quotation marks.",
                `The story is: ${storyChapters.map(c => c.sentence).join(' ')}`
            );

            const batch = writeBatch(db);
            const newArchiveDocRef = doc(collection(db, `${publicDataPath}/completed_stories`));
            
            batch.set(newArchiveDocRef, {
                title: storyTitle,
                classId: classId,
                className: classData.name,
                classLogo: classData.logo,
                completedAt: serverTimestamp(),
                createdBy: { uid: currentUserId, name: currentTeacherName }
            });

            storyChapters.forEach((chapter, index) => {
                const chapterDocRef = doc(collection(db, `${newArchiveDocRef.path}/chapters`));
                batch.set(chapterDocRef, { ...chapter, chapterNumber: index + 1 });
            });
            
            historySnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);

            await batch.commit();
            resetStoryWeaverWordUI();
            showToast(`Storybook "${storyTitle}" has been archived!`, "success");

        } catch (error) {
            console.error("Error ending story:", error);
            showToast("Failed to archive the story. The story might be too long or there was a network issue. Please try again.", "error");
        } finally {
            endBtn.disabled = false;
            endBtn.innerHTML = `The End`;
        }
    }, "Yes, Finish It!");
}

function openStoryArchiveModal() {
    renderStoryArchive();
    document.getElementById('story-archive-modal').classList.remove('hidden');
}

function renderStoryArchive() {
    const listEl = document.getElementById('story-archive-list');
    if (allCompletedStories.length === 0) {
        listEl.innerHTML = `<p class="text-center text-gray-500 py-8">You have no completed storybooks yet. Finish a story to see it here!</p>`;
        return;
    }
    listEl.innerHTML = allCompletedStories.map(story => `
        <div class="completed-storybook-item border-indigo-300">
            <div>
                <h3 class="font-bold text-lg text-indigo-800">${story.title}</h3>
                <p class="text-sm text-gray-600">A story by <span class="font-semibold">${story.classLogo} ${story.className}</span></p>
                <p class="text-xs text-gray-400">Completed on ${story.completedAt?.toDate().toLocaleDateString() || 'a while ago'}</p>
            </div>
            <div class="flex gap-2">
                <button class="view-storybook-btn bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full bubbly-button" data-story-id="${story.id}"><i class="fas fa-book-open"></i></button>
            </div>
        </div>
    `).join('');
}

async function openStorybookViewer(storyId) {
    hideModal('story-archive-modal');
    const story = allCompletedStories.find(s => s.id === storyId);
    if (!story) return;

    document.getElementById('storybook-viewer-title').innerText = story.title;
    document.getElementById('storybook-viewer-subtitle').innerText = `A Story by ${story.classLogo} ${story.className}`;
    const contentEl = document.getElementById('storybook-viewer-content');
    contentEl.innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading chapters...</p>`;
    
    const playBtn = document.getElementById('storybook-viewer-play-btn');
    playBtn.onclick = null;
    playBtn.disabled = true;

    document.getElementById('storybook-viewer-print-btn').onclick = null;
    document.getElementById('storybook-viewer-print-btn').disabled = true;
    
    document.getElementById('storybook-viewer-delete-btn').onclick = () => handleDeleteCompletedStory(story.id);
    
    document.getElementById('storybook-viewer-modal').classList.remove('hidden');

    try {
        const chaptersQuery = query(collection(db, `artifacts/great-class-quest/public/data/completed_stories/${storyId}/chapters`), orderBy("chapterNumber", "asc"));
        const snapshot = await getDocs(chaptersQuery);
        const chapters = snapshot.docs.map(doc => doc.data());

        if (chapters.length === 0) {
            contentEl.innerHTML = `<p class="text-center text-red-500 py-8">This storybook has no chapters!</p>`;
            return;
        }

        story.chapters = chapters;

        contentEl.innerHTML = chapters.map((chapter) => `
            <div class="story-history-card">
                <img src="${chapter.imageBase64}" alt="Chapter ${chapter.chapterNumber} illustration">
                <div class="text-content">
                    <p class="text-xs text-gray-500 font-bold">CHAPTER ${chapter.chapterNumber}</p>
                    <p class="text-gray-800 mt-2 flex-grow">${chapter.sentence}</p>
                </div>
            </div>`).join('');
        
        playBtn.onclick = () => playStorybookNarration(storyId);
        playBtn.disabled = false;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;

        document.getElementById('storybook-viewer-print-btn').onclick = () => handlePrintStorybook(storyId);
        document.getElementById('storybook-viewer-print-btn').disabled = false;

    } catch (error) {
        console.error("Error loading story chapters:", error);
        contentEl.innerHTML = `<p class="text-center text-red-500 py-8">Could not load the chapters for this storybook.</p>`;
    }
}

async function playStorybookNarration(storyId) {
    const story = allCompletedStories.find(s => s.id === storyId);
    if (!story || !story.chapters) return;

    const playBtn = document.getElementById('storybook-viewer-play-btn');
    const fullStoryText = story.chapters.map(c => c.sentence).join(' ');

    if (currentStorybookAudio && !currentStorybookAudio.paused) {
        currentStorybookAudio.pause();
        currentStorybookAudio = null;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
        return;
    }

    playBtn.disabled = true;
    playBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-3"></i> Generating Audio...`;

    try {
        const audioBlob = await callElevenLabsTtsApi(fullStoryText);
        const audioUrl = URL.createObjectURL(audioBlob);
        currentStorybookAudio = new Audio(audioUrl);
        
        currentStorybookAudio.onplay = () => {
            playBtn.innerHTML = `<i class="fas fa-pause-circle mr-3"></i> Pause Narration`;
            playBtn.disabled = false;
        };
        currentStorybookAudio.onended = () => {
            playBtn.innerHTML = `<i class="fas fa-redo-alt mr-3"></i> Narrate Again`;
            currentStorybookAudio = null;
        };
        currentStorybookAudio.play();
    } catch (error) {
        showToast('Could not generate or play audio.', 'error');
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> Narrate Story`;
        playBtn.disabled = false;
    }
}

async function handleDeleteCompletedStory(storyId) {
    const story = allCompletedStories.find(s => s.id === storyId);
    if (!story) return;

    showModal('Delete This Storybook?', `Are you sure you want to permanently delete "${story.title}"? This cannot be undone.`, async () => {
        try {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const storyDocRef = doc(db, `${publicDataPath}/completed_stories`, storyId);
            const chaptersSnapshot = await getDocs(collection(db, `${storyDocRef.path}/chapters`));

            const batch = writeBatch(db);
            chaptersSnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(storyDocRef);
            await batch.commit();

            hideModal('storybook-viewer-modal');
            showToast('Storybook deleted.', 'success');
        } catch (error) {
            showToast('Failed to delete storybook.', 'error');
        }
    }, 'Delete Forever');
}

async function handlePrintStorybook(storyId) {
    const story = allCompletedStories.find(s => s.id === storyId);
    const classData = allSchoolClasses.find(c => c.id === story.classId);
    if (!story || !classData || !story.chapters) {
        showToast("Story data is not fully loaded for printing.", "error");
        return;
    }

    const btn = document.getElementById('storybook-viewer-print-btn');
    btn.disabled = true;btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Assembling...`;

    try {
        const theme = storybookThemes[simpleHashCode(story.title) % storybookThemes.length];
        const storyPages = story.chapters.map(chapter => `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <div style="width: 100%; height: 350px; border-radius: 10px; border: 3px solid ${theme.border}; background-color: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${chapter.imageBase64}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <p style="text-align: center; font-family: ${theme.bodyFont}; font-size: 22px; color: ${theme.textColor}; margin-top: 20px; flex-grow: 1; font-weight: ${theme.fontWeight || 'normal'};">${chapter.sentence}</p>
                <p style="text-align: right; font-size: 14px; color: ${theme.textColor}; opacity: 0.7;">- Page ${chapter.chapterNumber} -</p>
            </div>`);

        const titlePage = `
            <div style="width: 800px; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; background-color: ${theme.bg}; border: 10px solid ${theme.border}; box-sizing: border-box; page-break-after: always;">
                <h1 style="font-family: ${theme.titleFont}; font-size: 50px; color: ${theme.titleColor}; text-align: center;">${story.title}</h1>
                <h2 style="font-family: ${theme.titleFont}; font-size: 30px; color: ${theme.textColor}; text-align: center; margin-top: 10px;">A Story Weavers Adventure</h2>
            </div>`;

        const signatureTemplate = document.getElementById('storybook-signature-page-template');
        signatureTemplate.style.backgroundColor = theme.bg;
        signatureTemplate.style.borderColor = theme.border;
        document.getElementById('signature-class-logo').innerText = classData.logo;
        document.getElementById('signature-created-by').style.color = theme.titleColor;
        document.getElementById('signature-class-name').innerText = classData.name;
        document.getElementById('signature-class-name').style.color = theme.titleColor;
        document.getElementById('signature-student-list').style.fontFamily = theme.bodyFont;
        document.getElementById('signature-student-list').style.color = theme.textColor;
        document.getElementById('signature-school-name').style.color = theme.textColor;
        const studentsInClass = allStudents.filter(s => s.classId === classData.id);
        document.getElementById('signature-student-list').innerHTML = studentsInClass.map(s => `<span>${s.name}</span>`).join('');
        
        const printContainer = document.getElementById('storybook-print-container');
        printContainer.innerHTML = titlePage + storyPages.join('') + signatureTemplate.outerHTML;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });

        const pages = printContainer.children;
        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            if (i > 0) pdf.addPage([800, 600], 'landscape');
            pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        }

        pdf.save(`${story.title}_Storybook.pdf`);

    } catch (error) {
        console.error("Error creating storybook PDF:", error);
        showToast("Could not create the storybook PDF.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-print mr-2"></i> Print Storybook`;
    }
}

function showWordEditorControls() {
    document.getElementById('story-weavers-confirm-word-btn').classList.remove('hidden');
    document.getElementById('story-weavers-clear-word-btn').classList.remove('hidden');
}

function hideWordEditorControls(isLocked = false) {
    document.getElementById('story-weavers-confirm-word-btn').classList.add('hidden');
    if (!isLocked) {
        document.getElementById('story-weavers-clear-word-btn').classList.add('hidden');
    }
}

function resetStoryWeaverWordUI() {
    const input = document.getElementById('story-weavers-word-input');
    input.value = '';
    input.classList.remove('bg-green-100', 'border-green-400', 'font-bold');
    storyWeaverLockedWord = null;
    document.getElementById('story-weavers-suggest-word-btn').disabled = false;
    document.getElementById('story-weavers-lock-in-btn').disabled = true;
    document.getElementById('story-weavers-end-btn').disabled = true;
    const classId = document.getElementById('story-weavers-class-select').value;
    renderStoryWeaversUI(classId);
    hideWordEditorControls();
}

// --- OVERVIEW MODAL FUNCTIONS ---

function openOverviewModal(classId) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData) return;

    const modal = document.getElementById('overview-modal');
    modal.dataset.classId = classId;
    document.getElementById('overview-modal-title').innerHTML = `${classData.logo} ${classData.name} - Quest Overview`;

    document.querySelectorAll('.overview-tab-btn').forEach(btn => {
        const isDefault = btn.dataset.view === 'class';
        btn.classList.toggle('border-purple-500', isDefault);
        btn.classList.toggle('text-purple-600', isDefault);
        btn.classList.toggle('border-transparent', !isDefault);
        btn.classList.toggle('text-gray-500', !isDefault);
    });

    renderOverviewContent(classId, 'class');
    modal.classList.remove('hidden');
}

function renderOverviewContent(classId, view) {
    const contentEl = document.getElementById('overview-modal-content');
    contentEl.innerHTML = `<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i><p class="mt-2">Analyzing Quest Logs...</p></div>`;

    const overviewData = generateOverviewData(classId);

    if (view === 'class') {
        renderClassOverview(overviewData);
    } else {
        renderStudentOverview(overviewData);
    }
}

function generateOverviewData(classId) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    const logsForClass = allAwardLogs.filter(log => log.classId === classId);

    if (logsForClass.length === 0) {
        return { classStats: { noData: true }, studentStats: {}, students: studentsInClass };
    }

    const logsByMonth = logsForClass.reduce((acc, log) => {
        const monthKey = parseDDMMYYYY(log.date).toISOString().substring(0, 7);
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(log);
        return acc;
    }, {});

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const MILESTONE_NAMES = {
        diamond: "💎 Diamond",
        gold: "👑 Gold",
        silver: "🏆 Silver",
        bronze: "🛡️ Bronze",
        none: "None"
    };

    const monthlyStats = Object.entries(logsByMonth).map(([monthKey, monthLogs]) => {
        const totalStars = monthLogs.reduce((sum, log) => sum + log.stars, 0);
        const diamondGoal = studentsInClass.length > 0 ? Math.round(studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) : 18;
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100) : 0;
        
        let milestone = 'none';
        if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) milestone = 'diamond';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.GOLD) milestone = 'gold';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.SILVER) milestone = 'silver';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.BRONZE) milestone = 'bronze';

        return { monthKey, totalStars, progress, milestone };
    });

    const bestMonth = monthlyStats.sort((a, b) => b.totalStars - a.totalStars)[0] || null;
    const furthestMilestoneMonth = monthlyStats.sort((a, b) => b.progress - a.progress)[0] || null;

    const allTimeReasonCounts = logsForClass.reduce((acc, log) => {
        if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
        return acc;
    }, {});
    const topReason = Object.entries(allTimeReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

    const allTimeStudentStars = logsForClass.reduce((acc, log) => {
        acc[log.studentId] = (acc[log.studentId] || 0) + log.stars;
        return acc;
    }, {});
    const topStudents = Object.entries(allTimeStudentStars).sort((a,b) => b[1] - a[1]).slice(0, 3);

    const studentStats = {};
    studentsInClass.forEach(student => {
        const studentLogs = logsForClass.filter(log => log.studentId === student.id);
        if (studentLogs.length === 0) {
            studentStats[student.id] = { noData: true };
            return;
        }
        
        const studentLogsByMonth = studentLogs.reduce((acc, log) => {
            const monthKey = parseDDMMYYYY(log.date).toISOString().substring(0, 7);
            if (!acc[monthKey]) acc[monthKey] = 0;
            acc[monthKey] += log.stars;
            return acc;
        }, {});
        const bestStudentMonth = Object.entries(studentLogsByMonth).sort((a,b) => b[1] - a[1])[0] || null;

        const studentReasonCounts = studentLogs.reduce((acc, log) => {
            if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
            return acc;
        }, {});
        const topStudentReason = Object.entries(studentReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

        studentStats[student.id] = {
            totalStars: studentLogs.reduce((sum, log) => sum + log.stars, 0),
            bestMonth: bestStudentMonth ? { month: bestStudentMonth[0], stars: bestStudentMonth[1] } : null,
            topReason: topStudentReason ? { reason: topStudentReason[0], stars: topStudentReason[1] } : null
        };
    });

    return {
        classStats: {
            bestMonth: bestMonth ? { month: bestMonth.monthKey, stars: bestMonth.totalStars } : null,
            furthestMilestone: furthestMilestoneMonth ? { month: furthestMilestoneMonth.monthKey, milestone: MILESTONE_NAMES[furthestMilestoneMonth.milestone] } : null,
            topReason: topReason ? { reason: topReason[0], stars: topReason[1] } : null,
            topStudents
        },
        studentStats,
        students: studentsInClass
    };
}

function renderClassOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    if (data.classStats.noData) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Not enough data yet! Award some stars to this class to start seeing insights.</p>`;
        return;
    }

    const { bestMonth, furthestMilestone, topReason, topStudents } = data.classStats;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const furthestMilestoneDisplay = furthestMilestone ? `${furthestMilestone.milestone} <span class="text-sm font-normal text-gray-500">(in ${new Date(furthestMilestone.month + '-02').toLocaleString('en-GB', { month: 'long' })})</span>` : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';
    
    const topStudentsHtml = topStudents.length > 0 
        ? topStudents.map((studentEntry, index) => {
            const student = allStudents.find(s => s.id === studentEntry[0]);
            return `<div class="flex items-center gap-2"><span class="font-bold text-gray-400 w-6">${index+1}.</span> <span class="flex-grow">${student?.name || 'Unknown'}</span> <span class="font-semibold text-purple-600">${studentEntry[1]} ⭐</span></div>`;
        }).join('')
        : 'No stars awarded yet.';

    contentEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-3xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${bestMonth?.stars || 0} ⭐ collected</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-route mr-2"></i>Furthest on Quest Map</p>
                <p class="font-title text-3xl text-purple-700">${furthestMilestoneDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">Highest monthly progress</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>All-Time Top Skill</p>
                <p class="font-title text-3xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-crown mr-2"></i>All-Time Top Adventurers</p>
                <div class="space-y-1 mt-2 text-lg">
                    ${topStudentsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderStudentOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    
    if (data.students.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Add students to this class to see their individual stats.</p>`;
        return;
    }
    
    const studentOptions = data.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    contentEl.innerHTML = `
        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/3">
                <label for="overview-student-select" class="block text-sm font-medium text-gray-700 mb-1">Select a Student:</label>
                <select id="overview-student-select" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-lg">
                    ${studentOptions}
                </select>
            </div>
            <div id="overview-student-details" class="flex-grow">
                <!-- Student details will be rendered here -->
            </div>
        </div>
    `;

    const studentSelect = document.getElementById('overview-student-select');
    studentSelect.addEventListener('change', (e) => {
        renderStudentDetails(data, e.target.value);
    });

    renderStudentDetails(data, studentSelect.value);
}

function renderStudentDetails(data, studentId) {
    const detailsEl = document.getElementById('overview-student-details');
    const studentData = data.studentStats[studentId];

    if (!studentData || studentData.noData) {
        detailsEl.innerHTML = `<div class="h-full flex items-center justify-center bg-gray-50 rounded-lg"><p class="text-gray-500">This student hasn't earned any stars yet.</p></div>`;
        return;
    }

    const { totalStars, bestMonth, topReason } = studentData;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';

    detailsEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-star mr-2"></i>All-Time Stars</p>
                <p class="font-title text-4xl text-purple-700">${totalStars}</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-2xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${bestMonth?.stars || 0} ⭐ earned</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>Top Skill</p>
                <p class="font-title text-2xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
        </div>
    `;
}


// --- v6.0.0: Scholar's Scroll Functions (OVERHAULED for FIX #2) ---
function renderScholarsScrollTab(selectedClassId = null) {
    const classSelect = document.getElementById('scroll-class-select');
    if (!classSelect) return;

    // FIX #7: Use global class ID
    const currentVal = selectedClassId || globalSelectedClassId;
    const optionsHtml = allTeachersClasses.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">Select a class to view their scroll...</option>' + optionsHtml;
    if (currentVal) classSelect.value = currentVal;
    
    document.getElementById('log-trial-btn').disabled = !currentVal;
    document.getElementById('view-trial-history-btn').disabled = !currentVal;

    if (currentVal) {
        renderScrollDashboard(currentVal);
        document.getElementById('scroll-dashboard-content').classList.remove('hidden');
        document.getElementById('scroll-placeholder').classList.add('hidden');
    } else {
        document.getElementById('scroll-dashboard-content').classList.add('hidden');
        document.getElementById('scroll-placeholder').classList.remove('hidden');
    }
}

function renderScrollDashboard(classId) {
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    const scoresForClass = allWrittenScores.filter(s => s.classId === classId);
    const classData = allSchoolClasses.find(c => c.id === classId);
    const isJunior = classData && (classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B');
    
    const statsContainer = document.getElementById('scroll-stats-cards');
    const chartContainer = document.getElementById('scroll-performance-chart');

    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    const testScores = scoresForClass.filter(s => s.type === 'test' && s.scoreNumeric !== null);
    const dictationScores = scoresForClass.filter(s => s.type === 'dictation');
    
    // --- Calculate Averages ---
    const testAvg = testScores.length > 0 
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / testScores.length) 
        : null;

    let avgDictationDisplay = '--';
    if (isJunior) {
        const juniorDictations = dictationScores.filter(s => s.scoreQualitative);
        const avgDictationValue = juniorDictations.length > 0
            ? (juniorDictations.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / juniorDictations.length)
            : null;
        if (avgDictationValue !== null) {
            const dictationEntries = Object.entries(dictationMap);
            const closest = dictationEntries.reduce((prev, curr) => Math.abs(curr[1] - avgDictationValue) < Math.abs(prev[1] - avgDictationValue) ? curr : prev);
            avgDictationDisplay = closest[0];
        }
    } else {
        const seniorDictations = dictationScores.filter(s => s.scoreNumeric !== null);
        const avgSeniorDictation = seniorDictations.length > 0
            ? (seniorDictations.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / seniorDictations.length)
            : null;
        if (avgSeniorDictation !== null) {
            avgDictationDisplay = `${avgSeniorDictation.toFixed(0)}%`;
        }
    }

    let topScholars = [];
    if (studentsInClass.length > 0 && scoresForClass.length > 0) {
        const studentAverages = studentsInClass.map(student => {
            const studentTestScores = testScores.filter(s => s.studentId === student.id);
            const studentDictationScores = dictationScores.filter(s => s.studentId === student.id);
            if (studentTestScores.length === 0 && studentDictationScores.length === 0) return null;

            const avg = isJunior 
                ? calculateJuniorTreasureRank(studentTestScores, studentDictationScores).value 
                : calculateSeniorAverage(studentTestScores, studentDictationScores);

            return { name: student.name, avg };
        }).filter(Boolean);

        if(studentAverages.length > 0) {
            const maxAvg = Math.max(...studentAverages.map(s => s.avg));
            topScholars = studentAverages.filter(s => s.avg === maxAvg);
        }
    }
    const topScholarsDisplay = topScholars.length > 0 ? topScholars.map(s => s.name).join(', ') : '--';

    statsContainer.innerHTML = `
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Class Avg (Test)</p>
            <p class="font-title text-4xl text-green-600">${testAvg !== null ? testAvg.toFixed(0) + '%' : '--'}</p>
        </div>
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Class Avg (Dictation)</p>
            <p class="font-title text-4xl text-blue-600">${avgDictationDisplay}</p>
        </div>
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Top Scholar(s)</p>
            <p class="font-title text-2xl text-purple-700" title="${topScholarsDisplay}">${topScholarsDisplay}</p>
        </div>
    `;

    const studentPerformanceData = studentsInClass.map(student => {
        const studentTestScores = scoresForClass.filter(s => s.studentId === student.id && s.type === 'test');
        const studentDictationScores = scoresForClass.filter(s => s.studentId === student.id && s.type === 'dictation');
        
        let performance = { value: 0, display: '--' };
        if (studentTestScores.length > 0 || studentDictationScores.length > 0) {
            if (isJunior) {
                performance = calculateJuniorTreasureRank(studentTestScores, studentDictationScores);
            } else {
                const avg = calculateSeniorAverage(studentTestScores, studentDictationScores);
                performance = { value: avg, display: `${avg.toFixed(1)}%` };
            }
        }
        return { student, performance };
    }).sort((a, b) => b.performance.value - a.performance.value);

    // Render Performance Chart
    if (studentPerformanceData.length === 0 || studentPerformanceData.every(d => d.performance.value === 0)) {
        chartContainer.innerHTML = `<p class="text-center text-gray-400 p-8">Log some trials to see the performance chart!</p>`;
    } else {
        chartContainer.innerHTML = `<div class="performance-chart-container">${studentPerformanceData.map(({student, performance}) => {
            const avatarHtml = student.avatar 
                ? `<img src="${student.avatar}" alt="${student.name}" class="student-avatar enlargeable-avatar">` 
                : `<div class="student-avatar flex items-center justify-center bg-gray-300 text-gray-600 font-bold">${student.name.charAt(0)}</div>`;
            
            const maxVal = isJunior ? 4 : 100;
            const percentage = (performance.value / maxVal) * 100;
            let tier = 'low';
            if (percentage >= 80) tier = 'high';
            else if (percentage >= 50) tier = 'mid';

            // --- CORRECTED: Tooltip Stat Calculation ---
            const studentScores = scoresForClass.filter(s => s.studentId === student.id);
            const studentTestScores = studentScores.filter(s => s.type === 'test');
            const studentDictationScores = studentScores.filter(s => s.type === 'dictation');
            const totalTests = studentTestScores.length;
            const totalDictations = studentDictationScores.length;

            let avgTestScore = null;
            if (totalTests > 0) {
                avgTestScore = studentTestScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / totalTests;
            }

            let bestTest = null;
            if (totalTests > 0) {
                bestTest = studentTestScores.reduce((best, current) => {
                    const bestScore = best.scoreNumeric / best.maxScore;
                    const currentScore = current.scoreNumeric / current.maxScore;
                    return currentScore > bestScore ? current : best;
                });
            }
            
            let dictationTooltipStat = '';
            if (isJunior) {
                const dictationCounts = studentDictationScores.reduce((acc, s) => {
                    if(s.scoreQualitative) acc[s.scoreQualitative] = (acc[s.scoreQualitative] || 0) + 1;
                    return acc;
                }, {});
                const dictationOrder = ["Great!!!", "Great!!", "Great!", "Nice Try!"];
                const dictationSummary = dictationOrder
                    .filter(key => dictationCounts[key])
                    .map(key => `${dictationCounts[key]}x ${key}`)
                    .join(', ');
                if (dictationSummary) {
                    dictationTooltipStat = `<div><strong>Dictations:</strong> ${dictationSummary}</div>`;
                }
            } else { // Is Senior
                if (totalDictations > 0) {
                    const seniorDictations = studentDictationScores.filter(s => s.scoreNumeric !== null);
                    if (seniorDictations.length > 0) {
                        const avgDictationScore = seniorDictations.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / seniorDictations.length;
                        dictationTooltipStat = `<div><strong>Avg. Dictation Score:</strong> ${avgDictationScore.toFixed(1)}%</div>`;
                    }
                }
            }

            let tooltipBody = `<div><strong>Trials Logged:</strong> ${totalTests + totalDictations}</div>`;
            if (avgTestScore !== null) {
                tooltipBody += `<div><strong>Avg. Test Score:</strong> ${avgTestScore.toFixed(1)}%</div>`;
            }
            tooltipBody += dictationTooltipStat; // Add the level-specific dictation stat
            if (bestTest) {
                const bestScorePercent = (bestTest.scoreNumeric / bestTest.maxScore * 100).toFixed(0);
                tooltipBody += `<div><strong>Best Test:</strong> ${bestScorePercent}% on "${bestTest.title}"</div>`;
            }
            if (totalTests === 0 && totalDictations === 0) {
                tooltipBody = `<div>No trial data logged yet.</div>`;
            }

            const tooltipHtml = `
                <div class="chart-tooltip">
                    <div class="tooltip-title">${student.name}'s Stats</div>
                    <div class="tooltip-body">
                        ${tooltipBody}
                    </div>
                </div>
            `;

            return `
                <div class="chart-row">
                    ${avatarHtml}
                    <div class="chart-label">${student.name}</div>
                    <div class="chart-bar-wrapper">
                        ${tooltipHtml}
                        <div class="chart-bar" data-score-tier="${tier}" style="width: ${percentage}%; animation-delay: ${Math.random() * 0.2}s;">
                            <span>${performance.display}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    }
}

// FIX #4: New simplified metric function for Junior students
function calculateJuniorTreasureRank(testScores, dictationScores) {
    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    // Calculate average score for each type (0-4 scale)
    const testAvg = testScores.length > 0
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 4
        : 0;
    
    const dictationAvg = dictationScores.length > 0
        ? dictationScores.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / dictationScores.length
        : 0;

    // Weighting: 60% test, 40% dictation if both exist. Otherwise 100% of whichever exists.
    let finalScore;
    if (testScores.length > 0 && dictationScores.length > 0) {
        finalScore = (testAvg * 0.6) + (dictationAvg * 0.4);
    } else {
        finalScore = Math.max(testAvg, dictationAvg);
    }

    if (finalScore > 3.5) return { value: 4, display: '💎 Diamond Explorer' };
    if (finalScore > 2.7) return { value: 3, display: '👑 Gold Seeker' };
    if (finalScore > 1.8) return { value: 2, display: '🏆 Silver Adventurer' };
    if (finalScore > 0) return { value: 1, display: '🧭 Bronze Pathfinder' };
    return { value: 0, display: '--' };
}

// Original calculation for senior students
function calculateSeniorAverage(testScores, dictationScores) {
    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    const testAvg = testScores.length > 0 
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 100 
        : 0;
        
    const dictationAvg = dictationScores.length > 0 
        ? (dictationScores.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / dictationScores.length) 
        : 0;
    
    let weightedAvg;
    if (testScores.length > 0 && dictationScores.length > 0) {
        weightedAvg = (testAvg * 0.6) + ((dictationAvg / 4) * 100 * 0.4);
    } else {
        weightedAvg = Math.max(testAvg, (dictationAvg / 4) * 100);
    }
    return weightedAvg;
}

async function openLogTrialModal(classId, trialId = null) {
    if (!classId) return;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    const form = document.getElementById('log-trial-form');
    form.reset();
    form.dataset.editingId = trialId || '';

    document.getElementById('log-trial-class-id').value = classId;
    document.getElementById('log-trial-modal-title').innerText = trialId ? 'Edit Trial Log' : 'Log a New Trial';
    
    const studentSelect = document.getElementById('log-trial-student-select');
    const studentsInClass = allStudents.filter(s => s.classId === classId);
    studentSelect.innerHTML = studentsInClass.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    if (trialId) {
        const score = allWrittenScores.find(s => s.id === trialId);
        if (score) {
            studentSelect.value = score.studentId;
            document.getElementById('log-trial-date').value = score.date;
            document.getElementById('log-trial-type').value = score.type;
            document.getElementById('log-trial-notes').value = score.notes || '';
            renderLogTrialScoreInput(); // Render inputs before filling them
            if (score.scoreQualitative) {
                document.getElementById('log-trial-score-qualitative').value = score.scoreQualitative;
            } else {
                if (document.getElementById('log-trial-title')) document.getElementById('log-trial-title').value = score.title || '';
                if (document.getElementById('log-trial-score-numeric')) document.getElementById('log-trial-score-numeric').value = score.scoreNumeric;
            }
        }
    } else {
        document.getElementById('log-trial-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('log-trial-type').value = 'dictation'; // Default to Dictation
        renderLogTrialScoreInput();
        const existingScore = allWrittenScores.find(s => s.classId === classId && s.date === document.getElementById('log-trial-date').value && s.type === 'test' && s.title);
        if (existingScore && document.getElementById('log-trial-title')) {
            document.getElementById('log-trial-title').value = existingScore.title;
        }
    }
    
    document.getElementById('log-trial-modal').classList.remove('hidden');
}

function renderLogTrialScoreInput() {
    const container = document.getElementById('log-trial-score-container');
    const classId = document.getElementById('log-trial-class-id').value;
    const trialType = document.getElementById('log-trial-type').value;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

    let inputHtml = '';
    if (isJunior && trialType === 'dictation') {
        inputHtml = `
            <label for="log-trial-score-qualitative" class="block text-sm font-medium text-gray-700">Score</label>
            <select id="log-trial-score-qualitative" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500" required>
                <option value="Great!!!">Great!!! (Excellent)</option>
                <option value="Great!!">Great!!</option>
                <option value="Great!">Great!</option>
                <option value="Nice Try!">Nice Try!</option>
            </select>
        `;
    } else {
        const maxScore = (isJunior && trialType === 'test') ? 40 : 100;
        inputHtml = `
            <div>
                <label for="log-trial-title" class="block text-sm font-medium text-gray-700">Test Title</label>
                <input type="text" id="log-trial-title" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500" placeholder="e.g., Unit 5 Vocabulary Quiz" required>
            </div>
            <div>
                <label for="log-trial-score-numeric" class="block text-sm font-medium text-gray-700">Score (out of ${maxScore})</label>
                <input type="number" id="log-trial-score-numeric" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500" max="${maxScore}" min="0" required>
            </div>
        `;
    }
    container.innerHTML = inputHtml;
}

async function handleLogTrial() {
    const classId = document.getElementById('log-trial-class-id').value;
    const studentId = document.getElementById('log-trial-student-select').value;
    const date = document.getElementById('log-trial-date').value;
    const type = document.getElementById('log-trial-type').value;
    const notes = document.getElementById('log-trial-notes').value.trim();
    const editingId = document.getElementById('log-trial-form').dataset.editingId;

    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;
    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

    let scoreData = {
        studentId, classId, date: parseDDMMYYYY(date).toISOString().split('T')[0], type, notes,
        teacherId: currentUserId,
        title: null,
        scoreNumeric: null,
        scoreQualitative: null,
        maxScore: null
    };

    if (isJunior && type === 'dictation') {
        const scoreEl = document.getElementById('log-trial-score-qualitative');
        if (!scoreEl || !scoreEl.value) { showToast('Please select a score.', 'error'); return; }
        scoreData.scoreQualitative = scoreEl.value;
    } else {
        const titleEl = document.getElementById('log-trial-title');
        if (!titleEl || !titleEl.value.trim()) { showToast('Please enter a title for the test.', 'error'); return; }
        scoreData.title = titleEl.value.trim();

        const maxScore = (isJunior && type === 'test') ? 40 : 100;
        const scoreEl = document.getElementById('log-trial-score-numeric');
        if (!scoreEl || scoreEl.value === '') { showToast('Please enter a score.', 'error'); return; }
        const score = parseInt(scoreEl.value, 10);
        if (isNaN(score) || score < 0 || score > maxScore) { showToast(`Please enter a valid score between 0 and ${maxScore}.`, 'error'); return; }
        scoreData.scoreNumeric = score;
        scoreData.maxScore = maxScore;
    }

    try {
        const btn = document.querySelector('#log-trial-form button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

        if (editingId) {
            const docRef = doc(db, `artifacts/great-class-quest/public/data/written_scores`, editingId);
            await updateDoc(docRef, scoreData);
            showToast("Trial results updated successfully!", "success");
        } else {
            scoreData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, `artifacts/great-class-quest/public/data/written_scores`), scoreData);
            showToast("Trial results recorded successfully!", "success");
            checkAndTriggerStarfall(studentId, {id: docRef.id, ...scoreData});
        }
        hideModal('log-trial-modal');

    } catch (error) {
        console.error("Error logging/updating trial:", error);
        showToast("Failed to save the score.", "error");
    } finally {
        const btn = document.querySelector('#log-trial-form button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Record Treasure';
        }
    }
}

async function checkAndTriggerStarfall(studentId, newScoreData) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    const studentClass = allSchoolClasses.find(c => c.id === student.classId);
    if (!studentClass) return;

    const classLevel = studentClass.questLevel;
    const isJunior = classLevel === 'Junior A' || classLevel === 'Junior B';
    let bonusTriggered = false;
    let bonusAmount = 0;

    const currentMonthKey = newScoreData.date.substring(0, 7);

    if (newScoreData.type === 'test') {
        const threshold = isJunior ? 37 : 85;
        if (newScoreData.scoreNumeric >= threshold) {
            bonusTriggered = true;
            bonusAmount = 1;
        }
    } else if (newScoreData.type === 'dictation') {
        const studentScoresThisMonth = allWrittenScores.filter(s => 
            s.studentId === studentId && 
            s.type === 'dictation' &&
            s.date.startsWith(currentMonthKey)
        );

        if (isJunior) {
            const excellentCount = studentScoresThisMonth.filter(s => s.scoreQualitative === 'Great!!!').length;
            if (excellentCount > 2) {
                bonusTriggered = true;
                bonusAmount = 0.5;
            }
        } else {
            const highScores = studentScoresThisMonth.filter(s => (s.scoreNumeric / s.maxScore) * 100 > 85);
            if (highScores.length > 2) {
                bonusTriggered = true;
                bonusAmount = 0.5;
            }
        }

        if (bonusTriggered) {
            const bonusLogsThisMonth = allAwardLogs.filter(log => 
                log.studentId === studentId && 
                log.reason === 'scholar_s_bonus' && 
                log.date.startsWith(currentMonthKey) &&
                log.note && log.note.includes('dictation')
            ).length;

            if (bonusLogsThisMonth >= 2) {
                bonusTriggered = false;
            }
        }
    }
    
    if (bonusTriggered) {
        setTimeout(() => showStarfallModal(student.id, student.name, bonusAmount, newScoreData.type), 500);
    }
}

function showStarfallModal(studentId, studentName, bonusAmount, trialType) {
    playSound('magic_chime');

    document.getElementById('starfall-student-name').innerText = studentName;
    const confirmBtn = document.getElementById('starfall-confirm-btn');
    const modal = document.getElementById('starfall-modal');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleAwardBonusStar(studentId, bonusAmount, trialType);
        hideModal('starfall-modal');
    });

    modal.classList.remove('hidden');
}

async function handleAwardBonusStar(studentId, bonusAmount, trialType) {
    playSound('star3');
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
        await runTransaction(db, async (transaction) => {
            const publicDataPath = "artifacts/great-class-quest/public/data";
            const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
            const newLogRef = doc(collection(db, `${publicDataPath}/award_log`));

            transaction.update(scoreRef, {
                totalStars: increment(bonusAmount),
                monthlyStars: increment(bonusAmount)
            });

            const logData = {
                studentId,
                classId: student.classId,
                teacherId: currentUserId,
                stars: bonusAmount,
                reason: "scholar_s_bonus",
                note: `Awarded for exceptional performance on a ${trialType}.`,
                date: getTodayDateString(),
                createdAt: serverTimestamp(),
                createdBy: { uid: currentUserId, name: currentTeacherName }
            };
            transaction.set(newLogRef, logData);
        });
        showToast(`✨ A ${bonusAmount}-Star Bonus has been bestowed upon ${student.name}! ✨`, 'success');
    } catch (error) {
        console.error("Scholar's Bonus transaction failed:", error);
        showToast('Could not award the bonus star. Please try again.', 'error');
    }
}

// --- Trial History Functions ---
function openTrialHistoryModal(classId) {
    if (!classId) return;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    const modal = document.getElementById('trial-history-modal');
    modal.dataset.classId = classId;
    document.getElementById('trial-history-title').innerHTML = `${classData.logo} Trial History`;

    const viewToggle = document.getElementById('trial-history-view-toggle');
    viewToggle.innerHTML = `
        <button data-view="test" class="toggle-btn active-toggle"><i class="fas fa-file-alt mr-2"></i>Tests</button>
        <button data-view="dictation" class="toggle-btn"><i class="fas fa-microphone-alt mr-2"></i>Dictations</button>
    `;

    viewToggle.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-toggle'));
            e.currentTarget.classList.add('active-toggle');
            renderTrialHistoryContent(classId, e.currentTarget.dataset.view);
        });
    });

    document.getElementById('trial-history-content').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-trial-btn');
        if (deleteBtn) handleDeleteTrial(deleteBtn.dataset.trialId);
        const editBtn = e.target.closest('.edit-trial-btn');
        if (editBtn) openLogTrialModal(classId, editBtn.dataset.trialId);
    });
    
    renderTrialHistoryContent(classId, 'test');
    modal.classList.remove('hidden');
}

function renderTrialHistoryContent(classId, view) {
    const contentEl = document.getElementById('trial-history-content');
    const scores = allWrittenScores.filter(s => s.classId === classId && s.type === view);

    if (scores.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No ${view} records found for this class.</p>`;
        return;
    }

    const scoresByMonth = scores.reduce((acc, score) => {
        const monthKey = score.date.substring(0, 7); // YYYY-MM
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(score);
        return acc;
    }, {});

    const sortedMonths = Object.keys(scoresByMonth).sort().reverse();

    contentEl.innerHTML = sortedMonths.map(monthKey => {
        const monthName = new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        
        let monthScoresHtml;
        if (view === 'dictation') {
            const scoresByDate = scoresByMonth[monthKey].reduce((acc, score) => {
                if (!acc[score.date]) acc[score.date] = [];
                acc[score.date].push(score);
                return acc;
            }, {});
            const sortedDates = Object.keys(scoresByDate).sort((a,b) => new Date(b) - new Date(a));
            
            monthScoresHtml = sortedDates.map(date => {
                const dateScoresHtml = scoresByDate[date].map(score => renderTrialHistoryItem(score)).join('');
                return `<div class="date-group-header">${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>${dateScoresHtml}`;
            }).join('');
        } else {
            monthScoresHtml = scoresByMonth[monthKey].map(score => renderTrialHistoryItem(score)).join('');
        }

        return `
            <details class="month-group bg-white/50 rounded-lg" open>
                <summary class="font-title text-xl text-amber-800 p-3 cursor-pointer">${monthName}</summary>
                <div class="p-2 space-y-2">
                    ${monthScoresHtml}
                </div>
            </details>
        `;
    }).join('');
}

function renderTrialHistoryItem(score) {
    const student = allStudents.find(s => s.id === score.studentId);
    if (!student) return '';

    const scorePercent = score.maxScore ? (score.scoreNumeric / score.maxScore) * 100 : null;
    let scoreDisplay = '';
    if (score.scoreQualitative) {
        scoreDisplay = `<span class="font-title text-xl text-blue-600">${score.scoreQualitative}</span>`;
    } else if (scorePercent !== null) {
        const colorClass = scorePercent >= 80 ? 'text-green-600' : scorePercent >= 60 ? 'text-yellow-600' : 'text-red-600';
        scoreDisplay = `<span class="font-title text-2xl ${colorClass}">${scorePercent.toFixed(0)}%</span>
                        <span class="text-xs text-gray-500">(${score.scoreNumeric}/${score.maxScore})</span>`;
    }
    
    const isOwner = score.teacherId === currentUserId;

    return `
        <div class="trial-history-item">
            <div class="flex-grow">
                ${score.type === 'test' ? `<p class="text-sm text-gray-500">${score.date}</p>` : ''}
                <p class="font-semibold text-lg text-gray-800">${student.name}</p>
                ${score.title ? `<p class="text-amber-800 font-medium italic">"${score.title}"</p>` : ''}
                ${score.notes ? `<p class="text-xs text-gray-600 mt-1 pl-2 border-l-2 border-gray-300">Note: ${score.notes}</p>` : ''}
            </div>
            <div class="text-right flex-shrink-0 w-24 flex flex-col items-end">
                ${scoreDisplay}
            </div>
            <div class="flex-shrink-0 ml-2 flex flex-col gap-1">
                ${isOwner ? `<button data-trial-id="${score.id}" class="edit-trial-btn bubbly-button bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center" title="Edit Trial Record"><i class="fas fa-pencil-alt"></i></button>` : ''}
                ${isOwner ? `<button data-trial-id="${score.id}" class="delete-trial-btn bubbly-button bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center" title="Delete Trial Record"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
        </div>
    `;
}


function handleDeleteTrial(trialId) {
    showModal('Delete Trial Record?', 'Are you sure you want to permanently delete this score? This cannot be undone.', async () => {
        try {
            await deleteDoc(doc(db, "artifacts/great-class-quest/public/data/written_scores", trialId));
            showToast('Trial record deleted.', 'success');
        } catch (error) {
            console.error("Error deleting trial record:", error);
            showToast('Could not delete the record.', 'error');
        }
    });
}


// --- ATTENDANCE OVERHAUL ---
function getLastLessonDate(classId) {
    const classData = allSchoolClasses.find(c => c.id === classId);
    if (!classData || !classData.scheduleDays || classData.scheduleDays.length === 0) {
        return getTodayDateString(); 
    }
    
    let checkDate = new Date();
    for (let i = 0; i < 7; i++) {
        if (classData.scheduleDays.includes(checkDate.getDay().toString())) {
            return getDDMMYYYY(checkDate);
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return getTodayDateString(); 
}

async function handleMarkAbsent(studentId, classId, isAbsent) {
    const lastLessonDate = getLastLessonDate(classId);
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const attendanceCollectionRef = collection(db, `${publicDataPath}/attendance`);

    try {
        if (isAbsent) {
            const q = query(
                attendanceCollectionRef,
                where("studentId", "==", studentId),
                where("date", "==", lastLessonDate),
                where("markedBy.uid", "==", currentUserId)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                await addDoc(attendanceCollectionRef, {
                    studentId,
                    classId,
                    date: lastLessonDate,
                    markedBy: { uid: currentUserId, name: currentTeacherName },
                    createdAt: serverTimestamp()
                });
            }
        } else {
            const q = query(
                attendanceCollectionRef,
                where("studentId", "==", studentId),
                where("date", "==", lastLessonDate),
                where("markedBy.uid", "==", currentUserId)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        
        const student = allStudents.find(s => s.id === studentId);
        showToast(`${student.name} marked as ${isAbsent ? 'absent' : 'present'}.`, 'success');

    } catch (error) {
        console.error("Error updating attendance:", error);
        showToast("Failed to update attendance record.", "error");
        updateStudentCardAttendanceState(studentId, !isAbsent);
    }
}


function openAttendanceChronicle() {
    const classId = document.getElementById('adventure-log-class-select').value;
    const classData = allTeachersClasses.find(c => c.id === classId);
    if (!classData) return;

    document.getElementById('attendance-chronicle-title').innerHTML = `${classData.logo} Attendance Chronicle`;
    document.getElementById('attendance-chronicle-content').innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading attendance records...</p>`;
    document.getElementById('attendance-chronicle-modal').classList.remove('hidden');

    renderAttendanceChronicle(classId);
}

function renderAttendanceChronicle(classId) {
    const contentEl = document.getElementById('attendance-chronicle-content');
    const classData = allSchoolClasses.find(c => c.id === classId);
    const studentsInClass = allStudents.filter(s => s.classId === classId);

    if (!classData || studentsInClass.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No students in this class to track attendance for.</p>`;
        return;
    }
    
    const scheduledDaysOfWeek = classData.scheduleDays || [];
    const lessonDates = [];
    let loopDate = new Date(competitionStart);
    const today = new Date();

    while (loopDate <= today) {
        if (scheduledDaysOfWeek.includes(loopDate.getDay().toString())) {
            lessonDates.push(getDDMMYYYY(loopDate));
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }
    
    lessonDates.sort((a,b) => parseDDMMYYYY(a) - parseDDMMYYYY(b));

    if(lessonDates.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">This class has no scheduled lesson days set in 'My Classes'.</p>`;
        return;
    }
    
    const attendanceByStudent = allAttendanceRecords.reduce((acc, record) => {
        if (record.classId === classId) {
            if (!acc[record.studentId]) acc[record.studentId] = new Set();
            acc[record.studentId].add(record.date);
        }
        return acc;
    }, {});

    let tableHtml = `<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-gray-100 sticky top-0 z-10">
        <th class="p-2 border font-semibold text-left">Student</th>`;
    lessonDates.forEach(dateStr => {
        const d = parseDDMMYYYY(dateStr);
        tableHtml += `<th class="p-2 border text-center text-sm font-medium">${d.getDate()}/${d.getMonth()+1}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    studentsInClass.forEach(student => {
        tableHtml += `<tr class="hover:bg-gray-50">
            <td class="p-2 border font-medium text-gray-800">${student.name}</td>`;
        lessonDates.forEach(dateStr => {
            const isAbsent = attendanceByStudent[student.id]?.has(dateStr);
            tableHtml += `<td class="p-2 border text-center">
                <button class="attendance-status-btn w-5 h-5 rounded-full transition-transform transform hover:scale-125 ${isAbsent ? 'status-absent' : 'status-present'}" 
                        data-student-id="${student.id}" 
                        data-date="${dateStr}" 
                        title="${isAbsent ? 'Click to mark Present' : 'Click to mark Absent'}">
                </button>
            </td>`;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    contentEl.innerHTML = tableHtml;

    contentEl.querySelectorAll('.attendance-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            toggleAttendanceRecord(e.target);
        });
    });
}

async function toggleAttendanceRecord(button) {
    playSound('click');
    const { studentId, date } = button.dataset;
    const isCurrentlyAbsent = button.classList.contains('status-absent');
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    button.classList.toggle('status-absent', !isCurrentlyAbsent);
    button.classList.toggle('status-present', isCurrentlyAbsent);
    button.title = isCurrentlyAbsent ? 'Click to mark Absent' : 'Click to mark Present';

    try {
        await handleMarkAbsent(studentId, student.classId, !isCurrentlyAbsent);
    } catch (error) {
        button.classList.toggle('status-absent', isCurrentlyAbsent);
        button.classList.toggle('status-present', !isCurrentlyAbsent);
        button.title = isCurrentlyAbsent ? 'Click to mark Present' : 'Click to mark Absent';
        showToast('Failed to update attendance.', 'error');
    }
}

// --- AVATAR MAKER & STUDENT MOVE FUNCTIONS ---

 function openAvatarMaker(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    avatarMakerData = { studentId, creature: null, color: null, accessory: null, generatedImage: null };
    
    document.getElementById('avatar-maker-student-name').textContent = `for ${student.name}`;

    const deleteBtn = document.getElementById('avatar-delete-btn');
    if (student.avatar) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
    
    const creatures = ['Fairy', 'Wizard', 'Elf', 'Dwarf', 'Goblin', 'Knight', 'Dragon', 'Unicorn', 'Robot', 'Alien', 'Mermaid', 'Gnome', 'Witch', 'Prince', 'Princess'];
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Black', 'White', 'Rainbow', 'Grey'];
    const accessories = ['None', 'Magic Wand', 'Big Glasses', 'Flower Crown', 'Pointy Hat', 'Shiny Sword', 'Glowing Book', 'Headphones', 'Small Backpack'];
    
    document.getElementById('avatar-creature-pool').innerHTML = creatures.map(c => `<button class="avatar-maker-option-btn" data-value="${c}">${c}</button>`).join('');
    document.getElementById('avatar-color-pool').innerHTML = colors.map(c => `<button class="avatar-maker-option-btn" data-value="${c}">${c}</button>`).join('');
    document.getElementById('avatar-accessory-pool').innerHTML = accessories.map(a => `<button class="avatar-maker-option-btn" data-value="${a}">${a}</button>`).join('');

    const placeholder = document.getElementById('avatar-maker-placeholder');
    const loader = document.getElementById('avatar-maker-loader');
    const imgEl = document.getElementById('avatar-maker-img');
    
    loader.classList.add('hidden');
    if (student.avatar) {
        imgEl.src = student.avatar;
        imgEl.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    document.getElementById('avatar-generate-btn').disabled = true;
    document.getElementById('avatar-post-generation-btns').classList.add('hidden');

    document.getElementById('avatar-maker-modal').classList.remove('hidden');
}

function handleAvatarOptionSelect(event, pool) {
    const btn = event.target.closest('.avatar-maker-option-btn');
    if (!btn) return;
    playSound('click');

    const poolContainer = document.getElementById(`avatar-${pool}-pool`);
    poolContainer.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    avatarMakerData[pool] = btn.dataset.value;

    if (avatarMakerData.creature && avatarMakerData.color && avatarMakerData.accessory) {
        document.getElementById('avatar-generate-btn').disabled = false;
    }
}

async function handleGenerateAvatar() {
    playSound('magic_chime');
    const { creature, color, accessory } = avatarMakerData;
    if (!creature || !color || !accessory) {
        showToast('Please select an option from each category.', 'error');
        return;
    }

    const generateBtn = document.getElementById('avatar-generate-btn');
    const postGenBtns = document.getElementById('avatar-post-generation-btns');
    const loader = document.getElementById('avatar-maker-loader');
    const placeholder = document.getElementById('avatar-maker-placeholder');
    const imgEl = document.getElementById('avatar-maker-img');

    generateBtn.disabled = true;
    postGenBtns.classList.add('hidden');
    placeholder.classList.add('hidden');
    imgEl.classList.add('hidden');
    loader.classList.remove('hidden');

    const systemPrompt = "You are an AI art prompt engineer specializing in creating cute, child-friendly avatars. The style MUST be: 'chibi character, cute, simple, flat 2D vector style, thick outlines, solid colors, centered, on a white background'. Your task is to combine a creature, a main color, and an accessory into a concise, effective prompt. The prompt MUST be a single sentence.";
    const accessoryText = accessory === 'None' ? 'with no accessory' : `holding a ${accessory}`;
    const userPrompt = `Generate a prompt for a cute chibi ${creature} with a main color scheme of ${color}, ${accessoryText}.`;

    try {
        const finalPrompt = await callGeminiApi(systemPrompt, userPrompt);
        const imageBase64 = await callCloudflareAiImageApi(finalPrompt);
        
        avatarMakerData.generatedImage = imageBase64;
        imgEl.src = imageBase64;

        imgEl.classList.remove('hidden');
        postGenBtns.classList.remove('hidden');
    } catch (error) {
        console.error("Avatar Generation Error:", error);
        showToast("The Avatar Forge had a hiccup. Please try again.", "error");
        placeholder.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
        generateBtn.disabled = false;
    }
}

async function handleSaveAvatar() {
    const { studentId, generatedImage } = avatarMakerData;
    if (!studentId || !generatedImage) return;

    const saveBtn = document.getElementById('avatar-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Saving...`;

    try {
        const compressedAvatar = await compressAvatarImageBase64(generatedImage);
        const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
        await updateDoc(studentRef, { avatar: compressedAvatar });
        
        showToast("Avatar saved successfully!", "success");
        hideModal('avatar-maker-modal');
    } catch (error) {
        console.error("Error saving avatar:", error);
        showToast("Could not save the avatar. Please try again.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-save mr-2"></i> Save Avatar`;
    }
}

async function handleDeleteAvatar() {
    const { studentId } = avatarMakerData;
    if (!studentId) return;

    showModal(
        'Remove Avatar?',
        'Are you sure you want to remove this student\'s avatar? This will revert them to the default initial.',
        async () => {
            const deleteBtn = document.getElementById('avatar-delete-btn');
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Removing...`;

            try {
                const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
                await updateDoc(studentRef, {
                    avatar: null 
                });
                
                showToast("Avatar removed successfully!", "success");
                hideModal('avatar-maker-modal');
            } catch (error) {
                console.error("Error removing avatar:", error);
                showToast("Could not remove the avatar. Please try again.", "error");
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = `<i class="fas fa-trash-alt mr-2"></i> Remove Avatar`;
            }
        },
        'Yes, Remove It',
        'Cancel'
    );
}

function openMoveStudentModal(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;
    const currentClass = allSchoolClasses.find(c => c.id === student.classId);
    if (!currentClass) return;

    const modal = document.getElementById('move-student-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('move-student-name').innerText = student.name;
    document.getElementById('move-student-current-class').innerText = `${currentClass.logo} ${currentClass.name}`;

    const targetClassSelect = document.getElementById('move-student-target-class');
    // FIX #1: Allow moving to ANY class in the same league
    const possibleClasses = allSchoolClasses.filter(c => c.questLevel === currentClass.questLevel && c.id !== currentClass.id);

    if (possibleClasses.length === 0) {
        targetClassSelect.innerHTML = `<option value="">No other classes in this league.</option>`;
        document.getElementById('move-student-confirm-btn').disabled = true;
    } else {
        targetClassSelect.innerHTML = possibleClasses.map(c => `<option value="${c.id}">${c.logo} ${c.name} (by ${c.createdBy.name})</option>`).join('');
        document.getElementById('move-student-confirm-btn').disabled = false;
    }
    
    modal.classList.remove('hidden');
}

async function handleMoveStudent() {
    const studentId = document.getElementById('move-student-modal').dataset.studentId;
    const newClassId = document.getElementById('move-student-target-class').value;

    if (!studentId || !newClassId) {
        showToast("Please select a target class.", "error");
        return;
    }

    const newClassData = allSchoolClasses.find(c => c.id === newClassId);
    if (!newClassData) {
        showToast("Target class data not found.", "error");
        return;
    }

    const btn = document.getElementById('move-student-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Moving...`;

    try {
        const studentRef = doc(db, `artifacts/great-class-quest/public/data/students`, studentId);
        
        // This is the key change: we are now updating ownership as well.
        await updateDoc(studentRef, { 
            classId: newClassId,
            createdBy: {
                uid: newClassData.createdBy.uid,
                name: newClassData.createdBy.name
            }
        });
        
        showToast("Student moved and ownership transferred successfully!", "success");
        hideModal('move-student-modal');
    } catch (error) {
        console.error("Error moving student:", error);
        showToast("Failed to move student. Please check permissions and try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Confirm Move`;
    }
}


// --- CEREMONY LOGIC ---

async function showGlobalLeaderboardModal() {
    playSound('click');
    const { league, monthKey } = ceremonyState;
    const modal = document.getElementById('global-leaderboard-modal');
    const titleEl = document.getElementById('global-leaderboard-title');
    const contentEl = document.getElementById('global-leaderboard-content');
    
    titleEl.innerText = `${league} - Global Ranks (${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' })})`;
    contentEl.innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading global ranks...</p>`;
    modal.classList.remove('hidden');
    
    document.getElementById('global-leaderboard-close-btn').onclick = () => hideModal('global-leaderboard-modal');
    
    const globalData = await fetchLastMonthResults(league, 'hero', monthKey);
    
    if (globalData.length === 0 || globalData.every(s => s.score === 0)) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No students in this league earned stars last month.</p>`;
        return;
    }

    contentEl.innerHTML = globalData.slice(0, 100).map(student => {
        const isMyStudent = allStudents.some(s => s.id === student.id && allTeachersClasses.some(tc => tc.id === s.classId));
        const highlightClass = isMyStudent ? 'bg-purple-100 border-purple-400' : 'bg-gray-50 border-gray-200';
        
        return `
            <div class="flex items-center justify-between p-2 rounded-lg border-l-4 ${highlightClass}">
                <div class="flex items-center">
                    <span class="font-bold text-gray-500 w-8 text-center">${student.rank}.</span>
                    <div>
                        <p class="font-semibold text-gray-800">${student.name}</p>
                        <p class="text-xs text-gray-500">${student.className}</p>
                    </div>
                </div>
                <p class="font-title text-xl text-purple-600">${student.score} ⭐</p>
            </div>
        `;
    }).join('');
}

function updateCeremonyStatus() {
    const teamQuestBtn = document.querySelector('.nav-button[data-tab="class-leaderboard-tab"]');
    const heroChallengeBtn = document.querySelector('.nav-button[data-tab="student-leaderboard-tab"]');
    teamQuestBtn.classList.remove('ceremony-ready-pulse');
    heroChallengeBtn.classList.remove('ceremony-ready-pulse');

    // FIX #7: Use global league state
    if (!globalSelectedLeague) return;

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    if (lastMonthDate < competitionStart) return;

    const monthKey = lastMonthDate.toISOString().substring(0, 7);

    const classesToday = getClassesOnDay(getTodayDateString());
    const myClassesInLeagueToday = classesToday.filter(c => 
        c.questLevel === globalSelectedLeague && allTeachersClasses.some(tc => tc.id === c.id)
    );

    if (myClassesInLeagueToday.length === 0) return;

    const heroCeremonyClassId = myClassesInLeagueToday[0].id;

    const teamCeremonyViewedKey = `ceremonyViewed_team_${globalSelectedLeague}_${monthKey}`;
    const heroCeremonyViewedKey = `ceremonyViewed_hero_${heroCeremonyClassId}_${monthKey}`;
    
    const isTeamCeremonyReady = !localStorage.getItem(teamCeremonyViewedKey);
    const isHeroCeremonyReady = !localStorage.getItem(heroCeremonyViewedKey);

    if (isTeamCeremonyReady) teamQuestBtn.classList.add('ceremony-ready-pulse');
    if (isHeroCeremonyReady) heroChallengeBtn.classList.add('ceremony-ready-pulse');

    const activeTab = document.querySelector('.app-tab:not(.hidden)');
    if (activeTab) {
        if (activeTab.id === 'class-leaderboard-tab' && isTeamCeremonyReady) {
            showCeremonyVeil('team', globalSelectedLeague, monthKey);
        } else if (activeTab.id === 'student-leaderboard-tab' && isHeroCeremonyReady) {
            showCeremonyVeil('hero', globalSelectedLeague, monthKey, heroCeremonyClassId);
        } else {
            hideCeremonyVeil();
        }
    }
}

function showCeremonyVeil(type, league, monthKey, classId = null) {
    if (sessionStorage.getItem('ceremonyVeilDismissed') === 'true' && sessionStorage.getItem('ceremonyDismissMonth') === monthKey) return;

    const screen = document.getElementById('ceremony-screen');
    const veil = document.getElementById('ceremony-veil');
    const stage = document.getElementById('ceremony-stage');
    const btn = document.getElementById('start-ceremony-btn');
    const ceremonyTitle = btn.querySelector('.font-title.text-6xl');
    const monthName = new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' });
    document.getElementById('ceremony-month-name').innerText = monthName;

    const themes = {
        team: { gradient: 'from-amber-500 to-orange-500', text: 'Team Quest Ceremony' },
        hero: { gradient: 'from-purple-500 to-indigo-500', text: 'Hero\'s Challenge Ceremony' }
    };
    const theme = themes[type];
    const buttonGradientDiv = btn.querySelector('.bg-gradient-to-r');
    buttonGradientDiv.className = `mt-2 px-8 py-4 bg-gradient-to-r ${theme.gradient} rounded-full shadow-2xl`;
    ceremonyTitle.innerText = theme.text;

    screen.classList.remove('hidden');
    veil.classList.remove('hidden');
    stage.classList.add('hidden');

    btn.onclick = () => {
        playSound('confirm');
        veil.classList.add('hidden');
        stage.classList.remove('hidden');
        startCeremony(type, league, monthKey, classId); 
    };
    document.getElementById('ceremony-veil-close-btn').onclick = () => {
        hideCeremonyVeil();
        sessionStorage.setItem('ceremonyDismissMonth', monthKey);
    };
}

function hideCeremonyVeil() {
    document.getElementById('ceremony-screen').classList.add('hidden');
    sessionStorage.setItem('ceremonyVeilDismissed', 'true');
    if (soundsReady && ceremonyMusic.state === "started") ceremonyMusic.stop(); 
}

async function startCeremony(type, league, monthKey, classId = null) {
    ceremonyState = { isActive: true, type, league, monthKey, data: [], step: -1, isFinalShowdown: false, classId: classId };
    
    if (soundsReady && ceremonyMusic.loaded) {
        ceremonyMusic.start();
    }

    const veilBtn = document.getElementById('start-ceremony-btn');
    if (veilBtn) veilBtn.disabled = true;
    const titleEl = document.getElementById('ceremony-title');
    titleEl.innerText = `Preparing the stage...`;
    
    if (allSchoolClasses.length === 0 || allStudents.length === 0) {
        titleEl.innerText = `Waiting for Quest data to sync...`;
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (allSchoolClasses.length === 0 || allStudents.length === 0) {
             titleEl.innerText = `Error: Could not sync all class data. Please refresh and try again.`;
             document.getElementById('ceremony-next-btn').disabled = true;
             document.getElementById('ceremony-skip-btn').disabled = true;
             return;
        }
    }
    
    document.getElementById('ceremony-title').innerText = `Fetching results for the ${type === 'team' ? 'Team Quest' : 'Hero\'s Challenge'}...`;
    document.getElementById('ceremony-reveal-area').innerHTML = '';
    document.getElementById('ceremony-next-btn').disabled = true;
    
    const showGlobalBtn = document.getElementById('ceremony-show-global-btn');
    showGlobalBtn.onclick = showGlobalLeaderboardModal;

    const nextBtn = document.getElementById('ceremony-next-btn');
    const exitBtn = document.getElementById('ceremony-exit-btn');
    const skipBtn = document.getElementById('ceremony-skip-btn');
    nextBtn.onclick = advanceCeremony;
    exitBtn.onclick = endCeremony;
    skipBtn.onclick = () => {
        const lastStep = ceremonyState.data.length - 1;
        if (lastStep >= 0) {
             ceremonyState.step = lastStep - 2;
             advanceCeremony();
        } else {
            endCeremony();
        }
    };
    
    let rawData;
try {
    rawData = await fetchLastMonthResults(league, type, monthKey, classId);
} catch (error) {
    console.error("Failed to fetch ceremony results:", error);
    document.getElementById('ceremony-reveal-area').innerHTML = `<p class="text-2xl font-title text-red-400">A storm has delayed the Quest Master!</p>`;
    document.getElementById('ceremony-ai-commentary').innerHTML = `<p>Could not retrieve results. Please check your internet connection and try again.</p>`;
    document.getElementById('ceremony-next-btn').innerHTML = `<i class="fas fa-times"></i>`;
    document.getElementById('ceremony-next-btn').onclick = endCeremony;
    document.getElementById('ceremony-next-btn').disabled = false;
    document.getElementById('ceremony-skip-btn').disabled = true;
    if (veilBtn) veilBtn.disabled = false;
    return;
}
    let dataWithRanks = [];
    if (rawData.length > 0 && rawData.some(d => d.score > 0)) {
        let lastScore = -1;
        let lastProgress = -1; 
        let currentRank = 0;

        rawData.forEach((entry, index) => {
            const uniqueMetric = type === 'team' ? entry.progress : entry.score;
            const lastMetric = type === 'team' ? lastProgress : lastScore;

            if (uniqueMetric !== lastMetric) {
                currentRank = index + 1;
            }
            dataWithRanks.push({ ...entry, rank: currentRank });
            
            if (type === 'team') {
                lastProgress = entry.progress;
            } else {
                lastScore = entry.score;
            }
        });

        const groupedByRank = dataWithRanks.reduce((acc, entry) => {
            if (!acc[entry.rank]) {
                acc[entry.rank] = { rank: entry.rank, entries: [] };
            }
            acc[entry.rank].entries.push(entry);
            return acc;
        }, {});

        ceremonyState.data = Object.values(groupedByRank).sort((a, b) => b.rank - a.rank);
    }
    
    if (ceremonyState.data.length === 0) {
        document.getElementById('ceremony-reveal-area').innerHTML = `<p class="text-2xl font-title">No quest results were recorded for last month!</p>`;
        document.getElementById('ceremony-ai-commentary').innerHTML = `<p>The Quest Master's scroll is empty for this period.</p>`;
        nextBtn.innerHTML = `<i class="fas fa-check"></i>`;
        nextBtn.onclick = endCeremony;
        nextBtn.disabled = false;
        skipBtn.disabled = true;
        
        if (soundsReady && ceremonyMusic.state === "started") ceremonyMusic.stop();
        
        const ceremonyViewedKey = type === 'hero' 
            ? `ceremonyViewed_hero_${classId}_${monthKey}`
            : `ceremonyViewed_team_${league}_${monthKey}`;
            
        localStorage.setItem(ceremonyViewedKey, 'true');
        updateCeremonyStatus();
        return;
    }
    
    document.getElementById('ceremony-title').innerText = `${type === 'team' ? 'Team Quest' : 'Hero\'s Challenge'} - ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long' })} Results`;
    nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
    nextBtn.disabled = false;
    skipBtn.disabled = false;
    
    advanceCeremony();
}

async function advanceCeremony() {
    if (ceremonyState.isFinalShowdown) {
        revealWinner();
        ceremonyState.isFinalShowdown = false;
        return;
    }

    ceremonyState.step++;
    const { data, step } = ceremonyState;
    const nextBtn = document.getElementById('ceremony-next-btn');
    
    if (step >= data.length) {
        endCeremony();
        return;
    }
    
    const currentRankGroup = data[step];
    const { rank, entries } = currentRankGroup;
    
    const isShowdownTrigger = (rank === 2 && data[step + 1]?.rank === 1);

    if (isShowdownTrigger) {
        ceremonyState.isFinalShowdown = true;
        
        const finalists2 = entries;
        const finalists1 = data[step + 1].entries;
        
        revealFinalists(finalists1[0], finalists2[0]);

        if (soundsReady && ceremonyMusic.loaded) ceremonyMusic.volume.rampTo(-20, 1);
        if (soundsReady && showdownSting.loaded) showdownSting.start();

        nextBtn.innerHTML = `Reveal Winner!`;
        const aiCommentary = document.getElementById('ceremony-ai-commentary');
        aiCommentary.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> The Quest Master is preparing the final announcement...</p>`;
        const comment = await generateAICommentary(null, 0, ceremonyState.type, finalists1.length + finalists2.length);
        aiCommentary.innerHTML = `<p>${comment}</p>`;
        
        ceremonyState.step++;
    } else {
        if (rank <= 3) {
            revealPodiumEntry(entries, rank);
        } else {
            revealRegularEntry(entries, rank);
        }
        
        if (step === data.length - 1) {
            nextBtn.innerHTML = `<i class="fas fa-check"></i>`;
        }

        const aiCommentary = document.getElementById('ceremony-ai-commentary');
        aiCommentary.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> The Quest Master is checking their notes...</p>`;
        const comment = await generateAICommentary(entries[0], rank, ceremonyState.type);
        aiCommentary.innerHTML = `<p>${comment}</p>`;
    }
}

function revealFinalists(finalist1, finalist2) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.innerHTML = '';

    const createCard = (entry, rank) => {
        const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto">` : (entry.logo ? `<div class="text-6xl mx-auto">${entry.logo}</div>` : `<div class="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-5xl mx-auto">${entry.name.charAt(0)}</div>`);
        
        return `
            <div class="ceremony-card finalist" data-rank="${rank}">
                <p class="text-3xl font-bold text-gray-400">Finalist</p>
                <div class="my-4">${avatarHtml}</div>
                <h3 class="font-title text-3xl truncate">${entry.name}</h3>
                ${entry.className ? `<p class="text-sm text-gray-300">${entry.className}</p>` : ''}
                <p class="font-title text-4xl text-amber-400 mt-2">${entry.score} ⭐</p>
            </div>
        `;
    };

    revealArea.innerHTML = createCard(finalist1, 1) + createCard(finalist2, 2);
}

function revealWinner() {
    if (soundsReady && showdownSting.state === "started") showdownSting.stop();
    if (soundsReady && ceremonyMusic.loaded) ceremonyMusic.volume.rampTo(-12, 0.5);

    const winnerCard = document.querySelector('.ceremony-card[data-rank="1"]');
    const runnerUpCard = document.querySelector('.ceremony-card[data-rank="2"]');
    const revealArea = document.getElementById('ceremony-reveal-area');
    
    if (winnerCard && runnerUpCard) {
        winnerCard.classList.remove('finalist');
        runnerUpCard.classList.remove('finalist');
        winnerCard.classList.add('podium-1');
        runnerUpCard.classList.add('podium-2');
        winnerCard.querySelector('p:first-child').innerText = '#1';
        runnerUpCard.querySelector('p:first-child').innerText = '#2';
        revealArea.classList.add('confetti-active');
        playSound('star3');
        if (soundsReady && winnerFanfare.loaded) winnerFanfare.start();
    }

    if (ceremonyState.type === 'hero') {
        document.getElementById('ceremony-show-global-btn').classList.remove('hidden');
    }
    
    document.getElementById('ceremony-next-btn').innerHTML = `<i class="fas fa-check"></i>`;
}

function revealPodiumEntry(entries, rank) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.classList.remove('confetti-active');

    const entry = entries[0];
    const tieCount = entries.length;

    if (!ceremonyState.isFinalShowdown) {
         revealArea.innerHTML = '';
    }
    
    const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto">` : (entry.logo ? `<div class="text-6xl mx-auto">${entry.logo}</div>` : `<div class="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-5xl mx-auto">${entry.name.charAt(0)}</div>`);
    
    const nameHtml = tieCount > 1 
        ? entries.map(e => `<h3 class="font-title text-2xl truncate">${e.name}</h3>`).join('')
        : `<h3 class="font-title text-3xl truncate">${entry.name}</h3>`;

    const card = document.createElement('div');
    card.className = `ceremony-card podium-${rank}`;
    card.innerHTML = `
        <p class="text-3xl font-bold text-gray-400">#${rank}</p>
        <div class="my-4">${avatarHtml}</div>
        ${nameHtml}
        ${entry.className ? `<p class="text-sm text-gray-300">${entry.className}</p>` : ''}
        <p class="font-title text-4xl text-amber-400 mt-2">${entry.score} ⭐</p>
    `;
    revealArea.appendChild(card);

    if (rank === 1) {
        revealArea.classList.add('confetti-active');
        if (soundsReady && winnerFanfare.loaded) {
            if (ceremonyMusic.state === "started") ceremonyMusic.stop();
            winnerFanfare.start();
        }
    } else if (rank === 2) {
        playSound('star2');
    } else if (rank === 3) {
        playSound('star1');
    }
}

function revealRegularEntry(entries, rank) {
    const revealArea = document.getElementById('ceremony-reveal-area');
    revealArea.innerHTML = ''; // Clear for regular entries
    
    const cardHtml = entries.map(entry => {
        const avatarHtml = entry.avatar ? `<img src="${entry.avatar}" class="w-16 h-16 rounded-full border-2 border-white shadow-md">` : (entry.logo ? `<div class="text-4xl">${entry.logo}</div>` : `<div class="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-3xl">${entry.name.charAt(0)}</div>`);
        return `
            <div class="flex items-center gap-4">
                ${avatarHtml}
                <div>
                    <h3 class="font-title text-2xl truncate">${entry.name}</h3>
                    ${entry.className ? `<p class="text-xs text-gray-300">${entry.className}</p>` : ''}
                </div>
            </div>
        `;
    }).join('<div class="my-2 border-t border-gray-600"></div>');

    const card = document.createElement('div');
    card.className = 'ceremony-card';
    card.innerHTML = `
        <p class="text-2xl font-bold text-gray-400">#${rank}</p>
        <div class="my-4 space-y-2">${cardHtml}</div>
        <p class="font-title text-3xl text-amber-400 mt-2">${entries[0].score} ⭐</p>
    `;
    revealArea.appendChild(card);
    playSound('click');
}


function endCeremony() {
    const { type, league, monthKey, classId } = ceremonyState;

    const ceremonyViewedKey = type === 'hero' 
        ? `ceremonyViewed_hero_${classId}_${monthKey}`
        : `ceremonyViewed_team_${league}_${monthKey}`;
        
    localStorage.setItem(ceremonyViewedKey, 'true');

    document.getElementById('ceremony-screen').classList.add('hidden');
    document.getElementById('ceremony-reveal-area').classList.remove('confetti-active');
    
    document.getElementById('ceremony-show-global-btn').classList.add('hidden');
    
    ceremonyState.isActive = false;

    if (soundsReady) {
        if (ceremonyMusic.state === "started") ceremonyMusic.stop();
        if (winnerFanfare.state === "started") winnerFanfare.stop();
        if (showdownSting.state === "started") showdownSting.stop();
    }
    
    updateCeremonyStatus();
    if (type === 'team') renderClassLeaderboardTab();
    else renderStudentLeaderboardTab();
}

async function generateAICommentary(entry, rank, type) {
    const systemPrompt = `You are the 'Quest Master', a fun and dramatic announcer for a classroom awards ceremony. Provide a single, exciting sentence of commentary for a participant's ranking. Do NOT use markdown.`;
    let userPrompt;

    if (rank === 0) {
        userPrompt = `Generate a one-sentence, highly suspenseful comment announcing that only two finalists remain. Do not mention their names.`;
    } else if (rank > 3) {
        userPrompt = `Generate a one-sentence comment for ${entry.name}, who placed #${rank} with ${entry.score} stars. Keep it positive but brief.`;
    } else if (rank === 3) {
        userPrompt = `Generate a one-sentence comment for ${entry.name} securing the 3rd place (bronze) position with ${entry.score} stars. Make it sound honorable.`;
    } else if (rank === 2) {
        userPrompt = `Generate a one-sentence comment acknowledging the incredible effort of ${entry.name} for achieving the hard-fought 2nd place (silver) position with ${entry.score} stars.`;
    } else {
        const title = type === 'team' ? 'Team Quest Champions' : 'Prodigy of the Month';
        userPrompt = `Generate a one-sentence, highly celebratory championship announcement for ${entry.name}, who has won 1st place with ${entry.score} stars and is now the "${title}"!`;
    }

    try {
        return await callGeminiApi(systemPrompt, userPrompt);
    } catch (error) {
        console.error("AI Commentary Error:", error);
        if (rank === 0) return "And then there were two... Who will be the champion?";
        return `A valiant effort from ${entry.name}, securing the #${rank} position!`;
    }
}

async function fetchLastMonthResults(league, type, monthKey, classId = null) {
    await fetchMonthlyHistory(monthKey);
    const monthlyScores = allMonthlyHistory[monthKey] || {};
    
    if (type === 'team') {
        const classesInLeague = allSchoolClasses.filter(c => c.questLevel === league);
        const GOAL_PER_STUDENT = { DIAMOND: 18 };

        const classScores = classesInLeague.map(c => {
            const studentsInClass = allStudents.filter(s => s.classId === c.id);
            const studentCount = studentsInClass.length;
            const diamondGoal = studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18;
            const score = studentsInClass.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
            const progress = diamondGoal > 0 ? (score / diamondGoal) * 100 : 0;
            
            let completionTimestamp = null;
            if (c.questCompletedAt) {
                const completionDate = c.questCompletedAt.toDate();
                const completionMonthKey = completionDate.toISOString().substring(0, 7);
                if (completionMonthKey === monthKey) {
                    completionTimestamp = c.questCompletedAt.toMillis();
                }
            }
            return { id: c.id, name: c.name, logo: c.logo, score, progress, completedAt: completionTimestamp };
        });

        return classScores.sort((a, b) => {
            if (b.progress !== a.progress) return b.progress - a.progress;
            if (a.completedAt && b.completedAt) return a.completedAt - b.completedAt;
            if (a.completedAt) return -1;
            if (b.completedAt) return 1;
            return b.score - a.score;
        });

    } else {
        let studentsToRank;
        if (classId) {
            studentsToRank = allStudents.filter(s => s.classId === classId);
        } else {
            const classesInLeague = allSchoolClasses.filter(c => c.questLevel === league);
            studentsToRank = allStudents.filter(s => classesInLeague.some(c => c.id === s.classId));
        }
        
        return studentsToRank
            .map(s => {
                const studentClass = allSchoolClasses.find(c => c.id === s.classId);
                return { id: s.id, name: s.name, avatar: s.avatar, score: monthlyScores[s.id] || 0, className: studentClass?.name || '?' };
            })
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.name.localeCompare(b.name);
            });
    }
}

// --- FIX #7: Global Class/League Selection Sync ---
function setGlobalSelectedClass(classId, isManual = false) {
    if (classId === globalSelectedClassId) return;
    globalSelectedClassId = classId;
    if (classId) {
        const selectedClass = allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            globalSelectedLeague = selectedClass.questLevel;
        }
    }
    updateAllClassSelectors(isManual);
    updateAllLeagueSelectors(isManual);
}

function setGlobalSelectedLeague(league, isManual = false) {
    if (league === globalSelectedLeague) return;
    globalSelectedLeague = league;
    updateAllLeagueSelectors(isManual);
}

function updateAllClassSelectors(isManual) {
    isProgrammaticSelection = true;
    const classId = globalSelectedClassId;
    
    // Award Tab Dropdown
    const awardBtn = document.getElementById('award-class-dropdown-btn');
    if (awardBtn) {
        const selectedClass = allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            document.getElementById('selected-class-logo').innerText = selectedClass.logo;
            document.getElementById('selected-class-name').innerText = selectedClass.name;
            document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
            awardBtn.dataset.selectedId = classId;
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                renderAwardStarsStudentList(classId);
            }
        } else { // No class selected
            document.getElementById('selected-class-logo').innerText = '❓';
            document.getElementById('selected-class-name').innerText = 'Select a class...';
            document.getElementById('selected-class-level').innerText = '';
            awardBtn.dataset.selectedId = '';
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                 renderAwardStarsStudentList(null);
            }
        }
    }

    // Other Select elements
    const selectors = ['gemini-class-select', 'oracle-class-select', 'story-weavers-class-select', 'adventure-log-class-select', 'scroll-class-select'];
    selectors.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.value = classId || '';
            if (isManual) {
                // Manually dispatch change event to trigger tab-specific logic
                select.dispatchEvent(new Event('change'));
            }
        }
    });
    isProgrammaticSelection = false;
}

function updateAllLeagueSelectors() {
    isProgrammaticSelection = true;
    const league = globalSelectedLeague;
    const leagueButtons = ['leaderboard-league-picker-btn', 'student-leaderboard-league-picker-btn'];
    leagueButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerText = league || 'Select a League';
        }
    });
    isProgrammaticSelection = false;
}

// --- FIX #6: Avatar Enlargement Feature ---
function handleAvatarClick(e) {
    const avatar = e.target.closest('.enlargeable-avatar');
    
    // If clicking on an already enlarged avatar, do nothing (let the backdrop handle it)
    if (e.target.closest('.enlarged-avatar-container')) {
        return;
    }

    // If there's an existing enlarged avatar, remove it first
    const existingEnlarged = document.querySelector('.enlarged-avatar-container');
    if (existingEnlarged) {
        existingEnlarged.click();
    }

    if (avatar) {
        e.stopPropagation(); // Prevent backdrop from closing immediately
        
        const rect = avatar.getBoundingClientRect();
        const src = avatar.src;

        const container = document.createElement('div');
        container.className = 'enlarged-avatar-container';
        
        const clone = document.createElement('img');
        clone.src = src;
        clone.className = 'enlarged-avatar-image';
        
        // Set initial position and size
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;

        container.appendChild(clone);
        document.body.appendChild(container);

        // Animate to center
        requestAnimationFrame(() => {
            clone.style.top = `50%`;
            clone.style.left = `50%`;
            clone.style.width = `256px`;
            clone.style.height = `256px`;
            clone.style.transform = 'translate(-50%, -50%)';
            container.style.opacity = '1';
        });

        const closeHandler = () => {
            clone.style.top = `${rect.top}px`;
            clone.style.left = `${rect.left}px`;
            clone.style.width = `${rect.width}px`;
            clone.style.height = `${rect.height}px`;
            clone.style.transform = 'translate(0, 0)';
            container.style.opacity = '0';
            
            container.removeEventListener('click', closeHandler);
            setTimeout(() => {
                container.remove();
            }, 300); // Match transition duration
        };

        container.addEventListener('click', closeHandler);
    }
}


// --- INITIALIZATION ---
async function initApp() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        setLogLevel('error');
        // FIX #8: Disable Autocomplete on all inputs
        document.querySelectorAll('input').forEach(input => input.setAttribute('autocomplete', 'off'));
        setupAuthListeners();
        setupUIListeners();
        updateDateTime();
        setInterval(updateDateTime, 30000);
        await setupSounds();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        document.getElementById('loading-screen').innerHTML = `<div class="font-title text-3xl text-red-700">Error: Could not start app</div><p class="text-red-600 mt-4">${error.message}</p>`;
    }
}

initApp();


