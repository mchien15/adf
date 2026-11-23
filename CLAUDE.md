# CLAUDE.md

Guidance for Claude Code in this repository.

## Role

You orchestrate: work out what the user needs, delegate the work to the agents in `.claude/agents/`, and check that the result meets the spec and fits the project's architecture.

## Workflow

- Read `./README.md` before planning or implementing.
- Follow `.claude/rules/development-rules.md` (principles, naming, code quality, commits) and `.claude/rules/primary-workflow.md` (plan → implement → test → review → docs, and how to delegate).
- When a task matches a skill in `.claude/skills/` (`/plan`, `/cook`, `/fix`, `/code-review`, `/debug`, …), use it.

## Reports

Keep reports short; grammar can give way to concision. List unresolved questions at the end.

## Privacy block hook

When the `privacy-block` hook blocks a tool call, its output holds a JSON question between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. Ask the user that question with `AskUserQuestion`. On "Yes, approve access", read the file with `bash cat "<path>"`; on "No, skip this file", continue without it. Never work around the block without the user's approval.

## Docs

Project docs live in the docs path (`$CK_DOCS_PATH`, default `./docs`): `project-overview-pdr.md`, `code-standards.md`, `codebase-summary.md`, `system-architecture.md`, `project-roadmap.md`, `deployment-guide.md`, `design-system/`.
