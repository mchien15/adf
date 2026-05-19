# Agentic Development Framework - Project Roadmap

**Last Updated:** 2026-05-19
**Current Version:** 0.0.1
**Repository:** https://github.com/sotatek-dev/adf

## Executive Summary

Agentic Development Framework (ADF) is an AI-powered development orchestration framework for building professional software. v0.0.1 is the initial public release with **cross-platform support** for Claude Code, Antigravity IDE, OpenCode, and OpenAI Codex — a complete, production-ready foundation with unified tool support contract.

---

## Version History

### v0.0.1 — Initial Release (2026-03-16)

First public release. Includes full agent orchestration, skills library, hook system, and documentation pipeline.

**Core:**
- Multi-agent orchestration engine (16 specialized agents)
- Skill system with 44 skills (plan, cook, fix, test, debug, brainstorm, etc.)
- Hook system (session-init, dev-rules, subagent-init, scout-block, privacy-block)
- File-based agent communication via plans/reports
- Tool support contract for Claude Code, Antigravity, OpenCode, and Codex

**Workflows:**
- `/plan` — research + phased implementation plans (--fast, --hard, --two, --parallel)
- `/cook` — risk-gated end-to-end implementation (--auto approval-skip only, --fast, --parallel, policy-limited --no-test, mandatory verification)
- `/fix` — intelligent bug fixing (--quick, --parallel, specialized: test, types, ui, ci, logs)
- `/test` — test execution and coverage analysis
- `/code-review` — multi-pass automated review with edge case scouting
- `/debug` — root cause analysis and diagnostic reports
- `/git` — conventional commits, PRs, branch management
- `/docs` — documentation generation and sync

**Infrastructure:**
- **Cross-Platform**: Claude Code (macOS/Linux/Windows) + Antigravity IDE + OpenCode + OpenAI Codex with unified tool support contract
- Plans dashboard (`/plans-kanban`)
- Preview system (`/preview --explain|--diagram|--slides|--ascii`)
- Agent Teams for parallel multi-session collaboration (`/team`)
- MCP integrations (context7, sequential-thinking, chrome-devtools)
- `.claude/` canonical source with generated artifacts for `.codex/` and `.opencode/`
- Tool support matrix defining native, degraded, and unsupported surfaces

**Documentation:**
- Auto-generated project docs (overview, architecture, code standards, codebase summary)
- Plan system with phased file organization
- Report pipeline for agent-to-agent communication

---

## Roadmap

### Completed Since v0.0.1
- **quality-gates skill v1** (2026-03-31): Language-agnostic security and quality gates — production-ready release.
  - **Gates**: secrets (gitleaks), deps (trivy), sast (semgrep), dast (nuclei), coverage, file-size, sonar (opt-in)
  - **Setup wizard**: 7-step Claude-executed wizard; reads project docs, infers stack excludes, asks SonarQube/DAST/hooks; generates config, gitleaks.toml, sonar-project.properties per stack
  - **Stack-aware config**: nuclei tags auto-selected from stack signals; gitleaks rules + allowlists composed per detected patterns; sonar-project.properties augmented with stack-specific coverage paths
  - **SonarQube**: API-based profile assignment (Sonar way Recommended); fetches dashboard metrics & issues list; PR decoration support
  - **Run modes**: pre-commit, pre-push, pr, ci, diff, full — auto-detected from env
  - **DAST**: nuclei with configurable tags, block_severity, endpoints.txt; CI-only by default
  - **Reports**: isolated raw dir per run; all sections render even with no findings; exact CLI command shown per check
  - **CI/CD**: git hook integration (pre-commit secrets, pre-push sast+deps); JSON output mode for machine consumption
  - **Cleanup**: removed profiles feature, config validate/doctor, zombie config fields (nuclei section, dast.severity, sonar.sources/exclusions); leaned SKILL.md commands

### Near-term
- Additional cloud platform skill integrations (GCP, AWS, Azure)
- GitHub Actions workflow template for quality gates (CI setup)
- Community feedback and bug fixes
- Documentation improvements and tutorials
- Performance optimization (token efficiency, parallel execution)

### Future
- Visual workflow builder UI
- Custom agent/skill creator
- Analytics and insights dashboard
- Enhanced caching mechanisms
- Enterprise features (self-hosted, compliance, custom integrations)

---

## Success Metrics

| Category | Target |
|----------|--------|
| Bootstrap time | < 10 minutes |
| Planning-to-implementation cycle | 50% reduction |
| Documentation coverage | > 90% |
| Test coverage | > 80% |
| Code review time | 75% reduction |
| Conventional commit compliance | 100% |
| Zero secrets in commits | 100% |

---

## Technical Stack

- **Runtime:** Node.js >= 18, Bash, Python (skills venv)
- **AI:** Anthropic Claude (primary), Google Gemini (multimodal)
- **Tools:** Repomix, Puppeteer, Playwright
- **CI/CD:** GitHub Actions
- **Languages:** JavaScript, Python, Bash, Markdown

---

## Constraints

- Requires Claude Code CLI and API keys
- File-based communication has I/O overhead
- Token limits on AI model context windows
- Internet required for MCP tools and web search

---

**Maintained By:** Agentic Development Framework Team
**Next Review Target:** 2026-04-16
