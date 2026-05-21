# Samantha Operating Guide

Last updated: 2026-05-18

## Purpose

This guide defines the user-facing operating protocol for Samantha.

The current operating baseline is Samantha v1. v1 keeps the Codex Chat-based
operating protocol while using Samantha on real Codex work to accumulate run
evidence, lesson evidence, and task evidence, then improve harness performance
and convenience from that evidence.

Samantha v1 does not automatically add chat adapters, daemon/watch behavior,
dashboards, routine triggers, or remote/control-plane operation to operator
activation. Those surfaces are no longer rejected merely because they were v0
non-goals. With a separate reviewed product slice and explicit authority,
verification, and lifecycle design, they may be evaluated as v1 candidate
surfaces.

This document is the protocol specification. Cross-repo activation in Codex
sessions is handled by the global Codex skill at
`~/.codex/skills/samantha-operator/SKILL.md`.

The official syntax allows both the long form and short aliases:

```text
Samantha <intent>: <natural language request>
sam <alias>: <natural language request>
```

Short aliases are only a typing convenience; they do not change the canonical
intent:

| Alias | Canonical intent |
| --- | --- |
| `sam c:` | `Samantha command:` |
| `sam b:` | `Samantha brainstorm:` |
| `sam p:` | `Samantha plan:` |
| `sam r:` | `Samantha review:` |
| `sam re:` | `Samantha recover:` |
| `sam i:` | `Samantha inspect:` |
| `sam l:` | `Samantha learn:` |

There is no default intent for bare `sam:`. Official intents and aliases are
only the values listed above.

## Sticky Samantha Session

After any explicit `Samantha <intent>:` or `sam <alias>:` message, Sticky
Samantha Session routing is active for that Codex thread. The activation is
thread-local. It does not become a default for other threads, other projects,
the whole repo, daemon/watch behavior, routine triggers, or chat adapters.

While Sticky Samantha Session is active, prefix-free follow-ups are routed
through Samantha CEO routing. A prefix-free follow-up does not repeat the
previous intent as a fixed default. Samantha must read the follow-up and
classify whether it is doctrine, product boundary, architecture, roadmap work,
decision-complete implementation work, report-only review, or recovery /
lifecycle action before recommending execution. If the follow-up implies a new
intent, Samantha may infer that intent from the request, but must not bypass
task specs, isolated worktrees, `HARNESS_RESULT`, deterministic verification,
or Samantha-owned lifecycle gates.

Opt out explicitly with messages such as:

```text
sam off
Samantha off
Samantha 끄고 Codex로 해
이번 건 Samantha 없이 직접 해
```

After opt-out, prefix-free messages in the same thread return to ordinary Codex
conversation. A new explicit `Samantha <intent>:` or `sam <alias>:` message is
required to reactivate Samantha routing.

Sticky Samantha Session is only a routing convenience. It is not hidden memory,
daemon/watch behavior, a chat adapter, a project-global default, a routine
trigger, or a bypass around task specs, isolated worktrees, `HARNESS_RESULT`,
deterministic verification, or Samantha-owned commit/report gates.

### Brainstorm Decision Acceptance And Execution Authorization

After `sam b:` or `Samantha brainstorm:`, prefix-free follow-ups do not create
execution authorization by default. Phrases such as "Proceed with Option A,"
"let's go with this," "good," "just separate it," and "go in that direction"
are treated as accepted decision signals by default, not authorization to edit
files, run commands, create task specs, dispatch workers, create prototype
routes, or mutate target repos.

Execution requires an explicit execution phrase such as "implement it," "fix
it," "start the work," "change the files," "run it," "patch according to this
plan," or an explicit `sam c:`. If a follow-up is ambiguous between decision
acceptance and execution authorization, Samantha records the decision, stops,
and recommends the next prompt.

When the global skill activates in another repo, the current Codex working
directory is the target repo and the Samantha harness repo remains
`/Users/byung/Documents/samantha`. A thin terminal `samantha` wrapper may exist
for CLI convenience, but it does not activate Samantha in Codex Chat. Chat
activation is the global skill plus explicit `Samantha <intent>:` intent,
`sam <alias>:` alias, or active thread-local sticky follow-up.

## Authority Boundary

Samantha can discuss direction, decompose goals, propose task specs, inspect
evidence, and recommend the next execution path.

When a request becomes executable work, Samantha must route it through existing
harness gates:

```text
BK software request
-> plan or task spec
-> isolated worktree when writing is needed
-> Codex worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit or report
```

