import * as state from '../state.js';
import * as utils from '../utils.js';
import { questLeagues } from '../constants.js';

export const QUALITATIVE_SCALE_FALLBACK = [
    { id: 'great_3', label: 'Great!!!', normalizedPercent: 100 },
    { id: 'great_2', label: 'Great!!', normalizedPercent: 75 },
    { id: 'great_1', label: 'Great!', normalizedPercent: 50 },
    { id: 'nice_try', label: 'Nice Try!', normalizedPercent: 25 }
];

function slugifyAssessmentLabel(label, index = 0) {
    const base = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return base || `grade_${index + 1}`;
}

function clampNormalizedPercent(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function isJuniorLeague(questLevel) {
    return questLevel === 'Junior A' || questLevel === 'Junior B';
}

export function createLegacyAssessmentDefaultsForLeague(questLevel) {
    if (isJuniorLeague(questLevel)) {
        return {
            tests: { mode: 'numeric', maxScore: 40 },
            dictations: { mode: 'qualitative', scale: QUALITATIVE_SCALE_FALLBACK }
        };
    }

    return {
        tests: { mode: 'numeric', maxScore: 100 },
        dictations: { mode: 'numeric', maxScore: 100 }
    };
}

function normalizeQualitativeScale(scale, fallbackScale = QUALITATIVE_SCALE_FALLBACK) {
    const candidates = Array.isArray(scale) && scale.length > 0 ? scale : fallbackScale;
    return candidates
        .map((entry, index) => {
            const label = String(entry?.label || '').trim();
            if (!label) return null;
            return {
                id: String(entry?.id || slugifyAssessmentLabel(label, index)).trim(),
                label,
                normalizedPercent: clampNormalizedPercent(entry?.normalizedPercent, fallbackScale[index]?.normalizedPercent || 0)
            };
        })
        .filter(Boolean);
}

export function normalizeAssessmentScheme(rawScheme, fallbackScheme) {
    const fallback = fallbackScheme || { mode: 'numeric', maxScore: 100 };
    const requestedMode = rawScheme?.mode === 'qualitative' ? 'qualitative' : 'numeric';
    const mode = requestedMode || fallback.mode || 'numeric';

    if (mode === 'qualitative') {
        const scale = normalizeQualitativeScale(rawScheme?.scale, fallback.scale || QUALITATIVE_SCALE_FALLBACK);
        return {
            mode: 'qualitative',
            scale: scale.length > 0 ? scale : normalizeQualitativeScale(fallback.scale || QUALITATIVE_SCALE_FALLBACK)
        };
    }

    const fallbackMaxScore = Number(fallback.maxScore) > 0 ? Number(fallback.maxScore) : 100;
    const maxScore = Number(rawScheme?.maxScore);
    return {
        mode: 'numeric',
        maxScore: maxScore > 0 ? maxScore : fallbackMaxScore
    };
}

export function normalizeAssessmentConfig(rawConfig, questLevel = '') {
    const legacy = createLegacyAssessmentDefaultsForLeague(questLevel);
    const schoolDefaults = rawConfig || {};

    return {
        tests: normalizeAssessmentScheme(schoolDefaults.tests, legacy.tests),
        dictations: normalizeAssessmentScheme(schoolDefaults.dictations, legacy.dictations)
    };
}

export function normalizeAssessmentDefaultsByLeague(rawDefaults = {}) {
    return questLeagues.reduce((acc, league) => {
        acc[league] = normalizeAssessmentConfig(rawDefaults?.[league], league);
        return acc;
    }, {});
}

export function getSchoolAssessmentDefaults() {
    return normalizeAssessmentDefaultsByLeague(state.get('schoolAssessmentDefaults') || {});
}

export function normalizeClassAssessmentConfig(rawConfig, questLevel = '') {
    const normalized = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const defaults = createLegacyAssessmentDefaultsForLeague(questLevel);
    return {
        inheritSchoolDefaults: normalized.inheritSchoolDefaults !== false,
        tests: normalizeAssessmentScheme(normalized.tests, defaults.tests),
        dictations: normalizeAssessmentScheme(normalized.dictations, defaults.dictations)
    };
}

export function resolveAssessmentConfig(classData, schoolDefaults = getSchoolAssessmentDefaults()) {
    const questLevel = classData?.questLevel || '';
    const schoolConfig = normalizeAssessmentConfig(schoolDefaults?.[questLevel], questLevel);
    const classConfig = normalizeClassAssessmentConfig(classData?.assessmentConfig, questLevel);

    if (classConfig.inheritSchoolDefaults) {
        return {
            inheritSchoolDefaults: true,
            tests: schoolConfig.tests,
            dictations: schoolConfig.dictations
        };
    }

    return {
        inheritSchoolDefaults: false,
        tests: normalizeAssessmentScheme(classConfig.tests, schoolConfig.tests),
        dictations: normalizeAssessmentScheme(classConfig.dictations, schoolConfig.dictations)
    };
}

export function getAssessmentSchemeForClass(classData, type, schoolDefaults = getSchoolAssessmentDefaults()) {
    const resolved = resolveAssessmentConfig(classData, schoolDefaults);
    return type === 'dictation' ? resolved.dictations : resolved.tests;
}

export function getAssessmentSchemeByClassId(classId, type, schoolDefaults = getSchoolAssessmentDefaults()) {
    const classData = (state.get('allSchoolClasses') || []).find((item) => item.id === classId)
        || (state.get('allTeachersClasses') || []).find((item) => item.id === classId);
    return getAssessmentSchemeForClass(classData, type, schoolDefaults);
}

function normalizeScaleForSnapshot(scale = []) {
    return normalizeQualitativeScale(scale, QUALITATIVE_SCALE_FALLBACK).map((entry) => ({
        id: entry.id,
        label: entry.label,
        normalizedPercent: entry.normalizedPercent
    }));
}

export function buildAssessmentSnapshot(scheme) {
    if (!scheme) return null;
    if (scheme.mode === 'qualitative') {
        return {
            mode: 'qualitative',
            scale: normalizeScaleForSnapshot(scheme.scale)
        };
    }
    return {
        mode: 'numeric',
        maxScore: Number(scheme.maxScore) > 0 ? Number(scheme.maxScore) : 100
    };
}

export function getSchemeForScore(scoreRecord, classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    if (scoreRecord?.gradingSnapshot?.mode) {
        return normalizeAssessmentScheme(scoreRecord.gradingSnapshot, scoreRecord.gradingSnapshot);
    }

    const fallbackClass = classData
        || ((scoreRecord?.classId
            ? (state.get('allSchoolClasses') || []).find((item) => item.id === scoreRecord.classId)
            : null)
        || (scoreRecord?.classId
            ? (state.get('allTeachersClasses') || []).find((item) => item.id === scoreRecord.classId)
            : null));

    return getAssessmentSchemeForClass(fallbackClass, scoreRecord?.type || 'test', schoolDefaults);
}

export function getNormalizedPercentForScore(scoreRecord, classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    if (!scoreRecord) return null;
    if (Number.isFinite(Number(scoreRecord.normalizedPercent))) {
        return clampNormalizedPercent(scoreRecord.normalizedPercent, 0);
    }

    const scheme = getSchemeForScore(scoreRecord, classData, schoolDefaults);
    if (scheme.mode === 'qualitative') {
        const match = (scheme.scale || []).find((entry) => entry.label === scoreRecord.scoreQualitative);
        return match ? clampNormalizedPercent(match.normalizedPercent, 0) : null;
    }

    const maxScore = Number(scoreRecord.maxScore || scheme.maxScore);
    const scoreNumeric = Number(scoreRecord.scoreNumeric);
    if (!(maxScore > 0) || !Number.isFinite(scoreNumeric)) return null;
    return clampNormalizedPercent((scoreNumeric / maxScore) * 100, 0);
}

export function getAssessmentValueLabel(scoreRecord, classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    if (!scoreRecord) return '';
    const scheme = getSchemeForScore(scoreRecord, classData, schoolDefaults);

    if (scheme.mode === 'qualitative' || scoreRecord.scoreQualitative) {
        return String(scoreRecord.scoreQualitative || '').trim();
    }

    const maxScore = Number(scoreRecord.maxScore || scheme.maxScore);
    if (Number.isFinite(Number(scoreRecord.scoreNumeric)) && maxScore > 0) {
        return `${scoreRecord.scoreNumeric}/${maxScore}`;
    }

    return '';
}

export function describeAssessmentScheme(scheme) {
    if (!scheme) return 'Not configured';
    if (scheme.mode === 'qualitative') {
        return (scheme.scale || []).map((entry) => `${entry.label} (${entry.normalizedPercent}%)`).join(' • ');
    }
    return `Numeric / ${scheme.maxScore || 100}`;
}

export function getNearestQualitativeLabel(scheme, normalizedPercent) {
    if (!scheme || scheme.mode !== 'qualitative' || !Number.isFinite(Number(normalizedPercent))) return '';
    const scale = scheme.scale || [];
    if (scale.length === 0) return '';
    return scale.reduce((closest, entry) => {
        if (!closest) return entry;
        return Math.abs(entry.normalizedPercent - normalizedPercent) < Math.abs(closest.normalizedPercent - normalizedPercent)
            ? entry
            : closest;
    }, null)?.label || '';
}

export function createAssessmentScorePayload({ studentId, classId, type, title, teacherId, date, value, notes = null, classData = null, schoolDefaults = getSchoolAssessmentDefaults() }) {
    const scheme = classData
        ? getAssessmentSchemeForClass(classData, type, schoolDefaults)
        : getAssessmentSchemeByClassId(classId, type, schoolDefaults);
    const snapshot = buildAssessmentSnapshot(scheme);
    const payload = {
        studentId,
        classId,
        date,
        type,
        title: type === 'test' ? title : null,
        teacherId,
        notes,
        scoreNumeric: null,
        scoreQualitative: null,
        maxScore: scheme.mode === 'numeric' ? scheme.maxScore : null,
        gradingMode: scheme.mode,
        gradingSnapshot: snapshot,
        normalizedPercent: null
    };

    if (scheme.mode === 'qualitative') {
        const selected = (scheme.scale || []).find((entry) => entry.label === value)
            || (scheme.scale || [])[0]
            || QUALITATIVE_SCALE_FALLBACK[0];
        payload.scoreQualitative = selected.label;
        payload.normalizedPercent = selected.normalizedPercent;
    } else {
        const numericValue = Number(value);
        payload.scoreNumeric = numericValue;
        payload.maxScore = scheme.maxScore;
        payload.normalizedPercent = clampNormalizedPercent((numericValue / scheme.maxScore) * 100, 0);
    }

    return payload;
}

export function getAssessmentAverage(scores = [], classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    const normalized = scores
        .map((score) => getNormalizedPercentForScore(score, classData, schoolDefaults))
        .filter((value) => Number.isFinite(value));
    if (normalized.length === 0) return null;
    return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

export function getQualitativeDistribution(scores = [], classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    const distribution = {};
    scores.forEach((score) => {
        const scheme = getSchemeForScore(score, classData, schoolDefaults);
        if (scheme.mode !== 'qualitative' || !score.scoreQualitative) return;
        distribution[score.scoreQualitative] = (distribution[score.scoreQualitative] || 0) + 1;
    });
    return distribution;
}

export function getWeightedAcademicAverage(testScores = [], dictationScores = [], classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    const testAvg = getAssessmentAverage(testScores, classData, schoolDefaults);
    const dictationAvg = getAssessmentAverage(dictationScores, classData, schoolDefaults);

    if (testAvg !== null && dictationAvg !== null) {
        return (testAvg * 0.6) + (dictationAvg * 0.4);
    }
    if (testAvg !== null) return testAvg;
    if (dictationAvg !== null) return dictationAvg;
    return 0;
}

export function qualifiesForHighScore(scoreRecord, type = scoreRecord?.type || 'test', classData = null, schoolDefaults = getSchoolAssessmentDefaults()) {
    const normalized = getNormalizedPercentForScore(scoreRecord, classData, schoolDefaults);
    if (!Number.isFinite(normalized)) return false;
    if (type === 'dictation') return normalized > 85;
    return normalized >= 95;
}

export function getNextAssessmentOccurrenceForToday(classId = null) {
    const today = utils.getTodayDateString();
    const myClassIds = new Set((state.get('allTeachersClasses') || []).map((item) => item.id));
    const schoolClasses = state.get('allSchoolClasses') || [];
    const assignments = (state.get('allQuestAssignments') || [])
        .filter((assignment) => assignment.testData && utils.datesMatch(assignment.testData.date, today))
        .filter((assignment) => myClassIds.has(assignment.classId))
        .filter((assignment) => !classId || assignment.classId === classId);

    const deduped = new Map();
    assignments.forEach((assignment) => {
        const key = `${assignment.classId}__${assignment.testData?.date || today}__${assignment.testData?.title || ''}`;
        if (!deduped.has(key)) {
            const classData = schoolClasses.find((item) => item.id === assignment.classId);
            deduped.set(key, {
                ...assignment,
                classData
            });
        }
    });

    return [...deduped.values()].sort((a, b) => {
        const timeA = a.classData?.timeStart || '99:99';
        const timeB = b.classData?.timeStart || '99:99';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return (a.classData?.name || '').localeCompare(b.classData?.name || '');
    });
}
