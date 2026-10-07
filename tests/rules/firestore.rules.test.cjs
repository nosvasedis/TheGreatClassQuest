const { before, beforeEach, after, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  setDoc,
  updateDoc,
  serverTimestamp,
  setLogLevel,
} = require('firebase/firestore');
const {
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
} = require('firebase/storage');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = 'artifacts/great-class-quest/public/data';
let env;
const rulesTest = process.env.FIRESTORE_EMULATOR_HOST ? test : () => {};

setLogLevel('silent');

if (process.env.FIRESTORE_EMULATOR_HOST) before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gcq',
    firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8') },
  });
});

if (process.env.FIRESTORE_EMULATOR_HOST) beforeEach(async () => {
  await Promise.all([env.clearFirestore(), env.clearStorage()]);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'user_profiles/teacher'), {
        role: 'teacher', status: 'active',
      }),
      setDoc(doc(db, 'user_profiles/secretary'), {
        role: 'secretary', status: 'active',
      }),
      setDoc(doc(db, 'user_profiles/parent'), {
        role: 'parent', status: 'active', linkedStudentId: 'student-1',
      }),
      setDoc(doc(db, 'user_profiles/inactive'), {
        role: 'teacher', status: 'disabled',
      }),
      setDoc(doc(db, `${DATA}/school_roles/secretary`), {
        uid: 'secretary', status: 'active', username: 'office',
      }),
      setDoc(doc(db, 'appConfig/subscription'), {
        tier: 'starter', secretaryAccess: false, parentAccess: false,
      }),
      setDoc(doc(db, `${DATA}/school_year_state/current`), {
        activeYearKey: '2026-2027', nextYearKey: '2027-2028', status: 'active',
      }),
      setDoc(doc(db, `${DATA}/school_settings/holidays`), { ranges: [] }),
      setDoc(doc(db, 'teachers/orphan'), { displayName: 'No profile' }),
      setDoc(doc(db, `${DATA}/students/student-1`), {
        name: 'Student', schoolYearKey: '2026-2027', activeSchoolYearKey: '2026-2027',
        createdBy: { uid: 'teacher' }, enrollmentStatus: 'active',
      }),
      setDoc(doc(db, `${DATA}/award_log/archived-log`), {
        schoolYearKey: '2025-2026', status: 'archived', createdBy: { uid: 'teacher' }, stars: 1,
      }),
    ]);
    await uploadBytes(
      ref(context.storage(), 'avatars/legacy-avatar.png'),
      new Uint8Array([137, 80, 78, 71]),
      { contentType: 'image/png' },
    );
  });
});

after(async () => {
  await env?.cleanup();
});

