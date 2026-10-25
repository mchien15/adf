# Code Review Cycle

Interactive review-fix cycle used in code workflows. By default it runs once over the diff of all phases in the run; with `--per-phase`, once per phase. Every "fix" below is delegated to a `fullstack-developer` subagent with the findings; the main agent never patches code itself.

Terminology:
- `review gate`: human approval checkpoint
- `verification gate`: proof gate that cannot be skipped
- `checkpoint review`: intermediate review for risky implementation phases
- `plan-conformance`: evidence per acceptance criterion — collected by cook, judged by the reviewer

See `risk-and-gates.md` for trigger conditions.

## Checkpoint Review Loop

Use this during implementation when policy marks the phase as risky.

1. Run delegated review on the phase files, with `BASE_SHA` from `run-base.txt` (`subagent-patterns.md` → Code Review). Step 3 checkpoint: implementer report only; no tester report or Step 5 evidence yet, so no acceptance criteria table
2. Check for blocking issues, unsafe tradeoffs, or drift from approved scope
3. Fix blocking findings before continuing
4. If the same phase loops 3 times, escalate to the user instead of silently grinding

**Output:** `✓ Step 3: Checkpoint review complete - [phase] - [approved|fixes applied]`

## Plan-Conformance Gate

Evidence is collected in Step 5; the reviewer judges each criterion in Step 6. Its acceptance criteria table shows:
- every approved criterion ✓ with evidence; ✕ = not met or not verified
- scope creep: an Out of scope item that was built is a ✕ row (`Out of scope: <item> built`); a changed file outside every phase's Related Code Files with no stated reason is a Medium finding

`unmet_criteria_count` = ✕ rows. Any ✕ makes the verdict Block (`code-reviewer.md` → Output Format → Verdict): no auto-approve, fix first. The loops below also check `critical_count` and `unmet_criteria_count` themselves, so a report that contradicts its own verdict is not auto-approved.

Ownership:
- `cook` collects the evidence and never marks a criterion met itself
- `code-reviewer` judges each criterion from evidence

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Confirm the Step 5 evidence is ready
  2. Run code-reviewer (2nd review on: Re-review scope) (risk high: two in parallel, then Merging Two Reviews) → verdict, critical_count, warnings, suggestions, acceptance criteria table (unmet_criteria_count)

  3. DISPLAY FINDINGS:
     ┌─────────────────────────────────────────┐
     │ Code Review Results: [verdict]          │
     ├─────────────────────────────────────────┤
     │ Summary: [what implemented], tests      │
     │ [X/X passed]                            │
     │ Acceptance criteria: [met]/[total]      │
     │ ✕ [ids]                                 │
     │ Scope creep: [list or none]             │
     │ Findings resolved: [N]/[total]          │
     │ Architecture & reliability: [scope line]│
     ├─────────────────────────────────────────┤
     │ Critical Issues ([N]): MUST FIX         │
     │  - [issue] at [file:line]               │
     │ Warnings ([N]): SHOULD FIX              │
     │  - [issue] at [file:line]               │
     │ Suggestions ([N]): NICE TO HAVE         │
     │  - [suggestion]                         │
     └─────────────────────────────────────────┘

  4. AskUserQuestion (header: "Review & Approve"):
     IF verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0:
       - "Fix critical issues and unmet criteria" → fix, re-run tester, cycle++, LOOP
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
  1. Confirm the Step 5 evidence is ready
  2. Run code-reviewer (2nd review on: Re-review scope) (risk high: two in parallel, then Merging Two Reviews) → verdict, critical_count, warnings, acceptance criteria table (unmet_criteria_count)

  3. IF verdict == Accept AND critical_count == 0 AND unmet_criteria_count == 0:
     → Auto-approve, PROCEED

  4. ELSE IF (verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0) AND cycle < 3:
     → Auto-fix critical issues and unmet criteria
     → Re-run tester
     → cycle++, LOOP

  5. ELSE IF (verdict == Block OR critical_count > 0 OR unmet_criteria_count > 0) AND cycle >= 3:
     → ESCALATE TO USER

  6. ELSE IF verdict == Revise:
     → Approve with warnings logged, PROCEED

  7. ELSE (no verdict, or one that is not Accept / Revise / Block):
     → Re-spawn code-reviewer once; still none → ESCALATE TO USER
```

## Re-review (2nd review on)

`cycle` counts the fix rounds already run, so `cycle ≥ 1` means the 2nd review on. A re-review runs on the same `BASE_SHA` and full diff, with a narrower job (prompt: `subagent-patterns.md` → Code Review):
- each previous finding: resolved / not resolved. A previous finding that is not resolved keeps its severity: list it again in its section, marked `not resolved`; it counts in `critical_count` and the verdict.
- every ✕ criterion, and every ✓ criterion whose `Check:` fails in the new tester report: re-judged from the new evidence
- new findings: Critical or High only

Each cycle's fix adds code (validation, error handling) that brings new edge cases; reporting all of them at every level grows the diff and the test count cycle after cycle.

## Severity Levels

Defined once in [`code-reviewer.md`](../../../agents/code-reviewer.md) → Prioritization. Do not restate them here.

## Merging Two Reviews

Risk high runs two reviewers on the same `BASE_SHA` (`workflow-steps.md` → Step 6). Before display or auto-handling:
1. Wait for both reports. A reviewer that errors or returns no verdict is re-spawned once. If it fails again: interactive → show the one report and name the missing review; auto → escalate to the user. Never auto-approve on one report
2. Union the findings. Same `file:line` **and** same problem → keep one, at the higher severity, citing both reviewers (and the check ID, if any). Different problems on the same line stay separate
3. `critical_count` = Critical findings after step 2
3b. `unmet_criteria_count` comes from the main reviewer's table; the architecture & reliability reviewer does not produce one
4. `verdict` = the stricter of the two (Block > Revise > Accept)
5. Scope line: take the architecture & reliability reviewer's
6. A fix cycle re-runs both reviewers

## Output Formats
- Waiting: `⏸ Step 6: Code reviewed - [verdict] - WAITING for approval`
- After fix: `✓ Step 6: [old verdict] → Fixed [N] issues → [new verdict] - Approved`
- Auto-approved: `✓ Step 6: Code reviewed - Accept - Auto-approved`
- Approved: `✓ Step 6: Code reviewed - [verdict] - User approved`
