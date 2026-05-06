# Branch Management

## Naming Convention

Use short-lived task branches. Do not work directly on fixed branches.

### Fixed Branches

| Branch | Role | Rule |
|--------|------|------|
| `main` | Production | No direct pushes. Accepts code from `release/*` or `hotfix/*` only. |
| `dev` | Development / sandbox | Integration branch for completed task branches during a sprint. |
| `staging` | UAT / QA | Optional pre-production validation branch when project uses a dedicated UAT branch. |

### Working Branches

| Type | Purpose | Example |
|------|---------|---------|
| `feat/` | New feature work | `feat/cls-101-login-btn` |
| `chore/` | Maintenance, tooling, config | `chore/upgrade-eslint` |
| `hotfix/` | Production emergency fix | `hotfix/fix-payment-crash` |
| `release/` | Release packaging | `release/v1.2.0` |

## Branch Lifecycle

### Start Feature or Chore Work
```bash
git checkout main
git pull origin main
git checkout -b feat/cls-101-login-btn
```

- Push branch to remote
- Open MR/PR into `dev`

### Long-Running Feature
```bash
git checkout feat/cls-200-admin-dashboard
git fetch origin
git rebase origin/main
```

- Re-sync from `main` after each production release
- Resolve conflicts on the feature branch, not on fixed branches

### Hotfix
```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-payment-crash
```

- Hotfix branches must start from `main`
- Merge hotfix into `main`
- Sync the same fix back into `dev` and any affected `feat/*` branches

### Conflict Resolution
```bash
git checkout feat/my-cart-feature
git fetch origin
git rebase origin/dev
```

- The branch owner resolves conflicts
- Force push allowed only on your own working branch after rebase
- Never force push fixed branches

### Release Flow
```bash
git checkout main
git pull origin main
git checkout -b release/v1.2.0
```

- Release branch collects only approved completed work
- Validate on staging/UAT
- Merge release into `main`, tag version, then sync long-lived branches

## Merge Targets

| Source | Target |
|--------|--------|
| `feat/*` | `dev` |
| `chore/*` | `dev` |
| `hotfix/*` | `main` |
| `release/*` | `main` |

## Quick Commands

| Task | Command |
|------|---------|
| Current branch | `git rev-parse --abbrev-ref HEAD` |
| Create branch | `git checkout -b <branch>` |
| Sync with `main` | `git fetch origin && git rebase origin/main` |
| Sync with `dev` | `git fetch origin && git rebase origin/dev` |
| Delete local | `git branch -d <branch>` |
| Delete remote | `git push origin --delete <branch>` |