async function seedCampfire(tier = 'pro') {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'appConfig/subscription'), { tier, parentAccess: true });
    await setDoc(doc(db, 'user_profiles/other-teacher'), { role: 'teacher', status: 'active' });
    await setDoc(doc(db, DATA + '/classes/camp-class'), { createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027' });
    await updateDoc(doc(db, DATA + '/students/student-1'), { classId: 'camp-class' });
    await setDoc(doc(db, DATA + '/student_scores/student-1'), { createdBy: { uid: 'teacher' }, activeSchoolYearKey: '2026-2027', inventory: [], gold: 10, monthlyStars: 3 });
  });
}
function validEmber() {
  return { studentId: 'student-1', classId: 'camp-class', teacherId: 'teacher', createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027',
    templateId: 'mid_virtue', text: 'I help someone take a turn.', projectorText: 'I help someone take a turn.', category: 'virtue', band: 'mid',
    target: { kind: 'virtue', count: 1, reason: 'Teamwork' }, evidenceRule: 'virtue', startDate: '2026-09-20', dueDate: '2026-10-04',
    status: 'active', private: true, checkIns: [], evidence: [], reflection: { helped: '', next: '', emoji: '' }, legendLine: '', keptAt: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
function validCampfire() {
  return { classId: 'camp-class', date: '2026-09-27', league: 'A', band: 'mid', teacherId: 'teacher', createdBy: { uid: 'teacher' },
    schoolYearKey: '2026-2027', status: 'kindled', source: 'bank', selfCheck: null, checkedInIds: [], keptOathIds: [], logId: null, heroStudentId: null,
    script: { question: 'What helped you today?', followUp: 'What could you try next?', starters: ['I tried…'], words: ['practice'], circle: ['student-1'],
      rotation: { selectedIds: ['student-1'], cycleIds: ['student-1'], lastIds: ['student-1'], cycleSize: 1 }, readyOathIds: [], lessonTarget: null,
      fireTale: 'Every effort brings a little light.', closingLine: 'Our fire rests.', tomorrowSpark: 'Bring one question.', classPromise: 'We listen and help.' } };
}
rulesTest('Campfire sessions can be transactionally created from a missing document, then relit idempotently', async () => {
  await seedCampfire();
  const db = env.authenticatedContext('teacher').firestore(), ref = doc(db, DATA + '/campfire_sessions/camp-class_2026-09-27');
  await assertSucceeds(runTransaction(db, async tx => { await tx.get(ref); tx.set(ref, validCampfire()); }));
  await assertSucceeds(updateDoc(ref, { status: 'lit', checkedInIds: ['student-1'] }));
  await assertSucceeds(updateDoc(ref, { status: 'completed' }));
  await assertFails(updateDoc(ref, { status: 'lit' }));
  await assertSucceeds(updateDoc(ref, { status: 'completed', selfCheck: 'flame' }));
  await assertFails(updateDoc(ref, { classId: 'other' }));
  await assertFails(updateDoc(ref, { date: '2026-09-28' }));
});
rulesTest('private oaths never inherit generic staff access; parents and other teachers cannot read or query them', async () => {
  await seedCampfire('elite');
  const db = env.authenticatedContext('teacher').firestore(), path = DATA + '/ember_oaths/private';
  await assertSucceeds(setDoc(doc(db, path), validEmber()));
  await assertSucceeds(getDocs(query(collection(db, DATA + '/ember_oaths'), where('teacherId', '==', 'teacher'), where('schoolYearKey', '==', '2026-2027'))));
  for (const uid of ['parent','other-teacher','secretary','inactive']) {
    const other = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDocs(collection(other, DATA + '/ember_oaths')));
    await assertFails(updateDoc(doc(other, path), { text: 'Changed' }));
    await assertFails(deleteDoc(doc(other, path)));
  }
});
rulesTest('oath shape, plan, ownership, year and bounded histories are enforced', async () => {
  await seedCampfire('starter');
  const db = env.authenticatedContext('teacher').firestore(), ref = doc(db, DATA + '/ember_oaths/goal');
  await assertFails(setDoc(ref, validEmber()));
  await seedCampfire();
  await assertSucceeds(setDoc(ref, validEmber()));
  for(const change of [{ teacherId: 'other' },{ schoolYearKey: '2025-2026' },{ studentId: 'other' },{ status: 'closed' },{ evidence: Array(13).fill({}) },{checkIns:[{date:'2026-09-27',mood:'bad'}]},{ text: 'x'.repeat(241) },{ target: {kind:'manual',count:0} }])
    await assertFails(updateDoc(ref, change));
  await assertSucceeds(updateDoc(ref, { checkIns: [{ date:'2026-09-27', mood:'flame' }], evidence: [{ kind:'manual', label:'Helped a partner', date:'2026-09-27', refId:'observed' }] }));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), DATA + '/school_year_state/current'), { activeYearKey:'2027-2028' }));
  await assertFails(updateDoc(ref,{text:'Cannot edit closed year'}));
});
rulesTest('keeping an oath writes one chronicle receipt and keepsake without changing gold or stars', async () => {
  await seedCampfire();
  const db=env.authenticatedContext('teacher').firestore(), oath=doc(db,DATA+'/ember_oaths/kept'), score=doc(db,DATA+'/student_scores/student-1'), note=doc(db,DATA+'/hero_chronicle_notes/ember_kept');
  await setDoc(oath,validEmber());
  async function keep(){
    return runTransaction(db,async tx=>{
      const [o,s]=await Promise.all([tx.get(oath),tx.get(score)]);
      if(o.data().status==='kept') return;
      tx.update(oath,{status:'kept',keptAt:serverTimestamp(),legendLine:'A promise kept.'});
      tx.update(score,{inventory:[...s.data().inventory,{id:'ember_kept',source:'ember_oath',name:'Star-Ember'}]});
      tx.set(note,{studentId:'student-1',teacherId:'teacher',schoolYearKey:'2026-2027',category:'Goals',noteText:'A promise kept.',source:'ember_oath',oathId:'kept',createdAt:serverTimestamp()});
    });
  }
  await assertSucceeds(keep()); await assertSucceeds(keep());
  const assert=require('node:assert/strict'), data=(await getDoc(score)).data();
  assert.equal(data.inventory.length,1);assert.equal(data.gold,10);assert.equal(data.monthlyStars,3);
});

