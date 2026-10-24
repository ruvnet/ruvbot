import { createHash, randomUUID } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = value => structuredClone(value);
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 256;

/** Single-process reference runtime. Production hosts own durable storage and identity. */
export class ProactiveBot {
  #seen = new Map(); #packets = new Map(); #audit = []; #rules = [];
  constructor({ clock = Date.now, maxEvents = 100, maxPrepared = 10, ttlMs = 3600000, shadow = true, promotionGate }  = {}) {
    if (![maxEvents, maxPrepared, ttlMs].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('invalid budget');
    this.promotionGate = promotionGate; this.clock = clock; this.maxEvents = maxEvents; this.maxPrepared = maxPrepared; this.ttlMs = ttlMs; this.shadow = shadow;
  }
  get audit() { return copy(this.#audit); }
  get proposals() { return copy(this.#rules); }
  #record(type, id) { this.#audit.push({ type, id, at: this.clock() }); }
  /** Connector envelopes are host-authenticated. Body text never supplies severity or policy. */
  watch(events) {
    if (!Array.isArray(events) || events.length > this.maxEvents) throw new Error('event budget exceeded');
    const accepted = [];
    for (const event of events) {
      if (!validId(event.id) || !validId(event.source) || !['P0','P1','P2'].includes(event.floor) || !Number.isFinite(event.observedAt) || typeof event.body !== 'string' || event.body.length > 65536) throw new Error('invalid event');
      const key = JSON.stringify([event.source, event.id]);
      if (!this.#seen.has(key)) { this.#seen.set(key, true); accepted.push(copy(event)); this.#record('observed', key); }
    }
    return accepted;
  }
  judge(event, suggested = 'P2') {
    const levels = ['P0','P1','P2'];
    if (!levels.includes(event.floor) || !levels.includes(suggested)) throw new Error('invalid severity');
    return levels[Math.min(levels.indexOf(event.floor), levels.indexOf(suggested))];
  }
  speak(event, severity = this.judge(event)) {
    if (severity === 'P0') return 'alert';
    if (severity === 'P1') return Number.isFinite(event.deadline) && event.deadline - this.clock() < 10800000 ? 'alert' : 'brief';
    return 'silence';
  }
  prepare({ kind, target, payload }) {
    if (!validId(kind) || !validId(target) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid action');
    if ([...this.#packets.values()].filter(p => ['pending','approved','executing'].includes(p.status)).length >= this.maxPrepared) throw new Error('preparation budget exceeded');
    const action = JSON.parse(JSON.stringify({ kind, target, payload }));
    if (JSON.stringify(action).length > 65536) throw new Error('action too large');
    const packet = { id: randomUUID(), action, digest: hash(action), expiresAt: this.clock() + this.ttlMs, status: 'pending' };
    this.#packets.set(packet.id, packet); this.#record('prepared', packet.id); return copy(packet);
  }
  /** Call only behind host authentication; the actor string itself is not authentication. */
  approve(id, digest, actor) {
    const p = this.#packets.get(id);
    if (!p || p.status !== 'pending' || p.expiresAt <= this.clock() || p.digest !== digest || !validId(actor)) throw new Error('approval rejected');
    p.status = 'approved'; p.actor = actor; this.#record('approved', id);
  }
  skip(id) {
    const p = this.#packets.get(id);
    if (!p || !['pending','approved'].includes(p.status)) throw new Error('skip rejected');
    p.status = 'skipped'; this.#record('skipped', id);
  }
  async execute(id, { allow, defend, dispatch }) {
    const p = this.#packets.get(id);
    if (!p || p.status !== 'approved' || p.expiresAt <= this.clock() || this.shadow) throw new Error('execution blocked');
    // Consume before the first await: concurrent attempts cannot dispatch twice.
    p.status = 'executing';
    try {
      if ((await allow(copy(p.action), p.actor)) !== true || (await defend(copy(p.action))) !== true) throw new Error('policy blocked');
      if (p.expiresAt <= this.clock()) throw new Error('approval expired');
      await dispatch(copy(p.action), { idempotencyKey: p.id });
      p.status = 'executed'; this.#record('executed', id);
    } catch (error) {
      // No automatic retry after ambiguous external failure.
      p.status = 'failed'; this.#record('failed', id); throw error;
    }
  }
  learn({ candidate, parent, safety, regressions, rule }) {
    if (![candidate,parent,safety,regressions].every(Number.isFinite) || candidate <= parent || safety < .95 || safety > 1 || regressions !== 0 || typeof rule !== 'string' || !rule.trim() || rule.length > 4096) return false;
    if (this.promotionGate && !this.promotionGate({candidate,parent,safety,regressions})) return false;
    this.#rules.push({ rule, candidate, parent, safety, regressions, status: 'proposed' });
    this.#record('rule-proposed', String(this.#rules.length)); return true;
  }
}
export function replay(bot, events) {
  return bot.watch(events).map(e => ({ id: e.id, source: e.source, severity: bot.judge(e), route: bot.speak(e) }));
}
