# ADR 002: MetaHarness npm integration and WASM promotion gate

Status: Accepted with explicit backend availability reporting.

## Decision and evidence

Pin @metaharness/kernel at npm version 0.1.3 with a package lock. Use its real loadKernel and mcpValidate interfaces, verified against packages/kernel-js/src/index.ts in https://github.com/ruvnet/metaharness. The kernel selects native, WASM, then JavaScript according to its upstream loader. Report the selected backend. A specifically requested unavailable backend must fail; do not mislabel fallback as WASM. The tested published package selected JavaScript and did not contain the upstream WASM artifact.

Ship a separate 86-byte import-free WASM numeric promotion predicate compiled reproducibly from WAT using pinned wabt. This is ruvbot's own predicate, not the upstream MetaHarness kernel. Host validation rejects nonfinite metrics. Promotion requires candidate > parent, safety >= 0.95 and <= 1, and zero regressions. Passing creates a proposal only; it cannot rewrite policy or severity floors. The predicate is opt-in via loadPromotionGate and ProactiveBot's promotionGate option.

## Tradeoffs

JavaScript avoids a Rust build requirement. WASM adds a small startup/read cost and packaging complexity for a portable deterministic primitive; no speed advantage is claimed for four comparisons. Native acceleration, browser execution, model evaluation and full Darwin optimizer integration are not implemented. MetaHarness connector validation checks transport shape, not URL trust, SSRF, credentials or authorization. Those remain host responsibilities.

## Deployment and rollback

npm ci --ignore-scripts installs pinned dependencies. npm run build:wasm rebuilds the checked-in artifact. npm pack includes JS and the artifact. Node 20+ is required; the package uses Node crypto and filesystem APIs, so it is not a browser bundle. Remove promotionGate to use the identical host predicate. Set METAHARNESS_KERNEL_BACKEND=wasm only when upstream artifacts are actually installed.

## Acceptance

Run the runtime suite, real MetaHarness validation smoke test, JS/WASM promotion parity tests, demo, package inspection and a fresh tarball install. Record measured latency separately from claims. Before production, require a durable authenticated host and held-out candidate evaluation; supplied scores alone are not proof of improvement.
