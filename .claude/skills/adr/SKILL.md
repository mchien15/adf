---
name: adr
description: "Record an architecture decision as an ADR (Michael Nygard format) — the decision, the alternatives, and why they were rejected."
argument-hint: "<decision title>"
---

# Architecture Decision Record

Capture **why** a decision was made, so the constraint that ruled out the obvious alternative survives the people who knew it.

Architecture docs describe what the system *is*. An ADR describes why it turned out that way. Without them an agent reads the architecture, learns the shape but not the constraints, and re-proposes the option that was already rejected.

## When to use

- A decision that outlives the task that produced it
- Architecture, tech stack, security boundary, deployment posture
- A non-obvious choice a future reader would otherwise second-guess
- `cook` / `plan` suggests one after the plan's `## Impact` table flags a breaking change or a long-lived architectural commitment

**Not** for reversible or task-scoped calls. Those belong in the plan's `## Decision Log`, which dies with the task. If the answer to *"will this still matter after the task closes?"* is no, do not write an ADR.

## Workflow

### 1. Resolve where records live

**Records go in `<docs-root>/adr/`.** Resolve the docs root with [`references/docs-root-detection.md`](references/docs-root-detection.md) → Layer 1 — never assume `docs/`, since a repo with a docs site keeps content somewhere like `apps/docs/docs/`. Then append `adr/`. That is the whole rule.

There is no search for an existing ADR directory elsewhere and no adoption of one. Layer 3 explains why that mechanism was removed after two adversarial review rounds; the short version is that every version of it moved the failure somewhere new.

**Before creating anything, check whether records already exist elsewhere.** Use the record probe in the reference (Layer 3 → *Finding records that already exist*), then follow its **writing** rule: if surviving records sit somewhere other than `<docs-root>/adr/`, say so and ask. Never switch on your own.

A record in the wrong directory is visible and a human moves it. A silent redirect is not. The readers (`/plan`, `/brainstorm`, `/docs update`) search wider than you do, so wherever the user tells you to write, they will still find it.

### 2. Create the directory if it does not exist

| File | Source |
|---|---|
| `_template.md` | `templates/adr-template.md` |
| `README.md` | `templates/adr-readme.md` |

Both are byte-identical in every repo, which is why ADF is allowed to write them at all. **Check before writing — never overwrite either file if it already exists.** A repo may have customised them.

Write nothing else. Not `AGENTS.md`, not `CLAUDE.md`, not `.claude/config/`, not docs-tool metadata (`sidebar_position`, `_category_.json`).

### 3. Interview

Ask for all four. A record missing any of them is not worth writing:

| Field | Prompt |
|---|---|
| **Context** | What forced the decision? Which constraints conflicted? |
| **Decision** | What was chosen? |
| **Alternatives** | At least two others — "do nothing" counts. **Why was each rejected?** |
| **Consequences** | Positive *and* negative. A record with no downsides reads as advocacy |

Ask in one round via `AskUserQuestion` where possible. Do not invent answers, and do not fabricate alternatives to pad the table — a reader who spots an invented alternative stops trusting the record.

### 4. Number it

Use the numbering rule in [`references/docs-root-detection.md`](references/docs-root-detection.md) → **Layer 3 → Numbering**. In short: strip an optional `adr-` / `ADR-` prefix, take the leading digits of every record, and add one to the highest.

**Key on the number, never on the filename or on a glob returning nothing.** `Glob [0-9]*.md` sees only half of a directory holding both `0001-260731-a.md` and `adr-0002-b.md`, so it hands back `0002` — a number already taken. And checking whether the computed *filename* exists does not catch it either, because `0002-260731-new.md` and `adr-0002-old.md` are different names carrying the same number.

Before writing, confirm no existing record already carries the chosen number **under any scheme**. If one does, stop and ask — never overwrite, never silently skip to the next free number, because either hides a numbering assumption that just proved wrong.

File name: `NNNN-YYMMDD-kebab-title.md` — e.g. `0007-260730-choose-postgres-over-mongodb.md`. Cited in prose as `ADR-0007`.

**If the directory already holds records, keep their naming**, including zero-padding width. If they are `NNNN-slug.md` with no date, match them. One consistent convention beats the better convention applied to half the files. If their scheme is one this skill does not recognise — `20200601-use-postgres.md`, the log4brains default — **stop and ask** rather than starting over at `0001` beside them.

