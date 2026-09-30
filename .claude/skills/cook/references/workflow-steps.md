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
- Present plan overview with phases, and one **New names** table merged across phases (skip phases with none) — names are cheapest to change before any code exists. In auto mode nobody sees it; the reviewer's New Vocabulary section is then the only naming check
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

**All modes — the main agent orchestrates and never edits code itself:**
- Spawn one fresh `fullstack-developer` subagent per phase, in phase order (`ui-ux-designer` for frontend UI). Prompt: see `subagent-patterns.md` → Implementation
- Use `TaskUpdate` to assign the phase's tasks to the subagent and mark them `in_progress` when dispatching
- The subagent works test-first (TDD): failing test → minimal code → full suite green, and reports RED/GREEN evidence per behavior. A behavior change without evidence and without an allowed skip reason goes back to the subagent
- On return: read the report, check `git diff --stat` against the phase's file list, run type checking/build
- Wrong or incomplete → `SendMessage` the findings to the same subagent (it keeps its context); spawn a fresh one if it is stuck. Do not patch the code yourself
- Once the phase is verified, `TaskUpdate` its tasks to `completed` — this unblocks the next phase's `addBlockedBy`; Step 7 sync-back only reconciles
- Use `ai-multimodal` for image assets
- If high-risk: run checkpoint review before leaving the phase. With `--per-phase`, also for medium-risk phases with 3+ touched files or cross-cutting behavior (by default those are covered by the final review)
- Default scope: once the phase is verified, go straight to the next phase — no tester, reviewer or finalize in between (see Review Scope)
- Fixes from the final test/review span several phases' files: `SendMessage` each finding to the subagent that owns the file, or give the full list to one fresh `fullstack-developer` if those subagents are gone

**Parallel mode:**
- Utilize all tools of Claude Tasks: `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList`
- Launch multiple `fullstack-developer` agents at once, one per phase in the parallel group
- Respect file ownership boundaries
- Wait for parallel group before next

**Output:** `✓ Step 3: Implemented [N] files - [X/Y] tasks complete`

### Checkpoint Review (policy-driven)
- Triggered by `risk-and-gates.md`, not by mode alone
- Use delegated review for risky intermediate state and fix blocking findings before continuing

**Output:** `✓ Step 3: Checkpoint review complete - [phase] - [approved|fixes applied]`

### [Review Gate 3] Post-Implementation (skip if auto mode)
- Default scope: asked once, after the last phase; with `--per-phase`, after every phase
- Present implementation summary (files changed, key changes, and the New names the developers added outside the plan's table)
- Use `AskUserQuestion` to ask: "Proceed to testing?" / "Request implementation changes" / "Abort"
- **Auto mode:** Skip this gate

## Step 4: Testing (skip if no-test mode)

**All modes (except no-test):**
- Tests already exist from Step 3 (TDD). `tester` runs the full suite, checks the RED/GREEN evidence, and adds a test only for a gap it names (changed behavior, error path or integration point no test exercises)
- **MUST** spawn `tester` subagent: `Task(subagent_type="tester", prompt="Run test suite", description="Run tests")`
- If failures: **MUST** spawn `debugger` subagent → `fullstack-developer` applies the fix → repeat
- **Forbidden:** fake mocks, commented tests, changed assertions, skipping subagent delegation
- Pass the implementer's RED/GREEN evidence in the tester handoff (every phase's evidence in the default scope)

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
- Auto-fix critical via `fullstack-developer` (max 3 cycles)
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
4. If `plan.md` is now `completed` (all phases done), archive it: `node .claude/scripts/tidy-plans.cjs archive <plan-dir> --apply` → `plans/archive/{YYMM}/`. Mention the new path in the summary
5. Onboarding check (API keys, env vars)
6. Summarize verification proof before claiming completion

**Why the sweep at step 0 and not only at Gate 2.** Step 2b fires right after planning, when the least is known, and it reads a four-row Impact table that has no architecture row. Decisions worth a record mostly appear *during* implementation. Measured on the plan that built this feature: 18 Decision Log rows, **zero** of them written at `Post-Plan`, and its Impact table never ticked `Breaking change` — so Gate 2 would have stayed silent for all 18.

The sweep is also the only ADR checkpoint that survives `code` mode. Entering with `/cook <plan.md>` routes to `code`, which skips Steps 1 and 2 — and Step 2b lives inside Step 2. Since the reminder hook recommends exactly `/clear` then `/cook {planMdPath}`, that is the dominant path from the second session onward, and Gate 2's question is never reached on it.

**CRITICAL:** Step 7 is INCOMPLETE without spawning all 3 subagents. DO NOT skip subagent delegation.

