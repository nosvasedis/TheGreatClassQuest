import {
    normalizeAssessmentConfig,
    normalizeClassAssessmentConfig,
    normalizeAssessmentDefaultsByLeague,
    QUALITATIVE_SCALE_FALLBACK
} from '../features/assessmentConfig.js';
import { questLeagues } from '../constants.js';

function getScaleRowsHtml(prefix, scale = []) {
    return (scale.length > 0 ? scale : QUALITATIVE_SCALE_FALLBACK).map((entry, index) => `
        <div class="assessment-scale-row grid grid-cols-[1.4fr_0.8fr_auto] gap-2 items-center" data-scale-row>
            <input type="text" class="assessment-scale-label w-full px-3 py-2 border border-slate-200 rounded-xl bg-white" value="${entry.label || ''}" placeholder="Label">
            <input type="number" class="assessment-scale-percent w-full px-3 py-2 border border-slate-200 rounded-xl bg-white" value="${entry.normalizedPercent ?? 0}" min="0" max="100" step="1" placeholder="%">
            <button type="button" class="assessment-remove-scale-btn px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50" title="Remove grade">
                <i class="fas fa-minus"></i>
            </button>
        </div>
    `).join('');
}

function getSchemeEditorHtml(prefix, title, scheme) {
    return `
        <div class="assessment-scheme-editor rounded-2xl border border-slate-200 bg-white/80 p-4" data-scheme-editor data-prefix="${prefix}">
            <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400 font-black">${title}</p>
                    <p class="text-xs text-slate-500 mt-1">Choose numeric or word-based grading for this assessment type.</p>
                </div>
                <select class="assessment-mode-select px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold">
                    <option value="numeric" ${scheme.mode === 'numeric' ? 'selected' : ''}>Numeric scale</option>
                    <option value="qualitative" ${scheme.mode === 'qualitative' ? 'selected' : ''}>Word scale</option>
                </select>
            </div>
            <div class="assessment-numeric-panel ${scheme.mode === 'numeric' ? '' : 'hidden'}" data-mode-panel="numeric">
                <label class="block text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Maximum score</label>
                <input type="number" class="assessment-max-score w-full px-3 py-2 border border-slate-200 rounded-xl bg-white" min="1" step="1" value="${scheme.maxScore || 100}">
            </div>
            <div class="assessment-qualitative-panel ${scheme.mode === 'qualitative' ? '' : 'hidden'} space-y-3" data-mode-panel="qualitative">
                <div class="text-xs text-slate-500">Each label also carries a normalized percentage so charts and rankings stay consistent.</div>
                <div class="space-y-2" data-scale-list>
                    ${getScaleRowsHtml(prefix, scheme.scale || [])}
                </div>
                <button type="button" class="assessment-add-scale-btn px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold">
                    <i class="fas fa-plus mr-2"></i>Add grade label
                </button>
            </div>
        </div>
    `;
}

export function getAssessmentConfigCardHtml(config, key, options = {}) {
    const normalized = options.allowInherit
        ? normalizeClassAssessmentConfig(config, options.questLevel || '')
        : normalizeAssessmentConfig(config, options.questLevel || '');
    const title = options.title || 'Assessment rules';
    const description = options.description || '';

    return `
        <div class="assessment-config-card rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5 space-y-4" data-assessment-card data-card-key="${key}">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h4 class="font-title text-2xl text-slate-800">${title}</h4>
                    ${description ? `<p class="text-sm text-slate-500 mt-1">${description}</p>` : ''}
                </div>
                ${options.allowInherit ? `
                    <label class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 border border-slate-200 text-sm font-semibold text-slate-700">
                        <input type="checkbox" class="assessment-inherit-toggle" ${normalized.inheritSchoolDefaults ? 'checked' : ''}>
                        Use school defaults
                    </label>
                ` : ''}
            </div>
            <div class="assessment-override-panel space-y-4 ${options.allowInherit && normalized.inheritSchoolDefaults ? 'hidden' : ''}" data-override-panel>
                ${getSchemeEditorHtml(`${key}-tests`, 'Tests', normalized.tests)}
                ${getSchemeEditorHtml(`${key}-dictations`, 'Dictations', normalized.dictations)}
            </div>
        </div>
    `;
}

