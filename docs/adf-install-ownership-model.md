# ADF Install Ownership Model

ADF now installs its canonical payload under `./.adf/payload/` and generates root-facing support surfaces for supported tools.

## Layout

```text
repo/
├── .adf/
│   ├── payload/         # Canonical installed ADF files (not committed)
│   ├── manifest.json    # Managed-path ownership + install metadata (not committed)
│   ├── backups/         # Local rollback snapshots (not committed)
│   ├── docs/            # (cmc profile) ADF generated docs — COMMITTED
│   └── .gitignore       # Installer-managed: ignores payload/backups/state, keeps docs/ tracked
├── .claude/            # Canonical Claude-facing payload copied from .adf/payload
├── .agent/             # Generated compatibility files for Antigravity
├── .codex/agents/      # Generated Codex custom agents from .adf/payload/.claude/agents
├── .opencode/agents/   # Generated from .adf/payload/.claude/agents
├── .agents             # Symlink or copied fallback to .claude for Codex skill discovery
├── CLAUDE.md           # Managed block injection
└── AGENTS.md           # Managed block injection
```

## CMC Profile Docs Path

Under the `cmc` git-profile, ADF sets `paths.docs = .adf/docs` and `docs.codeLevelOnly = true` (shipped in `profiles/cmc/.claude/config/adf-config.json`, deep-merged into the base config at install). Generated docs go to `./.adf/docs/` so they never collide with CMC's curated company `docs/` tree, and only code-level docs are produced (`codebase-summary.md`, `code-standards.md`, `documentation-index.md`); architecture/PRD/FSD/use-cases are deferred to the company `docs/` tree.

The installer writes a scoped `./.adf/.gitignore` (`/*`, `!/.gitignore`, `!/docs/`) so `.adf/docs/` is committed while install machinery is not. **Caveat:** this requires the repo-root `.gitignore` to NOT blanket-ignore `.adf/`; the installer prints a warning when it detects such a rule.

## Ownership Modes

| Mode | Meaning | Examples |
|------|---------|----------|
| `managed-children` | ADF owns specific generated file paths, not the whole parent dir | `.claude/rules/primary-workflow.md`, `.agent/workflows/cook.md` |
| `managed-block` | ADF owns only a marked block inside an existing file | `CLAUDE.md`, `AGENTS.md` |
| `generated-exclusive` | ADF owns a generated output path and can fully regenerate it | `.codex/agents`, `.opencode/agents`, `.agents` |
| `observed-only` | ADF records state but does not mutate it | Legacy conflicting repo-owned files |

## Root File Markers

ADF injects managed sections with explicit markers:

```html
<!-- adf:managed-block:start adf-claude-instructions -->
...
<!-- adf:managed-block:end adf-claude-instructions -->
```

```html
<!-- adf:managed-block:start adf-agents-instructions -->
...
<!-- adf:managed-block:end adf-agents-instructions -->
```

Text outside those blocks stays repo-owned.

## Conflict Rules

- Missing managed paths: `repair-needed`
- Missing unmanaged paths: `safe-create`
- Existing path identical to desired content without manifest ownership: `legacy-adoptable`
- Existing repo-owned root file or child path that differs: blocking conflict
- Existing manifest-owned path that differs: `safe-update-managed`

## Recovery Rules

- `adf --dry-run` prints planned actions and conflicts without writing
- `adf repair` regenerates only manifest-owned outputs
- `adf rollback [id|latest]` restores last backed-up managed state
- Manifest writes happen after successful install/update generation
