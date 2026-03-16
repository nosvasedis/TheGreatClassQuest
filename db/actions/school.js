import { db } from '../../firebase.js';
import { doc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { DEFAULT_SCHOOL_NAME } from '../../constants.js';
import * as utils from '../../utils.js';
import { canUseFeature } from '../../utils/subscription.js';
import {
    getSchoolAssessmentDefaults,
    normalizeAssessmentDefaultsByLeague,
    normalizeClassAssessmentConfig
} from '../../features/assessmentConfig.js';
import {
    getAssessmentConfigCardHtml,
    getAssessmentDefaultsEditorHtml,
    readAssessmentCardValue,
    readAssessmentDefaultsFromContainer,
    wireAssessmentEditor
} from '../../ui/assessmentEditor.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
let optionsLocationSearchResults = [];

function normalizeGeocodingResult(raw) {
    if (!raw) return null;
    return utils.normalizeWeatherLocation({
        name: raw.name,
        admin1: raw.admin1,
        country: raw.country,
        countryCode: raw.countryCode || raw.country_code,
        timezone: raw.timezone,
        latitude: raw.latitude,
        longitude: raw.longitude
    });
}

function formatLocationLabel(location) {
    if (!location) return '';
    return [location.name, location.admin1 || location.country].filter(Boolean).join(', ');
}

function setOptionsLocationStatus(location, message = null) {
    const status = document.getElementById('options-school-location-status');
    if (!status) return;
    if (message) {
        status.textContent = message;
        status.className = 'text-xs text-gray-500';
        return;
    }
    if (!location) {
        status.textContent = 'No weather location selected. Default Athens area is used.';
        status.className = 'text-xs text-gray-500';
        return;
    }
    status.textContent = `Selected: ${formatLocationLabel(location)} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
    status.className = 'text-xs text-emerald-700';
}

function getSelectedOptionsLocation() {
    const select = document.getElementById('options-school-location-results');
    if (select && !select.classList.contains('hidden')) {
        const idx = Number(select.value);
        if (Number.isInteger(idx) && optionsLocationSearchResults[idx]) {
            return utils.normalizeWeatherLocation(optionsLocationSearchResults[idx]);
        }
    }
    return utils.normalizeWeatherLocation(state.get('schoolWeatherLocation'));
}

export function initializeSchoolLocationOptionsUi() {
    const locationInput = document.getElementById('options-school-location-search');
    const results = document.getElementById('options-school-location-results');
    const current = utils.normalizeWeatherLocation(state.get('schoolWeatherLocation'));

    if (locationInput) {
        locationInput.value = current ? formatLocationLabel(current) : '';
    }
    if (results) {
        results.classList.add('hidden');
        results.innerHTML = '';
    }
    optionsLocationSearchResults = [];
    setOptionsLocationStatus(current);
}

export function renderAssessmentOptionsUi() {
    if (!canUseFeature('scholarScroll')) return;
    const defaultsContainer = document.getElementById('options-assessment-defaults-editor');
    const classesContainer = document.getElementById('options-class-assessment-editor');
    if (!defaultsContainer || !classesContainer) return;

    const schoolDefaults = getSchoolAssessmentDefaults();
    defaultsContainer.innerHTML = getAssessmentDefaultsEditorHtml(schoolDefaults);

    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const classes = (state.get('allTeachersClasses') || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const hiddenClassCount = Math.max(0, allSchoolClasses.length - classes.length);
    if (classes.length === 0) {
        classesContainer.innerHTML = `<div class="rounded-2xl border border-dashed border-indigo-200 bg-white px-4 py-5 text-center text-sm text-slate-500">Create a class first to manage per-class overrides.</div>`;
    } else {
        classesContainer.innerHTML = `
            ${hiddenClassCount > 0 ? `<div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">School defaults apply to every class. Per-class overrides can only be edited for the ${classes.length === 1 ? 'class' : 'classes'} you own.</div>` : ''}
            ${classes.map((classData) => getAssessmentConfigCardHtml(
            classData.assessmentConfig || normalizeClassAssessmentConfig(null, classData.questLevel),
            `options-class-${classData.id}`,
            {
                allowInherit: true,
                questLevel: classData.questLevel,
                title: `${classData.logo || '📚'} ${classData.name}`,
                description: `${classData.questLevel || 'League'} class`
            }
        )).join('')}
        `;
    }

    wireAssessmentEditor(defaultsContainer);
    wireAssessmentEditor(classesContainer);
}

export async function handleSaveAssessmentSettingsFromOptions() {
    if (!canUseFeature('scholarScroll')) {
        showToast("Assessment settings are available on Pro and Elite.", 'info');
        return;
    }
    const defaultsContainer = document.getElementById('options-assessment-defaults-editor');
    const classesContainer = document.getElementById('options-class-assessment-editor');
    if (!defaultsContainer || !classesContainer) return;

    const saveBtn = document.getElementById('save-assessment-settings-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    }

    try {
        const schoolDefaults = normalizeAssessmentDefaultsByLeague(readAssessmentDefaultsFromContainer(defaultsContainer));
        const batch = writeBatch(db);
        const settingsRef = doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays');
        batch.set(settingsRef, { assessmentDefaultsByLeague: schoolDefaults }, { merge: true });
        const updatedSchoolClasses = (state.get('allSchoolClasses') || []).map((classData) => ({ ...classData }));

        classesContainer.querySelectorAll('[data-assessment-card]').forEach((card) => {
            const classId = (card.dataset.cardKey || '').replace('options-class-', '');
            if (!classId) return;
            const classData = updatedSchoolClasses.find((item) => item.id === classId);
            if (!classData) return;
            const assessmentConfig = normalizeClassAssessmentConfig(
                readAssessmentCardValue(card, { allowInherit: true }),
                classData.questLevel
            );
            classData.assessmentConfig = assessmentConfig;
            batch.set(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), { assessmentConfig }, { merge: true });
        });

        await batch.commit();
        state.setSchoolAssessmentDefaults(schoolDefaults);
        state.setAllSchoolClasses(updatedSchoolClasses);
        state.setAllTeachersClasses(updatedSchoolClasses.filter((classData) => classData.createdBy?.uid === state.get('currentUserId')));
        showToast('Assessment settings updated!', 'success');
    } catch (error) {
        console.error('Error saving assessment settings:', error);
        showToast('Could not save assessment settings. Please try again.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Assessment Settings';
        }
    }
}

export async function handleSaveSchoolNameFromOptions() {
    const input = document.getElementById('options-school-name-input');
    if (!input) return;

    const newName = input.value.trim();
    const current = state.get('schoolName') || DEFAULT_SCHOOL_NAME;

    if (!newName) {
        showToast('School name cannot be empty.', 'error');
        return;
    }
    if (newName === current) {
        showToast('School name is already set to this.', 'info');
        return;
    }

    const btn = document.getElementById('save-school-name-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class=\"fas fa-spinner fa-spin mr-2\"></i> Saving...';
    }

    const settingsRef = doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays');

    try {
        await setDoc(settingsRef, { schoolName: newName }, { merge: true });
        state.setSchoolName(newName);
        showToast('School name updated!', 'success');
    } catch (e) {
        console.error('Error saving school name from options:', e);
        showToast('Could not save school name. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class=\"fas fa-save mr-2\"></i> Save School Name';
        }
    }
}

export async function handleSearchSchoolLocationFromOptions() {
    const input = document.getElementById('options-school-location-search');
    const query = input?.value?.trim() || '';
    if (!query) {
        showToast('Type a city or area first.', 'info');
        return;
    }

    const button = document.getElementById('search-school-location-btn');
    const select = document.getElementById('options-school-location-results');

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Searching...';
    }
    setOptionsLocationStatus(null, 'Searching locations...');

    try {
        const encoded = encodeURIComponent(query);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=8&language=el&format=json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Location API request failed');

        const payload = await response.json();
        const matches = (payload.results || [])
            .map(normalizeGeocodingResult)
            .filter((item) => item && (item.countryCode === 'GR' || item.country === 'Greece'));

        optionsLocationSearchResults = matches;

        if (!select) return;
        if (matches.length === 0) {
            select.classList.add('hidden');
            select.innerHTML = '';
            setOptionsLocationStatus(utils.normalizeWeatherLocation(state.get('schoolWeatherLocation')));
            showToast('No Greek locations found. Try a nearby city name.', 'info');
            return;
        }

        select.innerHTML = matches.map((loc, index) => {
            const label = formatLocationLabel(loc);
            return `<option value="${index}">${label} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})</option>`;
        }).join('');
        select.classList.remove('hidden');
        select.selectedIndex = 0;

        if (input) {
            input.value = formatLocationLabel(matches[0]);
        }
        setOptionsLocationStatus(matches[0]);
        showToast('Location found. Save to apply school weather.', 'success');
    } catch (e) {
        console.error('Error searching school location:', e);
        setOptionsLocationStatus(utils.normalizeWeatherLocation(state.get('schoolWeatherLocation')));
        showToast('Could not search locations right now.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-search mr-2"></i> Search';
        }
    }
}

export function handleSchoolLocationResultChange() {
    const select = document.getElementById('options-school-location-results');
    const input = document.getElementById('options-school-location-search');
    if (!select) return;

    const idx = Number(select.value);
    const selected = Number.isInteger(idx) ? optionsLocationSearchResults[idx] : null;
    if (!selected) return;

    if (input) {
        input.value = formatLocationLabel(selected);
    }
    setOptionsLocationStatus(selected);
}

export async function handleSaveSchoolLocationFromOptions() {
    const selected = getSelectedOptionsLocation();
    if (!selected) {
        showToast('Choose a location first.', 'error');
        return;
    }

    const current = utils.normalizeWeatherLocation(state.get('schoolWeatherLocation'));
    if (
        current &&
        current.latitude === selected.latitude &&
        current.longitude === selected.longitude &&
        current.name === selected.name
    ) {
        showToast('School location is already set to this.', 'info');
        return;
    }

    const btn = document.getElementById('save-school-location-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    }

    const settingsRef = doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays');
    try {
        await setDoc(settingsRef, { weatherLocation: selected }, { merge: true });
        state.setSchoolWeatherLocation(selected);
        utils.setWeatherCoordinates(selected);
        utils.fetchSolarCycle();
        setOptionsLocationStatus(selected);
        showToast('School weather location updated!', 'success');
    } catch (e) {
        console.error('Error saving school location from options:', e);
        showToast('Could not save school location. Please try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-map-marker-alt mr-2"></i> Save School Location';
        }
    }
}
