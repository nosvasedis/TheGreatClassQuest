import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOOK_ATLAS, getUnitWords, unitPageSets, describeUnit, unitForPage, pageRangeForUnit } from '../features/bookAtlas.mjs';
test('all twelve books have unique, ordered, sourced units',()=>{
    assert.equal(BOOK_ATLAS.length,12);
    for(const b of BOOK_ATLAS){assert.ok(b.units.length);assert.equal(new Set(b.units.map(u=>u.n)).size,b.units.length);assert.ok(b.source);for(const u of b.units) if(u.pageRange)assert.ok(u.pageRange[0]<=u.pageRange[1]);}
});
test('page ranges map a unit to pages and back, and page-less books stay null',()=>{
    assert.deepEqual(pageRangeForUnit('primary-path-2',2),[28,49]);
    assert.equal(unitForPage('primary-path-2',28),2);
    assert.deepEqual(pageRangeForUnit('grammalysis-b1',1),[4,9]);
    assert.equal(unitForPage('grammalysis-b1',4,'grammar'),1);
    assert.equal(pageRangeForUnit('bamboo',1),null);
    assert.equal(pageRangeForUnit('primary-path-2',999),null);
});
test('published third-edition Close-Up page ranges do not inherit old-edition contents',async()=>{
    assert.equal(unitForPage('close-up-b1',17),2);
    assert.equal(unitForPage('close-up-b1',137),12);
    assert.equal(unitForPage('close-up-b1',17,'wb'),null);
    for(const [file,count] of [['close-up-b1',1366],['close-up-b1-plus',1566]]){
        const data=JSON.parse(fs.readFileSync(new URL('../features/bookAtlas/data/'+file+'.json',import.meta.url)));
        assert.equal(Object.values(data.units).flat().length,count);
        const words=await getUnitWords(file,2,{limit:8});assert.equal(words.length,8);assert.ok(words.every(w=>w.w));
    }
});
test('every part of a collection maps its own pages to the unit',()=>{
    // CPP derives Student's Book and Activity Book ranges from the school wordlist CSV.
    for(const id of ['primary-path-1','primary-path-2','primary-path-3']){
        const book=BOOK_ATLAS.find(b=>b.id===id);
        assert.ok(book.units.every(u=>Array.isArray(u.pages?.sb)),id+' sb');
        assert.ok(book.units.every(u=>Array.isArray(u.pages?.wb)),id+' wb');
        for(const u of book.units){
            assert.equal(unitForPage(id,u.pages.sb[0],'sb'),u.n,id+' sb u'+u.n);
            assert.equal(unitForPage(id,u.pages.wb[0],'wb'),u.n,id+' wb u'+u.n);
            assert.deepEqual(pageRangeForUnit(id,u.n,'wb'),u.pages.wb);
        }
    }
    // A page-only book (Bamboo) still has no invented map, in any part.
    assert.equal(pageRangeForUnit('bamboo',1,'sb'),null);
    assert.equal(pageRangeForUnit('bamboo',1,'wb'),null);
});
test('curated component maps fill a collection the publishers never published as scope',()=>{
    // Yeti: Pupil's Book + Activity Book (page-for-page) + Language Booster (companion), from the samples.
    assert.equal(unitForPage('yeti-2',80,'sb'),25);
    assert.equal(unitForPage('yeti-2',80,'wb'),25);
    assert.equal(unitForPage('yeti-2',108,'companion'),25);
    assert.deepEqual(pageRangeForUnit('yeti-2',25,'companion'),[108,112]);
    for(const u of BOOK_ATLAS.find(b=>b.id==='yeti-2').units){
        assert.ok(u.pages.sb&&u.pages.wb&&u.pages.companion,'yeti unit '+u.n+' has all parts');
    }
    // A real atlas still only contains real ranges.
    for(const b of BOOK_ATLAS) for(const u of b.units) for(const [part,range] of Object.entries(u.pages||{}))
        assert.ok(Array.isArray(range)&&range[0]<=range[1],b.id+' u'+u.n+' '+part);
});
test('CPP lesson and page ordering prefers the precise requested content',async()=>{
    for(const id of ['primary-path-1','primary-path-2','primary-path-3']){
        const words=await getUnitWords(id,1,{lessonCode:'1a',limit:5});assert.equal(words.length,5);assert.ok(words.every(w=>w.location.toLowerCase()==='1a'));
        assert.equal(describeUnit(BOOK_ATLAS,id,1).n,1);
    }
});
test('OCR sources never invent a printed page map and companion stays separate',async()=>{
    assert.equal(unitForPage('bamboo',10),null);
    const sb=await getUnitWords('yeti-2',1), companion=await getUnitWords('yeti-2',1,{component:'companion'});
    assert.ok(sb.length&&companion.length);assert.notDeepEqual(sb,companion);
    assert.deepEqual(await getUnitWords('custom',2),[]);
    assert.equal(BOOK_ATLAS.find(b=>b.id==='burlington-grammar-3')?.units.length,26);
});
test('a senior unit returns only the assigned page set, while a junior book stays whole-unit',async()=>{
    const whole=await getUnitWords('close-up-b1',3,{limit:Infinity});
    const set=await getUnitWords('close-up-b1',3,{pages:[30],limit:Infinity});
    assert.ok(set.length&&set.length<whole.length,'page set is a strict subset of the unit');
    assert.ok(set.every(w=>w.page===30),'only pages in the assigned set');
    assert.deepEqual((await unitPageSets('close-up-b1',3)).slice(0,2).map(s=>s.page),[29,30]);
    // Junior courses teach the whole lesson at once: an unpinned page keeps the whole unit.
    const yetiWhole=await getUnitWords('yeti-2',1,{limit:Infinity});
    assert.equal(yetiWhole.length,(await getUnitWords('yeti-2',1,{pages:[80],limit:Infinity})).length);
    assert.deepEqual(await unitPageSets('yeti-2',1),[]);
});
