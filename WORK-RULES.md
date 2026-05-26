# Samantha Work Rules

This file is the source of truth for BK/Codex working discipline in this repo.
Keep detailed operating rules here so `AGENTS.md` can stay focused on product
and authority boundaries.

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

When recommending a next prompt, brainstorm (`sam b:`), plan (`sam p:`),
command (`sam c:`), review (`sam r:`), recover (`sam re:`), inspect
(`sam i:`), and learn (`sam l:`) handoffs close with one copy-paste-ready
fenced text block. Use this slot order when slots are present:

```text
sam <alias>: <one-line goal>
Context:
Ask:
Scope:
Output:
Stop:
```

Empty or irrelevant slots may be omitted for simple handoffs.

Use `sam b:` when the work is still directional. Close brainstorm work with:

- accepted decisions
- rejected alternatives
- remaining architecture or product questions
- the smallest useful next prompt

If the direction is coherent but execution boundaries are not yet complete, the
next prompt should be `sam p:`. If the work is already decision-complete and
only needs execution normalization, the next prompt may be `sam c:`. Do not
collapse brainstorm directly into implementation when product direction,
authority, artifact lifecycle, validation boundary, or stop conditions remain
unclear.

Use `sam p:` when the next valuable work is to turn accepted direction into a
plan. Close plan work with:

- assumptions and decisions used by the plan
- target artifact or capability boundary
- intended files or artifact families, if known
- verification approach
- stop conditions
- whether the next prompt should be `sam c:` or another `sam p:`

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

After command work, treat the next prompt as operating guidance, not runtime
automation or automatic continuation. The final response must separate current
completion evidence from the next boundary:

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

Stop before recommending another `sam c:` when any of these are true:

- product judgment is still needed;
- authority expansion is being considered;
- target files or artifact families are unclear;
- verification is unclear or unavailable;
- dirty or stale repo risk could invalidate the handoff;
- current completion failed or is untrusted;
- lifecycle ambiguity remains;
- push, secrets, credentials, or external access is required;
- the next work belongs to a new initiative boundary.

Any recommended prompt must remain one copy-paste-ready fenced `text` block.
When slots are present, preserve the existing slot order: `Context:`, `Ask:`,
`Scope:`, `Output:`, `Stop:`. No-next-action outcomes must state the reason
instead of inventing work.

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
`Recommended next prompt`. Recommend `sam re:` instead of `sam c:` for failed
or untrusted command completion, and recommend no next action only when the
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
