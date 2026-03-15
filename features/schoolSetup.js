import * as state from '../state.js';
import { db, doc, setDoc, collection, writeBatch, serverTimestamp } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import { classLogos, DEFAULT_SCHOOL_NAME, questLeagues } from '../constants.js';
import * as utils from '../utils.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature, getLimit } from '../utils/subscription.js';
import { markTeacherOnboardingComplete } from './teacherJourney.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const SCORE_DEFAULTS = {
    totalStars: 0,
    monthlyStars: 0,
    gold: 0,
    inventory: [],
    starsByReason: {},
    heroLevel: 0,
    heroSkills: [],
    pendingSkillChoice: false
};

let listenersAttached = false;
let locationSearchResults = [];
let selectedSchoolWeatherLocation = null;
let setupDraftClasses = [];
let setupContext = {
    isFirstTeacher: false,
    shouldCollectSchoolName: false,
    onComplete: null,
    user: null
};

function formatLocationLabel(location) {
    if (!location) return '';
    const parts = [location.name, location.admin1 || location.country].filter(Boolean);
    return parts.join(', ');
}

function sanitizeLocationCandidate(raw) {
    if (!raw) return null;
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const name = (raw.name || '').trim();
    if (!name) return null;
    return {
        name,
        admin1: raw.admin1 || '',
        country: raw.country || '',
        countryCode: raw.country_code || raw.countryCode || '',
        timezone: raw.timezone || 'auto',
        latitude,
        longitude
    };
}

