# ADR-0001: Derive the review verdict from findings instead of a score

🟡 Proposed

- **Date**: 2026-10-25
- **Deciders**: @mchien15 (ADF maintainer)

## Context

`code-reviewer` was asked, by the cook and `/fix` prompts, to return a self-reported `score X/10`. Cook and `/fix` auto-approved at score ≥ 9.5 with no Critical finding; `/fix` quick mode accepted 8.5 and offered a quick commit at 9.0. The reviewer's own Output Format had no score field and no rubric, so nothing calibrated the number. In practice only `critical_count` changed what the loops did; the score only changed the output line.

The same change introduced numbered acceptance criteria per plan phase, judged by the reviewer as ✓ or ✕. An unmet criterion has no `file:line`, so it cannot be expressed as a Critical finding, yet it must stop approval — including in `cook --auto`, where no human looks at the report.

The verdict is the reviewer's own word about its own report. A gate that reads only that word trusts the reviewer never to contradict itself.

## Decision

The reviewer writes a verdict last, after its findings and acceptance criteria table, derived from them: **Block** = any Critical finding or any ✕ acceptance criterion; **Revise** = any High finding; **Accept** = neither. The rule is defined once, in `.claude/agents/code-reviewer.md` → `### Verdict`.

Cook and `/fix` auto-approve only when `verdict == Accept AND critical_count == 0 AND unmet_criteria_count == 0`. `Block`, a Critical or a ✕ criterion → auto-fix (at most 3 cycles), then escalate. `Revise` with High findings only → approve with the warnings logged. No or unknown verdict → re-spawn the reviewer once, then escalate. With two reviewers the stricter verdict wins (Block > Revise > Accept). On a re-review, a previous finding that is not resolved keeps its severity and counts.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Keep `score X/10` and the thresholds | No change for anything that reads the number | Uncalibrated; three different thresholds (9.5, 9.0, 8.5) for the same reviewer | The number decided nothing that `critical_count` did not already decide, and gave false precision |
| 0–2 rubric per review dimension | Makes the reasoning per dimension visible | Six more numbers, each as uncalibrated as the one it replaces | Multiplies the problem instead of removing it |
| ✕ criterion → Revise | Keeps Block for code defects only | Revise then meant two gate actions: approve with warnings (High only) or fix first (✕) | Loops had to look past the verdict to branch; ✕ already meant "fix first", like Critical |
| Branch on the verdict word alone | Simplest loop conditions | A report that says Accept while listing a Critical or a ✕ row auto-approves; a missing verdict fell into the approve branch | Review cycle 0 finding H1: the counts are the guard against a self-contradicting report |
| Verdict derived from findings, guarded by counts (chosen) | Gate follows the findings; unmet criterion blocks `--auto` | See Consequences | — |

## Consequences

### Positive

- The approve/fix decision follows the findings and the acceptance criteria table, not a number nobody calibrated
- An unmet acceptance criterion blocks `cook --auto` and `/fix` autonomous mode
- A report that contradicts itself, or has no verdict, cannot auto-approve

### Negative

- Breaking for anything outside this repo that reads `[score]/10` from cook or `/fix` output
- The verdict is only as good as the reviewer's severity labels: a High finding labeled Medium passes as Accept
- The gate condition is restated in about eight files (cook and `/fix` skills, references, docs); restatements can drift, and a guard test for the wording was declined

### Neutral / trade-off

- Revise with High findings only still auto-approves with the warnings logged, as "no Critical → approve with warnings" did before
- `critical_count` and `unmet_criteria_count` are still returned and read; the verdict does not replace them

## Implementation notes

- Rule: `.claude/agents/code-reviewer.md` → `### Verdict` (generated copies in `.codex/agents/`, `.opencode/agents/`)
- Loops: `.claude/skills/cook/references/review-cycle.md` (Interactive Cycle, Auto-Handling Cycle, Merging Two Reviews, Re-review), `.claude/skills/fix/references/review-cycle.md`
- Prompts: `.claude/skills/cook/references/subagent-patterns.md`, `.claude/skills/fix/references/workflow-quick.md`

## Related

- Plan: `plans/261025-0101-acceptance-criteria-review/` (phase 08, Decision Log rows with Gate `Plan`, `Validate`, `Review`)