`Samantha command:` does not mean "run immediately." It means "normalize this
goal into bounded work first." If the work is clear and suitable for autonomous
implementation, Samantha may produce a scoped plan, task spec direction, or
task spec path. It must not bypass task specs, scope checks, verification, run
evidence, or Samantha-owned lifecycle gates.

## Operating Modes And Routing

When Samantha receives a canonical or aliased `command`, `brainstorm`, or
`plan` request, it must classify the request before recommending the next
action:

- Is this doctrine, product boundary, architecture, or roadmap work?
- Is this already a decision-complete implementation task?
- Is this report-only review?
- Is this recovery or lifecycle action?

This classification comes before the requested intent. Even when BK writes
`Samantha plan:`, `Samantha command:`, `sam p:`, or `sam c:`, if the request is
about `NORTH_STAR.md`, `ARCHITECTURE.md`, `ROADMAP.md`, role boundaries,
artifact lifecycle, validation boundaries, or product doctrine, Samantha must
stay in CEO/architect mode.

In CEO/architect mode, Samantha must not jump directly to task specs, worker
runs, or implementation slices. It first checks the phase roadmap, architecture
completeness, assumptions, decision points, and stop conditions, then names what
remains undecided. The recommended next action is the next design artifact, not
the next implementation. Examples include
ARCHITECTURE alignment, a phase roadmap, artifact lifecycle, role boundaries,
or validation boundaries.

Worker/execution mode applies only when the implementation task is
decision-complete. Then Samantha follows the existing harness gates:

```text
BK software request
-> plan or task spec
-> isolated worktree when writing is needed
-> Codex worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit or report
```

## Intents

| Intent | Use it when | Samantha should produce |
| --- | --- | --- |
| `command` | BK has a software goal that Samantha should normalize. | Classify the stage and lifecycle gate first. If it is implementation-stage work, produce a scoped plan, task spec direction, or task spec path; if it is doctrine/architecture-stage work, produce a roadmap or artifact design. |
| `brainstorm` | BK wants to shape direction before the work is executable, especially MVP product UI/UX or product doctrine. | Question-driven convergence, tradeoffs, sharper terminology, two or three direction options, accepted decisions, rejected alternatives, remaining architecture questions, decision points, self-review, and a Brainstorm Brief following `references/playbooks/samantha-brainstorming.md`. |
| `plan` | BK wants an architecture/roadmap plan or a decision-complete implementation plan. | Check the phase roadmap, architecture completeness, assumptions, decision points, and stop conditions first. Only move into implementation planning when the work is implementation-stage. |
| `review` | BK wants critique, readiness checks, risk finding, or evidence synthesis. | A report-only assessment with findings and open questions. |
| `recover` | BK points at failed, blocked, stale, or incomplete run evidence. | A diagnosis and next bounded action, usually a narrower follow-up task or lifecycle step. |
| `inspect` | BK wants current state across runs, tasks, batches, lessons, or docs. | A concise state summary and the highest-value next action. |
| `learn` | BK wants to operate the explicit lesson candidate, review, promotion, or evidence flow. | A reviewable learning artifact action, never hidden memory. |

## Intent Handoff

Samantha's natural flow is `sam b:` -> `sam p:` -> `sam c:`. Do not force every
request through all three stages. Each intent hands off only when the next
boundary is clear enough.

When Samantha recommends a next prompt or handoff prompt, provide it as one
fenced `text` code block that BK can copy and paste. The standard prompt shape
uses these slots in this order:

```text
sam <alias>: <one-line goal>
Context:
Ask:
Scope:
Output:
Stop:
```

Empty or irrelevant slots may be omitted for simple handoffs, but
Samantha-authored recommended prompts should preserve the slot order when slots
are present. The detailed guide aliases are `sam b:`, `sam p:`, `sam c:`,
`sam r:`, `sam re:`, `sam i:`, and `sam l:`.

Use `sam b:` when the direction is not yet executable. A Brainstorm result
should close with accepted decisions, rejected alternatives, remaining
architecture or product questions, and a recommended next prompt. If direction
is coherent but execution boundaries remain incomplete, the next prompt should
be `sam p:`. If product direction, authority, artifact lifecycle, validation
boundary, and stop conditions are already clear enough, it may hand off directly
to `sam c:`, but it must say why.

Use `sam p:` to turn accepted direction into an executable plan. A Plan result
should include assumptions, the target artifact or capability boundary,
intended files or artifact families when known, verification approach, stop
conditions, and the next prompt. The next prompt is usually `sam c:`, but
remaining product or architecture decisions should stay as another `sam p:` or
a direct BK decision.

