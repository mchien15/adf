# ADF Legacy Adoption Rules

Legacy install means ADF files already exist at repo root without `./.adf/manifest.json`.

## Adoptable

ADF treats a legacy path as adoptable when:

- the current root path matches the desired generated content exactly, or
- `CLAUDE.md` / `AGENTS.md` already match the ADF source text or managed-block output

Run:

```bash
adf <tool> --adopt-legacy
```

## Blocking

ADF blocks by default when a legacy path differs from desired managed content.

Examples:

- repo-owned custom `CLAUDE.md`
- modified `.claude/rules/*.md`
- custom `.agents` target

Use `adf --dry-run` first to inspect conflicts.

## Non-Goals

- No heuristic markdown merge outside managed blocks
- No auto-overwrite of divergent repo-owned files
- No silent conversion of unknown `.claude/` children into managed state