rulesTest('the real keep transaction (auto evidence, flame check-in, reflection, dated note) and a book-aware session are accepted', async () => {
  await seedCampfire();
  const db = env.authenticatedContext('teacher').firestore();
  const oath = doc(db, DATA + '/ember_oaths/real'), score = doc(db, DATA + '/student_scores/student-1'), note = doc(db, DATA + '/hero_chronicle_notes/ember_real');
  await assertSucceeds(setDoc(oath, validEmber()));
  await assertSucceeds(updateDoc(oath, { checkIns: [{ date: '2026-09-27', mood: 'flame' }], updatedAt: serverTimestamp() }));
  await assertSucceeds(runTransaction(db, async tx => {
    const s = await tx.get(score);
    tx.update(oath, { status: 'kept', evidence: [{ kind: 'virtue', label: 'Teamwork observed', date: '2026-09-27', refId: 'daily_teacher_student-1_27-09-2026' }],
      legendLine: 'Kept a personal promise with care.', reflection: { helped: 'My partner', next: 'Ask a question', emoji: '🌱' }, keptAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(score, { inventory: [...s.data().inventory, { id: 'ember_real', name: 'Star-Ember', icon: '🌟', image: 'data:image/svg+xml,%3Csvg%3E', source: 'ember_oath', oathId: 'real', acquiredAt: '2026-09-27T10:00:00Z', description: 'x' }] });
    tx.set(note, { studentId: 'student-1', teacherId: 'teacher', noteText: 'Kept a personal promise with care.', category: 'Goals', source: 'ember_oath', oathId: 'real',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), schoolYearKey: '2026-2027' });
  }));
  await assertFails(updateDoc(oath, { status: 'active' }));
  const session = { ...validCampfire(), script: { ...validCampfire().script, lessonTarget: { bookId: 'primary-path-2', component: 'sb', unit: 4, page: 78,
    summary: 'Cambridge Primary Path 2 · Unit 4 · pp. 78–80', theme: '', bigQuestion: 'Why do we celebrate?', grammar: 'past simple' } } };
  await assertSucceeds(setDoc(doc(db, DATA + '/campfire_sessions/camp-class_2026-09-27'), session));
  await assertFails(setDoc(doc(db, DATA + '/campfire_sessions/wrong-id'), session));
  // The AI-polished script carries word examples and a grammar pattern (seen in production).
  const polished = { ...session, source: 'ai', script: { ...session.script,
    embellishments: [{ word: 'eagle', example: 'An eagle can fly.', depict: true }, { word: 'hop', example: '', depict: true }],
    pattern: { label: 'can/cannot', example: 'I can hop.' } } };
  await assertSucceeds(setDoc(doc(db, DATA + '/campfire_sessions/camp-class_2026-09-27'), polished));
  await assertFails(setDoc(doc(db, DATA + '/campfire_sessions/camp-class_2026-09-27'), { ...polished, script: { ...polished.script, embellishments: Array(9).fill({ word: 'x' }) } }));
  await assertFails(setDoc(doc(db, DATA + '/campfire_sessions/camp-class_2026-09-27'), { ...polished, script: { ...polished.script, pattern: { label: 'x', other: 1 } } }));
});

rulesTest('missing and inactive profiles cannot read protected school data', async () => {
  const missingDb = env.authenticatedContext('orphan').firestore();
  const inactiveDb = env.authenticatedContext('inactive').firestore();
  await assertFails(getDoc(doc(missingDb, `${DATA}/school_settings/holidays`)));
  await assertFails(getDoc(doc(missingDb, 'teachers/orphan')));
  await assertFails(getDoc(doc(inactiveDb, `${DATA}/school_settings/holidays`)));
});

rulesTest('active teacher and secretary retain legitimate reads', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const secretaryDb = env.authenticatedContext('secretary').firestore();
  await assertSucceeds(getDoc(doc(teacherDb, `${DATA}/school_settings/holidays`)));
  await assertSucceeds(getDoc(doc(secretaryDb, `${DATA}/students/student-1`)));
});

rulesTest('teacher self-registration is blocked until the canonical Secretary is active', async () => {
  const signupDb = env.authenticatedContext('new-teacher').firestore();
  const fixedProfile = {
    role: 'teacher',
    displayName: 'New Teacher',
    loginMode: 'email',
    status: 'active',
    linkedStudentId: null,
    createdBy: null,
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), `${DATA}/school_roles/secretary`));
  });
  await assertFails(setDoc(doc(signupDb, 'user_profiles/new-teacher'), fixedProfile));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `${DATA}/school_roles/secretary`), {
      uid: 'secretary', status: 'active', username: 'office',
    });
  });
  await assertSucceeds(setDoc(doc(signupDb, 'user_profiles/new-teacher'), fixedProfile));

  const forgedDb = env.authenticatedContext('forged-admin').firestore();
  await assertFails(setDoc(doc(forgedDb, 'user_profiles/forged-admin'), {
    ...fixedProfile,
    role: 'secretary',
    schoolAdmin: true,
  }));
});