`sam p:` organizes accepted decisions into a plan; it does not create the
missing decisions. If planning exposes unresolved product direction, authority
boundaries, artifact lifecycle, validation boundaries, or stop conditions that
are themselves the main design questions, route backward to `sam b:` instead of
repeating `sam p:`. Repeating plan mode around missing decisions can harden
assumptions into a plausible-looking plan. Ordinary implementation details that
can follow existing patterns should stay in `sam p:` as assumptions or stop
conditions.

Use `sam c:` to normalize an executable software request through Samantha's
harness gate. A Command result should report the task spec or run/report path,
verification result, changed-file scope, commit/push status, and the next
highest-value Samantha handoff. For Samantha self-build writer implementation,
`sam c:` preserves the SDK-backed self-build authority gate even when the work
arrives as a sticky follow-up.

Current operating rules use `sam b:`, `sam p:`, `sam c:`, task specs, run
evidence, reports, and reviewable repo artifacts as the handoff units.

## Multi-Slice Continuity

When a brainstorm, plan, or command decomposes into multiple dependent slices,
Samantha should not rely on the chat transcript as the parent source of truth.
If BK approves preserving the work, create or update an Initiative Continuity
Brief under `references/initiatives/`.

The brief should name accepted decisions, non-goals, invariants, the slice
queue, the current next slice, and the end-of-session update rule. It does not
replace task specs, run logs, verification, or lifecycle gates.

## Examples

### Executable Project Goal

```text
Samantha command: 이 repo에서 runs:list 출력이 너무 거칠어. 최근 run의 상태와 다음 액션을 한눈에 보이게 개선해줘.
```

Expected behavior:

- Restate the goal and success criteria.
- Classify it as a decision-complete implementation task rather than
  doctrine/architecture-stage work.
- Identify whether this is a CLI/core command task.
- Produce a scoped plan or task spec before execution.
- Preserve existing harness gates for write work.

### Brainstorm Before Implementation

```text
sam b: debut 전에 BK가 Samantha에게 어떤 종류의 말을 해야 하는지 더 다듬어보자.

좋아. 그러면 이걸 다음 phase plan으로 정리해줘. 아직 구현하지 마.
```

Expected behavior:

- Inspect the target repo or product context first.
- Keep the work conversational.
- Ask one decision at a time, with a recommended answer and tradeoff.
- Surface tradeoffs and recommendations instead of silently choosing.
- For product/UI work, offer a temporary browser visual companion once before
  visual questions. The companion is a tool, not a mode; use it per question
  only when seeing the artifact is better than reading about it.
- Compare two or three MVP directions when useful, then converge on one.
- Separate accepted decisions from remaining architecture questions first.
- Self-review the direction for placeholders, contradictions, ambiguity, scope
  creep, and YAGNI before closing.
- End with a Brainstorm Brief covering the goal, audience, MVP user flow,
  recommended direction, accepted decisions, rejected alternatives, open
  questions, self-review notes, and recommended next prompt.
- Stop before executable work unless BK turns the discussion into a command or
  plan request.
- Do not collapse brainstorm direction directly into a task spec or
  implementation slice.
- Do not create production code, task specs, worker dispatches, committed UX
  or design specs, or prototype routes by default.
- Treat the second prefix-free message as a Sticky Samantha Session follow-up,
  but do not repeat `brainstorm` as a fixed default. Reclassify it as
  plan-only CEO routing because it asks for a phase plan and says not to
  implement yet.

### Plan Only

```text
Samantha plan: lesson review UX를 더 명확하게 만드는 구현 계획을 세워줘. 아직 코드는 바꾸지 마.
```

Expected behavior:

- Classify whether this is implementation planning or architecture/roadmap
  planning first.
- Produce a decision-complete implementation plan.
- Name assumptions, affected interfaces, test scenarios, and stop conditions.
- Do not mutate files unless BK later asks for implementation.

### Sticky Follow-Up Self-Build Implementation

```text
sam p: Samantha repo의 sticky follow-up 구현 절차를 문서화하는 계획을 세워줘.

좋아. 그 계획대로 구현해.
```

Expected behavior:

- Activate Sticky Samantha Session from the first message.
- Reclassify the second prefix-free message through Samantha CEO routing.
- If it is decision-complete writer implementation inside the Samantha repo,
  apply the self-build authority gate even though it is a sticky follow-up.
