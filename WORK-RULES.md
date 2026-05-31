# Samantha Work Rules

This file is the source of truth for BK/Codex working discipline in this repo.
Keep detailed operating rules here so `AGENTS.md` can stay focused on product
and authority boundaries and `OPERATING_GUIDE_KR.md` can stay focused on
BK-facing usage protocol.

## Prime Directive

Protect BK's time. Say what matters most now. If BK is spending attention on
low-value work, say so directly and explain the tradeoff.

## Communication Rules

- Be direct, concrete, and explicit about assumptions, uncertainty, and
  tradeoffs.
- Do not flatter or agree for free. If BK is right, say why. If BK is wrong,
  say why.
- If multiple interpretations exist, name them instead of silently choosing.
- If a simpler approach exists, point it out. Push back when the requested
  direction is likely to waste time or broaden scope.
- If something is unclear and a reasonable assumption would be risky, stop and
  ask a concise question.

## Before Coding

Before implementation, define success criteria that can be verified.

For multi-step work, state a short plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Prefer tests or deterministic checks that prove the changed surface. Weak goals
such as "make it work" need clarification or a tighter local interpretation.

## Skill / Code Boundary

Before adding a new Samantha behavior, decide whether it belongs in a
reviewable procedure or deterministic code.

Use a playbook, skill, operating guide, or direction document when the work
requires judgment, adaptation, questioning, synthesis, tradeoff analysis, or
conversation-aware behavior. These artifacts describe how Samantha or Codex
should reason.

Use code, policy, tests, task templates, or CLI commands when the same input
should produce the same output. Lookup, list, status, validation, scope checks,
placeholder detection, dispatch eligibility, verification, and lifecycle state
belong on the deterministic side.

The boundary is:

```text
If the agent needs to think, use a reviewable procedure.
If the result must be trusted, use deterministic checks.
```

Do not use a markdown procedure to replace a trust gate. A playbook can advise
what to inspect, how to diagnose, or how to shape a follow-up task, but worker
output becomes trusted only through Samantha-owned scope checks, verification,
run evidence, and lifecycle gates.

Thread state, worker prose, and Chief-of-Staff summaries are not deterministic
trust gates and must not replace run log, `HARNESS_RESULT`, top-level pass,
changed-file scope, verification, candidate commit, final git status evidence,
or lifecycle records.

## Latent And Deterministic Work

Keep latent and deterministic work on the correct side of the system.

Latent work includes decomposition, diagnosis narrative, evidence synthesis,
tradeoff framing, terminology sharpening, and next-action recommendation. It
may produce advice, plans, reports, task instructions, lesson candidates, or
playbook candidates.

Deterministic work includes policy decisions, changed-file scope checks,
verify-command results, lifecycle status, placeholder detection, JSON parsing,
task template substitution, and commit or merge eligibility.

Do not turn deterministic work into an LLM judgment to save time. If a latent
judgment should change future behavior, route it through the explicit learning
flow: lesson candidate, review, promotion, and focused enforcement or guidance
only when justified.

## Long-Running Initiative Discipline

When a multi-slice initiative keeps expanding, lock the remaining roadmap to a
fixed named range before the queue becomes open-ended. New authority discovered
after that point should usually become a separate reviewed initiative instead
of another silently appended slice.

When an accepted slice plan's stated success criteria are met, declare that
plan complete. Move newly discovered adjacent hardening into a separately named
initiative, and record intentionally omitted source-report requirements as
residual work instead of silently reopening the completed plan.

Separate completion evidence from closure decisions. A completion-candidate
slice proves that the intended capability works; a closure slice decides
whether that evidence completes the initiative or whether follow-up authority
belongs somewhere else.

Do not treat vague lesson candidates as promoted learning. A useful lesson must
state a concrete invariant, cite evidence, name the target artifact or layer,
and explain the risk if adopted. Generic statements such as "preserve this task
shape if it recurs" are raw evidence only until rewritten into that form.

## Implementation Rules

- Keep changes surgical and test-driven.
- Prefer the smallest readable implementation that satisfies the current phase.
- Do not add features, abstractions, configurability, or error handling that the
  task does not need.
- Match existing style and local patterns, even when another style would be
  reasonable.
- Do not refactor adjacent code unless it is required for the requested change.
- Remove imports, variables, functions, and files that your own change made
  unused. Do not clean up pre-existing dead code unless asked.
- Size implementation slices around cohesive work surfaces, not tiny individual
  invariants. When several rules share the same validator, artifact shape,
  command workflow, or report-only orchestration boundary, group them into one
  implementation slice if they can be tested, verified, committed, and pushed
  together without crossing authority boundaries.
