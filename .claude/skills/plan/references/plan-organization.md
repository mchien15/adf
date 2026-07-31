# Plan Creation & Organization

## Directory Structure

### Plan Location

Use `Plan dir:` from `## Naming` section injected by hooks. This is the full computed path.

**Example:** `plans/251101-1505-authentication/` or `ai_docs/feature/MRR-1453/`

### File Organization

IN CURRENT WORKING PROJECT DIRECTORY:
```
{plan-dir}/                                    # From `Plan dir:` in ## Naming
├── research/
│   ├── researcher-XX-report.md
│   └── ...
├── reports/
│   ├── scout-report.md
│   ├── researcher-report.md
│   └── ...
├── plan.md                                    # Overview access point
├── phase-01-setup-environment.md              # Setup environment
├── phase-02-implement-database.md             # Database models
├── phase-03-implement-api-endpoints.md        # API endpoints
├── phase-04-implement-ui-components.md        # UI components
├── phase-05-implement-authentication.md       # Auth & authorization
├── phase-06-implement-profile.md              # Profile page
└── phase-07-write-tests.md                    # Tests
```

### Task Hydration

After creating plan.md and phase files, hydrate tasks (unless `--no-tasks`):
1. TaskCreate per phase with `addBlockedBy` dependency chain
2. Add critical step tasks for high-risk items
3. See `task-management.md` for patterns and cook handoff protocol

### Active Plan State Tracking

See SKILL.md "Active Plan State" section for full rules. Key points:
- Check `## Plan Context` injected by hooks for active/suggested/none state
- After creating plan: `node .claude/scripts/set-active-plan.cjs {plan-dir}`
- Active plans use plan-specific reports path; suggested plans use default path

## File Structure

### Overview Plan (plan.md)

**IMPORTANT:** All plan.md files MUST include YAML frontmatter. See `output-standards.md` for schema.

**Example plan.md structure:**
```markdown
---
title: "Feature Implementation Plan"
description: "Add user authentication with OAuth2 support"
status: pending
priority: P1
effort: 8h
issue: 123
branch: kai/feat/oauth-auth
tags: [auth, backend, security]
created: 2025-12-16
---

# Feature Implementation Plan

## Overview

Brief description of what this plan accomplishes.

## Impact

| Area | Affected? | Details |
|---|---|---|
| DB schema / migration | | |
| API contract (DTO/schema) | | |
| Security / permissions | | |
| Breaking change | | |

> An empty table means "not considered yet", not "nothing is affected".

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Setup | Pending | 2h | [phase-01](./phase-01-setup.md) |
| 2 | Implementation | Pending | 4h | [phase-02](./phase-02-impl.md) |
| 3 | Testing | Pending | 2h | [phase-03](./phase-03-test.md) |

## Dependencies

- List key dependencies here

## Decision Log

> **APPEND-ONLY.** Never edit or delete an existing row — the history is the asset.

| Date | Gate | Decision | Why |
|---|---|---|---|
| 2025-12-16 | Post-Plan | Rejected approach B (event bus) | New infrastructure for a single use case — not worth it yet |
```

**Guidelines:**
- Keep generic and under 100 lines
- List each phase with status/progress
- Link to detailed phase files
- Key dependencies

### `## Impact` — the four rows are fixed

Do not add, remove, or rename rows. The point is that a reader can tell "considered and clear" from "never thought about it", and that only works if the shape is the same in every plan.

Fill the `Details` cell for every row you tick. `cook` reads this table: a ticked **Breaking change**, or a row whose details describe a long-lived architectural commitment, triggers the ADR suggestion at Review Gate 2.

An empty table is a legitimate state — it means nobody has assessed impact yet. It is not the same as four "no"s, and it should not be silently treated as one.

### `## Decision Log` — append-only, no exceptions

One row every time a gate rejects something, or a considered option is dropped. Record **why**, not just what.

This exists because the reasoning is what gets lost across compaction and new sessions. Without it an agent comes back, has no idea approach B was already rejected and on what grounds, and proposes approach B again.

Rules:
- **Append only.** Never rewrite or remove a row, including your own from earlier in the session.
- Never "tidy up" or condense the log. A shorter log is a worse log.
- Superseding an earlier decision means adding a new row that says so — the old row stays.
- No secrets or credentials in the `Why` cell. Describe the reason, do not paste the value.

### Phase Files (phase-XX-name.md)
Fully respect [`.claude/rules/development-rules.md`](../../../rules/development-rules.md).
Each phase file should contain:

**Context Links**
- Links to related reports, files, documentation

**Overview**
- Priority
- Current status
- Brief description

**Key Insights**
- Important findings from research
- Critical considerations

**Requirements**
- Functional requirements
- Non-functional requirements

**Architecture**
- System design
- Component interactions
- Data flow

**Related Code Files**
- List of files to modify
- List of files to create
- List of files to delete

**Implementation Steps**
- Detailed, numbered steps
- Specific instructions

**Todo List**
- Checkbox list for tracking

**Success Criteria**
- Definition of done
- Validation methods

**Risk Assessment**
- Potential issues
- Mitigation strategies

**Security Considerations**
- Auth/authorization
- Data protection

**Next Steps**
- Dependencies
- Follow-up tasks
