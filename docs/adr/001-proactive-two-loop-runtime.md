# ADR 001: Proactive ruvbot runtime

Status: Accepted for opt-in reference implementation, not production activation. Storage limitations below describe the initial increment; ADR 003 adds optional single-writer persistence.

## Context and provenance

The existing Next.js/LlamaIndex chatbot has no proactive scheduler or approval service. Add a separately installable Node 20+ library without changing the existing chat route. Source: @choopyplug1, *Build Your Own Duet*, 15 pages, PDF metadata dated 2026-10-22, https://drive.google.com/file/d/12QJ9ZohTWBvh4VGk7p9WwmV3izx2N0P-/view. This is an independent architecture guide; its product claims and illustrative numbers are not benchmark evidence.

## Decision

One host-owned context supports an attention loop (watch, judge, speak) and work loop (prepare, gate, learn). Defend is mandatory before dispatch. Connector envelopes carry trusted source IDs, event IDs and severity floors; document bodies remain data. P0 alerts immediately, P1 briefs unless its deadline is within three hours, P2 stays silent. Deduplication keys include both source and ID. Poll batches and pending preparations have explicit limits.

Packets bind approval to an immutable action digest and expiry. Execution consumes approval before asynchronous checks, then rechecks expiry after checks. Policy and outbound defense are host callbacks and missing callbacks fail closed. Ambiguous dispatch failures require reconciliation, never an automatic retry. External dispatch receives the packet ID as an idempotency key. Shadow mode is the default.

## Boundaries and alternatives

Input: trusted connector envelopes and explicit action specifications. Output: decisions, approval packets, metadata-only audit events and rule proposals. The library does not authenticate actor strings, fetch sources, schedule polls, infer actions from text, store secrets, or provide a production sandbox. The host must authenticate approval and enforce allowed targets and permissions. A permissive callback is not a security boundary.

An in-process module costs zero extra services and supports deterministic local replay. A durable service provides restart safety and horizontal concurrency but requires a database transaction, authenticated API and deployment integration. Choose the module for this first increment. Never expose this in-memory implementation as an unattended production service. It has no restart deduplication or cross-process locks; audit and seen-event maps grow over its lifetime. Production needs retention limits, durable cursors and transactional packet consumption.

## Rollback and acceptance

No existing routes change. Remove the package or leave shadow mode enabled to roll back. Tests cover deduplication, severity floors, budgets, immutable action binding, expiry during asynchronous checks, concurrent execution, skipped packets, policy denial and ambiguous failure. Live email, payments, deletion and publication are outside this implementation.
