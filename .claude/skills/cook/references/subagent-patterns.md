# Subagent Patterns

Standard patterns for spawning and using subagents in cook workflows.

## Task Tool Pattern
```
Task(subagent_type="[type]", prompt="[task description]", description="[brief]")
```

## Research Phase
```
Task(subagent_type="researcher", prompt="Research [topic]. Report ≤150 lines.", description="Research [topic]")
```
- Use multiple researchers in parallel for different topics
- Keep reports ≤150 lines with citations

## Scout Phase
```
Task(subagent_type="scout", prompt="Find files related to [feature] in codebase", description="Scout [feature]")
```
- Use `/scout ext` (preferred) or `/scout` (fallback)

## Planning Phase
```
Task(subagent_type="planner", prompt="Create implementation plan based on reports: [reports]. Save to [path]", description="Plan [feature]")
```
- Input: researcher and scout reports
- Output: `plan.md` + `phase-XX-*.md` files

## UI Implementation
```
Task(subagent_type="ui-ux-designer", prompt="Implement [feature] UI per ./docs/design-system/design-principles.md", description="UI [feature]")
```
- For frontend work
- Follow design guidelines

## Testing
```
Task(subagent_type="tester", prompt="Run the full test suite for [all phases of this run | phase-name with --per-phase]. Check the implementer's RED/GREEN evidence: [evidence from every phase covered]. Add a test only for a concrete gap (changed behavior, error path or integration point no test exercises), naming the gap; otherwise add none. Report exact proof used.", description="Test [scope]")
```
- Tests are written test-first in Implementation; the tester verifies and fills gaps
- Must achieve 100% pass rate

## Debugging
```
Task(subagent_type="debugger", prompt="Analyze failures: [details]", description="Debug [issue]")
```
- Use when tests fail
- Provides root cause analysis

## Code Review
```
Task(subagent_type="code-reviewer", prompt="Review changes for [all phases of this run | one phase]: BASE_SHA=[SHA]; git diff $BASE_SHA [-- <phase files>] plus untracked files [among <phase files>]. Risk: [low|medium|high]. Plan: [plan-dir]. Consume the provided Step 5 plan-conformance result, challenge it only if evidence conflicts, then review security, performance, YAGNI/KISS/DRY. [Step 6 with risk high only: Skip the architecture & reliability checklist — the architecture & reliability reviewer runs it; write its scope line as 'skipped (separate reviewer)'.] Return score (X/10), critical, warnings, suggestions and the scope line.", description="Review [scope]")
```
- `BASE_SHA` = the content of `{plan-dir}/reports/run-base.txt`; the same value goes to every reviewer in the step
- Phase-scoped review (Step 3 checkpoint, or Step 6 with `--per-phase`): put `-- <phase files>` in the diff command and name those files. **Phase files** = the files reported changed by the phase's implementer, by the Step 4 tester when it ran for that phase, and by any fix subagent for that phase, plus untracked ones among them. A file shared with an earlier phase may show that phase's lines too

## Architecture & Reliability Review
```
Task(subagent_type="code-reviewer", prompt="Architecture & reliability review only. BASE_SHA=[SHA]; diff: git diff $BASE_SHA [-- <phase files>] plus untracked files [among <phase files>]. Plan: [plan-dir]. Run only the code-review skill's references/architecture-reliability-checklist.md: read its context (ADR Status lines, architecture doc, each phase's Failure modes table), apply A1–A4 to every changed file and R1–R9 to files that hit a trigger. Skip edge-case scouting, the other Systematic Review rows, New Vocabulary and Metrics — the main reviewer covers them in parallel. Do not update the plan file. Every Critical/High finding needs file:line and 'when X → Y', else report it as Medium; keep findings that depend on conditions. Return score (X/10), critical, warnings, suggestions and the scope line.", description="Architecture & reliability review")
```
- Step 6 with risk high only. Spawn in the same message as Code Review so both run in parallel, with the same `BASE_SHA`
- Merge: `review-cycle.md` → Merging Two Reviews

## Project Management
```
Task(subagent_type="project-manager", prompt="Run full sync-back in [plan-path]: reconcile completed tasks with all phase files, backfill stale completed checkboxes across all phases, update plan.md status/progress, and report unresolved mappings. Include final verification evidence status in the summary.", description="Update plan")
```

## Documentation
```
Task(subagent_type="docs-manager", prompt="Update docs for [scope]. Changed files: [list]", description="Update docs")
```

## Git Operations
```
Task(subagent_type="git-manager", prompt="Prepare git closeout options. Stage and commit with a conventional commit message only if the user or mode already approved git actions.", description="Git closeout")
```

## Implementation
```
Task(subagent_type="fullstack-developer", prompt="Implement [phase-file] of plan [plan-dir]. Files you own: [files]. Risk: [level]. Work test-first (TDD) per your agent definition. Run typecheck/build, then report changed files, RED/GREEN evidence, verification output and open issues.", description="Implement phase [N]")
```
- Every code change goes through this — phases, fixes from tester/debugger/code-reviewer findings, follow-ups
- Sequential modes: one fresh subagent per phase, next phase only after the previous one is verified (diff + typecheck + suite GREEN; plus test/review/finalize with `--per-phase`)
- Parallel mode: launch one per phase in the parallel group at once
- Always include file ownership boundaries, risk level and isolation expectation
- Follow-up on the same phase → `SendMessage` to that subagent instead of spawning a new one
