---
description: Generate test cases from use cases, update, and export to CSV/JSON
---
# /test-cases - Test Case Management

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/test-cases/SKILL.md`.

Pass `$ARGUMENTS` to the skill as the subcommand and arguments.

---

## Flags

| Flag | Description |
|------|-------------|
| `generate [module[/uc]]` | Generate test cases from use cases |
| `update` | Sync test cases with use case changes |
| `export csv\|json` | Export test cases to CSV or JSON |
