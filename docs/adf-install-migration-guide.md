# ADF Install Migration Guide

## Fresh Install

```bash
adf claude
```

Installs payload into `./.adf/payload/` and the Claude Code surfaces (`.claude/` and the `CLAUDE.md` managed block).

### Upgrading from a multi-tool install

Installs made before the Claude-only release may contain Codex, OpenCode, and Antigravity outputs. Re-running `adf claude` removes them (with backup): `.codex/`, `.opencode/`, `.agent/`, `.agents`, `opencode.json`, and the `AGENTS.md` managed block. Run `adf claude --dry-run` first to review the removals.

## Preview Changes

```bash
adf claude --dry-run
```

Prints action classes such as `safe-create`, `unchanged`, `safe-update-managed`, and blocking conflicts.

## Adopt Legacy Root-Copy Install

```bash
adf claude --dry-run
adf claude --adopt-legacy
```

Only pristine legacy paths are adopted automatically.

## Repair

```bash
adf repair
```

## Rollback

```bash
adf rollback latest
```

## Verification Matrix

Verified manually during migration work:

| Scenario | Result |
|----------|--------|
| Fresh `adf claude` install in empty git repo | Pass |
| Fresh rerun with `--dry-run` | Pass, entries classify as `unchanged` |
| Existing legacy root-copy ADF repo | Pass, requires `--adopt-legacy` |
| Existing custom `CLAUDE.md` with no manifest | Dry-run reports blocking unmanaged conflict path |
