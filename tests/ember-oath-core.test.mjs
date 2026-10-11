import test from 'node:test';
import assert from 'node:assert/strict';
import { oathTemplates, suggestOaths, createOathDraft, evaluateOathEvidence, addOathCheckIn, checkInDay, isTriedItMoment, emberStory, emberTarget, buildOathKeepsake, oathDate } from '../features/emberOathCore.mjs';
import { publicEmberNote, mergePublishedEmber } from '../functions/campfireCore.cjs';
const draft = () => ({ id: 'oath', ...createOathDraft(oathTemplates('A')[5], { studentId: 's', classId: 'c', teacherId: 't', schoolYearKey: '2026-2027', date: '2026-09-20' }) });
const award = (id, date, extra = {}) => ({ id, studentId: 's', classId: 'c', schoolYearKey: '2026-2027', date, stars: 1, reason: 'Teamwork', ...extra });
test('all five bands provide six editable goal categories', () => {
    for (const league of ['Pre-Junior','Junior B','A','C','D']) {
        const bank = oathTemplates(league); assert.equal(bank.length,6); assert.equal(new Set(bank.map(o=>o.id)).size,6);
        assert.equal(suggestOaths({ league }).length,3);
    }
});
test('legacy lesson dates normalize before comparing with oath window', () => {
    assert.equal(oathDate('27-09-2026'),'2026-09-27');
    assert.equal(oathDate('27/09/2026'),'2026-09-27');
    assert.equal(oathDate('2026-09-27T12:00:00Z'),'2026-09-27');
    assert.equal(oathDate('nonsense'),'');
});
test('evidence uses the correct student, year, class and start date, deduplicated', () => {
    const oath = draft();
    const awards = [award('a','21-09-2026'), award('a','21-09-2026'), award('b','2026-09-22'),
        award('old','2026-09-19'), award('wrong','2026-09-23',{studentId:'other'}),
        award('class','2026-09-23',{classId:'other'}), award('year','2026-09-23',{schoolYearKey:'2025-2026'}),
        award('future','2026-10-01'), award('zero','2026-09-24',{stars:0})];
    let result = evaluateOathEvidence(oath,{awards,today:'2026-09-27'});
    assert.equal(result.count,2); assert.equal(result.ready,false);
    oath.checkIns = addOathCheckIn(oath,'flame','2026-09-27');
    result = evaluateOathEvidence(oath,{awards,today:'2026-09-27'}); assert.equal(result.ready,true);
    assert.equal(evaluateOathEvidence({...oath,status:'released'},{awards,today:'2026-09-27'}).ready,false);
});
test('one daily mood, bounded history, no hidden penalty for quiet days', () => {
    let oath = draft();
    for(let i=1;i<=20;i++) oath.checkIns=addOathCheckIn(oath,'moon','2026-09-'+String(i).padStart(2,'0'));
    assert.equal(oath.checkIns.length,12);
    oath.checkIns=addOathCheckIn(oath,'flame','2026-09-20'); assert.equal(oath.checkIns.length,12);
    assert.equal(oath.checkIns.at(-1).mood,'flame'); assert.throws(()=>addOathCheckIn({...oath,status:'kept'},'flame','2026-09-21'));
});
test('keepsake is stable and collectible only; every promise is shown as written', () => {
    const oath = draft(); oath.legendLine='Kept a promise: I help someone take a turn.';
    const item=buildOathKeepsake(oath,'2026-09-27');
    assert.equal(item.id,'ember_oath'); assert.equal(item.source,'ember_oath'); assert.equal(item.description,oath.legendLine);
    assert.equal(item.gold,undefined); assert.equal(item.stars,undefined);
    assert.equal(createOathDraft(oathTemplates('A')[0],{studentId:'s',classId:'c',teacherId:'t',schoolYearKey:'2026-2027',date:'2026-09-27',private:true}).projectorText,'I share an idea in English.');
    assert.equal(createOathDraft(oathTemplates('A')[0],{studentId:'s',classId:'c',teacherId:'t',schoolYearKey:'2026-2027',date:'2026-09-27'}).private,false);
});
test('family publication whitelists content and retry replaces the same note', () => {
    const note=publicEmberNote({oathId:'oath',summary:'A small promise kept.',date:'2026-09-27',schoolYearKey:'2026-2027',evidence:['private']});
    assert.equal(note.evidence,undefined);
    const notes=mergePublishedEmber(mergePublishedEmber([],note),{...note,body:'Updated.'});
    assert.equal(notes.length,1); assert.equal(notes[0].body,'Updated.');
    assert.throws(()=>publicEmberNote({oathId:'../private',summary:'text'}));
    assert.throws(()=>publicEmberNote({oathId:'valid',summary:'x'.repeat(501)}));
});
test('the embers rule: one per lesson day the promise is kept, all lit = ready', () => {
    // A 2-week promise has 3 embers, a 1-week promise 2, whatever the suggestion carried.
    assert.equal(emberTarget(1), 2); assert.equal(emberTarget(2), 3); assert.equal(emberTarget(4), 3);
    const make = (template, date) => ({ ...createOathDraft(template, { studentId: 's', classId: 'c', teacherId: 't', schoolYearKey: '2026-2027', date }), id: 'w' });
    assert.equal(make({ ...oathTemplates('A')[2], target: { kind: 'manual', count: 7 } }, '2026-10-09').target.count, 3);
    assert.equal(make(oathTemplates('Pre-Junior')[0], '2026-10-09').target.count, 2);
    const oath = make(oathTemplates('A')[2], '2026-10-09');
    assert.equal(evaluateOathEvidence(oath, { today: '2026-10-11' }).count, 0);
    // The exact shape the Campfire stored on 9 Oct: a 🔥 check-in and no evidence. It lights that day's ember.
    oath.checkIns = addOathCheckIn(oath, 'flame', '2026-10-09');
    let r = evaluateOathEvidence(oath, { today: '2026-10-16' });
    assert.equal(r.count, 1); assert.equal(r.ready, false);
    assert.equal(r.evidence[0].label, 'Tried it'); assert.equal(isTriedItMoment(r.evidence[0]), true);
    // Rules only accept the stored kinds, so keeping (which stores the evidence) is allowed.
    assert.ok(['manual', 'virtue', 'practice', 'quiz'].includes(r.evidence[0].kind));
    // A moment the teacher saw the same day adds to that day's story, not a second ember.
    oath.evidence = [{ kind: 'manual', label: 'Spoke up in English', date: '2026-10-09', refId: '2026-10-09:Spoke up in English' }];
    r = evaluateOathEvidence(oath, { today: '2026-10-16' });
    assert.equal(r.count, 1);
    assert.deepEqual(emberStory(r.days), [{ date: '2026-10-09', icons: '🔥✍️', text: 'Tried it · Spoke up in English' }]);
    // A seen moment on another day lights its own ember; a third lesson's 🔥 fills the promise. No extra rule.
    oath.evidence.push({ kind: 'manual', label: 'Asked a question in English', date: '2026-10-14', refId: '2026-10-14:Asked' });
    oath.checkIns = addOathCheckIn(oath, 'flame', '2026-10-16');
    r = evaluateOathEvidence(oath, { today: '2026-10-16' });
    assert.equal(r.count, 3); assert.equal(r.ready, true);
    // "A little" / "Not today" never take an ember away, but changing a 🔥 does take that day's back.
    oath.checkIns = addOathCheckIn(oath, 'candle', '2026-10-16');
    r = evaluateOathEvidence(oath, { today: '2026-10-16' });
    assert.equal(r.count, 2); assert.equal(r.ready, false);
    // Stored evidence (after keeping) and the 🔥 it came from are the same ember.
    const stored = { ...oath, evidence: [...oath.evidence, { kind: 'manual', label: 'Tried it', date: '2026-10-09', refId: 'checkin:2026-10-09' }] };
    assert.equal(evaluateOathEvidence(stored, { today: '2026-10-16' }).count, 2);
    // Quiet days and check-ins outside the promise window light nothing.
    assert.equal(evaluateOathEvidence({ ...oath, evidence: [], checkIns: [{ date: '2026-10-08', mood: 'flame' }, { date: '2026-10-10', mood: 'moon' }] }, { today: '2026-10-16' }).count, 0);
});
test('a virtue promise: several stars in one lesson are one ember, so it grows over lessons', () => {
    const oath = draft(); // Teamwork, 2 weeks → 3 embers
    const sameDay = [award('x1', '2026-09-21'), award('x2', '2026-09-21'), award('x3', '2026-09-21')];
    assert.equal(evaluateOathEvidence(oath, { awards: sameDay, today: '2026-09-27' }).count, 1);
});
test('a check-in lands on the Campfire lesson day, never a future or pre-promise day', () => {
    const oath = { startDate: '2026-10-09' };
    assert.equal(checkInDay(oath, '2026-10-10', '2026-10-11'), '2026-10-10');
    assert.equal(checkInDay(oath, '2026-10-12', '2026-10-11'), '2026-10-11');
    assert.equal(checkInDay(oath, '2026-10-08', '2026-10-11'), '2026-10-11');
    assert.equal(checkInDay(oath, '', '2026-10-11'), '2026-10-11');
    assert.equal(checkInDay(oath, 'nonsense', '2026-10-11'), '2026-10-11');
});
test('the light evidence module is the same rule the Oath Board uses', async () => {
    const light = await import('../features/emberOathEvidence.mjs');
    assert.equal(light.evaluateOathEvidence, evaluateOathEvidence);
    // A virtue promise fills from stars alone (three lessons with a Teamwork star): the entry badge must see it as ready too.
    assert.equal(light.evaluateOathEvidence(draft(), { awards: [award('a1', '21-09-2026'), award('a2', '22-09-2026'), award('a3', '23-09-2026')], today: '2026-09-23' }).ready, true);
});