- Keep slices small only when the broader grouping would require new authority,
  a broad framework, writer parallelism, trusted worker reports, dispatch,
  merge, cleanup execution, or unclear product decisions. If slice size is being
  reduced mainly to lower implementation risk or context load, say that
  explicitly and explain the tradeoff before proceeding.
- Samantha, not a worker, owns commits after deterministic gates pass.
- Every writer task must declare target files, forbidden changes, and verify
  commands.
- Verify commands must be connected to the task's changed surface. Prefer
  focused verification first, then broader sanity checks only when the change can
  affect shared executable behavior.
- For authority-sensitive worker runs, especially policy, lifecycle, accept,
  scope, verification, or trust-boundary changes, passing tests, changed-file
  scope, and `HARNESS_RESULT` are necessary but not sufficient accept evidence.
  The accept review must also run or inspect a small source-of-truth adversarial
  matrix for the trust boundary being changed. Keep this scoped to
  authority-sensitive work; do not add the extra matrix to routine low-risk
  documentation or implementation tasks.
- Do not create "light" writer tasks that skip worktree isolation, scope checks,
  deterministic verification, run evidence, or Samantha-owned transitions.

Git mutations that touch the same repository state must be serialized per repo.
Do not run overlapping `git config`, `git add`, `git commit`, `git worktree`, or
other commands that touch `.git/index`, `.git/config`, or equivalent repository
metadata for the same repo.

## Self-Build SDK Authority Gate

When `Samantha command:` or `sam c:` is activated in the Samantha repo and the
request is decision-complete writer implementation, Codex Desktop must not
directly edit implementation files. Codex Desktop may clarify scope, classify
the request, draft the task spec, or report the required next gate, but trusted
implementation must go through:

