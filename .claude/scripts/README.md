# Claude Code Scripts

Node scripts used by the `plan`, `cook` and `docs` skills. No dependencies beyond Node.

## tidy-plans.cjs

Keeps `plans/` clean: merges plans left in git worktrees back into the main tree, normalizes plan `status`, archives completed/cancelled plans to `plans/archive/{YYMM}/`, buckets loose reports into `plans/reports/{YYMM}/`, flags dirs without `plan.md`, and removes junk (`__pycache__`, `*.pyc`, `.DS_Store`). Dry-run by default, never overwrites. Run it from the project root (the same directory the hooks resolve `plans/` against); inside a git worktree it works on the main worktree's `plans/`, like the hooks.

```bash
node .claude/scripts/tidy-plans.cjs                               # dry-run: show what would change
node .claude/scripts/tidy-plans.cjs --apply                       # do it
node .claude/scripts/tidy-plans.cjs archive "$CK_PLANS_PATH/<plan>" --apply  # archive one plan (cook finalize)
```

## set-active-plan.cjs

Marks a plan as the active plan for the current session (needs `CK_SESSION_ID`, set by the `session-init` hook). The hooks then report it under `## Plan Context` and route reports to `{plan-dir}/reports/`.

```bash
node .claude/scripts/set-active-plan.cjs {plan-dir}
```

## validate-docs.cjs

Checks docs against the codebase: code references (`functionName()`, `ClassName`) exist, internal markdown links resolve, env vars are listed in `.env.example`. Warn-only, always exits 0.

```bash
node .claude/scripts/validate-docs.cjs "$CK_DOCS_PATH/"
```

## Tests

```bash
node --test .claude/scripts/__tests__/*.test.cjs
```
