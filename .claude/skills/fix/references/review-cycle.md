# Review Cycle

Mode-aware review handling for code-reviewer results.

## Review Base

Before the first fix is dispatched, record `BASE_SHA=$(git rev-parse HEAD)`. Pass it to every `code-reviewer` in this cycle, re-reviews included, so the review covers the changes since the fix started plus any uncommitted work that already existed before it. Also pass the tester's report (quick mode: the implementer's TDD Evidence) — commands and result lines — and the reproducing test's name. The reviewer's acceptance criteria table for a fix has one row — the reported symptom no longer reproduces (deep mode with a plan: that plan's criteria); ✕ there blocks approval like a Critical finding. Re-reviews (2nd review on; `cycle ≥ 1` below) use the narrower scope in `../../cook/references/review-cycle.md` → Re-review (2nd review on), including how a `not resolved` finding counts.

## Autonomous Mode

```
cycle = 0
LOOP:
  1. Run code-reviewer with BASE_SHA → verdict, critical_count, unmet_criteria_count, warnings, suggestions

  2. IF verdict == Accept AND critical_count == 0 AND unmet_criteria_count == 0:
     → Output: "✓ Review Accept - Auto-approved"
     → PROCEED to next step

  3. ELSE IF (verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0) AND cycle < 3:
     → Output: "⚙ Auto-fixing [N] critical issues and unmet criteria (cycle [cycle+1]/3)"
     → Fix critical issues and unmet criteria
     → Re-run tests
     → cycle++, GOTO LOOP

  4. ELSE IF (verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0) AND cycle >= 3:
     → ESCALATE to user via AskUserQuestion
     → Display findings
     → Options: "Fix manually" / "Approve anyway" / "Abort"

  5. ELSE IF verdict == Revise:
     → Output: "✓ Review Revise - Approved with [N] warnings"
     → PROCEED (warnings logged, not blocking)

  6. ELSE (no verdict, or one that is not Accept / Revise / Block):
     → Re-spawn code-reviewer once; still none → ESCALATE to user (as step 4)
```

## Human-in-the-Loop Mode

```
ALWAYS:
  1. Run code-reviewer with BASE_SHA → verdict, critical_count, unmet_criteria_count, warnings, suggestions

  2. Display findings:
     ┌─────────────────────────────────────┐
     │ Review: [verdict]                   │
     │ Acceptance criteria: [met]/[total]  │
     │ ✕ [ids]                             │
     │ Scope creep: [list or none]         │
     │ Findings resolved: [N]/[total]      │
     ├─────────────────────────────────────┤
     │ Critical ([N]): [list]              │
     │ Warnings ([N]): [list]              │
     │ Suggestions ([N]): [list]           │
     └─────────────────────────────────────┘

  3. Use AskUserQuestion:
     IF verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0:
       - "Fix critical issues and unmet criteria"
       - "Fix all issues"
       - "Approve anyway"
       - "Abort"
     ELSE:
       - "Approve"
       - "Fix warnings/suggestions"
       - "Abort"

  4. Handle response:
     - Fix → implement, re-test, re-review (max 3 cycles)
     - Approve → proceed
     - Abort → stop workflow
```

## Quick Mode Review

Uses same logic as Autonomous (Accept, or Revise with High findings only, is acceptable) but:
- Only 1 auto-fix cycle before escalate
- Focus on: correctness, security, no regressions

## Severity Levels

Defined once in [`code-reviewer.md`](../../../agents/code-reviewer.md) → Prioritization. Do not restate them here.
