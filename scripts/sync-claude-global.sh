#!/usr/bin/env bash
# sync-claude-global.sh — Publish ADF framework source (~/adf/.claude) to the global
# Claude config (~/.claude). One-way, manual trigger.
#
# Copies ONLY an allowlist of managed dirs/files, skipping gitignored/runtime cruft inside
# them (.gitignore'd files, .claude/, .logs/, .coverage, .DS_Store). NEVER touches
# settings*.json, agent-memory/, or runtime state (sessions, projects, history.jsonl,
# tasks, caches…). settings.json is never written — only checked for drift. macOS openrsync OK.
#
# Usage:  ./scripts/sync-claude-global.sh [--dry-run]
# Env:    ADF_HOME   source repo root (default: $HOME/adf)
#
# FUTURE (NOT implemented — YAGNI): git-hook auto-trigger, `adf global` CLI subcommand,
# settings.local.json native split, settings auto-merge, Windows PowerShell variant,
# --seed flag to re-push agent-memory seeds.
set -euo pipefail

# ── config ─────────────────────────────────────────────────────────────────────
ADF_HOME="${ADF_HOME:-$HOME/adf}"
SRC="$ADF_HOME/.claude"
DEST="$HOME/.claude"

# Managed directories — synced with --delete so repo removals propagate to global.
MANAGED_DIRS=(skills agents rules hooks scripts config)
# Managed single files — copied, never --delete.
MANAGED_FILES=(statusline.cjs statusline.ps1 statusline.sh .env.example .mcp.json.example metadata.json)

# Cruft never published to global, even though it lives inside managed dirs:
#   --filter ':- .gitignore' → honor any in-tree .gitignore (build/coverage/log artifacts)
#   .claude/  → stray nested dirs from tools run with a wrong CWD
#   .logs/    → runtime hook/agent logs    .coverage → test artifacts    .DS_Store → macOS
# Excluded paths are ALSO protected from --delete, so global's own runtime logs survive.
EXCLUDES=(--filter=':- .gitignore' --exclude='.claude/' --exclude='.logs/' --exclude='.coverage' --exclude='.DS_Store')

DRY_RUN=0

# ── helpers ────────────────────────────────────────────────────────────────────
die()  { echo "✗ $*" >&2; exit 1; }
warn() { echo "⚠ $*" >&2; }

usage() {
  cat <<EOF
sync-claude-global.sh — publish ~/adf/.claude managed dirs to global ~/.claude

Usage: ./scripts/sync-claude-global.sh [--dry-run]

  --dry-run   Show what would change; write nothing.
  -h, --help  Show this help.

Env:
  ADF_HOME    Source repo root (default: \$HOME/adf). Source = \$ADF_HOME/.claude

Syncs (allowlist): ${MANAGED_DIRS[*]} + managed root files.
Skips in-dir cruft: .gitignore'd files, .claude/, .logs/, .coverage, .DS_Store.
Never touches:     settings.json, settings.local.json, agent-memory/, and all runtime
                   state (sessions, projects, history.jsonl, tasks, caches…).
settings.json:     never written — only checked for hooks/statusLine drift.
EOF
}

# ── arg parse ──────────────────────────────────────────────────────────────────
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $a (try --help)" ;;
  esac
done

# ── preflight (fail loudly) ─────────────────────────────────────────────────────
[[ -f "$SRC/metadata.json" ]] || die "ADF source not found: $SRC/metadata.json (set ADF_HOME)"
[[ -d "$DEST" ]]              || die "global config not found: $DEST"
command -v rsync >/dev/null   || die "rsync required"

# rsync option sets. Dirs get --delete; single files must NOT.
# --out-format prints one line per changed path (verified on macOS openrsync + GNU rsync).
DIR_OPTS=(-a --delete "${EXCLUDES[@]}" --out-format='%o %n')
FILE_OPTS=(-a --out-format='%o %n')
if [[ $DRY_RUN -eq 1 ]]; then
  DIR_OPTS+=(--dry-run); FILE_OPTS+=(--dry-run)
  echo "— DRY RUN: no writes —"
