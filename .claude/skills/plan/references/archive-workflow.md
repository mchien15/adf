# Archive Workflow

## Your mission
Read and analyze the plans, then archive specific plans or all plans in the `plans` directory.

## Plan Resolution
1. If `$ARGUMENTS` provided → Use that path
2. Else read all plans in the `plans` directory

## Workflow

### Step 1: Read Plan Files

Read the plan directory:
- `plan.md` - Overview and phases list
- `phase-*.md` - 20 first lines of each phase file to understand the progress and status

### Step 2: Ask user to confirm the action before archiving these plans
Use `AskUserQuestion` tool to ask if user wants to proceed with archiving these plans, select specific plans to archive or all completed plans only.
Use `AskUserQuestion` tool to ask if user wants to delete permanently or move to `./plans/archive/{YYMM}/`.
For a whole messy tree, show `node .claude/scripts/tidy-plans.cjs` (dry-run) output first — it also merges worktree plans, normalizes statuses and buckets loose reports.

### Step 3: Archive the plans
Start archiving the plans based on the user's choice:
- Move: `node .claude/scripts/tidy-plans.cjs archive "$CK_PLANS_PATH/<plan>" --apply` per plan (→ `plans/archive/{YYMM}/`; `$CK_PLANS_PATH` is the shared plans dir, also correct inside a git worktree), or `node .claude/scripts/tidy-plans.cjs --apply` for the full tidy the user approved
- Delete the plans permanently: `rm -rf "$CK_PLANS_PATH/<plan-1>" "$CK_PLANS_PATH/<plan-2>" ...`

### Step 4: Ask if user wants to commit the changes
Use `AskUserQuestion` tool to ask if user wants to commit the changes with these options:
- Stage and commit the changes (Use `/git cm` slash command)
- Commit and push the changes (Use `/git cp` slash command)
- Nah, I'll do it later

## Output
After archiving the plans, provide summary:
- Number of plans archived
- Number of plans deleted permanently
- Table of plans that are archived or deleted (title, status, created date, LOC)

## Important Notes
- Only ask questions about genuine decision points
- Sacrifice grammar for concision
- List any unresolved questions at the end
- Ensure token efficiency while maintaining high quality