export function getAssessmentDefaultsEditorHtml(defaultsByLeague) {
    const normalized = normalizeAssessmentDefaultsByLeague(defaultsByLeague);
    return `
        <div class="space-y-4">
            ${questLeagues.map((league) => getAssessmentConfigCardHtml(normalized[league], `league-${league}`, {
                title: `${league} defaults`,
                description: `These school-level defaults apply to all ${league} classes unless a class overrides them.`,
                questLevel: league
            })).join('')}
        </div>
    `;
}

export function wireAssessmentEditor(root = document) {
    if (!root || root.dataset?.assessmentEditorWired === 'true') return;
    if (root.dataset) root.dataset.assessmentEditorWired = 'true';

    root.addEventListener('change', (event) => {
        if (event.target.classList.contains('assessment-mode-select')) {
            const editor = event.target.closest('[data-scheme-editor]');
            if (!editor) return;
            const numericPanel = editor.querySelector('[data-mode-panel="numeric"]');
            const qualitativePanel = editor.querySelector('[data-mode-panel="qualitative"]');
            const isQualitative = event.target.value === 'qualitative';
            numericPanel?.classList.toggle('hidden', isQualitative);
            qualitativePanel?.classList.toggle('hidden', !isQualitative);
            return;
        }

        if (event.target.classList.contains('assessment-inherit-toggle')) {
            const card = event.target.closest('[data-assessment-card]');
            const overridePanel = card?.querySelector('[data-override-panel]');
            if (overridePanel) {
                overridePanel.classList.toggle('hidden', event.target.checked);
            }
        }
    });

    root.addEventListener('click', (event) => {
        const addBtn = event.target.closest('.assessment-add-scale-btn');
        if (addBtn) {
            const editor = addBtn.closest('[data-scheme-editor]');
            const list = editor?.querySelector('[data-scale-list]');
            if (!list) return;
            list.insertAdjacentHTML('beforeend', getScaleRowsHtml('scale', [{ label: '', normalizedPercent: 0 }]));
            return;
        }

        const removeBtn = event.target.closest('.assessment-remove-scale-btn');
        if (removeBtn) {
            const list = removeBtn.closest('[data-scale-list]');
            const row = removeBtn.closest('[data-scale-row]');
            if (!list || !row) return;
            if (list.querySelectorAll('[data-scale-row]').length <= 1) return;
            row.remove();
        }
    });
}

function readScaleFromEditor(editor) {
    return [...editor.querySelectorAll('[data-scale-row]')].map((row, index) => ({
        id: `scale_${index + 1}`,
        label: row.querySelector('.assessment-scale-label')?.value?.trim() || '',
        normalizedPercent: Number(row.querySelector('.assessment-scale-percent')?.value || 0)
    })).filter((entry) => entry.label);
}

function readSchemeFromCard(card, title) {
    const editor = card.querySelector(`[data-prefix$="${title}"]`)?.closest('[data-scheme-editor]')
        || card.querySelectorAll('[data-scheme-editor]')[title === 'tests' ? 0 : 1];
    const mode = editor?.querySelector('.assessment-mode-select')?.value === 'qualitative' ? 'qualitative' : 'numeric';
    if (mode === 'qualitative') {
        const scale = readScaleFromEditor(editor);
        return {
            mode: 'qualitative',
            scale: scale.length > 0 ? scale : QUALITATIVE_SCALE_FALLBACK
        };
    }
    return {
        mode: 'numeric',
        maxScore: Number(editor?.querySelector('.assessment-max-score')?.value || 100)
    };
}

export function readAssessmentCardValue(card, options = {}) {
    return {
        inheritSchoolDefaults: options.allowInherit ? !!card.querySelector('.assessment-inherit-toggle')?.checked : undefined,
        tests: readSchemeFromCard(card, 'tests'),
        dictations: readSchemeFromCard(card, 'dictations')
    };
}

export function readAssessmentDefaultsFromContainer(container) {
    const payload = {};
    container.querySelectorAll('[data-assessment-card]').forEach((card) => {
        const key = card.dataset.cardKey || '';
        const league = key.replace(/^league-/, '');
        if (!league) return;
        payload[league] = readAssessmentCardValue(card);
    });
    return normalizeAssessmentDefaultsByLeague(payload);
}