The date is not decoration. Highest-plus-one collides across branches, and with the number alone the collision is silent. `templates/adr-readme.md` documents how to resolve one.

### 5. Write

Which template you start from depends on which branch step 1 took:

| Branch | Start from |
|---|---|
| Directory created in step 2 | The `_template.md` written there |
| Directory already existed with records in it | Its own template if it has one, otherwise this skill's `templates/adr-template.md`. **Do not add `_template.md` to a directory you did not create** |

**Strip every `<!-- ... -->` block as you fill it in.** They are fill-in guidance for the author, not part of a record. Leaving them in is not merely untidy: the status block names all four statuses, so a written record ends up containing the literal text `🟢 Accepted` while its actual status is 🟡 Proposed — and any tool or person grepping the file for a status gets a false hit. `_template.md` keeps its comments; records never carry them.

Full section spec: [`references/nygard-format.md`](references/nygard-format.md).

Default status is **🟡 Proposed**. Confirm the file was written and print the path.

## Status lifecycle

```
🟡 Proposed ──► 🟢 Accepted ──┬──► 🔴 Deprecated
                              └──► ⚪ Superseded by ADR-XXXX
```

| Status | Meaning |
|---|---|
| 🟡 Proposed | Written down, not ratified. **Default for every new record** |
| 🟢 Accepted | In force |
| 🔴 Deprecated | No longer applies, nothing replaced it |
| ⚪ Superseded by ADR-XXXX | Replaced — link the replacement |

**Only a person moves a record to 🟢 Accepted.** Ratification is the whole point of the state; an agent setting it turns the lifecycle into decoration.

**In `--auto` mode: never set 🟢 Accepted, and never create a record unprompted.** Auto may note in the plan's `## Decision Log` that an ADR looks warranted, and stop there.

Superseding means writing a new record and flipping the old one to ⚪ — **edit both files** so the link is two-way. Never rewrite a record's history in place. A record that turned out wrong is still evidence of what was believed at the time.

## Ownership

The ADR directory belongs to this skill and to the people writing records.

Other skills may **read** records — `/plan` and `/brainstorm` do, before proposing anything. None of them may write into the directory. That boundary is why ADRs are a separate skill rather than part of `docs`: `docs` regenerates from code, and a decision cannot be derived from code, so a regenerating tool would eventually overwrite it.

Cross-linking records into `system-architecture.md` was designed and then cut — see the plan's Phase 05. Specifying a deterministic block-replace in prose produced thirty under-specified decision points and two data-loss paths across three review rounds. It belongs in a script, not in a markdown instruction, and it is not needed for the read path to work.

## Anti-patterns

❌ **Setting 🟢 Accepted without a human saying so.** Including "the user seemed to agree". Proposed is the default and staying there is not a failure.

❌ **Skipping "Alternatives considered", or leaving `Why not` blank.** The rejection reason is the highest-value cell in the record. Without it the alternative gets re-proposed and nothing on the page rules it out.

❌ **Padding alternatives with options nobody considered.** Fabricated rigour is worse than none — one invented row and the reader discounts the entire record.

❌ **Listing only positive consequences.** Every real decision costs something. A record with no downsides reads as a sales pitch and gets discounted wholesale.

❌ **One-line records for large decisions.** "Chose Postgres because it's good" records nothing. Name the specific constraint that decided it.

❌ **Two decisions in one record.** They can no longer be superseded independently — reversing one forces ⚪ on a record whose other half is still in force.

❌ **Writing outside the resolved ADR directory.** No `AGENTS.md`, no `CLAUDE.md`, no config, no docs-tool front-matter. ADF writes a file into someone's repo only when its content is identical in every repo.

❌ **Switching to a different ADR directory on your own** because the courtesy check found records elsewhere. Report it and ask. A wrong default is visible; a silent redirect is not.

❌ **Overwriting an existing record or an existing `_template.md`.** Lazy-create means *create if absent*, never replace.

❌ **Putting secrets in a record.** Describe the constraint — "the vendor token cannot be rotated without downtime" — never paste the value.

❌ **Leaving the template's `<!-- -->` guidance in a written record.** The status block lists all four statuses, so the file then contains `🟢 Accepted` regardless of its real status, and anything grepping for one is wrong.
