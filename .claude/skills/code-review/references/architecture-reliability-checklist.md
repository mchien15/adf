# Architecture & Reliability Checklist

Loaded by `code-reviewer`. Thirteen checks on purpose: a longer list dilutes the ones that matter. To add a check, remove one.

## Who runs it

The main reviewer runs it on every review: A1–A4 on every changed file, R1–R9 on files that hit a trigger, unless its prompt says another reviewer runs it. That happens at high risk in `cook` Step 6 and `/code-review` (see [`risk-and-gates.md`](../../cook/references/risk-and-gates.md) → Gate Matrix), where a second reviewer runs only this checklist in parallel, and in team and parallel reviews, where one reviewer runs it and the others skip it.

## Triggers

The diff adds or changes:
- a call that leaves the process — HTTP/gRPC client, DB, cache, queue, object store, model/LLM API, subprocess
- a handler started by something other than a user request — webhook, queue or stream consumer, cron/scheduled job
- a DB migration or schema change
- state shared across requests or instances — module-level mutable value, in-memory cache, local file, lock
- how many instances run — replicas, a single consumer or leader, removed failover

A1–A4 run on every changed file. R1–R9 run only on files that hit a trigger.

## Context to read first

1. **ADRs** — list records with the probe in [`docs-root-detection.md`](../../adr/references/docs-root-detection.md) → Layer 3, "Finding records that already exist". Grep each record's Status line. Open a full record only when its title concerns code the diff touches. Cite records by file path — numbers can collide.
2. **Architecture doc** — docs root is `$CK_DOCS_PATH` (no ADF config in the repo → Layer 1 of the same file). When it is `.adf/docs/` (cmc profile, generated docs only), also search `docs/`. Find architecture docs with Layer 2: `*architect*` in file **and** directory names; also check the repo root for `ARCHITECTURE.md`. Read only the sections for touched modules.
3. **Plan** — when a plan is given: each phase's `Risk Assessment` → `Failure modes` table.

## Architecture

| ID | Check | Usual severity when violated |
|---|---|---|
| A1 | Change sits in the layer the architecture doc assigns; no new dependency from a lower layer to a higher one, or between modules that should not know each other | High |
| A2 | Respects every Accepted ADR that no newer ADR supersedes — e.g. no direct provider SDK call where an ADR says the model gateway is the only model path | Critical |
| A3 | Changes a public contract (API route/schema, event payload, config key, CLI flag, column another service reads): backward compatible or versioned, consumers listed | Critical if incompatible and unversioned, else Medium |
| A4 | Adds a second mechanism next to an existing one (HTTP client, retry helper, queue client, config loader): reuse it or say why not | Medium |

## Reliability

| ID | Check | Usual severity when violated |
|---|---|---|
| R1 | Every cross-process call sets connect and request timeouts explicitly — many client defaults wait forever | High |
| R2 | Retries are capped, use backoff with jitter, cover only idempotent operations and transient errors (not 4xx/validation), and are not stacked at several layers | Critical when uncapped or repeating a side effect, else High |
| R3 | Writes triggered by a webhook, queue, stream or cron are idempotent — dedupe key or unique constraint; delivery is at-least-once | Critical when the duplicate is a charge, message or record a user sees, else High |
| R4 | State that must agree across instances is not kept in process memory, on local disk or behind an in-process lock | High; Critical when two instances corrupt data |
| R5 | Migration takes no long lock or table rewrite on a large table, and the code now in production still runs on the new schema (expand → migrate → contract) | Critical when running code breaks, else High |
| R6 | A new error branch logs with context (ids, dependency name) and, where the project has metrics, is counted by a metric; no swallowed exception | Medium; High on payment, auth or data-write paths |
| R7 | A new dependency, handler, migration or shared state states what happens when it is down, slow, over quota or duplicated (fallback, degrade, fail closed) and matches the phase `Failure modes` table (no plan given → check code behavior only) | Critical when auth fails open; High when the table says `none` but the code adds one; Medium when the phase has no table |
| R8 | Loops, queues, batches, fan-out and pagination are bounded. Agent/LLM code: max steps per run, max subagent depth, a size cap on tool results kept in context | High |
| R9 | Reverting this change is safe with the data it already wrote (new enum value, new format, dual write) | High |

Severity levels are defined once, in [`code-reviewer.md`](../../../agents/code-reviewer.md) → Prioritization. The column above only says which level a violation usually lands in.

## Finding format

Every Critical or High finding carries `file:line` and a scenario "when X → Y". Without both, report it as Medium.

```
- [R2] Critical — app/tools/runner.py:88 — retry wraps the whole step, including `send_email`
  When the model gateway returns 503 after the tool ran → the step retries → the user gets the email twice
  Fix: retry only the model call; give `send_email` an idempotency key
```

Keep findings that depend on conditions ("only when the gateway is slow"). Reliability bugs are conditional by nature — do not drop one for lacking a reproducer.

## Scope line

Every review report carries exactly one of these lines, whether or not this file was loaded:

```
Architecture & reliability: A1–A4 on N files; R1–R9 on M files
Architecture & reliability: A1–A4 on N files; R1–R9 skipped (no trigger)
Architecture & reliability: skipped (separate reviewer)
Architecture & reliability: checklist not found
```

After the first two, add what the context step found, e.g. `(ADRs: 33 records, 2 opened; architecture doc: docs/02-architecture/)`, or `(no architecture doc)`. "No finding" then means "checked", not "not looked at".
