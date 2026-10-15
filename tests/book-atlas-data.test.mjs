import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOOK_ATLAS, getUnitWords, unitPageSets, describeUnit, unitForPage, pageRangeForUnit } from '../features/bookAtlas.mjs';
test('all ten books have unique, ordered, sourced units',()=>{
    assert.equal(BOOK_ATLAS.length,10);
    for(const gone of ['close-up-b1-plus','grammalysis-b2']) assert.ok(!BOOK_ATLAS.some(b=>b.id===gone),gone+' was retired');
    for(const b of BOOK_ATLAS){assert.ok(b.units.length);assert.equal(new Set(b.units.map(u=>u.n)).size,b.units.length);assert.ok(b.source);for(const u of b.units) if(u.pageRange)assert.ok(u.pageRange[0]<=u.pageRange[1]);}
});
test('page ranges map a unit to pages and back, and page-less books stay null',()=>{
    assert.deepEqual(pageRangeForUnit('primary-path-2',2),[28,49]);
    assert.equal(unitForPage('primary-path-2',28),2);
    assert.deepEqual(pageRangeForUnit('grammalysis-b1',1),[4,9]);
    assert.equal(unitForPage('grammalysis-b1',4,'grammar'),1);
    assert.deepEqual(pageRangeForUnit('bamboo',1),[6,7]);
    assert.equal(pageRangeForUnit('bamboo',1,'companion'),null);
    assert.equal(pageRangeForUnit('primary-path-2',999),null);
});
test('published third-edition Close-Up page ranges do not inherit old-edition contents',async()=>{
    assert.equal(unitForPage('close-up-b1',17),2);
    assert.equal(unitForPage('close-up-b1',137),12);
    assert.equal(unitForPage('close-up-b1',17,'wb'),null);
    for(const [file,count] of [['close-up-b1',1366]]){
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
    // Units are fixed-length: a stray page number in the wordlist never stretches or overlaps a unit.
    for(const id of ['primary-path-1','primary-path-2','primary-path-3']) BOOK_ATLAS.find(b=>b.id===id).units.forEach((u,i,all)=>{
        assert.equal(u.pages.sb[1]-u.pages.sb[0],21,id+' u'+u.n);
        if(i) assert.ok(u.pages.sb[0]>all[i-1].pages.sb[1]&&u.pages.wb[0]>all[i-1].pages.wb[1],id+' u'+u.n+' overlaps');
    });
    // Bamboo: Pupil's Book and Activity Book from the publisher's contents pages.
    assert.equal(unitForPage('bamboo',20,'sb'),6);
    assert.equal(unitForPage('bamboo',18,'wb'),6);
    assert.equal(unitForPage('bamboo',84,'sb'),30);
    assert.equal(describeUnit(BOOK_ATLAS,'bamboo',9).title,'Is it a hat?');
});
test('curated component maps fill a collection the publishers never published as scope',()=>{
    // Yeti: Pupil's Book, Activity Book and Language Booster each keep their own page numbers (publisher contents).
    assert.equal(unitForPage('yeti-2',80,'sb'),25);
    assert.equal(unitForPage('yeti-2',62,'wb'),25);
    assert.equal(unitForPage('yeti-2',80,'wb'),null);
    assert.equal(unitForPage('yeti-2',108,'companion'),25);
    assert.deepEqual(pageRangeForUnit('yeti-2',25,'companion'),[108,111]);
    assert.equal(unitForPage('yeti-2',112,'companion'),null,'a review page belongs to no lesson');
    assert.equal(describeUnit(BOOK_ATLAS,'yeti-2',13).title,"Tina's day");
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
    assert.equal(unitForPage('bamboo',16),null,'a story page belongs to no lesson');
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
test('the Language Booster gives each lesson its own words, never another lesson\'s',async()=>{
    for(let n=1;n<=30;n++){
        const lesson=new Set((await getUnitWords('yeti-2',n,{limit:Infinity})).map(w=>w.w));
        const data=JSON.parse(fs.readFileSync(new URL('../features/bookAtlas/data/yeti2.json',import.meta.url)));
        for(const w of data.companion[String(n)]||[]) assert.ok(lesson.has(w.w),'lesson '+n+' companion word '+w.w);
    }
    // Lesson 13 is daily routines, not food.
    const c13=(await getUnitWords('yeti-2',13,{component:'companion',limit:Infinity})).map(w=>w.w);
    assert.ok(c13.includes('get up')&&!c13.includes('omelette'));
});
test('an activity book or companion supplies words even when it has no list of its own',async()=>{
    for(const [id,unit] of [['yeti-2',5],['bamboo',4],['primary-path-2',3]]){
        const wb=await getUnitWords(id,unit,{component:'wb',limit:Infinity});
        const companion=await getUnitWords(id,unit,{component:'companion',limit:Infinity});
        assert.ok(wb.length&&companion.length,id);
    }
    // A CPP activity book leads with its own words, then the unit's Student's Book words, never twice.
    const wb=await getUnitWords('primary-path-2',3,{component:'wb',limit:Infinity});
    assert.equal(wb[0].component,'wb');
    assert.ok(wb.some(w=>w.component==='sb'));
    assert.equal(new Set(wb.map(w=>w.w.toLowerCase())).size,wb.length);
    // Activity book pages only ever narrow activity book words, and page sets show its own pages.
    const sets=await unitPageSets('primary-path-2',3,{component:'wb'});
    assert.ok(sets.length&&sets.every(s=>s.page>=23&&s.page<=32));
});
test('CPP wordlist fixes: words filed in the right unit, no impossible pages, Latin lesson codes',async()=>{
    for(const id of ['primary-path-1','primary-path-2','primary-path-3']) for(let u=1;u<=9;u++){
        const range=pageRangeForUnit(id,u,'wb');
        for(const w of await getUnitWords(id,u,{component:'wb',limit:Infinity})) if(w.component==='wb'&&w.page) assert.ok(w.page>=range[0]-3&&w.page<=range[1],id+' u'+u+' '+w.w+' p'+w.page);
        for(const w of await getUnitWords(id,u,{limit:Infinity})) assert.ok(!/[\u0370-\u03ff]/.test(w.location||''),id+' '+w.location);
    }
    assert.ok((await getUnitWords('primary-path-1',3,{limit:Infinity})).some(w=>w.w==='petal'));
    assert.ok(!(await getUnitWords('primary-path-1',4,{limit:Infinity})).some(w=>w.w==='petal'));
});
