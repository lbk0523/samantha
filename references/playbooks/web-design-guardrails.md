# Web Design Guardrails Skill Adapter

Status: active
Canonical source: `/Users/byung/.agents/skills/web-design-guardrails/SKILL.md`

## Purpose

Use this playbook to route Samantha website and web app design work to the
canonical shared `web-design-guardrails` skill. This file is an adapter, not a
copy of the guardrails. The shared skill remains the source of truth for the
current design guidance.

## When To Consult The Skill

- Planning: consult the shared skill before shaping frontend design work. First
  inspect the target project's existing design system, tokens, components,
  styling framework, and conventions.
- Review: use the shared skill as an advisory review lens for maintainability
  and consistency issues in website or web app UI diffs.
- Command or task shaping: use the shared skill when normalizing implementation
  work into target files, forbidden changes, design-system preservation notes,
  minimal token or primitive scope, anti-pattern searches, and focused visual or
  browser verification when relevant.

## Authority Boundary

Existing project design systems, brand guidelines, tokens, components, and
styling conventions remain authoritative. The shared skill supplies
project-neutral guardrails only when they do not conflict with the target
project.

The shared skill is reviewable guidance, not hidden memory and not a
deterministic trust gate. Do not duplicate, fork, or locally extend the full
guardrails text in Samantha playbooks. If the guardrails need to change, update
the canonical shared skill through the explicit shared-skill process.

Do not turn repeated design observations into hidden memory. Durable learning
must go through explicit, reviewable repository artifacts and the normal
learning flow.

Keep the YAGNI boundary intact. Do not expand a small website or MVP task into a
full design system, theme matrix, exhaustive component catalog, or broad visual
refactor unless the user explicitly asks for it or the existing project already
requires that scope.
