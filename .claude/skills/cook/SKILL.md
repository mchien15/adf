---
name: cook
description: "ALWAYS activate this skill before implementing EVERY feature, plan, or fix."
version: 2.2.0
argument-hint: "[task|plan-path] [--interactive|--fast|--parallel|--auto|--no-test]"
---

# Cook - Smart Feature Implementation

End-to-end implementation with automatic workflow detection.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/cook <natural language task OR plan path>
```

**IMPORTANT:** If no flag is provided, the skill will use the `interactive` mode by default for the workflow.

**Optional flags to select the workflow mode:** 
- `--interactive`: Full workflow with user input (**default**)
- `--fast`: Skip research, scout→plan→code
- `--parallel`: Multi-agent execution
- `--no-test`: Request testing-step skip when policy allows
- `--auto`: Skip approval gates, keep hard gates

**Example:**
```
/cook "Add user authentication to the app" --fast
/cook path/to/plan.md --auto
```

## Smart Intent Detection

| Input Pattern | Detected Mode | Behavior |
|---------------|---------------|----------|
| Path to `plan.md` or `phase-*.md` | code | Execute existing plan |
| Contains "fast", "quick" | fast | Skip research, scout→plan→code |
| Contains "trust me", "auto" | auto | Skip approval gates, keep hard gates |
| Lists 3+ features OR "parallel" | parallel | Multi-agent execution |
| Contains "no test", "skip test" | no-test | Request testing-step skip when policy allows |
| Default | interactive | Full workflow with user input |

See `references/intent-detection.md` for detection logic.

## Workflow Overview

```
[Detect + Risk + Isolation] → [Research?] → [Review] → [Plan] → [Review] → [Implement] → [Checkpoint?] → [Test?] → [Plan-Conformance] → [Review] → [Finalize + Verify]
```

**Default (non-auto):** Stops at `[Review]` gates for human approval before each major step.
**Auto mode (`--auto`):** Skips human review gates only. Hard gates still apply.
**Claude Tasks:** Utilize all these tools `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` during implementation step.

See `references/risk-and-gates.md` for risk classification, hard gates, and override rules.

| Mode | Research | Testing Step | Review Gates | Hard Gates | Phase Progression |
|------|----------|--------------|--------------|------------|-------------------|
| interactive | ✓ | ✓ | **User approval at each step** | Always on | One at a time |
| auto | ✓ | ✓ | Skipped | Always on | All at once (no approval stops) |
| fast | ✗ | ✓ | **User approval at each step** | Always on | One at a time |
| parallel | Optional | ✓ | **User approval at each step** | Always on | Parallel groups |
| no-test | ✓ | Policy-limited skip | **User approval at each step** | Always on | One at a time |
| code | ✗ | ✓ | **User approval at each step** | Always on | Per plan |

## Step Output Format

```
✓ Step [N]: [Brief status] - [Key metrics]
```

## Blocking Gates (Non-Auto Mode)

Human review required at these checkpoints (skipped with `--auto`):
- **Post-Research:** Review findings before planning
- **Post-Plan:** Approve plan before implementation
- **Post-Implementation:** Approve code before testing
- **Post-Testing:** 100% pass + approve before finalize

**Always enforced (all modes):**
- **Risk + Isolation:** classify risk first, then follow isolation policy from `risk-and-gates.md`
- **Verification:** proof before completion is mandatory in every mode
- **TDD Evidence:** required for medium/high-risk behavior changes; low-risk skips need a reason
- **Checkpoint Review:** required for high-risk work and medium-risk phases that touch 3+ files or cross-cutting behavior
- **Plan-Conformance:** `cook` verifies approved scope before code-quality review
- **Testing:** 100% pass required (unless no-test mode)
- **`no-test` limits:** cannot bypass verification and should not be used for bugfix/high-risk logic work
- **Code Review:** User approval OR auto-approve (score≥9.5, 0 critical)
- **Finalize (MANDATORY - never skip):**
  1. `project-manager` subagent → run full plan sync-back (all completed tasks/steps across all `phase-XX-*.md`, not only current phase), then update `plan.md` status/progress
  2. `docs-manager` subagent → update `./docs` if changes warrant
  3. `TaskUpdate` → mark all Claude Tasks complete after sync-back verification
  4. `git-manager` subagent → prepare git closeout; commit/push only if user or mode already approved git actions

## Required Subagents (MANDATORY)

| Phase | Subagent | Requirement |
|-------|----------|-------------|
| Research | `researcher` | Optional in fast/code |
| Scout | `scout` | Optional in code |
| Plan | `planner` | Optional in code |
| UI Work | `ui-ux-designer` | If frontend work |
| Testing | `tester`, `debugger` | **MUST** spawn |
| Review | `code-reviewer` | **MUST** spawn |
| Finalize | `project-manager`, `docs-manager`, `git-manager` | **MUST** spawn all 3 |

**CRITICAL ENFORCEMENT:**
- Steps 4, 6, 7 **MUST** use Task tool to spawn subagents
- DO NOT implement testing, review, or finalization yourself - DELEGATE
- If workflow ends with 0 Task tool calls, it is INCOMPLETE
- Pattern: `Task(subagent_type="[type]", prompt="[task]", description="[brief]")`

## References

- `references/intent-detection.md` - Detection rules and routing logic
- `references/risk-and-gates.md` - Risk classification, hard gates, and override rules
- `references/workflow-steps.md` - Detailed step definitions for all modes
- `references/review-cycle.md` - Interactive and auto review processes
- `references/subagent-patterns.md` - Subagent invocation patterns
