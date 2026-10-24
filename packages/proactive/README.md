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

This increment is a single-process library and CLI, not a deployed scheduler or updated chatbot UI. State is in memory; production requires durable cursors, approval records, retention, authenticated identity and transaction locks. Audit metadata omits message and action bodies. Do not place secrets in source IDs or targets. No exactly-once guarantee exists across crashes or external systems.

The upstream MetaHarness WASM artifact is absent in the tested npm release. `doctor` reports JS honestly. ruvbot's separate promotion predicate executes actual WASM and has no imports. No performance improvement is claimed over JavaScript.