fi

CHANGES="$(mktemp)"; trap 'rm -f "$CHANGES"' EXIT

# ── sync funcs ──────────────────────────────────────────────────────────────────
# Sync one managed directory. SAFETY GUARD: the --delete target MUST end in
# /.claude/<name>/ so a bug can never aim --delete at the ~/.claude root (which holds
# irreplaceable runtime state). Changed paths are tagged [name] and collected for summary.
sync_dir() {
  local name="$1" s="$SRC/$1/" d="$DEST/$1/"
  # Guard the --delete target. name must be a plain path segment (non-empty, no '/' or
  # '.'), and the resolved target must equal exactly $DEST/<name>/ — never the ~/.claude
  # root (which holds runtime state). Two independent checks so neither alone is the SPOF.
  [[ -n "$name" && "$name" != *[/.]* ]] || die "invalid managed dir name: '$name'"
  [[ "$d" == "$DEST/$name/" ]]          || die "refusing unsafe --delete target: $d"
  [[ -d "$s" ]] || { warn "skip missing source dir: $s"; return; }
  # || die: pipefail makes a failed rsync abort the pipeline; surface it loudly instead of
  # dying silently mid-loop (partial-and-silent is the worst failure for a live-config sync).
  rsync "${DIR_OPTS[@]}" "$s" "$d" | sed "s#^#[$name] #" >>"$CHANGES" || die "rsync failed for [$name]"
}

# Sync one managed file (no --delete).
sync_file() {
  local s="$SRC/$1" d="$DEST/$1"
  [[ -f "$s" ]] || { warn "skip missing source file: $s"; return; }
  rsync "${FILE_OPTS[@]}" "$s" "$d" | sed "s#^#[$1] #" >>"$CHANGES" || die "rsync failed for [$1]"
}

# ── settings.json drift detector (NEVER writes) ─────────────────────────────────
# Repo settings use $CLAUDE_PROJECT_DIR/.claude; global uses $HOME/.claude and carries
# local-only keys (model/effortLevel/skipDangerous…). Compare ONLY the managed structure
# (hooks + statusLine) after rewriting the path scheme. Warn on divergence; never modify.
check_settings_drift() {
  local repo="$SRC/settings.json" glob="$DEST/settings.json"
  [[ -f "$repo" && -f "$glob" ]] || return 0
  command -v jq >/dev/null || { warn "jq not found — skipping settings drift check"; return 0; }
  local rewritten a b
  rewritten="$(sed 's#\$CLAUDE_PROJECT_DIR/\.claude#$HOME/.claude#g' "$repo")"
  a="$(jq -S '{hooks, statusLine}' <<<"$rewritten" 2>/dev/null)" || { warn "settings.json parse failed (repo)"; return 0; }
  b="$(jq -S '{hooks, statusLine}' "$glob" 2>/dev/null)"        || { warn "settings.json parse failed (global)"; return 0; }
  if [[ "$a" != "$b" ]]; then
    echo "⚠ settings.json hooks/statusLine diverged — review & merge manually (global '<' vs repo '>'):"
    diff <(printf '%s\n' "$b") <(printf '%s\n' "$a") || true
  else
    echo "✓ settings.json managed structure in sync"
  fi
}

# ── main ────────────────────────────────────────────────────────────────────────
echo "Source: $SRC"
echo "Target: $DEST"
for d in "${MANAGED_DIRS[@]}";  do sync_dir  "$d"; done
for f in "${MANAGED_FILES[@]}"; do sync_file "$f"; done

n="$(grep -c . "$CHANGES" || true)"
# NOTE: --out-format counts transfers only; deletions aren't included in this number.
label=""; [[ $DRY_RUN -eq 1 ]] && label="[dry-run] "
echo "✓ ${label}${n} path(s) transferred"
[[ "$n" -gt 0 ]] && sed 's/^/  /' "$CHANGES"

check_settings_drift
