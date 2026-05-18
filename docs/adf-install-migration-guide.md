# ADF Install Migration Guide

## Fresh Install

```bash
adf all
```

Installs payload into `./.adf/payload/` and generates root compatibility outputs.

## Preview Changes

```bash
adf all --dry-run
```

Prints action classes such as `safe-create`, `unchanged`, `safe-update-managed`, and blocking conflicts.

## Adopt Legacy Root-Copy Install

```bash
adf all --dry-run
adf all --adopt-legacy
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
| Fresh `adf all` install in empty git repo | Pass |
| Fresh rerun with `--dry-run` | Pass, entries classify as `unchanged` |
| Existing legacy root-copy ADF repo | Pass, requires `--adopt-legacy` |
| Existing custom `CLAUDE.md` with no manifest | Dry-run reports blocking unmanaged conflict path |
