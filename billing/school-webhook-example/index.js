/**
 * Example: HTTP endpoint each school deploys to receive tier updates from the billing backend.
 *
 * Deploy as a Firebase Cloud Function in that school's project:
 *   firebase deploy --only functions:updateSubscriptionFromBilling --project THE_SCHOOL_PROJECT_ID
 *
 * Or run as a standalone Express route behind auth; the important part is:
 * 1. Verify Authorization: Bearer <webhookSecret>
 * 2. Write req.body.subscription (or preset for req.body.tier) to Firestore appConfig/subscription
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// If using Cloud Functions:
// import { onRequest } from 'firebase-functions/v2/https';

const WEBHOOK_SECRET = process.env.GCQ_BILLING_WEBHOOK_SECRET;

// Tier preset fallbacks if billing backend sends only { tier } (no subscription body)
const PRESETS = {
  starter: {
    tier: 'starter',
    maxTeachers: 3,
    maxClasses: 6,
    guilds: false,
    adventureLog: false,
    calendar: false,
    schoolYearPlanner: false,
    scholarScroll: false,
    makeupTracking: false,
    advancedAttendance: false,
    storyWeavers: false,
    heroProgression: false,
    eliteAI: false,
    earlyAccess: false,
    prioritySupport: false,
    customFeatures: false,
  },
  pro: {
    tier: 'pro',
    maxTeachers: 6,
    maxClasses: 10,
    guilds: true,
    adventureLog: true,
    calendar: true,
    schoolYearPlanner: true,
    scholarScroll: true,
    makeupTracking: true,
    advancedAttendance: true,
    storyWeavers: true,
    heroProgression: true,
    eliteAI: false,
    earlyAccess: false,
    prioritySupport: false,
    customFeatures: false,
  },
  elite: {
    tier: 'elite',
    maxTeachers: null,
    maxClasses: null,
    guilds: true,
    adventureLog: true,
    calendar: true,
    schoolYearPlanner: true,
    scholarScroll: true,
    makeupTracking: true,
    advancedAttendance: true,
    storyWeavers: true,
    heroProgression: true,
    eliteAI: true,
    earlyAccess: true,
    prioritySupport: true,
    customFeatures: true,
  },
};

function getAuthHeader(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function updateSubscriptionFromBilling(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const token = getAuthHeader(req);
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const subscription = body.subscription || PRESETS[body.tier];
  if (!subscription) {
    return res.status(400).send('Missing tier or subscription');
  }

  try {
    if (!getApps().length) {
      initializeApp(); // In Cloud Functions this is already done; safe no-op if credential in env
    }
    const db = getFirestore();
    await db.collection('appConfig').doc('subscription').set(subscription);
    console.log('Updated appConfig/subscription to tier:', subscription.tier);
    return res.status(200).json({ ok: true, tier: subscription.tier });
  } catch (e) {
    console.error('Failed to write subscription:', e);
    return res.status(500).send('Internal error');
  }
}

// Cloud Functions v2 export (uncomment when deploying to Firebase):
// export const updateSubscriptionFromBilling = onRequest(
//   { secrets: ['GCQ_BILLING_WEBHOOK_SECRET'] },
//   async (req, res) => updateSubscriptionFromBilling(req, res)
// );