**Default scope:** Step 7 runs once, after the final review — there is no next phase to start.
**`--per-phase`:** auto mode continues to the next phase from **Step 3**; other modes ask the user before the next phase.
**Run stops early** (abort, blocked phase, escalation): still run Step 7 for the phases completed so far — sync-back and verification summary — and skip the archive, since the plan is not completed.

**Output:** `✓ Step 7: Verified before completion - [proof summary] - Finalized`

## Mode-Specific Flow Summary

Legend: `[R]` = Review Gate (human approval required)

`3(1…N)` = phases 1 to N back to back, each verified; checkpoint review only for high-risk phases. `3(groups)` = parallel groups one after another, phases inside a group at once.

```
interactive: 0 → 1 → [R] → 2 → [R] → 3(1…N) → [R] → 4 → [R] → 5 → 6(user) → 7
auto:        0 → 1 → 2 → 3(1…N) → 4 → 5 → 6(auto) → 7
fast:        0 → skip → 2(fast) → [R] → 3(1…N) → [R] → 4 → [R] → 5 → 6(simple) → 7
parallel:    0 → 1? → [R] → 2(parallel) → [R] → 3(groups, checkpoint per group) → 4 → [R] → 5 → 6(user) → 7
no-test:     0 → 1 → [R] → 2 → [R] → 3(1…N) → [R] → skip(policy) → 5 → 6(user) → 7
code:        0 → skip → skip → 3(1…N) → 4 → [R] → 5 → 6(user) → 7

+ --per-phase (any mode): the same steps, but 3 → 7 run for one phase at a time (parallel: one group at a time)
  (gates [R] follow the mode; auto continues to the next phase, other modes ask first)
```

## Review Scope

**Default — final.** Phases run back to back and Steps 4–7 run once for every phase implemented in this run (the whole plan, or only the phases still open when resuming or cooking a single `phase-*.md`):

1. **Per phase — Step 3 only.** Dispatch the phase to `fullstack-developer` (TDD; its Verify GREEN runs the full suite), check `git diff --stat` + typecheck, mark the phase's tasks complete, go straight to the next phase. No `tester`, no `code-reviewer`, no finalize between phases.
   - Checkpoint review still runs for **high-risk** phases (hard gate). Medium-risk checkpoints are covered by the final review.
   - A phase that fails verification is fixed (same subagent) before the next phase starts — never carry a red suite forward.
   - Keep each phase's report, with its TDD Evidence, in the plan's `reports/` so Step 4 can hand all of it to `tester` — also after compaction or a resume.
2. **After the last phase — once:** Step 4 `tester` (full suite, every phase's RED/GREEN evidence) → Step 5 plan-conformance across the phases of this run → Step 6 one `code-reviewer` pass over their diff; fixes go to `fullstack-developer`, cycle limits per mode → Step 7 finalize once (sync-back all phases, docs, git, archive).
3. **Approval gates** still follow the mode: interactive asks once at Gate 3 (after all phases), Gate 4, and review; `auto` asks no approval questions (hard gates such as the high-risk in-place acknowledgement still apply).

**`--per-phase`** (or "review each phase", "review từng phase"): Steps 3→7 repeat for every phase, and medium-risk phases with 3+ files or cross-cutting behavior get a checkpoint review too. `--final-review` is still accepted and means the default.

Trade-off: the default runs one tester, one reviewer and one finalize instead of one per phase, so it is much faster. Findings in early phases surface later and may touch more code; choose `--per-phase` for high-risk plans where early feedback matters more than speed.


## Critical Rules

- Never skip steps without mode justification
- Never skip hard gates because of mode flags
- **MANDATORY SUBAGENT DELEGATION:** Steps 3, 4, 6, 7 MUST spawn subagents via Task tool. DO NOT implement directly. By default Steps 4, 6, 7 run once for all phases of the run; with `--per-phase`, once per phase
  - Step 3: `fullstack-developer` per phase (`ui-ux-designer` for UI) — also for every fix requested by tester, debugger or code-reviewer
  - Step 4: `tester` (and `debugger` if failures)
  - Step 6: `code-reviewer`
  - Step 7: `project-manager`, `docs-manager`, `git-manager`
- Use `TaskCreate` to create Claude Tasks for each unchecked item with priority order and dependencies.
- Use `TaskUpdate` to mark Claude Tasks `in_progress` when picking up a task.
- Use `TaskUpdate` to mark Claude Tasks `completed` as soon as their phase is verified (Step 3); Step 7 only reconciles.
- All step outputs follow format: `✓ Step [N]: [status] - [metrics]`
- **VALIDATION:** If Task tool calls = 0 at end of workflow, the workflow is INCOMPLETE.
