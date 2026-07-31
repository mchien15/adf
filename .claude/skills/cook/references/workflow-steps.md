# Unified Workflow Steps

All modes share core steps with mode-specific variations.

## Step 0: Intent Detection & Setup

1. Parse input with `intent-detection.md` rules
2. Classify risk with `risk-and-gates.md`
3. Check branch, dirty workspace, and isolation availability
4. Decide isolation need: `in-place`, `recommended`, or `required`
5. If isolation is `required` and work stays in-place: get explicit user acknowledgement before proceeding
6. Log detected mode and risk
7. If mode=code: detect plan path, set active plan
8. Use `TaskCreate` to create workflow step tasks (with dependencies if complex)

**Output:** `✓ Step 0: Mode [interactive|auto|fast|parallel|no-test|code] - Risk [low|medium|high] - Isolation [in-place|recommended|required]`

## Step 1: Research (skip if fast/code mode)

**Interactive/Auto:**
- Spawn multiple `researcher` agents in parallel
- Use `/scout ext` or `scout` agent for codebase search
- Keep reports ≤150 lines

**Parallel:**
- Optional: max 2 researchers if complex

**Output:** `✓ Step 1: Research complete - [N] reports gathered`

### [Review Gate 1] Post-Research (skip if auto mode)
- Present research summary to user
- Use `AskUserQuestion` to ask: "Proceed to planning?" / "Request more research" / "Abort"
- **Auto mode:** Skip this gate

## Step 2: Planning

**Interactive/Auto/No-test:**
- Use `planner` agent with research context
- Create `plan.md` + `phase-XX-*.md` files

**Fast:**
- Use `/plan --fast` with scout results only
- Minimal planning, focus on action

**Parallel:**
- Use `/plan --parallel` for dependency graph + file ownership matrix

**Code:**
- Skip - plan already exists
- Parse existing plan for phases

**Output:** `✓ Step 2: Plan created - [N] phases`

### Step 2b: Read the Impact table

Read `## Impact` in `plan.md` (spec: [`../../plan/references/plan-organization.md`](../../plan/references/plan-organization.md)). It is a signal, not a gate — nothing blocks here.

| Table state | Action |
|---|---|
| Empty | Nothing. Do not ask, do not slow the flow — an empty table means impact was not assessed, which is the planner's problem, not a reason to interrupt |
| Rows ticked, none architectural | Nothing |
| **Breaking change** ticked, or a row describing a long-lived architectural commitment | Carry an ADR suggestion into Review Gate 2 |

**Do not trigger on `DB schema / migration` or `API contract` alone.** Both are far too common; treating them as triggers makes the question routine, and a routine question gets dismissed without being read.

**Output:** `✓ Step 2b: Impact reviewed - ADR [suggested|n/a]`

### [Review Gate 2] Post-Plan (skip if auto mode)
- Present plan overview with phases
- Use `AskUserQuestion` to ask: "Validate the plan or approve plan to start implementation?" - "Validate" / "Approve" / "Abort" / "Other" ("Request revisions")
  - "Validate": run `/plan validate` slash command
  - "Approve": continue to implementation
  - "Abort": stop the workflow
  - "Other": revise the plan based on user's feedback
- **If Step 2b raised a suggestion**, add one question to the same `AskUserQuestion` call — do not open a second round-trip: *"Does this decision outlive the task? Open an ADR?"*
  - **Yes** → invoke the `adr` skill. It defaults to 🟡 Proposed; nothing here may set 🟢 Accepted
  - **No** → append a row to the plan's `## Decision Log` recording the decision and the reason. No ADR
- **Auto mode:** Skip this gate. Append a row to `## Decision Log` noting an ADR looks warranted, and continue. **Auto never creates an ADR and never accepts one.**

**Output:** `✓ Gate 2: ADR [created|declined|deferred-to-log|n/a]`

## Step 3: Implementation

**IMPORTANT:**
1. `TaskList` first — check for existing tasks (hydrated by planning skill in same session)
2. If tasks exist → pick them up, skip re-creation
3. If no tasks → read plan phases, `TaskCreate` for each unchecked `[ ]` item with priority order and metadata (`phase`, `planDir`, `phaseFile`)
4. Tasks can be blocked by other tasks via `addBlockedBy`