rulesTest('teacher writes stay in the active year and immutable ownership cannot change', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const activeClass = doc(teacherDb, `${DATA}/classes/class-active`);
  await assertSucceeds(setDoc(activeClass, {
    name: 'Class', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' },
  }));
  await assertFails(setDoc(doc(teacherDb, `${DATA}/classes/class-archived`), {
    name: 'Old', schoolYearKey: '2025-2026', createdBy: { uid: 'teacher' },
  }));
  await assertFails(updateDoc(activeClass, { createdBy: { uid: 'someone-else' } }));
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/award_log/archived-log`), { stars: 2 }));
});

rulesTest('parent cannot forge authoritative guild state while secretary retains settings access', async () => {
  const parentDb = env.authenticatedContext('parent').firestore();
  const secretaryDb = env.authenticatedContext('secretary').firestore();
  await assertFails(setDoc(doc(parentDb, `${DATA}/guild_scores/forged`), {
    activeSchoolYearKey: '2026-2027', score: 999,
  }));
  await assertSucceeds(updateDoc(doc(secretaryDb, `${DATA}/school_settings/holidays`), {
    ranges: [{ start: '2026-12-24', end: '2027-01-07' }],
  }));
});

rulesTest('teacher cannot write school-wide settings and a forged legacy flag grants nothing', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'user_profiles/teacher'), { schoolAdmin: true });
  });
  const teacherDb = env.authenticatedContext('teacher').firestore();
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/school_settings/holidays`), { schoolName: 'Forged School' }));
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/school_year_state/current`), { nextYearKey: '2028-2029' }));
  await assertFails(updateDoc(doc(teacherDb, 'appConfig/subscription'), { tier: 'elite' }));
  await assertSucceeds(updateDoc(doc(teacherDb, 'user_profiles/teacher'), { displayName: 'Teacher Name' }));
});

rulesTest('Starter Secretary has core administration but Elite is required for grading and schoolwide edits', async () => {
  const secretaryDb = env.authenticatedContext('secretary').firestore();
  await assertSucceeds(updateDoc(doc(secretaryDb, `${DATA}/school_settings/holidays`), {
    schoolName: 'Core Admin School',
    weatherLocation: { name: 'Athens', latitude: 37.98, longitude: 23.72 },
  }));
  await assertFails(updateDoc(doc(secretaryDb, `${DATA}/school_settings/holidays`), {
    assessmentDefaultsByLeague: { Apprentices: { tests: { maxScore: 10 } } },
  }));
  await assertFails(updateDoc(doc(secretaryDb, `${DATA}/students/student-1`), { name: 'Edited by Starter' }));

  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'appConfig/subscription'), { tier: 'elite', secretaryAccess: true });
  });
  await assertSucceeds(updateDoc(doc(secretaryDb, `${DATA}/school_settings/holidays`), {
    assessmentDefaultsByLeague: { Apprentices: { tests: { maxScore: 10 } } },
  }));
  await assertSucceeds(updateDoc(doc(secretaryDb, `${DATA}/students/student-1`), { name: 'Edited by Elite' }));
});

rulesTest('teachers can edit only owned classes, students, and per-class grading overrides', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const ownedClass = doc(teacherDb, `${DATA}/classes/owned-class`);
  await assertSucceeds(setDoc(ownedClass, {
    name: 'Owned', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' },
  }));
  await assertSucceeds(updateDoc(ownedClass, {
    assessmentConfig: { mode: 'override', tests: { maxScore: 10 } },
  }));
  await assertSucceeds(updateDoc(doc(teacherDb, `${DATA}/students/student-1`), { name: 'Owned Student' }));

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `${DATA}/classes/other-class`), {
      name: 'Other', schoolYearKey: '2026-2027', createdBy: { uid: 'another-teacher' },
    });
  });
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/classes/other-class`), {
    assessmentConfig: { mode: 'override' },
  }));
});