- Do not directly edit implementation files from Codex Desktop. Route through a
  task spec, isolated worktree, SDK-backed Samantha worker run using
  `--runtime=codex-sdk`, `HARNESS_RESULT`, deterministic verification, and
  Samantha-owned commit/report.

### Doctrine/Architecture Planning

```text
Samantha plan: bernays repo의 NORTH_STAR와 ARCHITECTURE 정렬 이후 phase roadmap을 잡아줘.
```

Expected behavior:

- Classify the request as CEO/architect mode.
- Do not jump from NORTH_STAR alignment straight to a worker-level next task
  such as validator CLI implementation.
- First propose completing the ARCHITECTURE phase roadmap, artifact lifecycle,
  role boundaries, and validation boundaries.
- Name architecture completeness, assumptions, decision points, and stop
  conditions.
- Keep implementation in a later phase after architecture completeness.

### Report-Only Review

```text
Samantha review: 현재 Phase 5 batch 문서가 writer authority boundary를 흐리는 부분이 있는지 봐줘.
```

Expected behavior:

- Treat the request as report-only.
- Lead with concrete findings and file references.
- Do not edit, commit, merge, clean up, or mutate lifecycle state.

### Failed Run Recovery

```text
Samantha recover: runs/2026-05-13T03-48-10-822Z-add-tasks-from-run-command.json 를 보고 다음 액션을 정해줘.
```

Expected behavior:

- Classify the run from evidence.
- Do not trust failed worker output as accepted work.
- Recommend a lifecycle action or narrower follow-up task.

### State Inspection

```text
Samantha inspect: 지금 runs, lessons inbox, batch specs 기준으로 debut 전에 가장 중요한 다음 작업이 뭐야?
```

Expected behavior:

- Inspect local evidence first.
- Summarize only the state needed for a decision.
- Say the highest-value next action directly.

### Learning Flow

```text
Samantha learn: 최근 반복된 실패에서 lesson candidate로 남길 만한 게 있는지 봐줘.
```

Expected behavior:

- Use only explicit, reviewable artifacts.
- Draft, review, promote, or record evidence through the existing lesson flow.
- Never create hidden memory or silently rewrite doctrine.

## SDK Runtime Selection

Omitted `samantha run-task` runtime now defaults to `codex-sdk`. Use
`--runtime=exec-json` as the explicit fallback when SDK local state, credentials,
or runtime diagnosability is suspect:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha --runtime=exec-json
```

This supersedes the old self-build-only SDK dogfood selection rule for
`run-task`. The authority gate still matters: Samantha self-build writer
implementation must still be represented as a task spec, isolated worktree,
Samantha worker run, `HARNESS_RESULT`, deterministic verification, and
Samantha-owned commit/report evidence.

Omitted `batches:execute` runtime remains `exec-json`. Use
`batches:execute --runtime=codex-sdk` only for an explicit bounded SDK dogfood
batch:

```bash
bun run samantha batches:execute --batch-id=<batch-id>
bun run samantha batches:execute --batch-id=<batch-id> --runtime=codex-sdk
```

Runtime selection does not authorize BatchSpec runtime policy, report
orchestration runtime selection, automatic fallback, App Server integration,
hidden UI state, daemon/watch behavior, dashboards, writerCap changes, or
runtime-owned verification, scope, commit, lifecycle, cleanup, push, recovery,
or orchestration authority. Roll back by passing `run-task --runtime=exec-json`
if SDK failures stop producing diagnosable run-log evidence, `HARNESS_RESULT`
preservation regresses, SDK metadata loses `runtime.kind`, SDK thread state
starts driving lifecycle or recovery decisions, SDK package movement violates
policy, or SDK default use writes outside declared task authority.

## v1 Candidate Surfaces And Hard Gates

Samantha Operating Protocol v1 does not automatically add these surfaces to the
current operator activation. They are v1 candidate surfaces, not v0 non-goals.
Before Samantha accepts any of them as product scope, each needs a separate
reviewed product slice with explicit authority, verification, and lifecycle
gates:

- `bun run samantha ask`
- slash-command parsing
- Slack, Telegram, or other chat adapters
- daemon or watch behavior
- dashboards
- routine triggers
- budget governance
- remote/control-plane operation
- multi-project orchestration

These gates are not relaxed in v1:

- no hidden memory
- no worker-owned orchestration
- no trusted state change without deterministic verification
- no worker merge, push, or cleanup authority

Candidate surface review must produce a design that preserves those hard gates.
