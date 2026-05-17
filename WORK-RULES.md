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

Preserve intent semantics. `command` normalizes executable work through the
harness gate; `plan` may remain plan-only; `review` remains report-only unless
BK explicitly asks for implementation and the request is decision-complete. This
gate does not add daemon/watch behavior, App Server authority, automatic worker
dispatch, lifecycle authority changes, hidden memory, automatic promotion, or
playbook/policy/template promotion.

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
-> close out or propose the next autonomous goal
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
  - recommended autonomous `/goal`
  - blocked on BK decision
- after any `/goal` work completes, include the next highest-value action:
  - choose the right abstraction level before recommending execution
  - for product capability, architecture, roadmap, or CEO workflow work, default
    to the next CEO capability boundary
  - use a ready-to-send `/goal` only when the next boundary is an accepted,
    worker-safe implementation slice
  - use a direct BK decision only for genuine BK judgment or authority needs
  - use "no next action recommended" only when no meaningful cohesive slice
    remains, and state that reason explicitly

Prefer "completed now" when Codex can finish the work in the current session.
Prefer a recommended autonomous `/goal` when meaningful engineering work remains
and can be delegated to a fresh Codex session without BK taking over the next
step. Use "blocked on BK decision" only when BK's product judgment, credentials,
external authority, or explicit review is required before work can continue.

After completing a user-started `/goal`, do not stop at the outcome label alone.
If there is any plausible next cohesive engineering, documentation, verification,
or dogfood slice, provide a ready-to-send `/goal` prompt for it. If continuing
would be low-value, say why no next autonomous goal is recommended instead of
leaving the absence unexplained.

Before proposing any direct BK action, first check whether Codex can either do it
now or fold it into a larger autonomous `/goal`. Direct BK actions are allowed
only when the action genuinely requires BK, such as choosing product direction,
granting credentials, approving an authority-boundary change, resolving unclear
scope, or performing a non-delegable external step.

Small follow-up engineering steps are not valid direct BK actions. Anti-patterns
include ending with "create one fixture", "run one dogfood command", "add the
next test", "wire the next option", "clean up this sentence", or similar work
that Codex can perform. Do the work immediately, omit it if it is not valuable,
or include it inside a larger autonomous `/goal`.

Use a ready-to-send `/goal` prompt only for a sustained, independently
verifiable objective that benefits from a new or longer Codex session. A good
`/goal` lets Codex complete meaningful implementation, focused tests,
verification, commit, and push without BK deciding the next step midstream.

Size ready-to-send `/goal` prompts around one cohesive local work surface, not
one tiny invariant. Prefer a slice that lets Codex complete meaningful
implementation, focused tests, verification, commit, and push in one session
without crossing authority boundaries. Good examples are one validator area,
one command workflow, one report-only orchestration surface, or one document
section with its matching checks. Avoid prompts that spend more overhead on
context loading and commit/push than on the actual work. Also avoid prompts so
broad that they require new authority, broad frameworks, writer parallelism,
trusted worker reports, or dispatch/merge/cleanup execution.

Good `/goal` candidates include one artifact store workflow, one CLI command
workflow, one report-only orchestration surface, one run lifecycle API plus CLI
surface, or one validator area with focused tests. Bad `/goal` candidates are
single tests, one-off fixture runs, small documentation wording edits, or
commands Codex can run immediately.

If the classification is ambiguous, include the recommended autonomous `/goal`
first and state the exact BK decision that would make direct action necessary.

Every ready-to-send `/goal` prompt must:

- explicitly require answers in Korean
- name the repo
- state the objective and verifiable end state in the first line
- summarize relevant evidence or prior results
- define observable success criteria
- define scope
- define autonomy expectations
- define verification commands or explain why no code verification is needed
- define reporting expectations
- define stop conditions

### Ready-To-Send `/goal` Prompt Format

Treat a ready-to-send `/goal` prompt as an autonomous session contract, not a
small handoff note. It should be large enough to remove BK from the next
engineering loop, but bounded enough for one Codex session to finish safely.

Do not compress ready-to-send `/goal` prompts into one dense line. Use a
multiline fenced `text` block so BK can read, edit, and paste the prompt without
reconstructing it.

Use this shape by default:

```text
/goal <repo path> 에서 <objective>를 완료해줘. <verifiable end state>가 충족될 때까지 중간에 BK에게 작은 다음 액션을 넘기지 말고 진행해줘. 답변은 반드시 한국어로 해줘.

맥락:
- <prior evidence or current state>
- <important prior decision>

성공 기준:
- <observable behavior after the change>
- <what should be true in CLI/API/artifact/output>
- <what remains explicitly out of scope>

범위:
- 포함: <allowed work>
- 제외: <forbidden work>

자율성:
- 기존 코드 패턴을 우선하고, 사소한 구현 선택은 직접 결정
- 작은 후속 작업은 BK에게 넘기지 말고 현재 goal 안에서 처리
- 아래 Stop condition에 걸릴 때만 멈춤

검증:
- <exact command>
- <exact command>
- <manual/CLI observable check if useful>

보고:
- deterministic verification 결과
- 변경 파일이 의도 범위인지
- 구현된 coverage와 남긴 항목
- commit/push 여부

Stop condition:
- <authority boundary / policy decision / credential / destructive operation>
- <scope expansion that must not be crossed>
```

If a possible prompt feels very small, do not emit it by default. Either do the
work now, omit it, or enlarge it into the nearest cohesive autonomous objective.
For valid small-but-real autonomous prompts, the `맥락` section may be omitted,
but keep line breaks and keep `성공 기준`, `범위`, `자율성`, `검증`, `보고`, and
`Stop condition` visible as separate sections. If no code verification applies,
say that explicitly under `검증`.

Do not suggest turning this into a global skill until the same formatting need
recurs outside this repository. For now, this repo rule is the source of truth.
