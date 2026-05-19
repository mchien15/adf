# Code Review Cycle

Interactive review-fix cycle used in code workflows.

Terminology:
- `review gate`: human approval checkpoint
- `verification gate`: proof gate that cannot be skipped
- `checkpoint review`: intermediate review for risky implementation phases
- `plan-conformance`: verify built scope before style/perf review

See `risk-and-gates.md` for trigger conditions.

## Checkpoint Review Loop

Use this during implementation when policy marks the phase as risky.

1. Run delegated review on the current phase or changed slice
2. Check for blocking issues, unsafe tradeoffs, or drift from approved scope
3. Fix blocking findings before continuing
4. If the same phase loops 3 times, escalate to the user instead of silently grinding

**Output:** `✓ Step 3: Checkpoint review complete - [phase] - [approved|fixes applied]`

## Plan-Conformance Gate

Run before final code-quality review.

Checklist:
- approved requirements are implemented
- no material scope item was skipped without explanation
- no out-of-plan feature was added silently
- known tradeoffs are surfaced before approval

If conformance fails, return to implementation before final review.

Ownership:
- `cook` performs this gate before the final review
- `code-reviewer` consumes the result and may challenge it if the evidence does not match the implementation

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Confirm plan-conformance result is available
  2. Run code-reviewer → score, critical_count, warnings, suggestions

  3. DISPLAY FINDINGS:
     ┌─────────────────────────────────────────┐
     │ Code Review Results: [score]/10         │
     ├─────────────────────────────────────────┤
     │ Summary: [what implemented], tests      │
     │ [X/X passed]                            │
     ├─────────────────────────────────────────┤
     │ Critical Issues ([N]): MUST FIX         │
     │  - [issue] at [file:line]               │
     │ Warnings ([N]): SHOULD FIX              │
     │  - [issue] at [file:line]               │
     │ Suggestions ([N]): NICE TO HAVE         │
     │  - [suggestion]                         │
     └─────────────────────────────────────────┘

  4. AskUserQuestion (header: "Review & Approve"):
     IF critical_count > 0:
       - "Fix critical issues" → fix, re-run tester, cycle++, LOOP
       - "Fix all issues" → fix all, re-run tester, cycle++, LOOP
       - "Approve anyway" → PROCEED
       - "Abort" → stop
     ELSE:
       - "Approve" → PROCEED
       - "Fix warnings/suggestions" → fix, cycle++, LOOP
       - "Abort" → stop

  5. IF cycle >= 3 AND user selects fix:
     → "⚠ 3 review cycles completed. Final decision required."
     → AskUserQuestion: "Approve with noted issues" / "Abort workflow"
```

## Auto-Handling Cycle (for auto modes)

```
cycle = 0
LOOP:
  1. Confirm plan-conformance result is available
  2. Run code-reviewer → score, critical_count, warnings

  3. IF score >= 9.5 AND critical_count == 0:
     → Auto-approve, PROCEED

  4. ELSE IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tester
     → cycle++, LOOP

  5. ELSE IF critical_count > 0 AND cycle >= 3:
     → ESCALATE TO USER

  6. ELSE (no critical, score < 9.5):
     → Approve with warnings logged, PROCEED
```

## Critical Issues Definition
- Security: XSS, SQL injection, OWASP vulnerabilities
- Performance: bottlenecks, inefficient algorithms
- Architecture: violations of patterns, coupling
- Principles: YAGNI, KISS, DRY violations

## Output Formats
- Waiting: `⏸ Step 6: Code reviewed - [score]/10 - WAITING for approval`
- After fix: `✓ Step 6: [old]/10 → Fixed [N] issues → [new]/10 - Approved`
- Auto-approved: `✓ Step 6: Code reviewed - 9.8/10 - Auto-approved`
- Approved: `✓ Step 6: Code reviewed - [score]/10 - User approved`
