import {
    normalizeAssessmentConfig,
    normalizeClassAssessmentConfig,
    normalizeAssessmentDefaultsByLeague,
    QUALITATIVE_SCALE_FALLBACK
} from '../features/assessmentConfig.js';
import { questLeagues } from '../constants.js';

function describeSchemeSummary(scheme) {
    if (scheme.mode === 'none') return 'Not used';
    if (scheme.mode === 'qualitative') {
        const count = (scheme.scale || []).length;
        return `Word scale · ${count} label${count === 1 ? '' : 's'}`;
    }
    return `Numeric scale · ${scheme.maxScore || 100} points`;
}

function getScaleRowsHtml(prefix, scale = []) {
    return (scale.length > 0 ? scale : QUALITATIVE_SCALE_FALLBACK).map((entry, index) => `
        <div class="assessment-scale-row" data-scale-row>
            <label class="assessment-scale-field">
                <span>Word or label</span>
                <input type="text" class="assessment-scale-label" value="${entry.label || ''}" placeholder="e.g. Great">
            </label>
            <label class="assessment-scale-field assessment-scale-field--percent">
                <span>Normalized result</span>
                <span class="assessment-percent-input">
                    <input type="number" class="assessment-scale-percent" value="${entry.normalizedPercent ?? 0}" min="0" max="100" step="1" placeholder="0">
                    <b>%</b>
                </span>
            </label>
            <button type="button" class="assessment-remove-scale-btn" title="Remove grade label" aria-label="Remove grade label">
                <i class="fas fa-minus" aria-hidden="true"></i>
            </button>
        </div>
    `).join('');
}

function getSchemeEditorHtml(prefix, title, scheme) {
    return `
        <div class="assessment-scheme-editor" data-scheme-editor data-prefix="${prefix}">
            <div class="assessment-scheme-editor__header">
                <div class="assessment-scheme-editor__title-wrap">
                    <span class="assessment-scheme-editor__icon" aria-hidden="true"><i class="fas ${title === 'Tests' ? 'fa-file-pen' : 'fa-spell-check'}"></i></span>
                    <div>
                        <p class="assessment-scheme-editor__title">${title}</p>
                        <p class="assessment-scheme-editor__hint">Choose numeric, word-based, or not used at all.</p>
                    </div>
                </div>
                <label class="assessment-mode-control">
                    <span>Grading style</span>
                    <select class="assessment-mode-select">
                        <option value="numeric" ${scheme.mode === 'numeric' ? 'selected' : ''}>Numeric scale</option>
                        <option value="qualitative" ${scheme.mode === 'qualitative' ? 'selected' : ''}>Word scale</option>
                        <option value="none" ${scheme.mode === 'none' ? 'selected' : ''}>Not used</option>
                    </select>
                </label>
            </div>
            <div class="assessment-numeric-panel ${scheme.mode === 'numeric' ? '' : 'hidden'}" data-mode-panel="numeric">
                <label class="assessment-field">
                    <span>Maximum score</span>
                    <input type="number" class="assessment-max-score" min="1" step="1" value="${scheme.maxScore || 100}">
                </label>
            </div>
            <div class="assessment-qualitative-panel ${scheme.mode === 'qualitative' ? '' : 'hidden'}" data-mode-panel="qualitative">
                <div class="assessment-qualitative-panel__description">Each label also carries a normalized percentage so charts and rankings stay consistent.</div>
                <div class="assessment-scale-list" data-scale-list>
                    ${getScaleRowsHtml(prefix, scheme.scale || [])}
                </div>
                <button type="button" class="assessment-add-scale-btn">
                    <i class="fas fa-plus" aria-hidden="true"></i>Add grade label
                </button>
            </div>
            <div class="assessment-none-panel ${scheme.mode === 'none' ? '' : 'hidden'}" data-mode-panel="none">
                <p class="assessment-none-panel__title">This type is turned off</p>
                <p class="assessment-none-panel__description">Teachers will not see ${title.toLowerCase()} anywhere for this league or class — no logging, scheduling, charts, or parent results. You can turn it back on later; the last scale is kept.</p>
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
    const isCollapsible = options.collapsible === true;
    const containerTag = isCollapsible ? 'details' : 'div';
    const summary = isCollapsible ? `
        <summary class="assessment-config-summary">
            <span class="assessment-config-summary__main">
                <span class="assessment-config-summary__icon" aria-hidden="true"><i class="fas fa-layer-group"></i></span>
                <span>
                    <strong>${title}</strong>
                    <small>${description || 'School-wide assessment rules'}</small>
                </span>
            </span>
            <span class="assessment-config-summary__meta">
                <span>${describeSchemeSummary(normalized.tests)}</span>
                <span>${describeSchemeSummary(normalized.dictations)}</span>
                <i class="fas fa-chevron-down assessment-config-summary__chevron" aria-hidden="true"></i>
            </span>
        </summary>
    ` : '';

    return `
        <${containerTag} class="assessment-config-card${isCollapsible ? ' assessment-config-card--collapsible' : ''}" data-assessment-card data-card-key="${key}"${isCollapsible && options.open ? ' open' : ''}>
            ${summary}
            <div class="assessment-config-card__content">
            <div class="assessment-config-card__header">
                <div>
                    <p class="role-card__eyebrow">Assessment rules</p>
                    <h4 class="assessment-config-card__title">${title}</h4>
                    ${description ? `<p class="assessment-config-card__description">${description}</p>` : ''}
                </div>
                ${options.allowInherit ? `
                    <label class="assessment-inherit-control">
                        <input type="checkbox" class="assessment-inherit-toggle" ${normalized.inheritSchoolDefaults ? 'checked' : ''}>
                        <span><strong>Use school defaults</strong><small>Keep this class synced</small></span>
                    </label>
                ` : ''}
            </div>
            <div class="assessment-override-panel ${options.allowInherit && normalized.inheritSchoolDefaults ? 'hidden' : ''}" data-override-panel>
                ${getSchemeEditorHtml(`${key}-tests`, 'Tests', normalized.tests)}
                ${getSchemeEditorHtml(`${key}-dictations`, 'Dictations', normalized.dictations)}
            </div>
            </div>
        </${containerTag}>
    `;
}

export function getAssessmentDefaultsEditorHtml(defaultsByLeague) {
    const normalized = normalizeAssessmentDefaultsByLeague(defaultsByLeague);
    return `
        <div class="assessment-defaults-list">
            ${questLeagues.map((league, index) => getAssessmentConfigCardHtml(normalized[league], `league-${league}`, {
                title: `${league} defaults`,
                description: `These school-level defaults apply to all ${league} classes unless a class overrides them.`,
                questLevel: league,
                collapsible: true,
                open: index === 0
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
            const mode = event.target.value;
            editor.querySelectorAll('[data-mode-panel]').forEach((panel) => {
                panel.classList.toggle('hidden', panel.dataset.modePanel !== mode);
            });
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
    const selectedMode = editor?.querySelector('.assessment-mode-select')?.value;
    const mode = selectedMode === 'qualitative' || selectedMode === 'none' ? selectedMode : 'numeric';
    if (mode === 'none') {
        const scale = editor ? readScaleFromEditor(editor) : [];
        return {
            mode: 'none',
            maxScore: Number(editor?.querySelector('.assessment-max-score')?.value || 0) || undefined,
            scale: scale.length > 0 ? scale : undefined
        };
    }
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
