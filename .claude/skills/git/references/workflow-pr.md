# Pull / Merge Request Workflow

Execute via `git-manager` subagent. Provider-aware: GitHub PR (`gh`) or GitLab MR (`glab`),
auto-detected from the remote. `/git pr` and `/git mr` run THIS same workflow — only the
final create step differs.

## Variables
- TO_BRANCH: target (defaults to `main`)
- FROM_BRANCH: source (defaults to current branch)
- KEYWORD: `pr` | `mr` (the invoked subcommand; used only as a provider tiebreaker)

## CRITICAL: Use REMOTE diff
PRs/MRs are based on remote branches. Local diff includes unpushed changes.

## Step 0: Resolve provider
Detect from the remote URL; the invoked keyword breaks ties for ambiguous / self-hosted hosts.
**REQUIRED first action:** set the `KEYWORD` line below to match how the skill was invoked —
`mr` for `/git mr`, `pr` for `/git pr` (no-arg menu → `pr`). It is the tiebreaker for
ambiguous / self-hosted hosts; an unambiguous URL match wins regardless.
```bash
KEYWORD=pr                 # ← REQUIRED: change to 'mr' when invoked via /git mr
REMOTE_URL=$(git remote get-url origin 2>/dev/null || git remote get-url "$(git remote | head -1)" 2>/dev/null)
case "$REMOTE_URL" in
  *github.com*|*github.*) PROVIDER=github ;;   # incl. GitHub Enterprise
  *gitlab.*)              PROVIDER=gitlab ;;   # incl. self-hosted gitlab.<corp>
  *) case "$KEYWORD" in mr) PROVIDER=gitlab ;; pr) PROVIDER=github ;; *) PROVIDER=ask ;; esac ;;
esac
BIN=$([ "$PROVIDER" = gitlab ] && echo glab || echo gh)
command -v "$BIN" >/dev/null || { echo "✗ $BIN not installed (brew install $BIN)"; exit 1; }
"$BIN" auth status >/dev/null 2>&1 || echo "⚠ not authenticated — run: ! $BIN auth login"
```
- `PROVIDER=ask` → main agent uses `AskUserQuestion` (github | gitlab) before continuing.
- Self-hosted GitLab on a custom domain (e.g. `git.corp.com`): run `/git mr` → keyword forces gitlab.

## Tool 1: Sync + Analyze
**IMPORTANT: Always merge `main` (or any default branch) to current branch first.**
```bash
git fetch origin && \
git push -u origin HEAD 2>/dev/null || true && \
BASE=${TO_BRANCH:-main} && \
HEAD=${FROM_BRANCH:-$(git rev-parse --abbrev-ref HEAD)} && \
echo "=== ${PROVIDER:-PR/MR}: $HEAD → $BASE ===" && \
echo "=== COMMITS ===" && \
git log "origin/$BASE...origin/$HEAD" --oneline && \
echo "=== FILES ===" && \
git diff "origin/$BASE...origin/$HEAD" --stat
```
**If "Branch not on remote":** Push first, retry.

## Tool 2: Generate Content
**Title:** Conventional commit format, <72 chars, NO version numbers
**Body:** Summary bullets + Test plan checklist. Same template for both providers
(`Closes #N` resolves issues on GitHub and GitLab alike).

## Tool 3: Create (branch on provider)
Branch already pushed in Tool 1 → no extra push needed.

**GitHub (`gh`):**
```bash
gh pr create --base "$BASE" --head "$HEAD" --title "..." --body "$(cat <<'EOF'
## Summary
- Bullet points

## Test plan
- [ ] Test item
EOF
)"
```

**GitLab (`glab`):** `--yes </dev/null` keeps it fully non-interactive (verify on first real MR).
`-b` = target/base, `-s` = source/head.
```bash
glab mr create -b "$BASE" -s "$HEAD" --title "..." --description "$(cat <<'EOF'
## Summary
- Bullet points

## Test plan
- [ ] Test item
EOF
)" --yes </dev/null
```

**Output:** say **MR** when `PROVIDER=gitlab`, else **PR**.

## DO NOT use (local comparison)
- ❌ `git diff main...HEAD`
- ❌ `git diff --cached`
- ❌ `git status`

## Error Handling

| Error | Action |
|-------|--------|
| Branch not on remote | `git push -u origin HEAD`, retry |
| Empty diff | Warn: "No changes for PR/MR" |
| Push rejected | `git pull --rebase`, resolve, push |
| No upstream | `git push -u origin HEAD` |
| `gh`/`glab` not installed | Install (`brew install gh` / `brew install glab`), retry |
| Not authenticated | `! gh auth login` / `! glab auth login [--hostname <host>]` |
| Provider unresolved | `AskUserQuestion`: github or gitlab |
| glab MR aborts (EOF) | an optional/required field was prompted; re-run with explicit `-a`/`-l`/`--reviewer`, or set GitLab project defaults |
