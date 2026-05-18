# Documentation Index

This file provides a navigation guide to all ADF documentation with description of contents and intended audience.

## Core Documentation (Essential Reading)

### 1. [README.md](../README.md) — Getting Started
**Audience:** Everyone — new users first stop
**Contents:**
- Project overview and key benefits
- Tool compatibility matrix (Claude Code, Antigravity, OpenCode, Codex)
- Quick start with 5 setup options
- Step-by-step installation instructions per tool
- Workflow invocation guide (slash commands vs native prompts)

### 2. [Tool Support Matrix](./tool-support-matrix.md) — Support Contract
**Audience:** Integration engineers, maintainers, tool-specific power users
**Contents:**
- Per-tool support status (native/degraded/unsupported)
- Canonical vs generated paths for agents, skills, hooks, configs
- Tool-specific notes and limitations
- Release gate validation commands
- Codex privacy enforcement limitations

### 3. [Release and Validation Procedures](./release-and-validation.md) — Pre-Release QA
**Audience:** Maintainers, CI/CD engineers, release managers
**Contents:**
- Three validation scripts (Claude, Codex, support matrix)
- Configuration regeneration procedure
- Full release gate checklist
- CI/CD integration examples
- Troubleshooting validation failures

## Architecture & Design

### 4. [System Architecture](./system-architecture.md) — Technical Deep Dive
**Audience:** Architects, advanced developers, extension builders
**Contents:**
- Component interactions and data flow
- Hook system and boot sequence
- Tool integration architecture (Claude/Codex/OpenCode)
- Workflow execution model
- Command routing and argument handling
- Cross-platform differences and limitations
- 1100+ lines of technical reference

### 5. [Project Overview & PDR](./project-overview-pdr.md) — Product Definition
**Audience:** Product managers, stakeholders, new team members
**Contents:**
- Vision, mission, and value proposition
- Target users and personas
- Key features (16 agents, 44 skills, multi-tool orchestration)
- Tool support contract overview
- Functional and non-functional requirements
- Success metrics and technical architecture

### 6. [Code Standards](./code-standards.md) — Development Conventions
**Audience:** Contributors, code reviewers, developers
**Contents:**
- Naming conventions across agents, skills, files
- Hook categories and event names
- Skill structure and requirements
- Command syntax and argument handling
- Error handling patterns
- Documentation standards
- Testing and validation requirements

## Project Organization

### 7. [Project Roadmap](./project-roadmap.md) — Release Timeline
**Audience:** Everyone — what's completed, what's coming
**Contents:**
- v0.0.1 initial release features (16 agents, 44 skills, hooks, CLI)
- Completed work since launch (quality-gates v1, agent counts)
- Near-term priorities and future roadmap
- Success metrics and technical stack

### 8. [Codebase Summary](./codebase-summary.md) — High-Level Structure
**Audience:** Developers exploring the codebase
**Contents:**
- Directory structure with descriptions
- `.claude/`, `.codex/`, `.opencode/` directories explained
- File organization patterns
- Key entry points and workflow pathways

## Specialized Topics

### 9. [Agent Teams Guide](./agent-teams-guide.md) — Parallel Collaboration
**Audience:** Advanced workflow users, team leads
**Contents:**
- Agent team spawning and coordination
- Parallel research patterns
- Message passing between agents
- Report generation and aggregation
- Team scaling strategies

### 10. [Skill-Native Task](./skill-native-task.md) — Custom Skill Development
**Audience:** Skill developers, extension authors
**Contents:**
- Anatomy of a skill
- SKILL.md manifest format
- Extending existing skills
- Skill testing and validation
- Skill publishing guidelines

### 11. [Skills Dependency Graph](./skills-dependency-graph.md) — Skill Relationships
**Audience:** Architects, skill maintainers
**Contents:**
- Dependency tree visualization
- Direct vs transitive dependencies
- Breaking change impact analysis
- Circular dependency detection

### 12. [Skills Interconnection Map](./skills-interconnection-map.md) — Skill Workflow Integration
**Audience:** Advanced workflow users, orchestration planners
**Contents:**
- Which skills call which other skills
- Common skill composition patterns
- Agent-to-skill routing
- Workflow bottlenecks and optimization opportunities

## Installation & Operations

### 13. [ADF Install Ownership Model](./adf-install-ownership-model.md) — Installer Architecture
**Audience:** Operations teams, deployment engineers
**Contents:**
- Canonical vs installed payload structure
- `.adf/manifest.json` ownership tracking
- Local configuration overrides
- Repair and rollback capabilities

