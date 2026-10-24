import { performance } from 'node:perf_hooks';
import { ProactiveBot, replay } from './index.js';

/** Offline labelled replay; never dispatches actions or calls a model. */
export function evaluateReplay(cases, options = {}) {
  if(!Array.isArray(cases) || cases.length===0 || cases.length>10000) throw new Error('invalid replay dataset');
  let critical=0,caught=0,alerts=0,trueAlerts=0,correct=0;
  const errors=[];const start=performance.now();
  // Independent scenarios avoid accidental deduplication between fixtures.
  for(const scenario of cases) {
    if(!scenario || !['alert','brief','defer','silence'].includes(scenario.expected)) throw new Error('invalid expected route');
    const bot=new ProactiveBot({...options,shadow:true,store:undefined});
    const decision=replay(bot,[scenario.event])[0];const route=decision?.route ?? 'silence';
    if(scenario.event.floor==='P0') {critical++;if(route==='alert') caught++;}
    if(route==='alert') {alerts++;if(scenario.expected==='alert') trueAlerts++;}
    if(route===scenario.expected) correct++;else errors.push({id:scenario.event.id,expected:scenario.expected,actual:route});
  }
  return {cases:cases.length,criticalRecall:critical?caught/critical:null,alertPrecision:alerts?trueAlerts/alerts:null,accuracy:correct/cases.length,alerts,errors,elapsedMs:performance.now()-start};
}