```text
task spec
-> isolated worktree
-> SDK-backed Samantha worker run using --runtime=codex-sdk
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

This also applies to sticky follow-up implementation language inside an active
Sticky Samantha Session. Prefix-free routing may classify the follow-up as
writer implementation, but it does not bypass the self-build SDK authority
gate.

Preserve intent semantics. `command` normalizes executable work through the
harness gate; `plan` may remain plan-only; `review` remains report-only unless
BK explicitly asks for implementation and the request is decision-complete. This
gate does not add background operation, App Server authority, automatic worker
dispatch, lifecycle authority changes, hidden memory, automatic promotion, or
playbook/policy/template promotion.

## Self-Build Task Spec Lifecycle

Persistent Samantha self-build task specs under `references/tasks/<id>.json`
are planning artifacts. They must be committed before worker dispatch, and the
worker must start from a clean base that includes that committed spec.

Ephemeral or ad-hoc task specs must live outside the repository, for example
under `/tmp`. After the worker run, Samantha must not backfill
`references/tasks/**` with that temporary spec. This lifecycle choice does not
increase worker authority.

Use `references/playbooks/self-build-task-spec-lifecycle.md` for the operational
gates, post-run restrictions, verification expectations, and stop conditions.

## Next Action Level Gate

Before recommending any next action, Samantha must choose the right abstraction
level instead of defaulting to worker-sized tasks.

For product capability, architecture, roadmap, or CEO workflow work, recommend
the next CEO capability boundary first. The recommendation should name the
capability BK would get, the user-facing outcome, why that boundary is the
highest-value next step, and which trust gates stay preserved.

Do not automatically collapse a completed product capability, architecture
slice, roadmap slice, or CEO workflow slice into the next implementation file,
test, CLI option, or worker task. Worker task decomposition belongs inside an
accepted capability plan, not in the default final next action.

If Samantha recommends a worker-sized task as the next action after higher-level
work, it must explain why a larger capability boundary is unsafe or premature.
Valid reasons include unresolved product decisions, missing authority design,
unclear lifecycle ownership, absent verification gates, or a scope boundary that
would cross MVP constraints.

Use this concise final-response shape when the next step is higher-level:

```text
Next CEO Capability
- Capability: <next capability boundary>
- User-facing outcome: <what BK can do or decide after it exists>
- Why now: <why this is the highest-value next boundary>
- Trust gates preserved: <authority, verification, lifecycle, or scope gates>
- Worker-safe decomposition: <what implementation tasks become safe only after acceptance>
- Not included: <explicit non-goals and premature worker-sized work>
```

## Completion Rules

For Samantha self-build implementation work, the default completion standard is:

```text
SDK-backed worker run evidence, or equivalent run log with HARNESS_RESULT
-> changed-file scope matches the task
deterministic verification passes
-> commit
-> push
-> close out with the outcome and the next Samantha handoff when useful
```

Do not report Samantha self-build implementation as complete, committed, or
pushed unless the final evidence includes the SDK run, or an equivalent run log
with `HARNESS_RESULT`, changed-file scope, and verification output.

Do not leave BK with "push this" as the next action when the work can be pushed
safely by Codex.

Do not leave BK with small engineering follow-ups when Codex can complete them
in the current session. If the next step is a document edit, a focused test, a
single CLI wiring change, a fixture dogfood run, or another small deterministic
engineering action, do it now instead of proposing it.

Stop before commit or push when verification fails, unrelated dirty changes are
present, the local branch diverges from the remote, secret or credential risk is
possible, BK asks to keep work local or use a PR flow, or the change needs
explicit review before publication.

## Samantha Intent Handoff Rules

Samantha handoffs should make the natural `sam b:` -> `sam p:` -> `sam c:`
flow explicit without forcing every task through every intent.

### Language Policy

Samantha's operator-facing control plane is Korean by default. BK-facing
summaries, judgments, risks, final reports, and recommended prompts should be
written in Korean unless BK explicitly requests another language or the target
artifact itself must be English.

Preserve execution substrate text in its original language: code symbols, file
paths, CLI commands, logs, API names, error messages, test names,
`HARNESS_RESULT`, config keys, and package names must stay directly matchable
to the repository, command output, or run evidence.

Do not produce English-only Samantha handoff prompts by default. Avoid
uncontrolled Korean-English mixing; keep each section language-consistent, with
original execution terms preserved where needed.

When recommending a next prompt, brainstorm (`sam b:`), plan (`sam p:`),
command (`sam c:`), review (`sam r:`), recover (`sam re:`), inspect
(`sam i:`), and learn (`sam l:`) handoffs close with one copy-paste-ready
fenced text block. Use this slot order when slots are present:

```text
sam <alias>: <one-line goal>
Context:
Ask:
Technical execution:
Scope:
Output:
Stop:
```

`Context:`, `Ask:`, `Scope:`, `Output:`, and `Stop:` remain the normal required
shape when a multi-slot prompt is warranted. `Technical execution:` is optional
and should be included only when a concise English implementation note improves
worker precision. `Output:` should say that the final report is Korean and that
file names, function names, CLI commands, `HARNESS_RESULT` keys, and test names
stay in their original language.

Empty or irrelevant slots may be omitted for simple handoffs, but the prompt
must not become English-only by default.

Inside an active Sticky Samantha Session, a copy-paste-ready prompt is the full
audit/restart input, not always the required same-thread input. If Samantha just
recommended a next prompt, BK may approve that exact prompt with a short
same-thread shortcut such as "추천한 sam p로 계속", "위 sam c로 진행",
"이 프롬프트 그대로 실행 정규화", or "방금 추천한 다음 단계로 가자".

Same-thread shortcuts reuse the immediately preceding `Recommended next prompt`
as the routing input. They must not add new scope, authority, target repo, or
execution permission beyond that prompt. If the prompt is executable or mutating,
the shortcut must still make execution intent clear, and all Samantha lifecycle
gates remain in force. Use the full fenced prompt for new threads, delayed
resumption, cross-repo handoff, or audit logs where transcript-local context is
not enough.

Use `sam b:` when the work is still directional. During the conversation, use a
grill-style one-question decision loop by default:

```text
Question:
Recommended answer:
Tradeoff:
Why this matters:
```

Ask one decision at a time. If repo docs or code can answer the question,
inspect them before asking BK. Do not make every brainstorm turn a long state
report. Close brainstorm work with:

- accepted decisions
- rejected alternatives
- open decisions
- decision debt
- readiness verdict: `continue_brainstorm`, `plan`, `command`, or `blocked`
- continuity artifact decision
- the smallest useful next prompt

If the direction is coherent but execution boundaries are not yet complete, the
next prompt should be `sam p:`. If the work is already decision-complete and
only needs execution normalization, the next prompt may be `sam c:`. Do not
collapse brainstorm directly into implementation when product direction,
authority, artifact lifecycle, validation boundary, or stop conditions remain
unclear.

Use `sam p:` when the next valuable work is to turn accepted direction into a
plan. Unless the work is a simple single slice, close plan work with a Plan
Readiness Review:

- stage classification
- artifact decision and durable artifact path
- accepted decisions and decision debt
- codebase evidence
- target artifact or capability boundary
- proposed execution units
- slice sizing gate and rationale
- HITL vs AFK classification
- intended files or artifact families, if known
- verification approach
- stop conditions
- plan verdict: `ready_for_command`, `needs_brainstorm`,
  `needs_plan_refinement`, `needs_review`, or `blocked`
- recommended next prompt

The artifact decision is `none`, `create_initiative_brief`,
`update_initiative_brief`, or `create_short_prd_section`. Use `none` for a
small single slice where a text-only plan is enough. For long-running or
multi-slice work, create or update an Initiative Continuity Brief when later
slices depend on current decisions and a future session would likely miss the
broader objective from one task spec or handoff prompt. Short PRD or checklist
content should normally live inside the initiative brief.

The slice sizing gate blocks micro-slicing. Plan execution units around
cohesive work surfaces, not tiny individual invariants. Related changes that
share a validator, artifact shape, command workflow, or verification boundary
should default to one command slice when they can be tested, verified,
committed, and pushed together without crossing authority boundaries. If the
plan splits smaller, name the authority, verification, lifecycle, product
uncertainty, broad framework, or repository-risk reason that justifies it. If
that reason is absent, return `needs_plan_refinement` instead of
`ready_for_command`.

`sam p:` organizes accepted decisions into an executable plan; it must not
invent product, authority, artifact lifecycle, or validation decisions to make a
plan feel complete. If planning exposes unresolved direction, route backward to
`sam b:` instead of repeating `sam p:`. Repeating plan mode around missing
decisions tends to harden assumptions into a plausible-looking plan.

Route `sam p:` back to `sam b:` when planning discovers:

- multiple viable product directions with no clear winner
- unresolved authority, artifact lifecycle, or validation boundaries
- stop conditions that are themselves the main design questions
- intended files or verification strategy changing because the direction is
  unsettled
- a plan that is substituting for BK's product or authority judgment

Do not route backward for ordinary implementation unknowns that can be recorded
as assumptions, local choices, or stop conditions. Recommend `sam c:` only when
the plan is decision-complete enough that Samantha can route it through task
specs, worktrees, worker run evidence, deterministic verification, and
Samantha-owned lifecycle gates without asking BK to make a midstream product or
authority decision.

Use `sam c:` when BK has an executable software request that must be normalized
through Samantha's harness. Close command work with the run/report outcome,
verification result, changed-file scope, commit/push status when applicable,
and the next highest-value Samantha handoff. For self-build writer
implementation inside this repo, `sam c:` must preserve the SDK-backed
self-build authority gate.

### Post-Command Handoff Branch Contract

After command work, treat the next prompt as operating guidance by default, not
runtime automation or an automatic execution contract. The final response must
separate current completion evidence from the next boundary:

- `Outcome`: what happened in the current command slice.
- `Trusted evidence`: task spec, run/report, `HARNESS_RESULT`, deterministic
  verification, changed-file scope, lifecycle state, and commit/push state when
  applicable.
- `Current slice`: the slice just completed, failed, blocked, or retired.
- `Next-slice state`: one of `next slice ready`, `needs plan`, `needs
  brainstorm`, `recovery`, `closure decision`, `no next action`, or `adjacent
  initiative needed`.
- `Recommended next prompt`: one copy-paste-ready fenced `text` block only when
  a next prompt is warranted.
- `Same-thread shortcut`: optional short approval phrase when BK can continue
  from the immediately preceding `Recommended next prompt` in the same thread.

Use this branch table when choosing the handoff:

| Next-slice state | Recommended intent | Evidence expectation |
| --- | --- | --- |
| `next slice ready` | `sam c:` | Ready executable next slice with clear target files or artifact family, verification, lifecycle boundary, and stop condition. |
| `needs plan` | `sam p:` | execution boundary incomplete: scope, target files, verification, stop condition, or lifecycle handling still needs planning. |
| `needs brainstorm` | `sam b:` | Product or authority decision needed before planning or execution can be honest. |
| `recovery` | `sam re:` | failed or untrusted completion, blocked run, stale base, verify failed, scope failed, missing `HARNESS_RESULT`, or incomplete lifecycle evidence. |
| `closure decision` | `sam p:` | The question is whether completion evidence satisfies the initiative completion rule, not how to implement another slice. |
| `no next action` | none | Completion rule satisfied and no meaningful cohesive slice remains. Say `No next action recommended` and state the reason. |
| `adjacent initiative needed` | separate `sam b:` or `sam p:` | Adjacent authority or product surface belongs outside the current initiative boundary. |

### Bounded Command Continuation Contract

As a narrow exception to ordinary handoff guidance, `sam c:` may operate
bounded continuation only when an approved Initiative Continuity Brief and a
structured continuation artifact provide trusted routing state. Markdown
roadmap prose, chat transcript, and worker summaries cannot authorize successor
execution.

Bounded continuation must preserve this envelope:

- `pushAllowed: false`
- `batchExecutionAllowed: false`
- `multiWriterAllowed: false`
- `backgroundOperationAllowed: false`
- `requiresStructuredContinuationArtifact: true`
- `requiresFreshPreflightPerSlice: true`
- `maxFailedEvidenceReworkCycles: 1`

Bounded continuation must reuse existing gates rather than creating a parallel
trust path: continuity brief status rules, structured continuation artifact
validation, `continuation:show`, `runTaskCandidate` preflight,
`continuation:run-task-once`, `runAcceptCandidate` preflight,
`continuation:accept-run-once`, `continuation:update-status-after-accept`, and
`readiness:check`.

Each bounded continuation report must cite the initiative path, structured
continuation artifact path, current slice id, selected action type, status
transition, evidence references, verification result, successful-continuation
or failed-evidence-rework classification, remaining rework budget, side-effect
map, next ready slice or active stop condition, and exact next Samantha command
or no-next-action reason.

Stop before recommending another `sam c:` when any of these are true:

- product judgment is still needed;
- authority expansion is being considered;
- target files or artifact families are unclear;
- forbidden changes, verify commands, repo root, base evidence, structured
  continuation artifact, or lifecycle handling is missing or ambiguous;
- verification is unclear or unavailable;
- dirty or stale repo risk could invalidate the handoff;
- current completion failed or is untrusted;
- lifecycle ambiguity remains;
- `HARNESS_RESULT` is missing or invalid;
- scope checks or deterministic verification failed;
- push, secrets, credentials, external access, connector access, background
  operation, hidden memory, operator UI, remote adapter, dashboard scope,
  multi-project orchestration, batch execution, or multi-writer execution is
  required;
- Samantha cannot update local evidence without inventing facts;
- the next work belongs to a new initiative boundary.

Any recommended prompt must remain one copy-paste-ready fenced `text` block.
When slots are present, preserve the existing slot order: `Context:`, `Ask:`,
`Scope:`, `Output:`, `Stop:`. No-next-action outcomes must state the reason
instead of inventing work.

When a same-thread continuation is expected, include a short `Same-thread
shortcut` after the recommended prompt. The shortcut is optional guidance for the
current thread only; it does not replace the fenced prompt as the restartable
handoff artifact.

Samantha's current systemized handoff surfaces are its own intents, task specs,
run evidence, reports, and reviewable repo artifacts.

## Final Response Checklist

Before the final response on Samantha self-build work, explicitly check:

- SDK run evidence exists, or an equivalent run log includes `HARNESS_RESULT`
  and the verification output needed to audit the worker lifecycle
- deterministic verification was run and passed, or the stop condition is named
- changed files are intended for the request
- commit and push were completed when safe
- remaining blockers are stated
- outcome is classified as one of:
  - completed now
  - recommended Samantha handoff
  - blocked on BK decision
  - recovery needed
  - no next action recommended
- the next action uses the right abstraction level before recommending
  execution:
  - for product capability, architecture, roadmap, or CEO workflow work, default
    to the next CEO capability boundary
  - use `sam b:`, `sam p:`, or `sam c:` handoff only when that intent matches
    the actual next boundary
  - use a direct BK decision only for genuine BK judgment or authority needs
  - use "no next action recommended" only when no meaningful cohesive slice
    remains, and state that reason explicitly

Prefer "completed now" when Codex can finish the work in the current session.
Prefer a recommended Samantha handoff when meaningful work remains and a
follow-up intent can preserve the right boundary without BK taking over small
engineering steps. Use "blocked on BK decision" only when BK's product judgment,
credentials, external authority, or explicit review is required before work can
continue.

For post-command work, use the Post-Command Handoff final response shape:
`Outcome`, `Trusted evidence`, `Current slice`, `Next-slice state`, and
`Recommended next prompt`, plus optional `Same-thread shortcut` when same-thread
continuation is expected. Recommend `sam re:` instead of `sam c:` for failed or
untrusted command completion, and recommend no next action only when the
completion rule is satisfied or there is no coherent remaining slice.

Before proposing any direct BK action, first check whether Codex can either do it
now or fold it into the next Samantha handoff. Direct BK actions are allowed
only when the action genuinely requires BK, such as choosing product direction,
granting credentials, approving an authority-boundary change, resolving unclear
scope, or performing a non-delegable external step.

Small follow-up engineering steps are not valid direct BK actions. Anti-patterns
include ending with "create one fixture", "run one dogfood command", "add the
next test", "wire the next option", "clean up this sentence", or similar work
that Codex can perform. Do the work immediately, omit it if it is not valuable,
or include it inside the next Samantha handoff.
