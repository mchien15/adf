# GitLab CLI Guide

Counterpart to `gh-cli-guide.md` for GitLab remotes. The `git` skill currently wires
**MR create** only; list/view/merge are documented here for future use.

## Authentication
```bash
glab auth login                              # interactive (gitlab.com)
glab auth login --hostname gitlab.corp.com   # self-hosted instance
glab auth status                             # check auth state
glab auth logout
```
glab infers the host from the git remote when authenticated; a fresh self-hosted host
needs `glab auth login --hostname <host>` first.

## Merge Requests

### Create MR (the wired path)
```bash
# Basic — -b target/base, -s source/head; --yes </dev/null = non-interactive
glab mr create -b main -s feature -t "feat: add login" -d "Summary" --yes </dev/null

# With HEREDOC body
glab mr create -b main -t "feat(auth): add OAuth" --description "$(cat <<'EOF'
## Summary
- Added OAuth2 provider support

## Test plan
- [ ] Unit tests pass
EOF
)" --yes </dev/null

# Draft
glab mr create --draft -t "WIP: new feature" --yes </dev/null

# Reviewers / labels
glab mr create --reviewer user1,user2 -l "bug,priority::high" --yes </dev/null   # '::' = GitLab scoped label

# Remove source branch on merge
glab mr create --remove-source-branch -t "fix: patch" --yes </dev/null
```

### View / List
```bash
glab mr list                  # list MRs
glab mr view 123              # MR details
glab mr view 123 --web        # open in browser
glab mr diff 123              # MR diff
```

### Merge MR
```bash
glab mr merge 123                       # merge
glab mr merge 123 --squash              # squash
glab mr merge 123 --remove-source-branch
glab mr merge 123 --when-pipeline-succeeds
```

### MR comments
```bash
glab mr note 123 -m "LGTM!"
```

## Issues
```bash
glab issue list
glab issue view 42
glab issue create -t "Bug" -d "Description"
```

## Repository / Pipelines
```bash
glab repo view                # current repo info
glab repo clone group/repo
glab ci list                  # pipeline runs
glab ci view                  # latest pipeline
glab ci status
```

## Flag map: `gh` → `glab`
| Concept | gh | glab |
|---------|-----|------|
| target/base branch | `--base` | `-b` / `--target-branch` |
| source/head branch | `--head` | `-s` / `--source-branch` (defaults to current) |
| body/description | `--body` | `-d` / `--description` |
| delete src on merge | `--delete-branch` (merge) | `--remove-source-branch` |
| non-interactive | (default) | `--yes` (+ `</dev/null` guard) |
| draft | `--draft` | `--draft` |
| reviewers | `--reviewer` | `--reviewer` |
| labels | `--label` | `-l` / `--label` |

## JSON output (scripting)
```bash
glab mr list -F json
glab issue list -F json
```
