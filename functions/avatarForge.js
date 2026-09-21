'use strict';

const crypto = require('node:crypto');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { HttpsError } = require('firebase-functions/v1/https');
const { shopAiChat, shopAiImage } = require('./shop/ai');

const CREATURES = new Set([
  'Fairy', 'Wizard', 'Witch', 'Elf', 'Dwarf', 'Goblin', 'Knight', 'Dragon',
  'Unicorn', 'Robot', 'Alien', 'Mermaid', 'Gnome', 'Prince', 'Princess', 'Pirate', 'Superhero'
]);
const COLORS = new Set([
  'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Turquoise',
  'Black', 'White', 'Grey', 'Rainbow'
]);
const ACCESSORIES = new Set([
  'None', 'Magic Wand', 'Big Glasses', 'Flower Crown', 'Pointy Hat',
  'Shiny Sword', 'Glowing Book', 'Headphones', 'Small Backpack'
]);

const MAX_IMAGE_BYTES = 1024 * 1024;

function choice(value, allowed, label) {
  const text = String(value || '').trim();
  if (!allowed.has(text)) {
    throw new HttpsError('invalid-argument', `Choose a ${label} from the Avatar Forge list.`);
  }
  return text;
}

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
      cacheControl: 'public, max-age=3600',
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
    const creature = choice(request.data?.creature, CREATURES, 'creature');
    const color = choice(request.data?.color, COLORS, 'colour');
    const accessory = choice(request.data?.accessory, ACCESSORIES, 'accessory');
    const accessoryText = accessory === 'None' ? 'with no accessory' : `holding a ${accessory}`;
    const systemPrompt = "You are an AI art prompt engineer specializing in creating cute, child-friendly avatars. The style MUST be: 'chibi character, cute, simple, flat 2D vector style, thick outlines, solid colors, centered, on a white background'. Your task is to combine a creature, a main color, and an accessory into a concise, effective prompt. The prompt MUST be a single sentence.";
    const userPrompt = `Generate a prompt for a cute chibi ${creature} with a main color scheme of ${color}, ${accessoryText}.`;

    let prompt = '';
    try {
      prompt = await shopAiChat(systemPrompt, userPrompt);
    } catch (error) {
      console.error('forgeStudentAvatar prompt failed:', error?.message || error);
      throw new HttpsError('unavailable', 'The Avatar Forge could not write a portrait prompt. Try again in a moment.');
    }
    const finalPrompt = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 1800);
    if (!finalPrompt) {
      throw new HttpsError('unavailable', 'The Avatar Forge returned an empty prompt. Try again.');
    }

    let bytes;
    try {
      bytes = await shopAiImage(
        `${finalPrompt} chibi character, cute, simple, flat 2D vector style, thick outlines, solid colors, centered, on a white background`,
        'text, watermark, blurry, low quality, scary, realistic photo, gore',
        { width: 512, height: 512, num_steps: 20 }
      );
    } catch (error) {
      console.error('forgeStudentAvatar image failed:', error?.message || error);
      throw new HttpsError('unavailable', 'The Avatar Forge could not paint the portrait. Try again in a moment.');
    }
    if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > 4 * MAX_IMAGE_BYTES) {
      throw new HttpsError('unavailable', 'The Avatar Forge returned an unusable portrait. Try again.');
    }
    return { imageDataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
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
