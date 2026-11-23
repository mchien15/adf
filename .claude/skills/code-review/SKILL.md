---
name: code-review
description: "Review a diff against the plan's acceptance criteria, receive feedback with technical rigor, verify completion claims. Use after implementing features, before PRs, when claiming task completion."
argument-hint: "[context]"
---

# Code Review

Guide proper code review practices emphasizing technical rigor, evidence-based claims, and verification over performative responses.

## Which review to run

| Need | Run |
|------|-----|
| Diff from a plan or /fix, judged against acceptance criteria | this skill → `code-reviewer` subagent |
| Quick review of a diff with no plan | `/ponytail-review` (ponytail plugin) |
| Whole-repo audit | `/ponytail-audit` (ponytail plugin) |
| Deep structural review before merging a large branch | `/thermo-nuclear-code-quality-review`, run by the user |

Invoked without context: review the current branch's changes.

## Core Principle

**YAGNI**, **KISS**, **DRY** always. Technical correctness over social comfort.
**Be honest, be brutal, straight to the point, and be concise.**

Verify before implementing. Ask before assuming. Evidence before claims.

## Practices

| Practice | When | Reference |
|----------|------|-----------|
| Receiving feedback | Unclear feedback, external reviewers, needs prioritization | `references/code-review-reception.md` |
| Requesting review | After tasks, before merge, stuck on problem | `references/requesting-code-review.md` |
| Verification gates | Before any completion claim, commit, PR | `references/verification-before-completion.md` |
| Architecture & reliability | Every review (R1–R9 only on trigger); architecture & reliability reviewer when risk is high | `references/architecture-reliability-checklist.md` |

## Quick Decision Tree

```
SITUATION?
│
├─ Received feedback → STOP if unclear, verify if external, implement if human partner
├─ Completed work → Request code-reviewer subagent
└─ About to claim status → RUN verification command FIRST
```

## Receiving Feedback

**Pattern:** READ → UNDERSTAND → VERIFY → EVALUATE → RESPOND → IMPLEMENT

**Rules:**
- No performative agreement: "You're absolutely right!", "Great point!"
- No implementation before verification
- Restate, ask questions, push back with reasoning, or just work
- YAGNI check: grep for usage before implementing "proper" features

**Source handling:**
- Human partner: Trusted - implement after understanding
- External reviewers: Verify technically, check breakage, push back if wrong

**Full protocol:** `references/code-review-reception.md`

## Requesting Review

**When:** After each task, major features, before merge

**Process:**
1. Base: `BASE_SHA`, picked by the snippet in [`code-reviewer.md`](../../agents/code-reviewer.md) → Review Process §1 unless you already have one; the review covers committed, uncommitted and untracked changes since it
2. Classify risk with `../cook/references/risk-and-gates.md` → Risk Levels, state it in the dispatch and report; the user may override
3. Dispatch code-reviewer subagent with: WHAT, PLAN, BASE_SHA, HEAD_SHA, RISK, EVIDENCE, DESCRIPTION. Risk high → also dispatch the architecture & reliability reviewer in the same message; merge both reports (see `references/requesting-code-review.md`)
4. Fix Critical immediately, High before proceeding

**Full protocol:** `references/requesting-code-review.md`

## Verification Gates

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

**Gate:** IDENTIFY command → RUN full → READ output → VERIFY confirms → THEN claim

**Requirements:**
- Tests pass: Output shows 0 failures
- Build succeeds: Exit 0
- Bug fixed: Original symptom passes
- Requirements met: Checklist verified

**Red Flags:** "should"/"probably"/"seems to", satisfaction before verification, trusting agent reports

**Full protocol:** `references/verification-before-completion.md`

## Integration with Workflows

- **Cook / fix:** cook runs one review after the last phase (or per phase with `--per-phase`) → fix Critical/High → re-review
- **Pull Requests:** Verify tests → code-reviewer review → before merge, optionally `/thermo-nuclear-code-quality-review` and `/ponytail-debt` → Merge

## Bottom Line

1. Technical rigor over social performance
2. Judge acceptance criteria from evidence
3. Evidence before claims

Verify. Question. Then implement. Evidence. Then claim.