**All modes:**
- Use `TaskUpdate` to mark tasks as `in_progress` immediately.
- Execute phase tasks sequentially (Step 3.1, 3.2, etc.)
- Use `ui-ux-designer` for frontend
- Use `ai-multimodal` for image assets
- Run type checking after each file
- If medium/high-risk behavior work: capture TDD evidence where policy requires
- If high-risk, or medium-risk with 3+ touched files or cross-cutting behavior: run checkpoint review before leaving the phase

**Parallel mode:**
- Utilize all tools of Claude Tasks: `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList`
- Launch multiple `fullstack-developer` agents
- When agents pick up a task, use `TaskUpdate` to assign task to agent and mark tasks as `in_progress` immediately.
- Respect file ownership boundaries
- Wait for parallel group before next

**Output:** `✓ Step 3: Implemented [N] files - [X/Y] tasks complete`

### Checkpoint Review (policy-driven)
- Triggered by `risk-and-gates.md`, not by mode alone
- Use delegated review for risky intermediate state and fix blocking findings before continuing

**Output:** `✓ Step 3: Checkpoint review complete - [phase] - [approved|fixes applied]`

### [Review Gate 3] Post-Implementation (skip if auto mode)
- Present implementation summary (files changed, key changes)
- Use `AskUserQuestion` to ask: "Proceed to testing?" / "Request implementation changes" / "Abort"
- **Auto mode:** Skip this gate

## Step 4: Testing (skip if no-test mode)

**All modes (except no-test):**
- Write tests: happy path, edge cases, errors
- **MUST** spawn `tester` subagent: `Task(subagent_type="tester", prompt="Run test suite", description="Run tests")`
- If failures: **MUST** spawn `debugger` subagent → fix → repeat
- **Forbidden:** fake mocks, commented tests, changed assertions, skipping subagent delegation
- For medium/high-risk behavior work, include red/green proof in tester handoff or summary

**Output:** `✓ Step 4: Tests [X/X passed] - tester subagent invoked`

**No-test policy:**
- `--no-test` skips this step only when allowed by `risk-and-gates.md`
- It never skips final verification

### [Review Gate 4] Post-Testing (skip if auto mode)
- Present test results summary
- Use `AskUserQuestion` to ask: "Proceed to code review?" / "Request test fixes" / "Abort"
- **Auto mode:** Skip this gate

## Step 5: Plan-Conformance Check

**All modes - required before code-quality review:**
- Confirm delivered behavior matches the approved plan or task scope
- Reject unplanned scope creep, missing acceptance items, or silent tradeoffs
- `cook` owns this gate and passes the result into the final reviewer prompt

**Output:** `✓ Step 5: Plan conformance verified - [criteria met count]`

## Step 6: Code Review

**All modes - MANDATORY subagent:**
- **MUST** spawn `code-reviewer` subagent: `Task(subagent_type="code-reviewer", prompt="Review changes. Return score, critical issues, warnings.", description="Code review")`
- **DO NOT** review code yourself - delegate to subagent
- Reviewer should consume Step 5 conformance output and only challenge it when evidence conflicts

**Interactive/Parallel/Code/No-test:**
- Interactive cycle (max 3): see `review-cycle.md`
- Requires user approval

**Auto:**
- Auto-approve if score≥9.5 AND 0 critical
- Auto-fix critical (max 3 cycles)
- Escalate to user after 3 failed cycles

**Fast:**
- Simplified review, no fix loop
- User approves or aborts

**Output:** `✓ Step 6: Review [score]/10 - [Approved|Auto-approved] - code-reviewer subagent invoked`

## Step 7: Finalize

**All modes - MANDATORY subagents (NON-NEGOTIABLE):**

0. **Decision Log sweep — do this FIRST, before spawning anything.** If the plan has a `## Decision Log` with any rows, **show it to the user** and ask once: *"any of these outlive the task?"* Yes → invoke the `adr` skill for those. No → nothing; the log already holds the reasoning. No log, or an empty one → skip silently.

   **Do not compute a count or filter by `Gate`.** An earlier version tried to count "rows written during implementation" by testing `Gate != Post-Plan`. Measured on the plan that built this feature: 32 rows, `Post-Plan` appearing **zero** times, so the filter selected 32 of 32 and discriminated nothing. It also assumed a `Gate` vocabulary nobody defined, broke on blank cells, and only parsed at all because that column happened to be written in English while the rest of the table was not. A human scanning ten rows is faster and more accurate than any of it.

   **Order matters.** A record created after the trio below has missed `docs-manager` (so it never reaches `system-architecture.md`) and missed `git-manager` (so it is not in the commit). Both failures are silent.

   **Auto mode:** do not ask and do not create a record — append one line to the Decision Log noting a sweep is owed.

   **Output:** `✓ Step 7: Decision Log swept - ADR [created|declined|deferred-to-log|n/a]`

