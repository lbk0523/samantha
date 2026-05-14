# Samantha Brainstorming Playbook

Last updated: 2026-05-15

## Purpose

Use this playbook when BK invokes:

```text
Samantha brainstorm: <request>
```

`Samantha brainstorm` is for shaping product direction before work is
executable. It is not a task runner, CLI command, prototype builder, or default
spec-writing flow.

The default subject is MVP product UX: what the first usable workflow should be,
what the user sees, what decisions remain open, and what should become a later
`Samantha plan` or `Samantha command`.

## Operating Loop

1. Inspect the target repo or product context before asking BK questions.
2. If the request spans multiple products, workflows, or independent surfaces,
   decompose it and pick the first MVP surface before refining details.
3. Ask one decision at a time. Give a recommended answer and name the tradeoff.
4. For product or UI work, offer a temporary browser visual companion once
   before visual questions begin.
5. Use visuals only when seeing the artifact is better than reading about it:
   layout, flow, hierarchy, screen comparison, component shape, or interaction
   structure.
6. Use terminal conversation for scope, terminology, constraints, priority,
   success criteria, and technical tradeoffs.
7. When useful, show two or three MVP UI/UX directions, then converge on one.
8. End with a Brainstorm Brief.

## Visual Companion

The visual companion is a temporary conversation aid. It may show mockups,
wireframes, diagrams, or side-by-side UI options while brainstorming.

It must not become trusted implementation state:

- Do not edit production code during brainstorm by default.
- Do not create committed frontend routes during brainstorm by default.
- Do not create task specs or dispatch workers during brainstorm by default.
- Do not treat temporary mockups as accepted product requirements until BK has
  explicitly accepted the corresponding decision in conversation.

If BK wants the visual direction preserved as a durable artifact, convert the
accepted decisions into a later `Samantha plan` or `Samantha command` scope.

## Default Boundaries

During `Samantha brainstorm`, Samantha may:

- inspect existing context;
- sharpen terms and product boundaries;
- challenge low-value scope;
- propose alternatives and tradeoffs;
- use temporary visual mockups for MVP UI/UX decisions;
- recommend the next planning or execution prompt.

During `Samantha brainstorm`, Samantha must not by default:

- add a new Samantha CLI surface;
- create daemon, dashboard, adapter, routine trigger, or remote-control scope;
- write production code;
- create task specs;
- dispatch workers;
- commit UX specs;
- build prototype routes in the target repo;
- create hidden memory.

## Brainstorm Brief

Close every brainstorm with a concise Brainstorm Brief:

```text
Brainstorm Brief
- Goal:
- Audience:
- MVP user flow:
- Accepted UI/UX decisions:
- Rejected alternatives:
- Open questions:
- Recommended next prompt:
```

The recommended next prompt should usually be `Samantha plan:` when the result
needs a decision-complete implementation plan, or `Samantha command:` when the
work is already executable and can be normalized into a bounded task.

Do not recommend `/goal` directly from brainstorm unless the remaining work is
cohesive, independently verifiable, and no BK product judgment is needed.
