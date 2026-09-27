import test from 'node:test';
import assert from 'node:assert/strict';
import { oathTemplates, suggestOaths, createOathDraft, evaluateOathEvidence, addOathCheckIn, buildOathKeepsake, oathDate } from '../features/emberOathCore.mjs';
import { publicEmberNote, mergePublishedEmber } from '../functions/campfireCore.cjs';
const draft = () => ({ id: 'oath', ...createOathDraft(oathTemplates('A')[5], { studentId: 's', classId: 'c', teacherId: 't', schoolYearKey: '2026-2027', date: '2026-09-20' }) });
const award = (id, date, extra = {}) => ({ id, studentId: 's', classId: 'c', schoolYearKey: '2026-2027', date, stars: 1, reason: 'Teamwork', ...extra });
test('all five bands provide six editable goal categories', () => {
    for (const league of ['Nursery','Junior B','A','E','Proficiency']) {
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
test('keepsake is stable, collectible only, and private copy stays discreet', () => {
    const oath = draft(); oath.private=true; oath.legendLine='Kept a personal promise with care.';
    const item=buildOathKeepsake(oath,'2026-09-27');
    assert.equal(item.id,'ember_oath'); assert.equal(item.source,'ember_oath'); assert.equal(item.description,oath.legendLine);
    assert.equal(item.gold,undefined); assert.equal(item.stars,undefined);
    assert.equal(createOathDraft(oathTemplates('A')[0],{studentId:'s',classId:'c',teacherId:'t',schoolYearKey:'2026-2027',date:'2026-09-27',private:true}).projectorText,'A secret oath');
});
test('family publication whitelists content and retry replaces the same note', () => {
    const note=publicEmberNote({oathId:'oath',summary:'A small promise kept.',date:'2026-09-27',schoolYearKey:'2026-2027',evidence:['private']});
    assert.equal(note.evidence,undefined);
    const notes=mergePublishedEmber(mergePublishedEmber([],note),{...note,body:'Updated.'});
    assert.equal(notes.length,1); assert.equal(notes[0].body,'Updated.');
    assert.throws(()=>publicEmberNote({oathId:'../private',summary:'text'}));
    assert.throws(()=>publicEmberNote({oathId:'valid',summary:'x'.repeat(501)}));
});