### 14. [ADF Install Migration Guide](./adf-install-migration-guide.md) — Upgrading
**Audience:** Users updating existing ADF installations
**Contents:**
- Safe upgrade procedures
- Git profile migration
- Breaking change handling
- Data preservation during upgrade

### 15. [ADF Rollback and Repair](./adf-rollback-and-repair.md) — Recovery
**Audience:** Operations, support teams
**Contents:**
- Rollback to previous versions
- Repair corrupted installations
- Snapshot management
- Safety procedures

### 16. [ADF Legacy Adoption Rules](./adf-legacy-adoption-rules.md) — Integration
**Audience:** Teams migrating from non-ADF projects
**Contents:**
- Adopting existing projects
- Legacy configuration handling
- Breaking changes
- Safe adoption checklist

### 17. [ADF Manifest Schema](./adf-manifest-schema.md) — Specification
**Audience:** Tool builders, integration engineers
**Contents:**
- `.adf/manifest.json` schema
- File checksums and versions
- Tool-specific configuration
- Validation rules

## Navigation Guide

### By Role

**New Users:**
1. [README.md](../README.md) — Understand what ADF is
2. [Tool Support Matrix](./tool-support-matrix.md) — See which tool you're using
3. [README.md](../README.md) setup section — Install for your tool

**Developers:**
1. [Code Standards](./code-standards.md) — Learn coding conventions
2. [System Architecture](./system-architecture.md) — Understand how things work
3. [AGENTS.md](../AGENTS.md) — AI coding instructions
4. [Skill-Native Task](./skill-native-task.md) — Extend with custom skills

**Maintainers:**
1. [Release and Validation Procedures](./release-and-validation.md) — Pre-release QA
2. [Tool Support Matrix](./tool-support-matrix.md) — Support contract
3. [ADF Install Ownership Model](./adf-install-ownership-model.md) — Installer ops
4. [Skills Dependency Graph](./skills-dependency-graph.md) — Impact analysis

**Operations / DevOps:**
1. [ADF Install Ownership Model](./adf-install-ownership-model.md)
2. [ADF Rollback and Repair](./adf-rollback-and-repair.md)
3. [Release and Validation Procedures](./release-and-validation.md) — CI/CD setup
4. [Tool Support Matrix](./tool-support-matrix.md) — Platform limitations

**Architects:**
1. [System Architecture](./system-architecture.md)
2. [Project Overview & PDR](./project-overview-pdr.md) — Design decisions
3. [Skills Dependency Graph](./skills-dependency-graph.md)
4. [Skills Interconnection Map](./skills-interconnection-map.md)

### By Topic

**Tool Support & Compatibility:**
- [Tool Support Matrix](./tool-support-matrix.md) — What works per tool
- [System Architecture](./system-architecture.md) — Tool integration details
- [Release and Validation Procedures](./release-and-validation.md) — Validation scripts

**Installation & Upgrade:**
- [README.md](../README.md) — Initial setup
- [ADF Install Ownership Model](./adf-install-ownership-model.md) — How installer works
- [ADF Install Migration Guide](./adf-install-migration-guide.md) — Upgrading
- [ADF Rollback and Repair](./adf-rollback-and-repair.md) — Recovery

**Development Practices:**
- [Code Standards](./code-standards.md) — Conventions
- [AGENTS.md](../AGENTS.md) — Workflow rules
- [System Architecture](./system-architecture.md) — Technical patterns

**Extending ADF:**
- [Skill-Native Task](./skill-native-task.md) — Build custom skills
- [Skills Dependency Graph](./skills-dependency-graph.md) — Understand dependencies
- [Agent Teams Guide](./agent-teams-guide.md) — Orchestrate agents

**Project Status:**
- [Project Roadmap](./project-roadmap.md) — What's planned
- [Project Overview & PDR](./project-overview-pdr.md) — Detailed requirements
- [Codebase Summary](./codebase-summary.md) — Current structure

## Related Files

- **CLAUDE.md** — Claude Code project instructions (generated)
- **AGENTS.md** — Codex/Antigravity project instructions + AI guidance
- **opencode.json** — OpenCode configuration (generated)
- **README.md** — Project overview and quick start

## Document Maintenance

- All docs in `/docs` directory follow Markdown format
- Each doc has metadata: name, purpose, audience
- Cross-referencing done via relative links `[text](./filename.md)`
- Content updates tracked via git commits
- Validation: all referenced files must exist and be accurate

---

**Last Updated:** 2026-05-18  
**Maintained By:** ADF Documentation Team  
**Next Review:** 2026-06-01