rulesTest('Special Quest actions only allow the class owner to update retryable effect status', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `${DATA}/classes/owned-class`), {
      name: 'Owned', schoolYearKey: '2026-2027', createdBy: { uid: 'teacher' },
    });
    await setDoc(doc(db, `${DATA}/classes/other-class`), {
      name: 'Other', schoolYearKey: '2026-2027', createdBy: { uid: 'another-teacher' },
    });
    const action = {
      type: 'completion', schoolYearKey: '2026-2027', coreStatus: 'applied',
      recipientIds: ['student-1'], starsPerRecipient: 2, totalStars: 2,
      effects: { guild: 'pending', familiars: 'pending' }, effectsVersion: 2,
    };
    await setDoc(doc(db, `${DATA}/quest_event_actions/owned-action`), { ...action, classId: 'owned-class' });
    await setDoc(doc(db, `${DATA}/quest_event_actions/other-action`), { ...action, classId: 'other-class' });
  });

  const ownedAction = doc(teacherDb, `${DATA}/quest_event_actions/owned-action`);
  await assertSucceeds(updateDoc(ownedAction, {
    'effects.guild': 'complete', 'effects.familiars': 'complete', updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(ownedAction, { starsPerRecipient: 99 }));
  await assertFails(updateDoc(ownedAction, { recipientIds: ['student-1', 'student-2'] }));
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/quest_event_actions/other-action`), {
    'effects.guild': 'complete', updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(ownedAction));
});

rulesTest('deterministic daily star and award rows are creatable by their owner', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const date = '26-09-2026';
  await assertSucceeds(setDoc(doc(teacherDb, `${DATA}/today_stars/teacher_student-1_${date}`), {
    studentId: 'student-1', stars: 2, date, reason: 'teamwork', teacherId: 'teacher',
    createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027',
  }));
  await assertSucceeds(setDoc(doc(teacherDb, `${DATA}/award_log/daily_teacher_student-1_${date}`), {
    studentId: 'student-1', stars: 2, date, reason: 'teamwork', teacherId: 'teacher',
    createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027',
  }));
  await assertSucceeds(getDoc(doc(teacherDb, `${DATA}/award_log/peerboon_class_${date}_0`)));
  await assertFails(setDoc(doc(teacherDb, `${DATA}/today_stars/another_student-1_${date}`), {
    studentId: 'student-1', stars: 2, date, teacherId: 'another-teacher',
    createdBy: { uid: 'another-teacher' }, schoolYearKey: '2026-2027',
  }));
});

rulesTest('storage preserves legacy reads while enforcing profile, ownership, MIME, and size limits', async () => {
  const teacherStorage = env.authenticatedContext('teacher').storage();
  const parentStorage = env.authenticatedContext('parent').storage();
  const missingStorage = env.authenticatedContext('orphan').storage();
  const validImage = new Uint8Array([82, 73, 70, 70]);

  await assertSucceeds(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/avatar.webp'),
    validImage,
    { contentType: 'image/webp' },
  ));
  await assertFails(uploadBytes(
    ref(parentStorage, 'avatars/student-1/avatar.webp'),
    validImage,
    { contentType: 'image/webp' },
  ));
  await assertFails(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/avatar.txt'),
    validImage,
    { contentType: 'text/plain' },
  ));
  await assertFails(uploadBytes(
    ref(teacherStorage, 'avatars/student-1/oversized.webp'),
    new Uint8Array((1024 * 1024) + 1),
    { contentType: 'image/webp' },
  ));
  await assertSucceeds(getBytes(ref(teacherStorage, 'avatars/legacy-avatar.png')));
  await assertFails(getBytes(ref(missingStorage, 'avatars/legacy-avatar.png')));
});

rulesTest('diary snapshots and picture edits remain restricted to the owning teacher and active year', async () => {
  const teacherDb = env.authenticatedContext('teacher').firestore();
  const parentDb = env.authenticatedContext('parent').firestore();
  const page = doc(teacherDb, `${DATA}/adventure_logs/diary-page`);
  const payload = { classId: 'camp-class', date: '02-10-2026', createdBy: { uid: 'teacher' }, schoolYearKey: '2026-2027', entryMode: 'ai', chroniclerContext: { version: 2, date: '2026-10-02', sections: { assessments: { items: [{ kind: 'Dictation', title: 'Autumn' }] } } }, generationRequestId: 'generation-1' };
  await assertSucceeds(setDoc(page, payload));
  await assertSucceeds(updateDoc(page, { imageUrl: 'https://example.test/my-picture', imageBase64: null, artworkStoragePath: 'adventure_logs/teacher/diary-page/image-1.jpg', artworkRequestId: 'image-1', artworkStatus: 'ready', artworkSource: 'upload' }));
  await assertFails(updateDoc(doc(parentDb, `${DATA}/adventure_logs/diary-page`), { imageUrl: null }));
  await assertSucceeds(updateDoc(page, { imageUrl: null, artworkStatus: 'removed', artworkRequestId: 'remove-1' }));
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${DATA}/adventure_logs/archived-page`), { ...payload, schoolYearKey: '2025-2026' }));
  await assertFails(updateDoc(doc(teacherDb, `${DATA}/adventure_logs/archived-page`), { artworkStatus: 'removed' }));
});

