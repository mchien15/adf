# ADF Manifest Schema

ADF stores installation state in `./.adf/manifest.json`.

## Shape

```json
{
  "manifestVersion": "2.0.0",
  "frameworkVersion": "0.0.1",
  "installedAt": "2026-05-11T09:55:26.549Z",
  "installMode": "all",
  "gitProfile": "adf",
  "payloadRoot": ".adf/payload",
  "generatedRoot": ".adf/payload/.generated",
  "backupRoot": ".adf/backups",
  "latestBackupId": "20260511095526",
  "backups": [{ "id": "20260511095526" }],
  "managedPaths": {
    ".claude/rules/primary-workflow.md": {
      "ownership": "managed-children",
      "hash": "file:...",
      "source": ".adf/payload/.claude/rules/primary-workflow.md"
    },
    "CLAUDE.md": {
      "ownership": "managed-block",
      "hash": "...",
      "source": ".adf/payload/CLAUDE.md"
    }
  },
  "legacy": {
    "adoptedAt": "2026-05-11T09:55:26.549Z"
  }
}
```

## Notes

- `managedPaths` is the source of truth for repair, update, and rollback scope
- `hash` stores the desired managed state fingerprint
- `source` is repo-relative and points to the payload or generated source
- `legacy` is only present when a pristine legacy install was explicitly adopted
- Backups are local repo snapshots, not git branches
