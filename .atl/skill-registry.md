# Skill Registry — jetzamarker

**Project**: jetzamarker  
**Stack**: HTML5 + CSS3 inline + JavaScript vanilla  
**Hosting**: Vercel  
**Last Updated**: 2026-06-24

---

## Overview

This registry lists all available skills for **jetzamarker** SDD workflows. Skills are scanned from user-level directories and project-level directories. When invoking a skill in an SDD phase, prefix with `/` (e.g., `/sdd-apply`).

---

## Core SDD Skills (Always Available)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `/sdd-init` | `sdd init`, `iniciar sdd` | Initialize SDD context; detect stack, conventions, and bootstrap persistence |
| `/sdd-explore` | `sdd explore <topic>` | Investigate ideas; read codebase; no files created |
| `/sdd-propose` | part of `/sdd-new` | Create change proposal with intent, scope, and approach |
| `/sdd-spec` | `/sdd-spec [change]` | Write specifications with requirements and scenarios |
| `/sdd-design` | `/sdd-design [change]` | Create technical design with architecture decisions |
| `/sdd-tasks` | `/sdd-tasks [change]` | Break down change into implementation task checklist |
| `/sdd-apply` | `/sdd-apply [change]` | Implement tasks in batches; check off items |
| `/sdd-verify` | `/sdd-verify [change]` | Validate implementation against specs and design |
| `/sdd-archive` | `/sdd-archive [change]` | Close change and persist final state in artifact store |

---

## Project-Specific Skills (Recommended)

### Documentation & Design
| Skill | File | Trigger | Purpose |
|-------|------|---------|---------|
| `cognitive-doc-design` | `.copilot/skills/cognitive-doc-design/SKILL.md` | Guides, READMEs, RFCs, architecture docs | Reduce cognitive load in docs |
| `sdd-design` | (core) | Architecture decisions | Technical design for changes |

### Code Quality & Review
| Skill | File | Trigger | Purpose |
|-------|------|---------|---------|
| `comment-writer` | `.copilot/skills/comment-writer/SKILL.md` | PR feedback, issue replies, reviews | Warm, direct collaboration comments |
| `judgment-day` | `.copilot/skills/judgment-day/SKILL.md` | `judgment day`, `dual review` | Parallel adversarial code review |

### Branching & PR Workflow
| Skill | File | Trigger | Purpose |
|-------|------|---------|---------|
| `branch-pr` | `.copilot/skills/branch-pr/SKILL.md` | Creating PRs, opening reviews | PR creation workflow (issue-first) |
| `chained-pr` | `.copilot/skills/chained-pr/SKILL.md` | PRs >400 lines, stacked PRs | Split oversized changes into chained PRs |
| `work-unit-commits` | `.copilot/skills/work-unit-commits/SKILL.md` | Implementation, commit planning | Plan commits as reviewable work units |

### Feature Development
| Skill | File | Trigger | Purpose |
|-------|------|---------|---------|
| `issue-creation` | `.copilot/skills/issue-creation/SKILL.md` | Creating GitHub issues | Issue creation workflow (issue-first) |

---

## Compact Rules

This section is injected into sub-agent prompts during SDD phases to enforce project-specific conventions.

### Code Style & Structure

**File Organization:**
- HTML: Single `index.html` entry point (SPA)
- CSS: Inline in `<style>` tags within HTML (no separate stylesheet)
- JavaScript: Vanilla ES6+ without frameworks
- Assets: Images and media in `/assets/` directory
- Scripts: Utility scripts in `/scripts/` directory

**JavaScript Conventions:**
- Use `const` for all variable declarations (immutable default)
- Use arrow functions for callbacks and async operations
- Use `async/await` for async control flow (no `.then()` chains)
- Error handling: `try/catch` blocks for async operations
- Console output for debugging; remove before production

**CSS Conventions:**
- Use CSS custom properties (variables) for theming
- Prefer `--key-name` naming (kebab-case)
- Organize properties: display → position → sizing → spacing → typography → colors
- Media queries at the end of each rule block

**HTML Conventions:**
- Semantic HTML5 tags (`<section>`, `<article>`, `<nav>`, etc.)
- Accessibility attributes: `alt`, `aria-label`, `role` where needed
- Inline critical CSS; defer non-critical styles
- Single-page app: all content in one HTML file

### Testing & Quality

**No Active Test Framework**: Project uses browser testing only.  
**No Linter or Formatter**: Apply consistent code style manually per conventions.  
**Deployment**: Vercel handles all hosting and CI/CD via `vercel.json`.

### Naming Conventions

- **CSS Classes**: kebab-case (e.g., `.section-hero`, `.btn-primary`)
- **CSS Variables**: `--context-name` (e.g., `--pink-deep`, `--gray-dark`)
- **JavaScript Variables & Functions**: camelCase (e.g., `fetchRepos`, `userData`)
- **File Names**: lowercase, hyphens (e.g., `check_github.js` — follow existing pattern)

---

## User-Level Skills Available

The following user-level skills are also available for this project (from `~/.copilot/skills/` and other global directories):

- `sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`
- `branch-pr`, `chained-pr`, `work-unit-commits`
- `comment-writer`, `cognitive-doc-design`
- `issue-creation`, `skill-registry`
- `judgment-day`

---

## How to Use This Registry

1. **In SDD Workflows**: When orchestrator delegates to sub-agents, it injects matching **Compact Rules** from the above section into each sub-agent prompt.
2. **For PR Reviews**: Reviewers should reference **Code Style & Structure** for consistency checks.
3. **For New Features**: Reference **File Organization** when planning new modules or scripts.
4. **For Updates**: Re-run `skill-registry` command after adding project-level skills or conventions.

---

## Next Steps

- Run `/sdd-new <change-name>` to start a new SDD workflow
- Run `/sdd-explore <topic>` to investigate an idea before committing
- Run `/sdd-continue` to continue an ongoing SDD workflow

---

*Registry generated by sdd-init on 2026-06-24*
