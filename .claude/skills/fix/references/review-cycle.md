# Review Cycle

Mode-aware review handling for code-reviewer results.

## Review Base

Before the first fix is dispatched, record `BASE_SHA=$(git rev-parse HEAD)`. Pass it to every `code-reviewer` in this cycle, re-reviews included, so the review covers the changes since the fix started plus any uncommitted work that already existed before it.

## Autonomous Mode

```
cycle = 0
LOOP:
  1. Run code-reviewer with BASE_SHA → score, critical_count, warnings, suggestions

  2. IF score >= 9.5 AND critical_count == 0:
     → Output: "✓ Review [score]/10 - Auto-approved"
     → PROCEED to next step

  3. ELSE IF critical_count > 0 AND cycle < 3:
     → Output: "⚙ Auto-fixing [N] critical issues (cycle [cycle+1]/3)"
     → Fix critical issues
     → Re-run tests
     → cycle++, GOTO LOOP

  4. ELSE IF cycle >= 3:
     → ESCALATE to user via AskUserQuestion
     → Display findings
     → Options: "Fix manually" / "Approve anyway" / "Abort"

  5. ELSE (score < 9.5, no critical):
     → Output: "✓ Review [score]/10 - Approved with [N] warnings"
     → PROCEED (warnings logged, not blocking)
```

## Human-in-the-Loop Mode

```
ALWAYS:
  1. Run code-reviewer with BASE_SHA → score, critical_count, warnings, suggestions

  2. Display findings:
     ┌─────────────────────────────────────┐
     │ Review: [score]/10                  │
     ├─────────────────────────────────────┤
     │ Critical ([N]): [list]              │
     │ Warnings ([N]): [list]              │
     │ Suggestions ([N]): [list]           │
     └─────────────────────────────────────┘

  3. Use AskUserQuestion:
     IF critical_count > 0:
       - "Fix critical issues"
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

Uses same logic as Autonomous but:
- Lower threshold: score >= 8.5 acceptable
- Only 1 auto-fix cycle before escalate
- Focus on: correctness, security, no regressions

## Severity Levels

Defined once in [`code-reviewer.md`](../../../agents/code-reviewer.md) → Prioritization. Do not restate them here.
