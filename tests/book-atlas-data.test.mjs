import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOOK_ATLAS, getUnitWords, describeUnit, unitForPage } from '../features/bookAtlas.mjs';
test('all twelve books have unique, ordered, sourced units',()=>{
    assert.equal(BOOK_ATLAS.length,12);
    for(const b of BOOK_ATLAS){assert.ok(b.units.length);assert.equal(new Set(b.units.map(u=>u.n)).size,b.units.length);assert.ok(b.source);for(const u of b.units) if(u.pageRange)assert.ok(u.pageRange[0]<=u.pageRange[1]);}
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
