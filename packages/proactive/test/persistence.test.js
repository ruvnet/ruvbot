import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStore} from '../src/store.js';
import {ProactiveBot,replay} from '../src/index.js';
const action={kind:'email',target:'contact:123',payload:{subject:'draft'}};
const event=(extra={})=>({id:'1',source:'monitor',observedAt:1000,floor:'P1',body:'untrusted text',...extra});
const setup=()=>{const root=mkdtempSync(join(tmpdir(),'ruvbot-'));return {root,path:join(root,'state')};};
test('restart retains cursors, deduplication and approvals; private atomic snapshot',async()=>{
  const {root,path}=setup();try {
    let bot=new ProactiveBot({store:new FileStore(path),clock:()=>1000,shadow:false});
    bot.watch([event()],{source:'monitor',cursor:'next'});const p=bot.prepare(action);bot.approve(p.id,p.digest,'user');bot.close();
    assert.equal(statSync(join(path,'state.json')).mode&0o777,0o600);
    bot=new ProactiveBot({store:new FileStore(path),clock:()=>1000,shadow:false});
    assert.equal(bot.cursors.monitor,'next');assert.deepEqual(bot.watch([event()]),[]);
    let calls=0;await bot.execute(p.id,{allow:()=>true,defend:()=>true,dispatch:()=>{calls++;}});bot.close();
    bot=new ProactiveBot({store:new FileStore(path),clock:()=>1000,shadow:false});
    await assert.rejects(bot.execute(p.id,{dispatch:()=>{calls++;}}));assert.equal(calls,1);bot.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('single writer lock blocks second process owner',()=>{
  const {root,path}=setup();try {const store=new FileStore(path);assert.throws(()=>new FileStore(path));store.close();new FileStore(path).close();}finally{rmSync(root,{recursive:true,force:true});}
});
test('interrupted dispatch becomes uncertain and never automatically retries',async()=>{
  const {root,path}=setup();try {
    let bot=new ProactiveBot({store:new FileStore(path),clock:()=>1000,shadow:false});const p=bot.prepare(action);bot.approve(p.id,p.digest,'user');
    // Persisted executing is the crash window between claim and dispatch receipt.
    const snapshot=JSON.parse(readFileSync(join(path,'state.json')));snapshot.packets[0][1].status='executing';bot.close();writeFileSync(join(path,'state.json'),JSON.stringify(snapshot));
    bot=new ProactiveBot({store:new FileStore(path),clock:()=>1000,shadow:false});assert.equal(bot.packets[0].status,'uncertain');await assert.rejects(bot.execute(p.id,{dispatch:()=>assert.fail()}));bot.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('failed persistence halts runtime before dispatch',async()=>{
  let saves=0;const bot=new ProactiveBot({shadow:false,store:{load:()=>null,save:()=>{if(++saves===3)throw Error('disk full');}}});
  const p=bot.prepare(action);bot.approve(p.id,p.digest,'user');await assert.rejects(bot.execute(p.id,{allow:()=>true,defend:()=>true,dispatch:()=>assert.fail()}));assert.throws(()=>bot.prepare(action));
});
test('edits revoke old approval and require new approval',async()=>{
  const bot=new ProactiveBot({shadow:false});const p=bot.prepare(action);bot.approve(p.id,p.digest,'user');
  const next=bot.edit(p.id,p.digest,{...action,payload:{subject:'edited'}});assert.notEqual(p.digest,next.digest);
  await assert.rejects(bot.execute(p.id,{dispatch:()=>assert.fail()}));await assert.rejects(bot.execute(next.id,{dispatch:()=>assert.fail()}));
});
test('expired packets no longer exhaust preparation slots',()=>{
  let now=0;const bot=new ProactiveBot({clock:()=>now,ttlMs:5,maxPrepared:1});bot.prepare(action);now=6;assert.ok(bot.prepare(action));assert.equal(bot.packets[0].status,'expired');
});
test('quiet hours defer nonurgent briefs but preserve P0 and imminent deadlines',()=>{
  const clock=()=>Date.UTC(2026,9,24,2);const bot=new ProactiveBot({clock,quietHours:{start:22,end:7,offsetMinutes:0}});
  assert.equal(bot.speak(event()),'defer');assert.equal(bot.speak(event({floor:'P0'}),'P2'),'alert');
  assert.equal(bot.speak(event({deadline:clock()+3600000})),'alert');assert.equal(bot.speak(event({floor:'P2'})),'silence');
});
test('batch validation is atomic and stale input is ignored',()=>{
  const bot=new ProactiveBot({clock:()=>1000,maxEventAgeMs:100});
  assert.throws(()=>bot.watch([event(),event({id:'bad',floor:'bad'})],{source:'monitor',cursor:'new'}));assert.deepEqual(bot.cursors,{});
  assert.equal(bot.watch([event()]).length,1);assert.equal(bot.watch([event({id:'stale',observedAt:0})]).length,0);
});
test('history bounds reject additions without losing existing deduplication',()=>{
  const bot=new ProactiveBot({clock:()=>1000,maxHistory:1});bot.watch([event()]);assert.throws(()=>bot.watch([event({id:'2'})]));assert.deepEqual(bot.watch([event()]),[]);assert.equal(bot.audit.length,1);
});
test('labelled replay reports critical recall, precision and routing errors',async()=>{
  const {evaluateReplay}=await import('../src/evaluate.js');
  const report=evaluateReplay([{event:event({floor:'P0'}),expected:'alert'},{event:event({floor:'P2'}),expected:'silence'}],{clock:()=>1000});
  assert.equal(report.criticalRecall,1);assert.equal(report.alertPrecision,1);assert.equal(report.accuracy,1);
  const noisy=evaluateReplay([{event:event({floor:'P0'}),expected:'silence'}],{clock:()=>1000});assert.equal(noisy.alertPrecision,0);assert.equal(noisy.errors.length,1);
});
test('corrupt action digest fails closed on startup',()=>{
  const {root,path}=setup();try {
    const bot=new ProactiveBot({store:new FileStore(path)});bot.prepare(action);bot.close();
    const snapshot=JSON.parse(readFileSync(join(path,'state.json')));snapshot.packets[0][1].action.payload.subject='tampered';writeFileSync(join(path,'state.json'),JSON.stringify(snapshot));
    const store=new FileStore(path);assert.throws(()=>new ProactiveBot({store}));store.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('actual process exit during dispatch retains uncertain receipt and stale lock',async()=>{
  const {spawnSync}=await import('node:child_process');const {rmdirSync}=await import('node:fs');
  const {root,path}=setup();try {
    const runtime=new URL('../src/index.js',import.meta.url).href;const storage=new URL('../src/store.js',import.meta.url).href;
    const script=`import {ProactiveBot} from ${JSON.stringify(runtime)};import {FileStore} from ${JSON.stringify(storage)};const bot=new ProactiveBot({store:new FileStore(${JSON.stringify(path)}),shadow:false});const p=bot.prepare(${JSON.stringify(action)});bot.approve(p.id,p.digest,'user');await bot.execute(p.id,{allow:()=>true,defend:()=>true,dispatch:()=>process.exit(0)});`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:5000,encoding:'utf8'});assert.equal(child.status,0,child.stderr);
    assert.throws(()=>new FileStore(path));
    // Confirmed child exit permits explicit operator recovery.
    rmdirSync(join(path,'.writer-lock'));const bot=new ProactiveBot({store:new FileStore(path),shadow:false});const p=bot.packets[0];assert.equal(p.status,'uncertain');await assert.rejects(bot.execute(p.id,{dispatch:()=>assert.fail()}));bot.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});
