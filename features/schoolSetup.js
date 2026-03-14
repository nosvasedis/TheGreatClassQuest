// features/schoolSetup.js
// First-user new-school setup: show when no classes exist; add classes + invite link; enter app.

import * as state from '../state.js';
import { createClass } from '../db/actions/classes.js';
import { showToast } from '../ui/effects.js';
import { db } from '../firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as utils from '../utils.js';

let listenersAttached = false;
let locationSearchResults = [];
let selectedSchoolWeatherLocation = null;

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
        statusEl.textContent = 'No location selected yet. Weather will use default Athens area until you choose one.';
        statusEl.className = 'text-xs text-gray-500 mt-2';
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

async function searchSetupLocations(queryText) {
    const query = queryText.trim();
    if (!query) {
        showToast('Type a city or area first.', 'info');
        return;
    }

    const resultsSelect = document.getElementById('setup-location-results');
    const statusEl = document.getElementById('setup-location-status');
    const searchBtn = document.getElementById('setup-search-location-btn');

    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Searching';
    }
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
        showToast('Location found. Review and keep the correct one.', 'success');
    } catch (e) {
        console.error('Location search failed:', e);
        setSetupLocationStatus(selectedSchoolWeatherLocation);
        showToast('Could not search locations right now.', 'error');
    } finally {
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fas fa-search mr-1"></i> Search';
        }
    }
}

/**
 * Should we show the setup screen? Yes when the school has no classes yet.
 */
export function isSetupNeeded() {
    const classes = state.get('allSchoolClasses') || [];
    return classes.length === 0;
}

/**
 * Show setup screen, hide main app.
 */
export function showSetupScreen() {
    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    if (setupEl) setupEl.classList.remove('hidden');
    if (appEl) appEl.classList.add('hidden');
    renderSetupClassesList();
    prefillSetupLocationFromState();
    setInviteLink();
    setupSetupListeners();
}

/**
 * Hide setup screen, show main app. Call when user clicks "Enter the Quest".
 */
export function hideSetupScreen() {
    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    if (setupEl) setupEl.classList.add('hidden');
    if (appEl) appEl.classList.remove('hidden');
}

/**
 * User finished setup: hide setup, show app, and switch to a default tab (e.g. My Classes).
 */
export async function finishSetupAndEnterApp() {
    const classes = state.get('allSchoolClasses') || [];
    if (classes.length === 0) {
        showToast('Add at least one class, then click Enter the Quest.', 'error');
        const hint = document.getElementById('setup-enter-hint');
        if (hint) hint.classList.remove('hidden');
        return;
    }

    const nameInput = document.getElementById('setup-school-name');
    const rawName = nameInput?.value?.trim();
    const normalizedLocation = utils.normalizeWeatherLocation(selectedSchoolWeatherLocation);

    if (rawName || normalizedLocation) {
        const publicDataPath = "artifacts/great-class-quest/public/data";
        const settingsRef = doc(db, `${publicDataPath}/school_settings`, 'holidays');
        const payload = {};
        if (rawName) payload.schoolName = rawName;
        if (normalizedLocation) payload.weatherLocation = normalizedLocation;

        try {
            await setDoc(settingsRef, payload, { merge: true });
            if (normalizedLocation) {
                state.setSchoolWeatherLocation(normalizedLocation);
                utils.setWeatherCoordinates(normalizedLocation);
                utils.fetchSolarCycle();
            }
        } catch (e) {
            console.error('Failed to save school setup details:', e);
        }
    }
    hideSetupScreen();
    import('../ui/tabs.js').then(tabs => tabs.showTab('my-classes-tab'));
}

function renderSetupClassesList() {
    const list = document.getElementById('setup-classes-list');
    if (!list) return;
    const classes = state.get('allSchoolClasses') || [];
    if (classes.length === 0) {
        list.innerHTML = '<li class="text-gray-400">No classes yet. Add one above.</li>';
    } else {
        list.innerHTML = classes.map(c => `<li><span class="font-medium">${c.logo || '📚'} ${c.name}</span> (${c.questLevel})</li>`).join('');
    }
}

function setInviteLink() {
    const input = document.getElementById('setup-invite-link');
    if (input) input.value = window.location.href.split('?')[0];
}

function setupSetupListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.getElementById('setup-add-class-btn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('setup-class-name');
        const levelSelect = document.getElementById('setup-class-level');
        const name = nameInput?.value?.trim();
        const level = levelSelect?.value;
        if (!name) {
            showToast('Enter a class name.', 'error');
            return;
        }
        try {
            await createClass({ name, questLevel: level || 'A' });
            nameInput.value = '';
            renderSetupClassesList();
            document.getElementById('setup-enter-hint')?.classList.add('hidden');
        } catch (e) {
            showToast(e?.message || 'Could not add class', 'error');
        }
    });

    document.getElementById('setup-copy-link-btn')?.addEventListener('click', () => {
        const input = document.getElementById('setup-invite-link');
        if (!input) return;
        input.select();
        input.setSelectionRange(0, 99999);
        try {
            navigator.clipboard.writeText(input.value);
            showToast('Link copied to clipboard!', 'success');
        } catch {
            showToast('Copy the link manually from the box.', 'info');
        }
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
        const locationInput = event.currentTarget;
        await searchSetupLocations(locationInput?.value || '');
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

/**
 * Call this when classes list might have changed (e.g. from real-time listener) so the setup UI updates.
 */
export function refreshSetupClassesList() {
    if (document.getElementById('setup-screen')?.classList.contains('hidden')) return;
    renderSetupClassesList();
}
