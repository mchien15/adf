# Pull Request Workflow

Execute via `git-manager` subagent.

## Variables
- TO_BRANCH: target. Defaults by branch type:
  - `feat/*`, `chore/*` -> `dev`
  - `hotfix/*`, `release/*` -> `main`
  - other branches -> `main`
- FROM_BRANCH: source (defaults to current branch)

## CRITICAL: Use REMOTE diff
PRs are based on remote branches. Local diff includes unpushed changes.

## Tool 1: Sync + Analyze

**IMPORTANT: Sync the current branch with its expected target branch first.**

```bash
git fetch origin && \
git push -u origin HEAD 2>/dev/null || true && \
HEAD=$(git rev-parse --abbrev-ref HEAD) && \
case "$HEAD" in \
  feat/*|chore/*) BASE=${BASE_BRANCH:-dev} ;; \
  hotfix/*|release/*) BASE=${BASE_BRANCH:-main} ;; \
  *) BASE=${BASE_BRANCH:-main} ;; \
esac && \
echo "=== PR: $HEAD -> $BASE ===" && \
echo "=== COMMITS ===" && \
git log origin/$BASE...origin/$HEAD --oneline && \
echo "=== FILES ===" && \
git diff origin/$BASE...origin/$HEAD --stat
```

**If branch not on remote:** Push first, retry.

## Tool 2: Generate Content
**Title:** Conventional commit format, <72 chars, no version numbers
**Body:** Summary bullets + test plan checklist

## Tool 3: Create PR
```bash
gh pr create --base $BASE --head $HEAD --title "..." --body "$(cat <<'EOF'
## Summary
- Bullet points

## Test plan
- [ ] Test item
EOF
)"
```

## Error Handling

| Error | Action |
|-------|--------|
| Branch not on remote | `git push -u origin HEAD`, retry |
| Empty diff | Warn: "No changes for PR" |
| Push rejected | `git pull --rebase`, resolve, push |
| No upstream | `git push -u origin HEAD` |
