# Skills Dependency Graph

**Last Updated**: 2026-03-16
**Total Skills**: 39

## ASCII Overview

```
     ┌──────────┐   ┌──────────┐   ┌─────────┐
     │ research │   │   plan   │   │   git   │
     └────┬─────┘   └──┬──┬───┘   └────┬────┘
          │             │  │            │
          ▼             │  │            ▼
    ┌───────────┐       │  │    ┌──────────────────┐
    │docs-seeker│       │  │    │context-engineering│
    └───────────┘       │  │    └──────────────────┘
                        ▼  ▼
                  ┌──────────┐     ┌──────────┐
                  │   cook   │     │   fix    │
                  └─┬──┬──┬──┘     └─┬──┬──┬──┘
                    │  │  │          │  │  │
       ┌────────────┘  │  │    ┌────┘  │  └────────┐
       ▼               │  │    ▼       │            ▼
   ┌───────┐           │  │  ┌─────┐   │      ┌──────────┐
   │ test  │           │  │  │debug│   │      │code-review│
   └───┬───┘           │  │  └──┬──┘   │      └─────┬────┘
       │               │  │     │      │            │
       ▼               ▼  ▼     ▼      ▼            ▼
   ┌─────────────────────────────────────────────────────┐
   │              SUPPORT SKILLS LAYER                   │
   │  sequential-thinking  problem-solving  ai-multimodal│
   │  docs-seeker  chrome-devtools  repomix  scout       │
   └─────────────────────────────────────────────────────┘
                           │
                           ▼
           ┌───────────────────────────────┐
           │     FINALIZATION LAYER        │
           │  project-management    docs   │
           │  git (commit/push)            │
           └───────────────────────────────┘
```

## Mermaid Diagram

```mermaid
graph TD
    subgraph Core Pipeline
        plan["plan"]
        cook["cook"]
        fix["fix"]
    end

    subgraph Quality Gate
        test["test"]
        code_review["code-review"]
        debug["debug"]
    end

    subgraph Intelligence
        brainstorm["brainstorm"]
        ask["ask"]
        research["research"]
        scout["scout"]
    end

    subgraph Reasoning Support
        seq["sequential-thinking"]
        prob["problem-solving"]
        ctx["context-engineering"]
    end

    subgraph External Integration
        ai["ai-multimodal"]
        chrome["chrome-devtools"]
        docs_seeker["docs-seeker"]
    end

    subgraph Project Management
        pm["project-management"]
        docs["docs"]
        git["git"]
        journal["journal"]
    end

    subgraph Visualization
        preview["preview"]
        md_viewer["markdown-novel-viewer"]
        kanban["plans-kanban"]
        mermaid["mermaidjs-v11"]
    end

    subgraph Collaboration
        team["team"]
        skill_creator["skill-creator"]
    end

    subgraph Frontend
        fe_dev["frontend-development"]
        fe_design["frontend-design"]
        ui_style["ui-styling"]
        ui_ux["ui-ux-pro-max"]
        web_guide["web-design-guidelines"]
        react_bp["react-best-practices"]
        web_test["web-testing"]
    end

    subgraph Backend & Infra
        be_dev["backend-development"]
        db["databases"]
        devops["devops"]
        web_fw["web-frameworks"]
    end

    subgraph Utility
        repomix["repomix"]
        mobile["mobile-development"]
    end

    %% Plan dependencies
    plan --> scout
    plan --> research
    plan --> seq
    plan --> brainstorm
    plan --> prob

    %% Cook dependencies
    cook --> plan
    cook --> test
    cook --> code_review
    cook --> pm
    cook --> docs
    cook --> debug

    %% Fix dependencies
    fix --> debug
    fix --> code_review
    fix --> test
    fix --> pm
    fix --> docs

    %% Test dependencies
    test --> debug
    test --> seq
    test --> chrome
    test --> ai

    %% Code Review dependencies
    code_review --> scout
    code_review --> seq
    code_review --> prob

    %% Debug dependencies
    debug --> docs_seeker
    debug --> repomix
    debug --> prob
    debug --> seq
    debug --> chrome
    debug --> ai

    %% Brainstorm dependencies
    brainstorm --> scout
    brainstorm --> docs_seeker
    brainstorm --> ai
    brainstorm --> seq
    brainstorm --> prob
    brainstorm --> plan

    %% Ask dependencies
    ask --> scout

    %% Research dependencies
    research --> docs_seeker

    %% Git dependencies
    git --> ctx

    %% Docs dependencies
    docs --> scout

    %% Project Management dependencies
    pm --> plan
    pm --> cook
    pm --> docs

    %% Preview dependencies
    preview --> mermaid

    %% Styling
    classDef core fill:#4a90d9,stroke:#2c5f8a,color:#fff
    classDef quality fill:#e67e22,stroke:#d35400,color:#fff
    classDef intel fill:#27ae60,stroke:#1e8449,color:#fff
    classDef support fill:#95a5a6,stroke:#7f8c8d,color:#fff
    classDef finalize fill:#8e44ad,stroke:#6c3483,color:#fff
    classDef viz fill:#16a085,stroke:#117a65,color:#fff
    classDef domain fill:#2c3e50,stroke:#1a252f,color:#fff

    class plan,cook,fix core
    class test,code_review,debug quality
    class brainstorm,ask,research,scout intel
    class seq,prob,ctx support
    class ai,chrome,docs_seeker support
    class pm,docs,git,journal finalize
    class preview,md_viewer,kanban,mermaid viz
    class team,skill_creator finalize
    class fe_dev,fe_design,ui_style,ui_ux,web_guide,react_bp,web_test domain
    class be_dev,db,devops,web_fw domain
    class repomix,mobile domain
```

