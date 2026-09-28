'use strict';

const crypto = require('node:crypto');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { HttpsError } = require('firebase-functions/v1/https');
const { shopAiChat, shopAiImage } = require('./shop/ai');

// The option lists and prompt builder live in avatarForgeRecipe.mjs so the modal and
// this callable can never disagree about what a teacher may pick.
let recipeModule = null;
function loadRecipe() {
  if (!recipeModule) recipeModule = import('./avatarForgeRecipe.mjs');
  return recipeModule;
}

// Bumped when the callable understands a new recipe shape; the modal repaints in the
// browser when an older deployment answers.
const FORGE_VERSION = 2;

const MAX_IMAGE_BYTES = 1024 * 1024;

// Portraits are immutable per download token: every save mints a fresh token, so a
// URL never points at changed bytes. Cache them hard so the browser and CDN stop
// re-fetching on every render. Keep this value identical to AVATAR_IMAGE_CACHE_CONTROL
// in constants.js (client-side fallback).
const PORTRAIT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function parseImageDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw new HttpsError('invalid-argument', 'The portrait was not a valid image.');
  const contentType = match[1].toLowerCase();
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(contentType)) {
    throw new HttpsError('invalid-argument', 'Save the portrait as PNG, WebP, or JPEG.');
  }
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'The portrait must be an image under 1 MiB.');
  }
  return { contentType, bytes };
}

async function uploadPortrait(studentId, bytes, contentType) {
  const extension = contentType === 'image/webp' ? 'webp' : (contentType === 'image/jpeg' ? 'jpg' : 'png');
  const path = `avatars/${studentId}/avatar.${extension}`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  const token = crypto.randomUUID();
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: PORTRAIT_CACHE_CONTROL,
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

function createAvatarForgeHandlers({ requireStudentManager, requireFeatureEnabled, publicDataPath }) {
  async function forgeStudentAvatar(request) {
    await requireFeatureEnabled('eliteAI');
    const studentId = String(request.data?.studentId || '').trim();
    if (!studentId) throw new HttpsError('invalid-argument', 'Choose a student first.');
    await requireStudentManager(request, studentId);
    const recipeTools = await loadRecipe();
    let recipe;
    try {
      recipe = recipeTools.normalizeForgeRecipe(request.data || {});
    } catch (error) {
      if (error instanceof recipeTools.ForgeRecipeError) throw new HttpsError('invalid-argument', error.message);
      throw error;
    }

    // The writer adds character detail; if it is down, the forge still paints from the
    // catalogue's own description rather than failing the teacher's click.
    const { system, user } = recipeTools.buildForgeWriterMessages(recipe);
    let subject = '';
    try {
      subject = recipeTools.cleanWriterSubject(await shopAiChat(system, user));
    } catch (error) {
      console.warn('forgeStudentAvatar writer unavailable, using catalogue description:', error?.message || error);
    }
    const finalPrompt = recipeTools.composeForgeImagePrompt(recipe, subject);

    let bytes;
    try {
      bytes = await shopAiImage(finalPrompt, recipeTools.FORGE_NEGATIVE_PROMPT, recipeTools.FORGE_IMAGE_OPTIONS);
    } catch (error) {
      console.error('forgeStudentAvatar image failed:', error?.message || error);
      throw new HttpsError('unavailable', 'The Avatar Forge could not paint the portrait. Try again in a moment.');
    }
    if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > 4 * MAX_IMAGE_BYTES) {
      throw new HttpsError('unavailable', 'The Avatar Forge returned an unusable portrait. Try again.');
    }
    return { imageDataUrl: `data:image/png;base64,${bytes.toString('base64')}`, forgeVersion: FORGE_VERSION, recipe };
  }

  async function saveStudentAvatar(request) {
    await requireFeatureEnabled('eliteAI');
    const studentId = String(request.data?.studentId || '').trim();
    if (!studentId) throw new HttpsError('invalid-argument', 'Choose a student first.');
    await requireStudentManager(request, studentId);
    const { contentType, bytes } = parseImageDataUrl(request.data?.imageDataUrl);
    let avatar;
    try {
      avatar = await uploadPortrait(studentId, bytes, contentType);
    } catch (error) {
      console.error('saveStudentAvatar upload failed:', error?.message || error);
      throw new HttpsError('unavailable', 'The portrait could not be stored. Try again in a moment.');
    }
    await getFirestore().doc(`${publicDataPath}/students/${studentId}`).update({
      avatar,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { avatar };
  }

  return { forgeStudentAvatar, saveStudentAvatar };
}

module.exports = { createAvatarForgeHandlers };
