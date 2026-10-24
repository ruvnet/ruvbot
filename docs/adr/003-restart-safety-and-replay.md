# ADR 003: Restart safety, interruption policy and measurable replay

Status: Accepted for a single-writer local host.

## Guidance and requirements

Build Your Own Duet describes source cursors, bounded polling, quiet notification routing, exact approval packets, edits that become learning evidence, shadow mode and replay invariants. This increment turns those requirements into executable contracts. It does not treat the paper's illustrative night or cost figures as measurements.

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Remember source progress | Persistent cursors and source-qualified seen IDs | Restart retains cursor and suppresses repeated event |
| Resume without repeating an action | Persist executing before dispatch; recover as uncertain | Interrupted dispatch never automatically retries |
| One active writer | Exclusive directory lock | Second owner rejected |
| Fail closed on storage faults | Persistence failure disables further mutation | Disk-full fixture prevents dispatch |
| Approval follows exact content | Editing supersedes old packet and creates pending replacement | Both old and unapproved replacement blocked |
| Quiet unless urgent | Defer P1 brief in quiet hours; P0 and imminent deadlines still alert | Quiet-hours routing fixtures |
| Bound stale data and memory | Event age, history, packet and proposal caps | Stale event and history-bound fixtures |
| Evaluate before learning | Offline labelled replay reports recall, precision and accuracy | Synthetic 1000-scenario evaluation plus wrong-label negative control |

## Storage and execution contract

FileStore uses a private 0700 directory, 0600 snapshot, temporary exclusive file, fsync, atomic rename and directory fsync. A lock is held until close. No automatic stale-lock stealing is allowed. On a crash an operator must establish that the old process is dead, reconcile uncertain actions using downstream idempotency receipts, then remove the lock. Never delete a lock just because it is old. A corrupt action digest rejects startup.

An executing receipt is saved before the first asynchronous policy check. A crash between that receipt and completion results in an uncertain packet which cannot execute again. This favors omission over duplicated consequential actions. It is not distributed exactly-once delivery. Each external provider must honor the supplied idempotency key.

Snapshots contain action payloads and actor IDs and are plaintext. Keep the volume private and encrypted by the host, retain it only as needed, and never put secrets in payloads. The store assumes a trusted local filesystem and local host identity. No network filesystems, multiple writers, clustered deployments or browser runtimes are supported.

## Notification and retention limits

Quiet hours use a host-provided UTC offset; the host must refresh it for daylight saving changes. Deferred decisions need a host brief queue. Persisting event receipt is not the same as delivering a notification: a durable notification outbox is still required for guaranteed alert delivery. Deduplication lasts for maxEventAgeMs (one day by default), and events older than that are ignored. The host must monitor stale connectors separately.

maxHistory defaults to 10000. Audit retains a rolling window. Event IDs expire with the age window. Packet and proposal histories stop accepting new entries at the cap; an operator must archive/rotate the host rather than silently delete approval evidence. Full snapshots rewrite bounded state, so storage latency grows with history; benchmark the target volume before production. No throughput gain is claimed.

## Validation and rollback

23 local tests pass, including actual process exit during dispatch and explicit stale-lock recovery. Synthetic replay of 1000 independent scenarios (100 critical, 900 routine) produced 100% critical recall, precision and routing accuracy in approximately 13 ms on the development host. These fixtures encode the rules directly; they are regression evidence, not real-world alert quality or a model benchmark. Evaluate labelled held-out operational history before enabling real notifications.

Keep shadow mode on. To roll back, stop the host and preserve the snapshot for reconciliation, then deploy the prior package. The previous in-memory runtime cannot read this snapshot; never roll back an actively dispatching host without reconciling actions.
