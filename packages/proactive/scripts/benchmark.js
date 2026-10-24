import {evaluateReplay} from '../src/evaluate.js';
const now=Date.UTC(2026,9,24,2);
const cases=Array.from({length:1000},(_,i)=>({event:{id:String(i),source:'fixture',floor:i%10===0?'P0':'P2',observedAt:now,body:'fixture'},expected:i%10===0?'alert':'silence'}));
const report=evaluateReplay(cases,{clock:()=>now});
console.log(JSON.stringify({dataset:'synthetic 1000 scenarios; 100 critical; 900 routine',...report},null,2));
if(report.criticalRecall!==1 || report.accuracy!==1) process.exitCode=1;
