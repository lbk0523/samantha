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

## Completion Rules

For Samantha self-build implementation work, the default completion standard is:

```text
deterministic verification passes
-> intended files only
-> commit
-> push
-> propose the next action
```

Do not leave BK with "push this" as the next action when the work can be pushed
safely by Codex.

Stop before commit or push when verification fails, unrelated dirty changes are
present, the local branch diverges from the remote, secret or credential risk is
possible, BK asks to keep work local or use a PR flow, or the change needs
explicit review before publication.

## Final Response Checklist

Before the final response on Samantha self-build work, explicitly check:

- deterministic verification was run and passed, or the stop condition is named
- changed files are intended for the request
- commit and push were completed when safe
- remaining blockers are stated
- next action is classified as either a direct action or a ready-to-send `/goal`
  prompt

If the next step is small or requires BK directly, state the next concrete
action directly.

If the next step is a larger autonomous slice, or a longer work session would be
useful, include a ready-to-send `/goal` prompt that BK can paste into this or
another Codex session without rewriting the scope.

Size ready-to-send `/goal` prompts around one cohesive local work surface, not
one tiny invariant. Prefer a slice that lets Codex complete meaningful
implementation, focused tests, verification, commit, and push in one session
without crossing authority boundaries. Good examples are one validator area,
one command workflow, one report-only orchestration surface, or one document
section with its matching checks. Avoid prompts that spend more overhead on
context loading and commit/push than on the actual work. Also avoid prompts so
broad that they require new authority, broad frameworks, writer parallelism,
trusted worker reports, or dispatch/merge/cleanup execution.

If the classification is ambiguous, include both the direct action and a goal
option.

Every ready-to-send `/goal` prompt must:

- explicitly require answers in Korean
- name the repo
- summarize relevant evidence or prior results
- define scope
- define verification commands or explain why no code verification is needed
- define reporting expectations
- define stop conditions

### Ready-To-Send `/goal` Prompt Format

Do not compress ready-to-send `/goal` prompts into one dense line. Use a
multiline fenced `text` block so BK can read, edit, and paste the prompt without
reconstructing it.

Use this shape by default:

```text
/goal <repo path> 에서 <objective>. 답변은 반드시 한국어로 해줘.

맥락:
- <prior evidence or current state>
- <important prior decision>

범위:
- 포함: <allowed work>
- 제외: <forbidden work>

검증:
- <command or deterministic check>
- <command or deterministic check>

보고:
- <what final answer must report>

Stop condition:
- <condition that must stop work>
- <condition that must stop work>
```

If the prompt is very small, the `맥락` or `보고` sections may be omitted, but
keep line breaks and keep `범위`, `검증`, and `Stop condition` visible as separate
sections. If no code verification applies, say that explicitly under `검증`.

Do not suggest turning this into a global skill until the same formatting need
recurs outside this repository. For now, this repo rule is the source of truth.
