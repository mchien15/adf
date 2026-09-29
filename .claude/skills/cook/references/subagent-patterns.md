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
Task(subagent_type="tester", prompt="Run the full test suite for plan phase [phase-name]. Check the implementer's RED/GREEN evidence: [evidence]. Add tests only for uncovered edge cases/errors and report exact proof used.", description="Test [phase]")
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
Task(subagent_type="code-reviewer", prompt="Review changes for [phase]. Consume the provided Step 5 plan-conformance result, challenge it only if evidence conflicts, then review security, performance, YAGNI/KISS/DRY. Return score (X/10), critical, warnings, suggestions.", description="Review [phase]")
```

## Project Management
```
Task(subagent_type="project-manager", prompt="Run full sync-back in [plan-path]: reconcile completed tasks with all phase files, backfill stale completed checkboxes across all phases, update plan.md status/progress, and report unresolved mappings. Include final verification evidence status in the summary.", description="Update plan")
```

## Documentation
```
Task(subagent_type="docs-manager", prompt="Update docs for [phase]. Changed files: [list]", description="Update docs")
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
- Sequential modes: one fresh subagent per phase, next phase only after the previous one is verified
- Parallel mode: launch one per phase in the parallel group at once
- Always include file ownership boundaries, risk level and isolation expectation
- Follow-up on the same phase → `SendMessage` to that subagent instead of spawning a new one
