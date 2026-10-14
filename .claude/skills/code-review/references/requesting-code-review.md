---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements - dispatches code-reviewer subagent to review implementation against plan or requirements before proceeding
---

# Requesting Code Review

Dispatch code-reviewer subagent to catch issues before they cascade.

**Core principle:** Scout first, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**0. Scout edge cases first (NEW):**
```
Before dispatching code-reviewer, invoke /scout to find:
- Files affected by changes (not just modified files)
- Data flow paths that could break
- Edge cases and boundary conditions
- Potential side effects

See: references/edge-case-scouting.md
```

**1. Get git SHAs:**

`BASE_SHA`: use the one you already have (cook's run base), else run the snippet in [`code-reviewer.md`](../../../agents/code-reviewer.md) → Review Process §1 (nearest default branch). The review diff is `git diff "$BASE_SHA"` plus untracked files — no `..HEAD` range, so uncommitted work is included.

```bash
HEAD_SHA=$(git rev-parse HEAD)   # for the record only
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with `code-reviewer` type; put these in the prompt:

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Base commit; the review is `git diff {BASE_SHA}` plus untracked files
- `{HEAD_SHA}` - HEAD at request time (record only, not part of the diff range)
- `{RISK}` - low | medium | high, from `../../cook/references/risk-and-gates.md`
- `{DESCRIPTION}` - Brief summary

**Risk high:** dispatch the architecture & reliability reviewer in the same message with the prompt in `../../cook/references/subagent-patterns.md` → Architecture & Reliability Review, and tell the main reviewer to skip the checklist. Merge the two reports per `../../cook/references/review-cycle.md` → Merging Two Reviews.

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix High issues before proceeding
- Note Medium and Low issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

# BASE_SHA = HEAD noted before starting Task 2 (a7981ec)
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  RISK: medium
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Architecture & reliability: A1–A4 on 3 files; R1–R9 skipped (no trigger)
  Issues:
    High: src/index/repair.ts:42 — when the index has ~1M rows → repair runs for minutes with no output and the user kills it mid-write
    Low: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed High issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification
