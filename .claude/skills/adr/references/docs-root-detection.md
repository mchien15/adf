# Docs Root Detection

How to find out **where this repo keeps its documentation** before writing anything into it.

Read-only. Nothing here writes, caches, or edits config. Re-run it every time — a few Glob calls cost nothing and the answer self-corrects when the repo moves files.

## Why this is not just `$CK_DOCS_PATH`

`$CK_DOCS_PATH` comes from `config.paths.docs` ([session-init.cjs](../../../hooks/session-init.cjs)), so it is only correct **when the repo has ADF config**. In global mode — ADF installed at `~/.claude`, never `adf install`ed into the target repo — there is no `.claude/config/adf-config.json`, `$CK_DOCS_PATH` falls back to `docs/`, and every docs-site repo gets written to the wrong place.

Layer 1a below uses `$CK_DOCS_PATH` when it is authoritative. Layers 1b–1d exist for when it is not.

## Layer 1 — Locate the docs root

Stop at the first layer that produces an answer.

| # | Source | How to check |
|---|--------|--------------|
| a | `config.paths.docs` / `$CK_DOCS_PATH` | Present **and** the repo has `.claude/config/adf-config.json` → done, do not probe further |
| b | Docs-site config | `Glob **/docusaurus.config.*` · `**/mkdocs.yml` · `**/mint.json` · `**/docs.json` · `**/astro.config.*` (skip `node_modules`) |
| c | Familiar directory | Test for `docs/` · `doc/` · `documentation/` · `apps/docs/` · `website/` · `.adf/docs/` |
| d | Nothing found | Default to `docs/` |

Layer (b) is the **strongest signal** and must be checked before (c). A monorepo often has a stub `docs/` at the root *and* the real content under `apps/docs/docs/` — the site config is what tells them apart.

### Layer 1b — config file → content directory

| Config found at | Docs root |
|---|---|
| `<dir>/docusaurus.config.*` | `<dir>/docs/`, unless the classic preset sets `docs.path` — grep the config for `path:` before assuming |
| `<dir>/mkdocs.yml` | `<dir>/` + the `docs_dir:` value, default `docs` |
| `<dir>/mint.json` or `<dir>/docs.json` | `<dir>/` itself — Mintlify page paths are relative to the config |
| `<dir>/astro.config.*` using Starlight | `<dir>/src/content/docs/` |

**Worked example (real).** `apps/docs/docusaurus.config.ts` exists and sets no `path:` override ⇒ docs root is `apps/docs/docs/`, **not** `<repo>/docs/`.

## Layer 2 — Find existing documents inside the root

Only after Layer 1. Match by substring, against **both file names and directory names**.

| Kind | Patterns |
|---|---|
| roadmap | `*roadmap*` · `*mvp*` · `*milestone*` |
| architecture | `*architect*` · `*adr*` · `*decision*` |
| standards | `*convention*` · `*standard*` · `*style-guide*` |
| overview / summary | `*overview*` · `*summary*` · `*pdr*` |
| specs | `*fsd*` · `*spec*` · `*usecase*` · `*use-case*` |
| test cases | `*test-case*` · `*testcase*` · `*qa*` |

### Directory names carry the meaning, and Glob alone will miss them

Glob returns **files**. Numbered Docusaurus trees (`01-overview`, `03-architecture`, `07-roadmap`, `10-engineering`) put the semantic word on the *directory* and number the files inside it, so file-name matching does not just under-return — it returns the wrong things.

Measured on a real Docusaurus repo, `*architect*` against file names only:

| | Result |
|---|---|
| Basename match `*architect*.md` | 4 hits — `01-overview/02-architecture.md` plus **three files under `08-references/` describing *other products'* architecture** (Dify, RAGFlow, Flowise) |
| The actual architecture docs | 17 files in `03-architecture/` — `01-services.md`, `02-data-stores.md`, `07-auth-flow.md`, … |
| Overlap between the two | **zero** |

Every hit is wrong and three of them are actively misleading. The directory `03-architecture/` is the only thing that identifies the real content.

`*roadmap*` fails less loudly but still fails: it finds `07-roadmap/02-product-roadmap-2026.md` and misses `07-roadmap/01-mvp.md` sitting beside it.

So run **both** forms:

```
Glob <root>/**/*roadmap*.md        → files whose own name matches
Glob <root>/**/*roadmap*/**/*.md   → files inside a matching directory
```

or one `find`, which covers files and directories in a single pass:

```bash
find <root> -maxdepth 3 -iname '*roadmap*'
```

## Layer 3 — where records go

**The ADR directory is `<docs-root>/adr/`. Always.** No search, no adoption, no inference.

An earlier design tried to discover an existing ADR directory anywhere in the repo and adopt it. Two adversarial review rounds killed it. The reasons are worth keeping, because they generalise:

| Attempt | Why it failed |
|---|---|
| `find` with a prune list | ADF's own `scout-block.cjs` hook rejects any Bash command containing `node_modules`, `dist`, `build`, `venv`, `vendor`, `target`, `coverage` or `.git` — the prune list *is* those tokens. Unrunnable in any ADF repo |
| Glob for candidate directories | Glob returns **file paths**. An empty `adr/` is not representable in the result at all — so the one case adoption existed for, `adr-tools` creating `doc/adr/` before the first record, could never be detected |
| Judge candidates by file shape | A record and a numbered docs chapter are the same shape. `decision-tables/01-pricing.md` passes every test you can write |
| Judge candidates by directory name | Rejects `arch-decisions`, `adr_records`, `decision-log`, `design-decisions`; Glob is case-sensitive so `ADR/` never even becomes a candidate; dependency trees ship their own `adr/` and nothing prunes them |

Each fix moved the failure somewhere else. The mechanism cost more than it was worth, so it is gone.

### Finding records that already exist — reading and writing differ

Records **are** files, so Glob finds them even though it cannot find an empty directory. **Constrain by directory, not by filename** — that is the whole trick:

```
Glob **/*adr*/**.md
Glob **/*decision*/**.md
Glob **/*Decision*/**.md          ← Glob is case-sensitive; `ADR/` needs its own pattern too
Glob **/*ADR*/**.md
```

Then keep only filenames matching `NNNN-*.md` or `adr-NNNN-*.md` (1–4 leading digits), discarding any whose digits are a date — `2024-05-01-*`, `2024-05-*`, `20240501-*`.

Discard hits under `.claude/`, `.agent/`, `.agents/`, `plans/`, and under `node_modules`, `vendor`, `dist`, `build`, `target`, `venv`, `.venv`, `coverage`.

**Never glob `**/NNNN-*.md` across the whole repo.** A numbered documentation tree names *every* file that way — `01-services.md`, `02-data-stores.md`, `03-workflow-engine.md`. Measured on a real Docusaurus repo: filename-only matching returned **207 files across 49 directories**, of which 27 were records. The reader would then treat architecture chapters as decisions. Requiring `adr` or `decision` in the *directory* path cuts it to the right set, and unlike the write side it can afford to be generous — a `decision-tables/` folder slipping in costs a few wasted reads, not a misplaced record.

**Then treat reading and writing differently, because they fail in opposite directions.**

| | Rule | Why |
|---|---|---|
| **Reading** (`/plan`, `/brainstorm`, `/docs update`) | Read **every** surviving record, wherever it lives. No question, no confirmation | A missed record is **silent** and indistinguishable from "this repo has no decisions" — so the agent re-proposes the rejected option, which is the failure this whole feature exists to prevent. Reading one irrelevant file costs a few tokens; missing the right one costs the feature its purpose |
| **Writing** (`/adr`) | Default to `<docs-root>/adr/`. If records survive elsewhere, **say so and ask**. Never switch on your own | A record written to the wrong directory is **visible** — a human sees it on the first glance and moves it. A silent redirect into a directory nobody expected is not |

> Found existing records in `doc/adr/`. Write there instead of `docs/adr/`?

Ask only when the surviving records are somewhere **other than** the default — finding records in `<docs-root>/adr/` itself is the normal case and warrants no question. If they survive in more than one place, list every location and ask; do not pick.

**Never let the write side commit to a directory the read side will not look at.** That asymmetry is the point: the reader casts a wide net on purpose, so wherever a human tells the writer to put records, the reader will still find them.

### Numbering

Within the chosen directory, a record is `NNNN-*.md` or `adr-NNNN-*.md` with **1–4 leading digits**. Exclude anything whose digits form a date — `2024-05-01-meeting-notes.md`, `2024-05-notes.md`, `20240501-notes.md`. Take the highest number and add one; zero-pad to the width already in use.

**Key on the number, never on the filename.** A directory holding both `0001-260731-a.md` and `adr-0002-b.md` has a highest number of 2; a glob of `[0-9]*.md` sees only one of them and hands back 2 again. Checking whether the computed *filename* already exists does not catch this either — `0002-260731-new.md` and `adr-0002-old.md` are different names carrying the same number.

**Sanity-check before writing.** If the next number exceeds the record count by more than a few, something that is not a record got counted — stop and ask. Jumping from 4 records to `ADR-2025` is the signature of a dated file slipping through, and it burns the number space permanently.

If the directory holds records under a naming scheme this one does not recognise (`20200601-use-postgres.md`, the log4brains default), **stop and ask** rather than starting over at `0001` beside them.

## Handling the result — Layer 2 only

**This table governs Layer 2 (finding an existing roadmap, architecture doc, spec, and so on). It does not govern Layer 3** — ADR directories have their own read/write split above, where "exactly one match, use it" is deliberately *not* the rule for writing.

| Matches | Action |
|---|---|
| Exactly one, unambiguous | Use it. **Update in place — do not create a parallel file** |
| More than one | List them and ask a single question. **Never pick for the user** |
| None | Create per ADF convention, inside the Layer-1 root |

The rule that matters: **when it is ambiguous, ask — do not guess.** A wrong guess writes a second roadmap next to the real one, and nobody notices until the two disagree.

## Limits

**Detection finds the place, not the policy.** You can discover `07-roadmap/`; you cannot discover "the roadmap is only updated at sprint boundaries." Rules like that belong to the repo's contract — `AGENTS.md` / `CLAUDE.md` — which the **repo owner** writes, never ADF. The boundary is clean: *detection owns paths, contract owns policy.*

**Docs outside the tree are undetectable.** Notion, Confluence, a separate wiki repo — nothing on disk to match, so Layer 1d fires and you get `docs/`. Known and accepted.

**The tool list in Layer 1b is not exhaustive.** VitePress, Sphinx, GitBook, and Nextra are not covered yet. Add them when a repo actually needs one, rather than guessing at config shapes up front.

**False positives are cheap.** `openapi-spec.md` matches `*spec*`. Worst case is one extra question, which is the correct trade against silently writing to the wrong path.

## Anti-patterns

❌ **Globbing before narrowing.** `**/*spec*.md` from the repo root in a JS/TS project returns `*.spec.ts`, `openapi-spec.md`, and test fixtures. Layer 1 first, always — it is not an optional optimisation.

❌ **Matching file names only.** Misses `07-roadmap/01-mvp.md` and every other numbered docs tree. Run the directory form too.

❌ **Taking `<repo>/docs/` because it exists.** In a monorepo it is frequently site scaffolding while the content lives elsewhere. The site config wins over the familiar name.

❌ **Choosing between several matches on the user's behalf.** Two roadmap files means two candidate sources of truth, and only the repo owner knows which. Ask.

❌ **Caching the result** into config, a state file, or session memory. Detection is cheap and re-running it is how the answer stays correct after a refactor.

❌ **Scaffolding a docs tree nobody asked for.** Create only what you were asked to create. Writing `/adr` into a repo with no docs directory legitimately creates `<docs-root>/adr/` and its two parents — that is the file you were asked to create — but nothing beyond it: no `README.md` at the docs root, no `system-architecture.md`, no `documentation-index.md`, no placeholder pages.
