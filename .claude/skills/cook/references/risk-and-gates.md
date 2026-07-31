# Risk and Gate Policy

Shared policy for `cook`. Keep this file as the single source of truth for risk classification, hard gates, and override rules.

## Terms

- `review gate`: human approval checkpoint in non-`auto` modes
- `verification gate`: proof gate that cannot be skipped by mode flags
- `checkpoint review`: mid-implementation review for risky work
- `plan-conformance`: check that implementation matches approved scope before style/perf review

## Risk Levels

| Risk | Typical work | Default isolation |
|------|---------------|-------------------|
| low | docs, copy, config-only, UI polish, refactor-only with no behavior change | in-place |
| medium | normal feature logic, multi-file behavior changes, non-trivial bugfixes | recommended |
| high | auth, billing, DB/migrations, infra, security, regression-prone bugfixes, parallel work, 3+ file behavior changes on `main` | required unless user explicitly accepts in-place risk |

## Gate Matrix

| Policy | Low | Medium | High |
|--------|-----|--------|------|
| Verification before completion | required | required | required |
| TDD evidence | optional, give reason if skipped | required for behavior changes | required |
| Checkpoint review | not required | required when phase touches 3+ files or cross-cutting behavior | required |
| Isolation check | note current workspace | recommend worktree or equivalent isolation | require worktree or explicit opt-out acknowledgement |
| Plan-conformance check | required | required | required |

## Mode Rules

| Mode | Allowed to skip human review gates? | Allowed to skip verification gate? | Notes |
|------|------------------------------------|-----------------------------------|-------|
| interactive | no | no | default mode |
| auto | yes | no | skips approval stops only |
| fast | no | no | skips research only |
| parallel | no | no | stronger isolation and checkpoint review expectations |
| no-test | no | no | skips test step only when policy allows |
| code | no | no | executes approved plan directly |

## Override Rules

1. `verification` always runs, even in `--auto` and `--no-test`.
2. `--no-test` cannot be used for high-risk work.
3. `--no-test` should be rejected for bugfixes and medium-risk logic changes unless user narrows scope to low-risk non-behavior work.
4. `auto` can skip approval waits, but it cannot bypass TDD evidence, plan-conformance, or final verification.
5. If high-risk work stays in the current workspace, `cook` must surface the risk and require explicit user acknowledgement before implementation.
6. The ADR suggestion is **not a gate**. It never blocks, and it never adds a fifth review gate — it is one extra question inside Review Gate 2 (Step 2b) and one inside Step 7 (Decision Log sweep). In `auto` mode both are skipped: `auto` may append a note to the plan's `## Decision Log`, but **never creates an ADR and never sets one to Accepted**. Ratifying a decision is a human act.
7. The Step 7 sweep is the one that matters in `code` mode, which skips Steps 1–2 and therefore never reaches Step 2b at all.

## Isolation Gate

Before implementation starts, check:

1. current branch and whether work is happening on `main`
2. whether the workspace is dirty
3. whether an isolated worktree or equivalent workspace is available
4. whether the user explicitly accepted in-place high-risk work

Rules:

- `low`: in-place is fine
- `medium`: recommend isolation when the tree is dirty, shared, or broad
- `high`: require isolation or explicit user acknowledgement to continue in-place
- `parallel`: treat as `high` for isolation

## Verification Evidence Contract

Every completion claim should tie to concrete proof. Minimum fields:

- command or check run
- exit status or clear success signal
- what output was inspected
- what claim that proof supports

Examples:

- implementation: changed files inspected and type/build command passed
- testing: exact test command, pass/fail counts, failing test follow-up if any
- review: reviewer score, critical count, disposition
- finalize: plan sync-back confirmed, docs update disposition, commit disposition

Verification is satisfied only when the proof summary is specific enough that another agent could repeat it.

## Plan-Conformance Owner

`cook` owns the Step 5 plan-conformance check. The final reviewer consumes that result and may challenge it, but does not replace the gate by default.

## Git Closeout Rule

`git-manager` is always spawned during finalization, but commit/push actions are conditional unless the user already approved automatic git actions. This keeps finalization mandatory without forcing an unwanted commit.

## Practical Triggers

- Escalate to `medium`: multiple files, new behavior, business logic, test additions, non-trivial bugfix
- Escalate to `high`: auth, security, payments, migrations, infrastructure, incident/regression fixes, parallel implementation, sensitive paths on `main`
- Stay `low`: docs-only, wording, comments, harmless config cleanup, visual polish with no behavior change

## Output Conventions

- `✓ Step 0: Mode [X] - Risk [low|medium|high] - Isolation [in-place|recommended|required]`
- `✓ Step 2b: Impact reviewed - ADR [suggested|n/a]`
- `✓ Gate 2: ADR [created|declined|deferred-to-log|n/a]`
- `✓ Step 7: Decision Log swept - ADR [created|declined|deferred-to-log|n/a]`
- `✓ Step 3: Checkpoint review complete - [phase] - [approved|fixes applied]`
- `✓ Step 5: Plan conformance verified - [N criteria met]`
- `✓ Step 7: Verified before completion - [command/check] - [proof supported]`
