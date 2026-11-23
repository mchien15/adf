# Documentation Index

This file provides a navigation guide to all ADF documentation with description of contents and intended audience.

## Core Documentation (Essential Reading)

### 1. [README.md](../README.md) — Getting Started
**Audience:** Everyone — new users first stop
**Contents:**
- Project overview and key benefits
- Quick start with Claude Code
- Installation instructions
- Workflow invocation guide (slash commands)

### 2. [System Architecture](./system-architecture.md) — Technical Deep Dive
**Audience:** Architects, advanced developers, extension builders
**Contents:**
- Component interactions and data flow
- Hook system and boot sequence
- Workflow execution model
- Command routing and argument handling
- Cross-platform differences and limitations
- 1100+ lines of technical reference

### 3. [Project Overview & PDR](./project-overview-pdr.md) — Product Definition
**Audience:** Product managers, stakeholders, new team members
**Contents:**
- Vision, mission, and value proposition
- Target users and personas
- Key features (16 agents, 45 skills, slash-command workflows)
- Functional and non-functional requirements
- Success metrics and technical architecture

### 4. [Code Standards](./code-standards.md) — Development Conventions
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

### 5. [Project Roadmap](./project-roadmap.md) — Release Timeline
**Audience:** Everyone — what's completed, what's coming
**Contents:**
- v0.0.1 initial release features (16 agents, 44 skills, hooks, CLI)
- Completed work since launch (quality-gates v1, agent counts)
- Near-term priorities and future roadmap
- Success metrics and technical stack

### 6. [Codebase Summary](./codebase-summary.md) — High-Level Structure
**Audience:** Developers exploring the codebase
**Contents:**
- Directory structure with descriptions
- `.claude/` directory explained
- File organization patterns
- Key entry points and workflow pathways

## Specialized Topics

### 7. [Agent Teams Guide](./agent-teams-guide.md) — Parallel Collaboration
**Audience:** Advanced workflow users, team leads
**Contents:**
- Agent team spawning and coordination
- Parallel research patterns
- Message passing between agents
- Report generation and aggregation
- Team scaling strategies

### 8. [Skill-Native Task](./skill-native-task.md) — Custom Skill Development
**Audience:** Skill developers, extension authors
**Contents:**
- Anatomy of a skill
- SKILL.md manifest format
- Extending existing skills
- Skill testing and validation
- Skill publishing guidelines

### 9. [Skills Dependency Graph](./skills-dependency-graph.md) — Skill Relationships
**Audience:** Architects, skill maintainers
**Contents:**
- Dependency tree visualization
- Direct vs transitive dependencies
- Breaking change impact analysis
- Circular dependency detection

### 10. [Skills Interconnection Map](./skills-interconnection-map.md) — Skill Workflow Integration
**Audience:** Advanced workflow users, orchestration planners
**Contents:**
- Which skills call which other skills
- Common skill composition patterns
- Agent-to-skill routing
- Workflow bottlenecks and optimization opportunities

## Installation & Operations

### 11. [ADF Install Ownership Model](./adf-install-ownership-model.md) — Installer Architecture
**Audience:** Operations teams, deployment engineers
**Contents:**
- Canonical vs installed payload structure
- `.adf/manifest.json` ownership tracking
- Local configuration overrides
- Repair and rollback capabilities

### 12. [ADF Install Migration Guide](./adf-install-migration-guide.md) — Upgrading
**Audience:** Users updating existing ADF installations
**Contents:**
- Safe upgrade procedures
- Git profile migration
- Breaking change handling
- Data preservation during upgrade

### 13. [ADF Rollback and Repair](./adf-rollback-and-repair.md) — Recovery
**Audience:** Operations, support teams
**Contents:**
- Rollback to previous versions
- Repair corrupted installations
- Snapshot management
- Safety procedures

### 14. [ADF Legacy Adoption Rules](./adf-legacy-adoption-rules.md) — Integration
**Audience:** Teams migrating from non-ADF projects
**Contents:**
- Adopting existing projects
- Legacy configuration handling
- Breaking changes
- Safe adoption checklist

### 15. [ADF Manifest Schema](./adf-manifest-schema.md) — Specification
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
2. [README.md](../README.md) setup section — Install for Claude Code

**Developers:**
1. [Code Standards](./code-standards.md) — Learn coding conventions
2. [System Architecture](./system-architecture.md) — Understand how things work
3. [CLAUDE.md](../CLAUDE.md) — AI coding instructions
4. [Skill-Native Task](./skill-native-task.md) — Extend with custom skills

**Maintainers:**
1. [ADF Install Ownership Model](./adf-install-ownership-model.md) — Installer ops
2. [Skills Dependency Graph](./skills-dependency-graph.md) — Impact analysis

**Operations / DevOps:**
1. [ADF Install Ownership Model](./adf-install-ownership-model.md)
2. [ADF Rollback and Repair](./adf-rollback-and-repair.md)

**Architects:**
1. [System Architecture](./system-architecture.md)
2. [Project Overview & PDR](./project-overview-pdr.md) — Design decisions
3. [Skills Dependency Graph](./skills-dependency-graph.md)
4. [Skills Interconnection Map](./skills-interconnection-map.md)

### By Topic

**Installation & Upgrade:**
- [README.md](../README.md) — Initial setup
- [ADF Install Ownership Model](./adf-install-ownership-model.md) — How installer works
- [ADF Install Migration Guide](./adf-install-migration-guide.md) — Upgrading
- [ADF Rollback and Repair](./adf-rollback-and-repair.md) — Recovery

**Development Practices:**
- [Code Standards](./code-standards.md) — Conventions
- [CLAUDE.md](../CLAUDE.md) — Workflow rules
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
