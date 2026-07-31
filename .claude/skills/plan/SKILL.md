---
name: plan
description: "Plan implementations, design architectures, create technical roadmaps with detailed phases. Use for feature planning, system design, solution architecture, implementation strategy, phase documentation."
argument-hint: "[task] OR archive|audit|validate"
license: MIT
---

# Planning

Create detailed technical implementation plans through research, codebase analysis, solution design, and comprehensive documentation.

## Default (No Arguments)

If invoked with a task description, proceed with planning workflow. If invoked WITHOUT arguments or with unclear intent, use `AskUserQuestion` to present available operations:

| Operation | Description |
|-----------|-------------|
| `(default)` | Create implementation plan for a task |
| `archive` | Write journal entry & archive plans |
| `audit` | Adversarial plan audit |
| `validate` | Critical questions interview |

Present as options via `AskUserQuestion` with header "Planning Operation", question "What would you like to do?".

## Workflow Modes

Default: `--auto` (analyze task complexity and auto-pick mode).

| Flag | Mode | Research | Audit | Validation | Cook Flag |
|------|------|----------|----------|------------|-----------|
| `--auto` | Auto-detect | Follows mode | Follows mode | Follows mode | Follows mode |
| `--fast` | Fast | Skip | Skip | Skip | `--auto` |
| `--hard` | Hard | 2 researchers | Yes | Optional | (none) |
| `--parallel` | Parallel | 2 researchers | Yes | Optional | `--parallel` |
| `--two` | Two approaches | 2+ researchers | After selection | After selection | (none) |

Add `--no-tasks` to skip task hydration in any mode.

Load: `references/workflow-modes.md` for auto-detection logic, per-mode workflows, context reminders.

## When to Use

- Planning new feature implementations
- Architecting system designs
- Evaluating technical approaches
- Creating implementation roadmaps
- Breaking down complex requirements

## Core Responsibilities & Rules

Always honoring **YAGNI**, **KISS**, and **DRY** principles.
**Be honest, be brutal, straight to the point, and be concise.**

### 1. Research & Analysis
Load: `references/research-phase.md`
**Skip if:** Fast mode or provided with researcher reports

### 2. Codebase Understanding
Load: `references/codebase-understanding.md`
**Skip if:** Provided with scout reports

### 3. Solution Design
Load: `references/solution-design.md`

### 4. Plan Creation & Organization
Load: `references/plan-organization.md`

### 5. Task Breakdown & Output Standards
Load: `references/output-standards.md`

## Workflow Process

1. **Pre-Creation Check** → Check Plan Context for active/suggested/none
2. **Mode Detection** → Auto-detect or use explicit flag (see `workflow-modes.md`)
3. **Research Phase** → Spawn researchers (skip in fast mode)
4. **Codebase Analysis** → Read docs, scout if needed, **and read existing ADRs** (see below)
5. **Plan Documentation** → Write comprehensive plan via planner subagent
6. **Impact Check** → Read the plan's `## Impact` table; suggest an ADR when warranted (see below)
7. **Audit Review** → Use `Skill` tool: `Skill(skill: "plan", args: "audit {plan-path}")` (hard/parallel/two modes)
8. **Post-Plan Validation** → Use `Skill` tool: `Skill(skill: "plan", args: "validate {plan-path}")` (hard/parallel/two modes)
9. **Hydrate Tasks** → Create Claude Tasks from phases (default on, `--no-tasks` to skip)
10. **Context Reminder** → Output cook command with absolute path (MANDATORY)

### Step 4 — Read existing decisions before proposing

Find existing records with the probe in [`../adr/references/docs-root-detection.md`](../adr/references/docs-root-detection.md) → Layer 3, and follow its **reading** rule: read every surviving record **wherever it lives**, without asking. Do not look only in `<docs-root>/adr/` — a repo that adopted ADRs before ADF keeps them somewhere else, and missing them is silent.

Read each record's **title** and its **`Alternatives considered` → `Why not`** column before you design anything. Records written by other tools (`adr-tools`, MADR) may have no such column — read Context and Decision instead.

This is the half of decision capture that pays. Writing records prevents the reasoning from being lost; reading them is what stops you re-proposing the option somebody already rejected — the failure this whole mechanism exists to prevent. A record nobody reads is a filing cabinet.

If your plan proposes something a record rejected, you must either say why the rejection no longer holds, or pick something else. Silently re-proposing it is the exact failure mode.

### Step 6 — Impact Check

Same rule `cook` applies at its Step 2b, so `/plan` run on its own does not lose the signal.

> **`--auto` here is not `cook --auto`.** This skill's `--auto` means *auto-detect the workflow mode* and is the **default** — it does not suppress this question. The rule that skips the ADR question applies to non-interactive execution (`cook --auto`), where there is no human to answer. Plain `/plan` and `/plan --hard` ask. `/plan --fast` skips the question — its whole premise is no round-trips — and instead appends a Decision Log line noting an ADR looks warranted.

Ask once — *"Does this decision outlive the task? Open an ADR?"* — only when the `## Impact` table ticks **Breaking change**, or a row describes a long-lived architectural commitment.

- **Yes** → invoke the `adr` skill (defaults to 🟡 Proposed; never set 🟢 Accepted here)
- **No** → append the decision and its reason to the plan's `## Decision Log`
- **Table empty, or only `DB schema` / `API contract` ticked** → ask nothing. Those two are too common to be signals, and a routine question gets dismissed unread

## Output Requirements

- DO NOT implement code - only create plans
- Respond with plan file path and summary
- Ensure self-contained plans with necessary context
- Include code snippets/pseudocode when clarifying
- Fully respect [`.claude/rules/development-rules.md`](../../rules/development-rules.md)

## Task Management

Plan files = persistent. Tasks = session-scoped. Hydration bridges the gap.

**Default:** Auto-hydrate tasks after plan files are written. Skip with `--no-tasks`.
**3-Task Rule:** <3 phases → skip task creation.

Load: `references/task-management.md` for hydration pattern, TaskCreate patterns, cook handoff protocol.

### Hydration Workflow
1. Write plan.md + phase files (persistent layer)
2. TaskCreate per phase with `addBlockedBy` chain
3. TaskCreate for critical/high-risk steps within phases
4. Metadata: phase, priority, effort, planDir, phaseFile
5. Cook picks up via TaskList (same session) or re-hydrates (new session)

## Active Plan State

Check `## Plan Context` injected by hooks:
- **"Plan: {path}"** → Active plan. Ask "Continue? [Y/n]"
- **"Suggested: {path}"** → Branch hint only. Ask if activate or create new.
- **"Plan: none"** → Create new using `Plan dir:` from `## Naming`

After creating plan: `node .claude/scripts/set-active-plan.cjs {plan-dir}`
Reports: Active plans → plan-specific path. Suggested → default path.

### Important
DO NOT create plans or reports in USER directory.
ALWAYS create plans or reports in CURRENT WORKING PROJECT DIRECTORY.

## Subcommands

| Subcommand | Reference | Purpose |
|------------|-----------|---------|
| `/plan archive` | `references/archive-workflow.md` | Archive plans + write journal entries |
| `/plan audit` | `references/audit-workflow.md` | Adversarial plan audit with hostile reviewers |
| `/plan validate` | `references/validate-workflow.md` | Validate plan with critical questions interview |

## Quality Standards

- Thorough and specific, consider long-term maintainability
- Research thoroughly when uncertain
- Address security and performance concerns
- Detailed enough for junior developers
- Validate against existing codebase patterns

**Remember:** Plan quality determines implementation success. Be comprehensive and consider all solution aspects.