1. **MUST** spawn these subagents in parallel:
   - `Task(subagent_type="project-manager", prompt="Run full sync-back for [plan-path]: reconcile all completed Claude Tasks with all phase files, backfill stale completed checkboxes across every phase, then update plan.md frontmatter/table progress. Do NOT only mark current phase.", description="Update plan")`
   - `Task(subagent_type="docs-manager", prompt="Update docs for changes. Leave the ADR directory alone — it is hand-maintained and cannot be derived from code.", description="Update docs")`
   - `Task(subagent_type="git-manager", prompt="Prepare git closeout options, stage if approved, and only commit/push when the user or mode already approved git actions.", description="Git closeout")`
2. Project-manager sync-back MUST include:
   - Sweep all `phase-XX-*.md` files in the plan directory.
   - Mark every completed item `[ ] → [x]` based on completed tasks (including earlier phases finished before current phase).
   - Update `plan.md` status/progress (`pending`/`in-progress`/`completed`) from actual checkbox state.
   - Return unresolved mappings if any completed task cannot be matched to a phase file.
3. Use `TaskUpdate` to mark Claude Tasks complete after sync-back confirmation.
4. Onboarding check (API keys, env vars)
5. Summarize verification proof before claiming completion

**Why the sweep at step 0 and not only at Gate 2.** Step 2b fires right after planning, when the least is known, and it reads a four-row Impact table that has no architecture row. Decisions worth a record mostly appear *during* implementation. Measured on the plan that built this feature: 18 Decision Log rows, **zero** of them written at `Post-Plan`, and its Impact table never ticked `Breaking change` — so Gate 2 would have stayed silent for all 18.

The sweep is also the only ADR checkpoint that survives `code` mode. Entering with `/cook <plan.md>` routes to `code`, which skips Steps 1 and 2 — and Step 2b lives inside Step 2. Since the reminder hook recommends exactly `/clear` then `/cook {planMdPath}`, that is the dominant path from the second session onward, and Gate 2's question is never reached on it.

**CRITICAL:** Step 7 is INCOMPLETE without spawning all 3 subagents. DO NOT skip subagent delegation.

**Auto mode:** Continue to next phase automatically, start from **Step 3**.
**Others:** Ask user before next phase

**Output:** `✓ Step 7: Verified before completion - [proof summary] - Finalized`

## Mode-Specific Flow Summary

Legend: `[R]` = Review Gate (human approval required)

```
interactive: 0 → 1 → [R] → 2 → [R] → 3 → [R] → 4 → [R] → 5 → 6(user) → 7
auto:        0 → 1 → 2 → 3 → 4 → 5 → 6(auto) → 7 → next phase
fast:        0 → skip → 2(fast) → [R] → 3 → [R] → 4 → [R] → 5 → 6(simple) → 7
parallel:    0 → 1? → [R] → 2(parallel) → [R] → 3(multi-agent) → checkpoint? → 4 → [R] → 5 → 6(user) → 7
no-test:     0 → 1 → [R] → 2 → [R] → 3 → [R] → skip(policy) → 5 → 6(user) → 7
code:        0 → skip → skip → 3 → checkpoint? → 4 → [R] → 5 → 6(user) → 7
```

## Critical Rules

- Never skip steps without mode justification
- Never skip hard gates because of mode flags
- **MANDATORY SUBAGENT DELEGATION:** Steps 4, 6, 7 MUST spawn subagents via Task tool. DO NOT implement directly.
  - Step 4: `tester` (and `debugger` if failures)
  - Step 6: `code-reviewer`
  - Step 7: `project-manager`, `docs-manager`, `git-manager`
- Use `TaskCreate` to create Claude Tasks for each unchecked item with priority order and dependencies.
- Use `TaskUpdate` to mark Claude Tasks `in_progress` when picking up a task.
- Use `TaskUpdate` to mark Claude Tasks `complete` immediately after finalizing the task.
- All step outputs follow format: `✓ Step [N]: [status] - [metrics]`
- **VALIDATION:** If Task tool calls = 0 at end of workflow, the workflow is INCOMPLETE.
