# Samantha Brainstorming Playbook

Last updated: 2026-05-16

## Purpose

Use this playbook when BK invokes:

```text
Samantha brainstorm: <request>
```

`Samantha brainstorm` is for shaping product direction before work is
executable. It is not a task runner, CLI command, prototype builder, mandatory
pre-step for all work, or default spec-writing flow.

The default subject is pre-execution product or architecture direction. For MVP
product UX, this means what the first usable workflow should be, what the user
sees, what decisions remain open, and what should become a later
`Samantha plan` or `Samantha command`.

Brainstorm follow-ups can accept a decision without authorizing execution.
Treat prefix-free phrases such as "Proceed with Option A," "let's go with
this," "good," "just separate it," or "go in that direction" as accepted
decision signals by default. They do not authorize file edits, command
execution, task specs, worker dispatch, prototype routes, or target repo
mutation unless BK also uses an explicit execution phrase or `sam c:`.

## Operating Loop

1. Inspect the target repo or product context before asking BK questions.
2. If the request spans multiple products, workflows, or independent surfaces,
   decompose it and pick the first MVP surface before refining details.
3. Ask one decision at a time. Give a recommended answer and name the tradeoff.
4. Prefer multiple-choice framing when it reduces BK's effort, but keep
   open-ended questions when the decision is genuinely exploratory.
5. For product or UI work, offer a temporary browser visual companion once
   before visual questions begin.
6. Use visuals only when seeing the artifact is better than reading about it:
   layout, flow, hierarchy, screen comparison, component shape, interaction
   structure, system relationships, or state transitions.
7. Use terminal conversation for scope, terminology, constraints, priority,
   success criteria, policy boundaries, and technical tradeoffs.
8. When useful, show two or three MVP directions, then converge on one.
9. Before closing, self-review the emerging direction for placeholders,
   contradictions, ambiguity, scope creep, and unrequested features.
10. If the result naturally decomposes into multiple follow-up slices, ask BK
   whether to preserve it as an Initiative Continuity Brief under
   `references/initiatives/`.
11. End with a Brainstorm Brief.

## Decision Framing

Each question should narrow the design without pretending the decision is
already made.

Use this shape by default:

```text
Question:
Recommended answer:
Tradeoff:
Why this matters:
```

Keep accepted decisions, rejected alternatives, and open questions separate.
Do not average conflicting directions into a compromise design. Pick the more
valuable direction, explain why, and leave the other as a rejected alternative
or explicit open question.

When the topic is already decision-complete, say so and recommend switching to
`Samantha plan:` or `Samantha command:` rather than continuing to brainstorm.

## Visual Companion

The visual companion is a temporary conversation aid. It may show mockups,
wireframes, diagrams, or side-by-side UI options while brainstorming.

It is a tool, not a mode. Accepting it means Samantha may use visuals when they
help a specific question; it does not mean every brainstorm step moves into the
browser.

Before each visual step, apply this test:

```text
Would BK understand this better by seeing it than by reading it?
```

Use the visual companion for:

- UI mockups, layout options, hierarchy, spacing, and component shape;
- architecture diagrams, data flow, relationship maps, and state transitions;
- side-by-side visual comparisons where BK is choosing a visual direction.

Stay in terminal conversation for:

- requirements, scope, terminology, priority, and success criteria;
- conceptual A/B/C choices described in words;
- policy, authority, verification, and implementation tradeoffs.

It must not become trusted implementation state:

- Do not edit production code during brainstorm by default.
- Do not create committed frontend routes during brainstorm by default.
- Do not create task specs or dispatch workers during brainstorm by default.
- Do not treat temporary mockups as accepted product requirements until BK has
  explicitly accepted the corresponding decision in conversation.

If BK wants the visual direction preserved as a durable artifact, convert the
accepted decisions into a later `Samantha plan` or `Samantha command` scope.

## Brainstorm Self-Review

Before producing the Brainstorm Brief, check the proposed direction:

- Placeholder: unresolved TODO, TBD, vague requirement, or missing decision.
- Consistency: accepted decisions contradict each other.
- Ambiguity: a future worker could build two different things from the same
  wording.
- Scope: the result covers multiple independent subsystems that need separate
  slices.
- YAGNI: the direction includes features BK did not ask for and the MVP does
  not need.

Fix the brief inline when the issue is obvious. If the issue requires BK's
judgment, leave it as an open question instead of silently choosing.

## Multi-Slice Continuity

If a brainstorm creates multiple dependent slices, the chat transcript must not
be the only source of truth. Recommend an Initiative Continuity Brief when a
fresh session would otherwise lose the broader objective, accepted decisions, or
remaining slice queue.

Continuity briefs live under `references/initiatives/` and follow
`references/playbooks/initiative-continuity-brief.md`.

Do not create the brief silently. Ask BK first, then create or update it through
a later `Samantha plan` or `Samantha command` scope.

## Default Boundaries

During `Samantha brainstorm`, Samantha may:

- inspect existing context;
- sharpen terms and product boundaries;
- challenge low-value scope;
- propose alternatives and tradeoffs;
- ask one narrowing question at a time;
- recommend a default answer while naming the cost;
- use temporary visual mockups for MVP UI/UX decisions;
- recommend the next planning or execution prompt.

During `Samantha brainstorm`, Samantha must not by default:

- add a new Samantha CLI surface;
- create daemon, dashboard, adapter, routine trigger, or remote-control scope;
- write production code;
- create task specs;
- dispatch workers;
- commit UX specs;
- write or commit default design specs;
- build prototype routes in the target repo;
- create hidden memory.

## Brainstorm Brief

Close every brainstorm with a concise Brainstorm Brief:

```text
Brainstorm Brief
- Goal:
- Audience:
- MVP user flow:
- Recommended direction:
- Accepted decisions:
- Rejected alternatives:
- Open questions:
- Self-review notes:
- Continuity artifact:
- Execution authorization:
- Recommended next prompt:
```

Use `Execution authorization: none` when BK has accepted a decision but has not
explicitly authorized execution. If a closure follow-up is ambiguous, record the
accepted decision, stop, set execution authorization to none, and recommend the
next prompt rather than creating task specs, dispatching workers, running
commands, editing files, or building prototype routes.

The recommended next prompt should usually be `Samantha plan:` when the result
needs a decision-complete implementation plan, or `Samantha command:` when the
work is already executable and can be normalized into a bounded task.

If a later `Samantha plan:` attempt exposes unresolved product direction,
authority, artifact lifecycle, validation boundary, or stop condition questions,
return to brainstorm and settle those decisions before planning again.
