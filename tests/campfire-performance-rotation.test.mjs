import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFairRotation } from '../utils/fairRotation.mjs';
import { getDevicePerformance } from '../utils/devicePerformance.mjs';
import { createFirePool, stepParticle, governFire } from '../features/campfire/fireParticlesCore.mjs';
test('single hero rotation preserves protagonist override and avoids last hero after cycle reset',()=>{
    const result=pickFairRotation({presentIds:['a','b','c'],cycleIds:['a','b','c','absent'],lastIds:['a'],random:()=>0});
    assert.deepEqual(result.selectedIds,['b']);assert.deepEqual(result.cycleIds,['b']);
    const forced=pickFairRotation({presentIds:['a','b'],cycleIds:['a'],priorityIds:['a'],random:()=>0});
    assert.deepEqual(forced.selectedIds,['a']);assert.deepEqual(forced.cycleIds,['a']);
    const circle=pickFairRotation({presentIds:['a','b','c','d','e'],count:4,random:()=>0});
    assert.equal(new Set(circle.selectedIds).size,4);
    assert.deepEqual(pickFairRotation({presentIds:[],count:4}).selectedIds,[]);
});
test('constrained laptops and reduced motion choose low cost; high needs evidence',()=>{
    for(const hint of [{cores:2},{memory:4},{reducedMotion:true},{userAgent:'Android'},{coarsePointer:true,narrowViewport:true}]) assert.equal(getDevicePerformance(hint).tier,'low');
    assert.equal(getDevicePerformance({cores:8,memory:8}).particles,140);
    assert.equal(getDevicePerformance({}).particles,90);
});
test('particle pool keeps object identity and finite geometry over many frames',()=>{
    const pool=createFirePool(50,()=>.4), identities=[...pool];
    for(let frame=0;frame<400;frame++) for(const p of pool){const s=stepParticle(p,1/30,1,()=>.4);assert.ok(Number.isFinite(s.x+s.y+s.size));assert.ok(s.alpha>=0&&s.alpha<=1);}
    pool.forEach((p,i)=>assert.equal(p,identities[i]));
});
test('governor sheds load after two slow seconds and recovers only after ten fast seconds',()=>{
    let s={limit:140}; for(let i=0;i<61;i++) s=governFire(s,34,1/30,140); assert.equal(s.limit,98);
    for(let i=0;i<100;i++)s=governFire(s,16,1/60,140);assert.equal(s.limit,98);
    for(let i=0;i<601;i++)s=governFire(s,16,1/60,140);assert.equal(s.limit,108);
    for(let i=0;i<1000;i++)s=governFire(s,50,.05,140);assert.equal(s.limit,30);
});
