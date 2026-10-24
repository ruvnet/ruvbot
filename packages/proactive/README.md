# @ruvbot/proactive

Opt-in proactive runtime for ruvbot. Node 20+. Default shadow mode. No credentials, paid APIs or network dispatch required for the demo.

```sh
cd packages/proactive
npm ci --ignore-scripts
npm run build:wasm
npm test
npm run demo
npm run doctor
npm pack
```

```js
import { ProactiveBot, replay } from '@ruvbot/proactive';
import { loadPromotionGate } from '@ruvbot/proactive/wasm';
import { createMetaHarness } from '@ruvbot/proactive/metaharness';

const harness = await createMetaHarness();
harness.validateConnector({ name: 'monitor', url: 'https://example.com/mcp' });
console.log(harness.backend); // actual native, wasm or js selection
const bot = new ProactiveBot({ promotionGate: await loadPromotionGate() });
console.log(replay(bot, [{id:'outage-1',source:'monitor',floor:'P0',observedAt:Date.now(),body:'Checkout unavailable'}]));
```

The host calls `watch` on each bounded poll, `judge` and `speak` for notification routing, and `prepare` for a specific action. An authenticated approval handler calls `approve(id, digest, actor)`. A trusted host may construct the bot with `shadow:false`, then call `execute(id, {allow, defend, dispatch})`. `allow` enforces permissions and targets; `defend` checks outbound content. Both must return true. `dispatch` uses the supplied idempotency key. Never expose these methods directly to model tools or unauthenticated HTTP requests.

`learn` takes measured candidate and parent scores, safety, regressions and a rule. It adds a proposed rule only after the promotion gate passes. Evaluators and human policy review are external.

This increment is a single-process library and CLI, not a deployed scheduler or updated chatbot UI. Optional FileStore persists cursors, approvals and receipts on a private local volume; the default remains in memory. Production still requires authenticated identity, a durable notification outbox, retention operations and live connector integration. Audit metadata omits message and action bodies. Do not place secrets in source IDs or targets. No exactly-once guarantee exists across crashes or external systems.

The upstream MetaHarness WASM artifact is absent in the tested npm release. `doctor` reports JS honestly. ruvbot's separate promotion predicate executes actual WASM and has no imports. No performance improvement is claimed over JavaScript.


## Restart-safe local host

```js
import { FileStore } from '@ruvbot/proactive/store';
const store = new FileStore('/private/ruvbot-state'); // creates 0700 directory
const durableBot = new ProactiveBot({
  store,
  quietHours: { start: 22, end: 7, offsetMinutes: -240 },
  maxEventAgeMs: 86400000,
  maxHistory: 10000
});
try {
  durableBot.watch(events, { source: 'monitor', cursor: 'page-42' });
  // Route accepted events; defer means queue for the next host brief.
} finally { durableBot.close(); }
```

Only one FileStore writer may open a directory. Interrupted executing actions recover as `uncertain` and require reconciliation. A crash leaves a lock: confirm the old process is dead and reconcile receipts before manually removing it. Never run this on a shared filesystem. Storage failures disable the runtime. Snapshot action payloads are plaintext and need host volume protection. Event receipt and notification delivery are distinct; there is no durable notification outbox yet.

`edit(id, digest, replacement)` revokes old approval and returns a new pending packet. Expired pending packets stop consuming the active preparation budget. Quiet hours never suppress P0 or imminent deadlines. Update the UTC offset for daylight saving changes.

Run `npm run benchmark` for labelled synthetic replay metrics. For operational evaluation, import `evaluateReplay` from `@ruvbot/proactive/evaluate` and supply independent `{event, expected}` cases. Compare held-out critical recall and alert precision before changing rules. Synthetic fixture accuracy does not prove real-world quality. See ADR 003 for limits and recovery.