rulesTest('diary picture objects allow owner upload and cleanup while blocking other owners and oversized images', async () => {
  const teacherStorage = env.authenticatedContext('teacher').storage();
  const picture = ref(teacherStorage, 'adventure_logs/teacher/diary-page/image-1.jpg');
  await assertSucceeds(uploadBytes(picture, new Uint8Array([255, 216, 255]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(teacherStorage, 'adventure_logs/another-teacher/diary-page/image-1.jpg'), new Uint8Array([255]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(teacherStorage, 'adventure_logs/teacher/diary-page/large.jpg'), new Uint8Array(1024 * 1024 + 1), { contentType: 'image/jpeg' }));
  await assertSucceeds(deleteObject(picture));
});

// ---- Two schools in one project: every school sees and changes only its own data. ----
const DATA_B = 'artifacts/school-b/public/data';

async function seedSchoolB({ tier = 'elite', status = 'active' } = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'schools/school-b'), { name: 'School B', status, subscription: { tier } }),
      setDoc(doc(db, 'user_profiles/teacher-b'), { role: 'teacher', status: 'active', schoolId: 'school-b' }),
      setDoc(doc(db, 'user_profiles/secretary-b'), { role: 'secretary', status: 'active', schoolId: 'school-b' }),
      setDoc(doc(db, 'user_profiles/parent-b'), { role: 'parent', status: 'active', schoolId: 'school-b', linkedStudentId: 'student-1' }),
      setDoc(doc(db, `${DATA_B}/school_roles/secretary`), { uid: 'secretary-b', status: 'active', username: 'office' }),
      setDoc(doc(db, `${DATA_B}/school_year_state/current`), { activeYearKey: '2026-2027', status: 'active' }),
      setDoc(doc(db, `${DATA_B}/school_settings/holidays`), { ranges: [] }),
      setDoc(doc(db, `${DATA_B}/students/student-b`), {
        name: 'B Student', schoolYearKey: '2026-2027', activeSchoolYearKey: '2026-2027',
        createdBy: { uid: 'teacher-b' }, enrollmentStatus: 'active',
      }),
      setDoc(doc(db, `${DATA_B}/parent_snapshots/student-1`), { name: 'Same id, other school' }),
      setDoc(doc(db, `${DATA}/student_scores/student-1/monthly_history/2026-09`), { stars: 4, month: '2026-09', schoolYearKey: '2026-2027' }),
      setDoc(doc(db, `${DATA_B}/student_scores/student-b/monthly_history/2026-09`), { stars: 7, month: '2026-09', schoolYearKey: '2026-2027' }),
    ]);
  });
}

rulesTest('a teacher reads and writes only their own school', async () => {
  await seedSchoolB();
  const teacherA = env.authenticatedContext('teacher').firestore();
  const teacherB = env.authenticatedContext('teacher-b').firestore();
  await assertSucceeds(getDoc(doc(teacherA, `${DATA}/students/student-1`)));
  await assertFails(getDoc(doc(teacherA, `${DATA_B}/students/student-b`)));
  await assertSucceeds(getDoc(doc(teacherB, `${DATA_B}/students/student-b`)));
  await assertFails(getDoc(doc(teacherB, `${DATA}/students/student-1`)));
  await assertFails(getDocs(collection(teacherB, `${DATA}/students`)));
  await assertSucceeds(updateDoc(doc(teacherB, `${DATA_B}/students/student-b`), { name: 'Renamed' }));
  await assertFails(setDoc(doc(teacherB, `${DATA}/students/forged`), {
    name: 'Forged', activeSchoolYearKey: '2026-2027', createdBy: { uid: 'teacher-b' },
  }));
  await assertFails(setDoc(doc(teacherA, `${DATA_B}/students/forged`), {
    name: 'Forged', activeSchoolYearKey: '2026-2027', createdBy: { uid: 'teacher' },
  }));
  await assertSucceeds(getDoc(doc(teacherA, `${DATA}/student_scores/student-1/monthly_history/2026-09`)));
  await assertFails(getDoc(doc(teacherB, `${DATA}/student_scores/student-1/monthly_history/2026-09`)));
});

