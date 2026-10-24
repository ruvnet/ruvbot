import { createHash, randomUUID } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = value => structuredClone(value);
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 256;

/** Single-process reference runtime. Production hosts own durable storage and identity. */
export class ProactiveBot {
  #seen = new Map(); #packets = new Map(); #audit = []; #rules = []; #cursors = Object.create(null); #store; #broken = false; #closed = false;
  constructor({ clock = Date.now, maxEvents = 100, maxPrepared = 10, ttlMs = 3600000, shadow = true, promotionGate, store, maxHistory = 10000, quietHours, maxEventAgeMs = 86400000 }  = {}) {
    if (![maxEvents, maxPrepared, ttlMs, maxHistory, maxEventAgeMs].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('invalid budget');
    if (quietHours && (!Number.isInteger(quietHours.start) || !Number.isInteger(quietHours.end) || quietHours.start < 0 || quietHours.start > 23 || quietHours.end < 0 || quietHours.end > 23 || !Number.isInteger(quietHours.offsetMinutes) || Math.abs(quietHours.offsetMinutes) > 840)) throw new Error('invalid quiet hours');
    this.maxHistory=maxHistory; this.quietHours=quietHours; this.maxEventAgeMs=maxEventAgeMs; this.#store=store;
    if(store) {
      const state=store.load();
      if(state) {
        if(state.version!==1 || !Array.isArray(state.seen) || !Array.isArray(state.packets) || !Array.isArray(state.audit) || !Array.isArray(state.rules) || !state.cursors || typeof state.cursors!=='object') throw new Error('invalid state snapshot');
        this.#seen=new Map(state.seen);this.#packets=new Map(state.packets);this.#audit=state.audit;this.#rules=state.rules;this.#cursors=Object.assign(Object.create(null),state.cursors);
        for(const [id,packet] of this.#packets) {
          if(!packet || packet.id!==id || !validId(id) || !packet.action || packet.digest!==hash(packet.action) || !Number.isFinite(packet.expiresAt) || !['pending','approved','executing','uncertain','executed','failed','skipped','expired','superseded'].includes(packet.status) || (packet.status==='approved' && !validId(packet.actor))) throw new Error('corrupt approval snapshot');
          if(packet.status==='executing') packet.status='uncertain';
        }
      }
    }
    this.promotionGate = promotionGate; this.clock = clock; this.maxEvents = maxEvents; this.maxPrepared = maxPrepared; this.ttlMs = ttlMs; this.shadow = shadow;
  }
  get audit() { return copy(this.#audit); }
  get proposals() { return copy(this.#rules); }
  #ready() { if(this.#broken || this.#closed) throw new Error('runtime closed or persistence failed'); }
  #save() {
    try {this.#store?.save({version:1,seen:[...this.#seen],packets:[...this.#packets],audit:this.#audit,rules:this.#rules,cursors:this.#cursors});}
    catch(error) {this.#broken=true;throw error;}
  }
  #record(type, id) {
    this.#audit.push({ type, id, at: this.clock() });
    if(this.#audit.length>this.maxHistory) this.#audit.shift();
    this.#save();
  }
  get cursors() {return copy(this.#cursors);}
  get packets() {return copy([...this.#packets.values()]);}
  close() {this.#closed=true;this.#store?.close();}
  #expire() {
    for(const p of this.#packets.values()) if(['pending','approved'].includes(p.status) && p.expiresAt<=this.clock()) p.status='expired';
    for(const [key,at] of this.#seen) if(at < this.clock()-this.maxEventAgeMs) this.#seen.delete(key);
  }
  /** Connector envelopes are host-authenticated. Body text never supplies severity or policy. */
  watch(events, checkpoint) {
    this.#ready();
    if (!Array.isArray(events) || events.length > this.maxEvents) throw new Error('event budget exceeded');
    if(checkpoint && (!validId(checkpoint.source) || !validId(checkpoint.cursor) || events.some(e=>e.source!==checkpoint.source))) throw new Error('invalid checkpoint');
    // Validate the entire batch before advancing any cursor or deduplication state.
    for(const e of events) if(!e || !validId(e.id) || !validId(e.source) || !['P0','P1','P2'].includes(e.floor) || !Number.isFinite(e.observedAt) || typeof e.body!=='string' || e.body.length>65536 || e.observedAt>this.clock()+300000) throw new Error('invalid event');
    this.#expire();
    const additions=new Set(events.filter(e=>e.observedAt>=this.clock()-this.maxEventAgeMs).map(e=>JSON.stringify([e.source,e.id])).filter(k=>!this.#seen.has(k)));
    if(this.#seen.size+additions.size>this.maxHistory) throw new Error('deduplication history budget exceeded');
    const accepted = [];
    for (const event of events) {
      if (!validId(event.id) || !validId(event.source) || !['P0','P1','P2'].includes(event.floor) || !Number.isFinite(event.observedAt) || typeof event.body !== 'string' || event.body.length > 65536) throw new Error('invalid event');
      const key = JSON.stringify([event.source, event.id]);
      if (event.observedAt >= this.clock()-this.maxEventAgeMs && !this.#seen.has(key)) { this.#seen.set(key, this.clock()); accepted.push(copy(event)); this.#record('observed', key); }
    }
if(this.#seen.size>this.maxHistory) {this.#broken=true;throw new Error('deduplication history budget exceeded');}
    if(checkpoint) {this.#cursors[checkpoint.source]=checkpoint.cursor;this.#save();}
    return accepted;
  }
  judge(event, suggested = 'P2') {
    const levels = ['P0','P1','P2'];
    if (!levels.includes(event.floor) || !levels.includes(suggested)) throw new Error('invalid severity');
    return levels[Math.min(levels.indexOf(event.floor), levels.indexOf(suggested))];
  }
  speak(event, severity = this.judge(event)) {
    severity = this.judge(event, severity);
    if (severity === 'P0') return 'alert';
    if (severity === 'P1') return Number.isFinite(event.deadline) && event.deadline - this.clock() < 10800000 ? 'alert' : (this.#isQuiet() ? 'defer' : 'brief');
    return 'silence';
  }
  #isQuiet() {
    if(!this.quietHours) return false;
    const {start,end,offsetMinutes}=this.quietHours;
    const hour=new Date(this.clock()+offsetMinutes*60000).getUTCHours();
    return start===end || (start<end ? hour>=start && hour<end : hour>=start || hour<end);
  }
  prepare({ kind, target, payload }) {
    this.#ready();this.#expire();
    if(this.#packets.size>=this.maxHistory) throw new Error('packet history budget exceeded');
    if (!validId(kind) || !validId(target) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid action');
    if ([...this.#packets.values()].filter(p => ['pending','approved','executing'].includes(p.status)).length >= this.maxPrepared) throw new Error('preparation budget exceeded');
    const action = JSON.parse(JSON.stringify({ kind, target, payload }));
    if (JSON.stringify(action).length > 65536) throw new Error('action too large');
    const packet = { id: randomUUID(), action, digest: hash(action), expiresAt: this.clock() + this.ttlMs, status: 'pending' };
    this.#packets.set(packet.id, packet); this.#record('prepared', packet.id); return copy(packet);
  }
  /** Call only behind host authentication; the actor string itself is not authentication. */
  approve(id, digest, actor) {
    this.#ready();
    const p = this.#packets.get(id);
    if (!p || p.status !== 'pending' || p.expiresAt <= this.clock() || p.digest !== digest || !validId(actor)) throw new Error('approval rejected');
    p.status = 'approved'; p.actor = actor; this.#record('approved', id);
  }
  skip(id) {
    this.#ready();
    const p = this.#packets.get(id);
    if (!p || !['pending','approved'].includes(p.status)) throw new Error('skip rejected');
    p.status = 'skipped'; this.#record('skipped', id);
  }
  async execute(id, { allow, defend, dispatch }) {
    this.#ready();
    const p = this.#packets.get(id);
    if (!p || p.status !== 'approved' || p.expiresAt <= this.clock() || this.shadow) throw new Error('execution blocked');
    // Consume before the first await: concurrent attempts cannot dispatch twice.
    p.status = 'executing'; this.#record('executing', id);
    try {
      if ((await allow(copy(p.action), p.actor)) !== true || (await defend(copy(p.action))) !== true) throw new Error('policy blocked');
      this.#ready();
      if (p.expiresAt <= this.clock()) throw new Error('approval expired');
      await dispatch(copy(p.action), { idempotencyKey: p.id });
      p.status = 'executed'; this.#record('executed', id);
    } catch (error) {
      // No automatic retry after ambiguous external failure.
      p.status = 'failed'; this.#record('failed', id); throw error;
    }
  }
  edit(id, digest, replacement) {
    this.#ready();const p=this.#packets.get(id);
    if(!p || !['pending','approved'].includes(p.status) || p.digest!==digest || p.expiresAt<=this.clock()) throw new Error('edit rejected');
    // Revoke before creating a replacement: even a failed edit cannot retain approval.
    p.status='superseded';this.#record('superseded',id);
    return this.prepare(replacement);
  }
  learn({ candidate, parent, safety, regressions, rule }) {
    this.#ready();
    if(this.#rules.length>=this.maxHistory) throw new Error('proposal history budget exceeded');
    if (![candidate,parent,safety,regressions].every(Number.isFinite) || candidate <= parent || safety < .95 || safety > 1 || regressions !== 0 || typeof rule !== 'string' || !rule.trim() || rule.length > 4096) return false;
    if (this.promotionGate && !this.promotionGate({candidate,parent,safety,regressions})) return false;
    this.#rules.push({ rule, candidate, parent, safety, regressions, status: 'proposed' });
    this.#record('rule-proposed', String(this.#rules.length)); return true;
  }
}
export function replay(bot, events) {
  return bot.watch(events).map(e => ({ id: e.id, source: e.source, severity: bot.judge(e), route: bot.speak(e) }));
}
