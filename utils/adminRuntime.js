import { functions, httpsCallable } from '../firebase.js';

function callable(name) {
    return httpsCallable(functions, name);
}

async function callAdmin(name, payload = {}) {
    const fn = callable(name);
    const result = await fn(payload);
    return result?.data || null;
}

export function createParentAccess(payload) {
    return callAdmin('createParentAccess', payload);
}

export function claimFoundingSchoolAdmin(payload = {}) {
    return callAdmin('claimFoundingSchoolAdmin', payload);
}

export function resetParentAccessPassword(payload) {
    return callAdmin('resetParentAccessPassword', payload);
}

export function disableParentAccess(payload) {
    return callAdmin('disableParentAccess', payload);
}

export function publishParentSummary(payload) {
    return callAdmin('publishParentSummary', payload);
}

export function createOrReplaceSecretaryAccess(payload) {
    return callAdmin('createOrReplaceSecretaryAccess', payload);
}

export function disableSecretaryAccess(payload) {
    return callAdmin('disableSecretaryAccess', payload);
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