rulesTest('a secretary and a parent stay inside their own school', async () => {
  await seedSchoolB();
  const secretaryA = env.authenticatedContext('secretary').firestore();
  const secretaryB = env.authenticatedContext('secretary-b').firestore();
  const parentA = env.authenticatedContext('parent').firestore();
  await assertFails(getDoc(doc(secretaryA, 'user_profiles/teacher-b')));
  await assertSucceeds(getDoc(doc(secretaryB, 'user_profiles/teacher-b')));
  await assertFails(getDoc(doc(secretaryB, 'user_profiles/teacher')));
  // School B is Elite on its own schools doc, so its Secretary has the full console there only.
  await assertSucceeds(updateDoc(doc(secretaryB, `${DATA_B}/students/student-b`), { name: 'Edited by B office' }));
  await assertFails(updateDoc(doc(secretaryB, `${DATA}/students/student-1`), { name: 'Edited by B office' }));
  await assertFails(updateDoc(doc(secretaryA, `${DATA_B}/school_settings/holidays`), { schoolName: 'Taken over' }));
  // Same linked student id in another school is still out of reach.
  await assertFails(getDoc(doc(parentA, `${DATA_B}/parent_snapshots/student-1`)));
});

rulesTest('each school reads only its own plan, and nobody can move schools', async () => {
  await seedSchoolB();
  const teacherA = env.authenticatedContext('teacher').firestore();
  const teacherB = env.authenticatedContext('teacher-b').firestore();
  await assertSucceeds(getDoc(doc(teacherA, 'appConfig/subscription')));
  await assertFails(getDoc(doc(teacherA, 'schools/school-b')));
  await assertSucceeds(getDoc(doc(teacherB, 'schools/school-b')));
  await assertFails(getDoc(doc(teacherB, 'appConfig/subscription')));
  await assertFails(setDoc(doc(teacherB, 'schools/school-b'), { name: 'School B', status: 'active', subscription: { tier: 'elite' } }));
  await assertFails(updateDoc(doc(teacherA, 'user_profiles/teacher'), { schoolId: 'school-b' }));
  await assertFails(updateDoc(doc(teacherB, 'user_profiles/teacher-b'), { schoolId: 'great-class-quest' }));
  // Open teacher signup exists only for the founding school.
  const stranger = env.authenticatedContext('stranger').firestore();
  await assertFails(setDoc(doc(stranger, 'user_profiles/stranger'), {
    role: 'teacher', displayName: 'Stranger', loginMode: 'email', status: 'active', schoolId: 'school-b',
    linkedStudentId: null, createdBy: null, createdAt: serverTimestamp(), lastSeenAt: null,
  }));
});

rulesTest('a suspended school loses its plan-gated access', async () => {
  await seedSchoolB({ status: 'suspended' });
  const secretaryB = env.authenticatedContext('secretary-b').firestore();
  await assertFails(updateDoc(doc(secretaryB, `${DATA_B}/students/student-b`), { name: 'Edited while suspended' }));
});

rulesTest('storage uploads check ownership inside the uploader\'s school', async () => {
  await seedSchoolB();
  const teacherB = env.authenticatedContext('teacher-b').storage();
  const teacherA = env.authenticatedContext('teacher').storage();
  const png = new Uint8Array([137, 80, 78, 71]);
  await assertSucceeds(uploadBytes(ref(teacherB, 'avatars/student-b/avatar.webp'), png, { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(teacherB, 'avatars/student-1/avatar.webp'), png, { contentType: 'image/webp' }));
  await assertSucceeds(uploadBytes(ref(teacherA, 'avatars/student-1/avatar.webp'), png, { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(teacherA, 'avatars/student-b/avatar.webp'), png, { contentType: 'image/webp' }));
});

rulesTest('platform records (operators, schools) are server-only', async () => {
  await seedSchoolB();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'platform/operators'), { uids: ['secretary'] });
  });
  for (const uid of ['teacher', 'secretary', 'teacher-b', 'secretary-b']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, 'platform/operators')));
    await assertFails(setDoc(doc(db, 'platform/operators'), { uids: [uid] }));
    await assertFails(setDoc(doc(db, 'schools/school-c'), { name: 'Self-made', status: 'active', subscription: { tier: 'elite' } }));
  }
});

// ---- Quest Remote: owner-only sessions, Pro/Elite only, a fixed list of small commands. ----
function remoteSession(uid = 'teacher') {
  return { teacherId: uid, hostId: 'h1', code: 'KM4R', classId: '', stage: { surface: 'tab', pad: [] },
    hostHeartbeatAt: serverTimestamp(), createdAt: serverTimestamp(), expiresAt: new Date(Date.now() + 3600e3), closed: false };
}
function remoteCommand(uid = 'teacher', extra = {}) {
  return { teacherId: uid, type: 'award', payload: { studentId: 'student-1', reason: 'teamwork', stars: 1 },
    clientSeq: 1, wandId: 'wand1', sentAt: Date.now(), createdAt: serverTimestamp(), ...extra };
}