## Dependency Summary

### Most Depended On (used by N other skills)
| Skill | Dependents |
|-------|-----------|
| sequential-thinking | 6 (plan, test, code-review, debug, brainstorm, ask) |
| scout | 5 (plan, code-review, brainstorm, ask, docs) |
| problem-solving | 4 (plan, code-review, debug, brainstorm) |
| debug | 4 (cook, fix, test, code-review) |
| docs-seeker | 4 (debug, research, brainstorm, ask) |
| ai-multimodal | 3 (test, debug, brainstorm) |
| chrome-devtools | 2 (test, debug) |
| repomix | 1 (debug) |
| context-engineering | 1 (git) |
| mermaidjs-v11 | 1 (preview) |

### Leaf Skills (zero dependents — domain/utility)
Frontend: frontend-development, frontend-design, ui-styling, ui-ux-pro-max, web-design-guidelines, react-best-practices, web-testing
Backend: backend-development, databases, devops, web-frameworks
Other: mobile-development, skill-creator

### Core Chain
```
plan → cook → test → code-review → project-management
fix  → debug
```

## Categories (11)

| Category | Count | Skills |
|----------|-------|--------|
| Core Pipeline | 3 | plan, cook, fix |
| Quality Gate | 3 | test, code-review, debug |
| Intelligence | 4 | brainstorm, ask, research, scout |
| Reasoning Support | 3 | sequential-thinking, problem-solving, context-engineering |
| External Integration | 3 | ai-multimodal, chrome-devtools, docs-seeker |
| Project Management | 4 | project-management, docs, git, journal |
| Visualization | 4 | preview, markdown-novel-viewer, plans-kanban, mermaidjs-v11 |
| Collaboration | 2 | team, skill-creator |
| Frontend | 7 | frontend-development, frontend-design, ui-styling, ui-ux-pro-max, web-design-guidelines, react-best-practices, web-testing |
| Backend & Infra | 4 | backend-development, databases, devops, web-frameworks |
| Utility | 2 | repomix, mobile-development |
