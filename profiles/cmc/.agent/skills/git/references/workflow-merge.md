# Merge Workflow

Execute via `git-manager` subagent.

## Variables
- TO_BRANCH: target. Defaults by source branch type:
  - `feat/*`, `chore/*` -> `dev`
  - `hotfix/*`, `release/*` -> `main`
  - other branches -> `main`
- FROM_BRANCH: source (defaults to current branch)

## Step 1: Sync with Remote

**IMPORTANT: Merge only committed and pushed changes from remote branches.**

```bash
git fetch origin && \
FROM_BRANCH=${FROM_BRANCH:-$(git rev-parse --abbrev-ref HEAD)} && \
case "$FROM_BRANCH" in \
  feat/*|chore/*) TO_BRANCH=${TO_BRANCH:-dev} ;; \
  hotfix/*|release/*) TO_BRANCH=${TO_BRANCH:-main} ;; \
  *) TO_BRANCH=${TO_BRANCH:-main} ;; \
esac && \
git checkout "$TO_BRANCH" && \
git pull origin "$TO_BRANCH"
```

## Step 2: Merge from REMOTE
```bash
git merge "origin/$FROM_BRANCH" --no-ff -m "merge: $FROM_BRANCH into $TO_BRANCH"
```

**Why `origin/$FROM_BRANCH`:** Ensures merging only committed and pushed changes, not local WIP.

## Step 3: Resolve Conflicts
If conflicts:
1. Resolve manually on your machine
2. `git add . && git commit`
3. If clarifications needed, report to main agent

## Step 4: Push
```bash
git push origin "$TO_BRANCH"
```

## Pre-Merge Checklist
- Fetch latest: `git fetch origin`
- Ensure source branch is pushed to remote
- Check expected target branch from source branch type
- Check for conflicts: `git merge --no-commit --no-ff origin/$FROM_BRANCH` then abort if needed

## Error Handling

| Error | Action |
|-------|--------|
| Merge conflicts | Resolve manually, then commit |
| Branch not found | Verify branch name, ensure pushed |
| Push rejected | `git pull --rebase`, retry |