rulesTest('Quest Remote: the owner hosts and commands; nobody else reads or writes', async () => {
  await seedCampfire('pro');
  const mine = env.authenticatedContext('teacher').firestore();
  const other = env.authenticatedContext('other-teacher').firestore();
  const office = env.authenticatedContext('secretary').firestore();
  const parent = env.authenticatedContext('parent').firestore();
  const session = doc(mine, DATA + '/quest_remote/wand-session-1');
  await assertSucceeds(setDoc(session, remoteSession()));
  await assertSucceeds(updateDoc(session, { wandId: 'wand1', wandHeartbeatAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(session, { stage: { surface: 'overlay', pad: [{ id: 'p1', label: 'Go' }] }, secret: { quizCorrect: 2 } }));
  await assertFails(updateDoc(session, { grades: { 'student-1': 90 } }), 'unknown fields are refused');
  await assertSucceeds(getDocs(query(collection(mine, DATA + '/quest_remote'), where('teacherId', '==', 'teacher'))));
  for (const db of [other, office, parent]) {
    await assertFails(getDoc(doc(db, DATA + '/quest_remote/wand-session-1')));
    await assertFails(setDoc(doc(db, DATA + '/quest_remote/wand-session-1/commands/c1'), remoteCommand('other-teacher')));
  }
  await assertFails(setDoc(doc(other, DATA + '/quest_remote/stolen'), remoteSession('teacher')), 'cannot open a session in someone else\'s name');

  const cmd = doc(mine, DATA + '/quest_remote/wand-session-1/commands/c1');
  await assertSucceeds(setDoc(cmd, remoteCommand()));
  await assertSucceeds(getDoc(cmd));
  // The projector's live listener (remoteChannel.js#watchCommands): the query names the owner.
  const commands = collection(mine, DATA + '/quest_remote/wand-session-1/commands');
  await assertSucceeds(getDocs(query(commands, where('teacherId', '==', 'teacher'))));
  await assertFails(getDocs(query(commands)), 'an unfiltered list is refused (rules are not filters)');
  await assertFails(getDocs(query(collection(other, DATA + '/quest_remote/wand-session-1/commands'), where('teacherId', '==', 'teacher'))), 'nobody else can ask for your commands');
  await assertFails(updateDoc(cmd, { clientSeq: 2 }), 'commands are never edited');
  await assertSucceeds(deleteDoc(cmd));
  await assertSucceeds(setDoc(doc(mine, DATA + '/quest_remote/wand-session-1/commands/c6'),
    remoteCommand('teacher', { type: 'charm', payload: { action: 'sound', sound: 'tada' } })), 'Sound Charms and Look here travel as charm commands');
  await assertFails(setDoc(doc(mine, DATA + '/quest_remote/wand-session-1/commands/c2'), remoteCommand('teacher', { type: 'deleteEverything' })));
  await assertFails(setDoc(doc(mine, DATA + '/quest_remote/wand-session-1/commands/c3'), remoteCommand('teacher', { clientSeq: 'one' })));
  await assertFails(setDoc(doc(mine, DATA + '/quest_remote/wand-session-1/commands/c4'),
    remoteCommand('teacher', { payload: Object.fromEntries(Array.from({ length: 13 }, (_, i) => ['k' + i, i])) })), 'oversized payload');
  await assertFails(setDoc(doc(mine, DATA + '/quest_remote/wand-session-1/commands/c5'), remoteCommand('teacher', { extra: true })));
  await assertSucceeds(deleteDoc(session));
});

rulesTest('Quest Remote: Starter schools cannot start a Wand', async () => {
  await seedCampfire('starter');
  const mine = env.authenticatedContext('teacher').firestore();
  await assertFails(setDoc(doc(mine, DATA + '/quest_remote/starter-session'), remoteSession()));
});

rulesTest('Quest Remote: a teacher of another school never reaches this school\'s sessions', async () => {
  await seedCampfire('pro');
  await seedSchoolB({ tier: 'pro' });
  const mine = env.authenticatedContext('teacher').firestore();
  const teacherB = env.authenticatedContext('teacher-b').firestore();
  await assertSucceeds(setDoc(doc(mine, DATA + '/quest_remote/a-session'), remoteSession()));
  await assertFails(getDoc(doc(teacherB, DATA + '/quest_remote/a-session')));
  await assertFails(setDoc(doc(teacherB, DATA + '/quest_remote/a-session/commands/x'), remoteCommand('teacher-b')));
  await assertSucceeds(setDoc(doc(teacherB, DATA_B + '/quest_remote/b-session'), remoteSession('teacher-b')));
});