function setSetupLocationStatus(location) {
    const statusEl = document.getElementById('setup-location-status');
    if (!statusEl) return;

    if (location) {
        const label = formatLocationLabel(location);
        statusEl.textContent = `Selected: ${label} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        statusEl.className = 'text-xs text-emerald-700 mt-2';
    } else {
        statusEl.textContent = 'No location selected yet. Weather will use the default Athens area until you choose one.';
        statusEl.className = 'text-xs text-slate-500 mt-2';
    }
}

function prefillSetupLocationFromState() {
    const locationInput = document.getElementById('setup-school-location-search');
    const stored = utils.normalizeWeatherLocation(state.get('schoolWeatherLocation'));
    selectedSchoolWeatherLocation = stored;

    if (locationInput && stored) {
        locationInput.value = formatLocationLabel(stored);
    }

    const resultsSelect = document.getElementById('setup-location-results');
    if (resultsSelect) {
        resultsSelect.classList.add('hidden');
        resultsSelect.innerHTML = '';
    }
    locationSearchResults = [];
    setSetupLocationStatus(stored);
}

function populateSetupSelectors() {
    const levelSelect = document.getElementById('setup-class-level');
    const logoSelect = document.getElementById('setup-class-logo');

    if (levelSelect && !levelSelect.dataset.ready) {
        levelSelect.innerHTML = questLeagues
            .map((league) => `<option value="${league}">${league}</option>`)
            .join('');
        levelSelect.dataset.ready = 'true';
    }

    if (logoSelect && !logoSelect.dataset.ready) {
        logoSelect.innerHTML = classLogos
            .map((logo) => `<option value="${logo}">${logo} ${logo}</option>`)
            .join('');
        logoSelect.value = '📚';
        logoSelect.dataset.ready = 'true';
    }
}

function getSetupMaxClasses() {
    const liveLimit = getLimit('maxClasses');
    if (liveLimit === 0) return 6;
    return liveLimit;
}

function parseStudentNames(raw) {
    const seen = new Set();
    return raw
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => {
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function resetClassDraftForm() {
    const nameInput = document.getElementById('setup-class-name');
    const studentsInput = document.getElementById('setup-class-students');
    const levelSelect = document.getElementById('setup-class-level');
    const logoSelect = document.getElementById('setup-class-logo');
    const suggestions = document.getElementById('setup-class-name-suggestions');

    if (nameInput) nameInput.value = '';
    if (studentsInput) studentsInput.value = '';
    if (levelSelect) levelSelect.value = questLeagues[0];
    if (logoSelect) logoSelect.value = '📚';
    if (suggestions) suggestions.innerHTML = '';
}

function renderSetupCopy() {
    const title = document.getElementById('setup-title');
    const subtitle = document.getElementById('setup-subtitle');
    const schoolSection = document.getElementById('setup-school-section');
    const schoolCopy = document.getElementById('setup-school-copy');
    const enterCopy = document.getElementById('setup-enter-copy');
    const schoolInput = document.getElementById('setup-school-name');
    const aiNote = document.getElementById('setup-ai-note');

    if (title) {
        title.textContent = setupContext.isFirstTeacher
            ? 'Build your school’s first adventure'
            : 'Set up your own teacher adventure';
    }
    if (subtitle) {
        subtitle.textContent = setupContext.isFirstTeacher
            ? 'You are the first teacher here, so GCQ needs the school name, your first classes, and the students in them.'
            : 'Welcome to this school. Add your own classes and students before you enter the app.';
    }
    if (schoolSection) {
        schoolSection.classList.toggle('hidden', !setupContext.shouldCollectSchoolName);
    }
    if (schoolCopy) {
        schoolCopy.textContent = setupContext.isFirstTeacher
            ? 'You are the founding teacher for this school, so choose the school name now.'
            : 'This school already exists. You can still adjust the live-weather location if needed.';
    }
    if (schoolInput) {
        schoolInput.value = state.get('schoolName') || '';
    }
    if (enterCopy) {
        enterCopy.textContent = setupContext.isFirstTeacher
            ? 'GCQ will save the school details, create your first classes, add the students, and open the app.'
            : 'GCQ will create your classes, add the students, and open the app for you.';
    }
    if (aiNote) {
        aiNote.innerHTML = canUseFeature('eliteAI')
            ? '<strong class="text-amber-800">Elite unlocked:</strong> AI class-name suggestions are ready for you.'
            : '<strong class="text-amber-800">Elite only:</strong> AI class-name suggestions wake up automatically on the Elite plan.';
    }
}

function renderSetupDraftClassesList() {
    const list = document.getElementById('setup-draft-classes-list');
    const count = document.getElementById('setup-draft-count');
    if (count) count.textContent = String(setupDraftClasses.length);
    if (!list) return;

    if (setupDraftClasses.length === 0) {
        list.innerHTML = `
            <div class="rounded-3xl border border-dashed border-white/20 bg-white/5 px-4 py-5 text-sm text-slate-300 text-center">
                No classes added yet. Create your first class on the left.
            </div>
        `;
        return;
    }

    list.innerHTML = setupDraftClasses.map((draft, index) => `
        <article class="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 shadow-lg">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-300 mb-1">${draft.questLevel}</p>
                    <h4 class="font-title text-2xl text-white">${draft.logo} ${draft.name}</h4>
                    <p class="text-sm text-slate-300 mt-2">${draft.students.length} ${draft.students.length === 1 ? 'student' : 'students'}</p>
                </div>
                <button type="button" class="setup-remove-draft-btn w-10 h-10 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-300/20 text-rose-100" data-index="${index}" title="Remove class">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                ${draft.students.length > 0
                    ? draft.students.map((student) => `<span class="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white">${student}</span>`).join('')
                    : '<span class="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-300">No students yet</span>'
                }
            </div>
        </article>
    `).join('');
}

function setInviteLink() {
    const input = document.getElementById('setup-invite-link');
    if (input) input.value = window.location.href.split('?')[0];
}

function setSetupButtonLoading(buttonId, isLoading, idleHtml, loadingHtml) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = isLoading ? loadingHtml : idleHtml;
}

async function searchSetupLocations(queryText) {
    const query = queryText.trim();
    if (!query) {
        showToast('Type a city or area first.', 'info');
        return;
    }

    const resultsSelect = document.getElementById('setup-location-results');
    const statusEl = document.getElementById('setup-location-status');
    setSetupButtonLoading(
        'setup-search-location-btn',
        true,
        '<i class="fas fa-search mr-2"></i>Search',
        '<i class="fas fa-spinner fa-spin mr-2"></i>Searching'
    );
    if (statusEl) {
        statusEl.textContent = 'Searching locations...';
        statusEl.className = 'text-xs text-sky-700 mt-2';
    }

    try {
        const encoded = encodeURIComponent(query);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=8&language=el&format=json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Location API request failed');

        const payload = await response.json();
        const matches = (payload.results || [])
            .map(sanitizeLocationCandidate)
            .filter((item) => item && (item.countryCode === 'GR' || item.country === 'Greece'));

        locationSearchResults = matches;

        if (!resultsSelect) return;

        if (matches.length === 0) {
            resultsSelect.classList.add('hidden');
            resultsSelect.innerHTML = '';
            setSetupLocationStatus(selectedSchoolWeatherLocation);
            showToast('No Greek locations found. Try a nearby city name.', 'info');
            return;
        }

        resultsSelect.innerHTML = matches.map((loc, index) => {
            const label = formatLocationLabel(loc);
            return `<option value="${index}">${label} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})</option>`;
        }).join('');
        resultsSelect.classList.remove('hidden');
        resultsSelect.selectedIndex = 0;

        selectedSchoolWeatherLocation = matches[0];
        setSetupLocationStatus(selectedSchoolWeatherLocation);
        showToast('Location found. Keep the correct one.', 'success');
    } catch (e) {
        console.error('Location search failed:', e);
        setSetupLocationStatus(selectedSchoolWeatherLocation);
        showToast('Could not search locations right now.', 'error');
    } finally {
        setSetupButtonLoading(
            'setup-search-location-btn',
            false,
            '<i class="fas fa-search mr-2"></i>Search',
            '<i class="fas fa-spinner fa-spin mr-2"></i>Searching'
        );
    }
}

async function handleGenerateSetupClassName() {
    if (!canUseFeature('eliteAI')) {
        showToast('AI class-name suggestions are available on Elite only.', 'info');
        return;
    }

    const level = document.getElementById('setup-class-level')?.value;
    const output = document.getElementById('setup-class-name-suggestions');
    if (!level || !output) return;

    setSetupButtonLoading(
        'setup-generate-class-name-btn',
        true,
        '<i class="fas fa-wand-magic-sparkles"></i><span>Suggest with AI</span>',
        '<i class="fas fa-spinner fa-spin"></i><span>Thinking...</span>'
    );

    const ageGroup = utils.getAgeGroupForLeague(level);
    const systemPrompt = `You are a creative assistant helping an English teacher name a class team. Generate 3 short, catchy, fantasy or adventure themed class names suitable for children aged ${ageGroup}. Include a fitting emoji at the start of each name. Return only the names separated by commas.`;
    const userPrompt = `Generate class names for a class in the "${level}" league.`;

    try {
        const result = await callGeminiApi(systemPrompt, userPrompt);
        const names = result.split(',').map((name) => name.trim()).filter(Boolean);

        output.innerHTML = names.map((name) => `
            <button type="button" class="setup-suggestion-btn bg-indigo-100 text-indigo-700 px-3 py-2 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm">
                ${name}
            </button>
        `).join('');
    } catch (error) {
        console.error(error);
        showToast('The naming spell failed. Try again!', 'error');
    } finally {
        setSetupButtonLoading(
            'setup-generate-class-name-btn',
            false,
            '<i class="fas fa-wand-magic-sparkles"></i><span>Suggest with AI</span>',
            '<i class="fas fa-spinner fa-spin"></i><span>Thinking...</span>'
        );
    }
}

function handleAddDraftClass() {
    const nameInput = document.getElementById('setup-class-name');
    const levelSelect = document.getElementById('setup-class-level');
    const logoSelect = document.getElementById('setup-class-logo');
    const studentsInput = document.getElementById('setup-class-students');

    const name = nameInput?.value?.trim();
    const questLevel = levelSelect?.value || questLeagues[0];
    const logo = logoSelect?.value || '📚';
    const students = parseStudentNames(studentsInput?.value || '');

    if (!name) {
        showToast('Enter a class name.', 'error');
        return;
    }

    const maxClasses = getSetupMaxClasses();
    const totalIfAdded = (state.get('allSchoolClasses') || []).length + setupDraftClasses.length + 1;
    if (maxClasses !== null && totalIfAdded > maxClasses) {
        showToast(`This school can have up to ${maxClasses} classes on the current access level.`, 'info');
        return;
    }

    setupDraftClasses.push({ name, questLevel, logo, students });
    renderSetupDraftClassesList();
    resetClassDraftForm();
    document.getElementById('setup-enter-hint')?.classList.add('hidden');
    showToast('Class added to your setup bundle!', 'success');
}

async function persistSetupBundle() {
    const rawName = document.getElementById('setup-school-name')?.value?.trim();
    const normalizedLocation = utils.normalizeWeatherLocation(selectedSchoolWeatherLocation);
    const currentUserId = state.get('currentUserId');
    const currentTeacherName = state.get('currentTeacherName');

    if (!currentUserId || !currentTeacherName) {
        throw new Error('Teacher session is missing. Please sign in again.');
    }

    const batch = writeBatch(db);
    const settingsRef = doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays');
    const settingsPayload = {};

    if (setupContext.shouldCollectSchoolName && rawName) {
        settingsPayload.schoolName = rawName;
    }
    if (normalizedLocation) {
        settingsPayload.weatherLocation = normalizedLocation;
    }
    if (Object.keys(settingsPayload).length > 0) {
        batch.set(settingsRef, settingsPayload, { merge: true });
    }

    const createdBy = { uid: currentUserId, name: currentTeacherName };
    const monthStart = utils.getStartOfMonthString();

    setupDraftClasses.forEach((draft) => {
        const classRef = doc(collection(db, `${PUBLIC_DATA_PATH}/classes`));
        batch.set(classRef, {
            name: draft.name,
            questLevel: draft.questLevel,
            logo: draft.logo,
            scheduleDays: [],
            timeStart: '',
            timeEnd: '',
            createdBy,
            createdAt: serverTimestamp()
        });

        draft.students.forEach((studentName) => {
            const studentRef = doc(collection(db, `${PUBLIC_DATA_PATH}/students`));
            batch.set(studentRef, {
                name: studentName,
                classId: classRef.id,
                createdBy,
                createdAt: serverTimestamp()
            });
            batch.set(doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentRef.id), {
                ...SCORE_DEFAULTS,
                lastMonthlyResetDate: monthStart,
                createdBy
            });
        });
    });

    await batch.commit();
}

export function showSetupScreen(options = {}) {
    setupContext = {
        isFirstTeacher: Boolean(options.isFirstTeacher),
        shouldCollectSchoolName: Boolean(options.shouldCollectSchoolName),
        onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
        user: options.user || null
    };
    setupDraftClasses = [];

    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    const subscribeEl = document.getElementById('subscribe-screen');
    if (setupEl) setupEl.classList.remove('hidden');
    if (appEl) appEl.classList.add('hidden');
    if (subscribeEl) subscribeEl.classList.add('hidden');

    populateSetupSelectors();
    renderSetupCopy();
    renderSetupDraftClassesList();
    prefillSetupLocationFromState();
    setInviteLink();
    resetClassDraftForm();
    setupSetupListeners();
}

export function hideSetupScreen() {
    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    if (setupEl) setupEl.classList.add('hidden');
    if (appEl) appEl.classList.remove('hidden');
}

export async function finishSetupAndEnterApp() {
    if (setupDraftClasses.length === 0) {
        showToast('Add at least one class before entering the app.', 'error');
        document.getElementById('setup-enter-hint')?.classList.remove('hidden');
        return;
    }

    setSetupButtonLoading(
        'setup-enter-quest-btn',
        true,
        '<i class="fas fa-dragon"></i><span>Save Everything & Enter the Quest</span>',
        '<i class="fas fa-spinner fa-spin"></i><span>Saving your school...</span>'
    );

    try {
        await persistSetupBundle();
        if (setupContext.user) {
            await markTeacherOnboardingComplete(setupContext.user, {
                createdClassesInSetup: setupDraftClasses.length
            });
        }
        setupDraftClasses = [];
        renderSetupDraftClassesList();
        hideSetupScreen();
        if (setupContext.onComplete) {
            await setupContext.onComplete();
        }
    } catch (e) {
        console.error('Failed to finish setup:', e);
        showToast(e?.message || 'Could not finish setup right now.', 'error');
    } finally {
        setSetupButtonLoading(
            'setup-enter-quest-btn',
            false,
            '<i class="fas fa-dragon"></i><span>Save Everything & Enter the Quest</span>',
            '<i class="fas fa-spinner fa-spin"></i><span>Saving your school...</span>'
        );
    }
}

function setupSetupListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.getElementById('setup-add-class-btn')?.addEventListener('click', handleAddDraftClass);
    document.getElementById('setup-clear-class-form-btn')?.addEventListener('click', resetClassDraftForm);
    document.getElementById('setup-generate-class-name-btn')?.addEventListener('click', handleGenerateSetupClassName);
    document.getElementById('setup-class-name-suggestions')?.addEventListener('click', (event) => {
        if (!event.target.classList.contains('setup-suggestion-btn')) return;
        const classNameInput = document.getElementById('setup-class-name');
        if (classNameInput) classNameInput.value = event.target.textContent.trim();
        document.getElementById('setup-class-name-suggestions').innerHTML = '';
    });

    document.getElementById('setup-draft-classes-list')?.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.setup-remove-draft-btn');
        if (!removeBtn) return;
        const index = Number(removeBtn.dataset.index);
        if (!Number.isInteger(index) || !setupDraftClasses[index]) return;
        setupDraftClasses.splice(index, 1);
        renderSetupDraftClassesList();
        showToast('Class removed from setup bundle.', 'info');
    });

    document.getElementById('setup-copy-link-btn')?.addEventListener('click', () => {
        const input = document.getElementById('setup-invite-link');
        if (!input) return;
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value)
            .then(() => showToast('Link copied to clipboard!', 'success'))
            .catch(() => showToast('Copy the link manually from the box.', 'info'));
    });

    document.getElementById('setup-enter-quest-btn')?.addEventListener('click', async () => {
        await finishSetupAndEnterApp();
    });

    document.getElementById('setup-search-location-btn')?.addEventListener('click', async () => {
        const locationInput = document.getElementById('setup-school-location-search');
        await searchSetupLocations(locationInput?.value || '');
    });

    document.getElementById('setup-school-location-search')?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await searchSetupLocations(event.currentTarget?.value || '');
    });

    document.getElementById('setup-location-results')?.addEventListener('change', (event) => {
        const idx = Number(event.target.value);
        const selected = Number.isInteger(idx) ? locationSearchResults[idx] : null;
        selectedSchoolWeatherLocation = selected || selectedSchoolWeatherLocation;

        const locationInput = document.getElementById('setup-school-location-search');
        if (locationInput && selectedSchoolWeatherLocation) {
            locationInput.value = formatLocationLabel(selectedSchoolWeatherLocation);
        }
        setSetupLocationStatus(selectedSchoolWeatherLocation);
    });
}

export function refreshSetupClassesList() {
    if (document.getElementById('setup-screen')?.classList.contains('hidden')) return;
    renderSetupDraftClassesList();
}
