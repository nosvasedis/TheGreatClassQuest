import { functions, httpsCallable } from '../firebase.js';
import { friendlyActionError, looksTechnical } from './friendlyErrors.js';

function callable(name) {
    return httpsCallable(functions, name);
}

// Server messages written for people pass through; raw codes like "internal" become plain sentences.
function humanizeCallableError(error) {
    if (!error || !looksTechnical(error.message)) return error;
    const friendly = new Error(friendlyActionError(error));
    friendly.code = error.code;
    friendly.details = error.details;
    friendly.cause = error;
    return friendly;
}

async function callAdmin(name, payload = {}) {
    const fn = callable(name);
    try {
        const result = await fn(payload);
        return result?.data || null;
    } catch (error) {
        throw humanizeCallableError(error);
    }
}

export function createParentAccess(payload) {
    return callAdmin('createParentAccess', payload);
}

export function getSecretaryBootstrapStatus(payload = {}) {
    return callAdmin('getSecretaryBootstrapStatus', payload);
}

export function activateSecretaryAdmin(payload) {
    return callAdmin('activateSecretaryAdmin', payload);
}

export function updateSecretaryCredentials(payload) {
    return callAdmin('updateSecretaryCredentials', payload);
}

export function resetParentAccessPassword(payload) {
    return callAdmin('resetParentAccessPassword', payload);
}

export function disableParentAccess(payload) {
    return callAdmin('disableParentAccess', payload);
}

export function deleteParentAccess(payload) {
    return callAdmin('deleteParentAccess', payload);
}

export function publishParentSummary(payload) {
    return callAdmin('publishParentSummary', payload);
}
export function publishEmberOath(payload) {
    return callAdmin('publishEmberOath', payload);
}

export function postCommunicationMessage(payload) {
    return callAdmin('postCommunicationMessage', payload);
}

export function publishParentHomework(payload) {
    return callAdmin('publishParentHomework', payload);
}

export function syncQuestAssignmentToParentHomework(payload) {
    return callAdmin('syncQuestAssignmentToParentHomework', payload);
}

export function backfillRoleAccessData(payload = {}) {
    return callAdmin('backfillRoleAccessData', payload);
}

export function previewYearRollover(payload = {}) {
    return callAdmin('previewYearRollover', payload);
}

export function ensureOpenSchoolYears(payload = {}) {
    return callAdmin('ensureOpenSchoolYears', payload);
}

export function closeSchoolYear(payload = {}) {
    return callAdmin('closeSchoolYear', payload);
}

export function openSchoolYear(payload = {}) {
    return callAdmin('openSchoolYear', payload);
}

export function archiveCarriedYearGold(payload = {}) {
    return callAdmin('archiveCarriedYearGold', payload);
}

export function finalizeRollover(payload = {}) {
    return callAdmin('finalizeRollover', payload);
}

export function backfillSchoolYearData(payload = {}) {
    return callAdmin('backfillSchoolYearData', payload);
}

export function allocateReturningStudents(payload = {}) {
    return callAdmin('allocateReturningStudents', payload);
}

export function markStudentLeftSchool(payload = {}) {
    return callAdmin('markStudentLeftSchool', payload);
}

export function restoreFormerStudent(payload = {}) {
    return callAdmin('restoreFormerStudent', payload);
}

export function purgeStudent(payload = {}) {
    return callAdmin('purgeStudent', payload);
}

export function transferStudentToClass(payload = {}) {
    return callAdmin('transferStudentToClass', payload);
}

export function releaseStudentToPlacement(payload = {}) {
    return callAdmin('releaseStudentToPlacement', payload);
}

export function assignClassTeacher(payload = {}) {
    return callAdmin('assignClassTeacher', payload);
}

export async function ensureShopStock(payload = {}) {
    const fn = httpsCallable(functions, 'ensureShopStock', { timeout: 540000 });
    const result = await fn(payload);
    return result?.data || null;
}

export async function manageShopItem(payload = {}) {
    const fn = httpsCallable(functions, 'manageShopItem', { timeout: 180000 });
    const result = await fn(payload);
    return result?.data || null;
}

export function refreshFamilySnapshot(payload = {}) {
    return callAdmin('refreshFamilySnapshot', payload);
}

export function sendFamilyMessage(payload) {
    return callAdmin('sendFamilyMessage', payload);
}
