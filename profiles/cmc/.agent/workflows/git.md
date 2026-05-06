---
description: Git operations with CMC git convention
---
# /git - Git Operations

$ARGUMENTS

---

## Task

Load and follow the skill definition at `.agent/skills/git/SKILL.md`.

Pass `$ARGUMENTS` to the skill.

The installed repo uses the CMC git convention:
- `feat/*` and `chore/*` branch from `main` and target `dev`
- `hotfix/*` branches from `main` and targets `main`
- `release/*` is used for packaging releases to `main`

---

## Sub-commands

| Command | Description |
|---------|-------------|
| `/git cm` | Stage files and create commit |
| `/git cp` | Stage, commit, and push |
| `/git pr` | Create a Pull Request |
| `/git merge` | Merge branches |

---

## Examples

```
/git cm
/git cp
/git pr
/git merge
```
