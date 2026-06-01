# Open Source Public Release Checklist

Date: 2026-06-01
Status: public repository and npm package closeout checklist
Source initiative: `references/initiatives/open-source-readiness.md`
Governance/package brief:
`references/operations/open-source-governance-package-readiness.md`
Accepted README and feedback intake commit:
`b059a2485fd17b051beb1b061c40bd64e86c4218`
Accepted demo commit: `413991128f3f0718c05846d23c018a38c4c33c7f`
Thread-policy delta audit:
`references/operations/open-source-thread-policy-delta-audit.md`
Accepted thread-policy commit: `45197c6c4be3e17f258ac2f8c26522aa494552f7`
Accepted governance files commit: `17d6349`
Package final pass:
`references/operations/open-source-package-readiness-final-pass.md`
Npm publication closeout:
`references/operations/open-source-npm-publication-closeout.md`

## Purpose

This checklist is the public release gate for Samantha's first open-source path.
It combines accepted S1/S2/S3/S4/S5 evidence, first-run demo readiness, public
docs readiness, governance/package readiness, dogfood-private boundary checks,
release blocker checks, and stop conditions.

This document records the public repository and npm package closeout state. It
does not publish a package, modify package settings, move references, delete
runs, or change the public/private artifact boundary.

## Evidence Baseline

Before public release, confirm these accepted slices:

| Slice | Required evidence | Status for this checklist |
| --- | --- | --- |
| S1 readiness audit | `references/operations/open-source-readiness-audit.md` | Completed evidence exists. |
| S2 first-run demo contract | `references/operations/open-source-first-run-demo-brief.md` | Completed evidence exists. |
| S3 README and public docs | `README.md`, `references/operations/open-source-artifact-map.md`, `references/operations/open-source-public-docs-plan.md` | README rewrite accepted at `b059a2485fd17b051beb1b061c40bd64e86c4218`. |
| S4 demo implementation | `references/operations/open-source-first-run-demo-dogfood.md` and accepted implementation commit `413991128f3f0718c05846d23c018a38c4c33c7f` | Dogfood evidence records `demo:first-run`, `HARNESS_RESULT`, verification, candidate commit, and no real repo merge. |
| S5 feedback intake | `.github/ISSUE_TEMPLATE/first-run-demo.yml`, `.github/ISSUE_TEMPLATE/workflow-feedback.yml`, `references/operations/open-source-release-note-draft.md` | Feedback intake accepted at `b059a2485fd17b051beb1b061c40bd64e86c4218`. |
| S6 governance/package final pass | `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `package.json`, `references/operations/open-source-package-readiness-final-pass.md` | Governance files accepted at `17d6349`; package metadata and package contents were prepared and verified before publication. |
| S7 npm publication closeout | `references/operations/open-source-npm-publication-closeout.md` | GitHub repository is public; npm package is public as `@lbk0523/samantha@0.1.0`; Bun-first package-runner dogfood passed with `HARNESS_RESULT: pass` and verification pass. |
| Thread-policy delta | `references/operations/open-source-thread-policy-delta-audit.md` and accepted thread-policy commit `45197c6c4be3e17f258ac2f8c26522aa494552f7` | Completed delta audit says thread-control artifacts remain advanced dogfood/private surfaces and must not enter the first public path. |

Stop if any accepted evidence is missing, superseded, or contradicted by the
current repository state.

## First-Run Demo Readiness

Release gate:

- `README.md` points new users to `bunx @lbk0523/samantha demo:first-run`.
- `README.md` preserves the clone-based local development path with `bun run
  samantha demo:first-run`.
- The demo uses disposable fixture state under `.samantha-demo/`.
- The demo does not mutate the user's real repository.
- The demo produces or reports `HARNESS_RESULT`.
- Deterministic verification runs outside the worker's judgment.
- The summary identifies fixture repo, worker worktree, run log, verification,
  candidate commit, merge status, and cleanup path.
- Cleanup instructions stay constrained to `.samantha-demo/<demo-id>`.
- Accepted dogfood evidence remains linked as proof, not as user setup.
- Failure output is understandable enough for the first-run issue template.

Stop conditions:

- `demo:first-run` requires a BK-specific local path.
- The demo depends on private run evidence, historical task specs, or real
  target repositories.
- The demo weakens task specs, isolated worktrees, forbidden-change checks,
  deterministic verification, `HARNESS_RESULT`, or Samantha-owned accept
  boundaries.

## Public Docs Readiness

Release gate:

- `README.md` explains Samantha as a local harness for deciding when agent work
  is safe to accept.
- `README.md` does not present Samantha as a more autonomous coding agent,
  SaaS control plane, remote operation system, background daemon, dashboard,
  connector platform, budget governance layer, writer parallelism system, or
  multi-project orchestrator.
- The trust loop appears before advanced command families.
- `README.md` links public-readiness artifacts selectively instead of treating
  all of `references/` as public docs.
- Public docs do not require `references/thread-control/**` for quickstart,
  first-run setup, or acceptance decisions.
- Thread-control artifacts, if mentioned at all, are labeled as advanced
  dogfood/private evidence and not as public product features.
- `README.md` states that `@lbk0523/samantha@0.1.0` is public and supported
  through the Bun-first package-runner path.
- `README.md` and governance docs do not claim `npx`, `npm exec`, or
  Node-general CLI support.
- Feedback intake asks for environment, command, stage, run log, cleanup,
  `HARNESS_RESULT`, verification evidence, gate friction, and expectations.
- The release note draft asks for gate-friction feedback rather than broad
  feature requests.

Stop conditions:

- Public docs expose private run history, personal paths, target-project
  histories, raw lesson review evidence, or generated worktrees as onboarding
  material.
- Public docs promise `npx`, `npm exec`, or Node-general CLI support before that
  contract is implemented and verified.
- Public docs invite first-release scope expansion into remote operation,
  background automation, dashboards, connector/control-plane entrypoints,
  budget governance, writer parallelism, thread API automation, or
  multi-project orchestration.

## Governance And Package Readiness

Release gate:

- `LICENSE` exists and reflects BK's chosen MIT license. Accepted governance
  files commit: `17d6349`.
- `CONTRIBUTING` defines contribution scope for the first public release.
- `CONTRIBUTING` accepts only thread-control documentation clarification in the
  first release and excludes thread API automation, scheduler/daemon behavior,
  run-log schema expansion, CLI exposure, UI, MCP, connector, and background
  operation unless a later reviewed initiative authorizes them.
- `SECURITY` gives a private security reporting policy and channel.
- `SECURITY` covers thread id, thread summary, prompt, run-log, lifecycle
  evidence, worker-output, and manual linkage report leakage, plus misuse of
  advisory thread evidence as trusted state.
- `CODE_OF_CONDUCT` exists or BK explicitly chooses a narrower first-release
  conduct policy with documented scope.
- Package metadata no longer describes Samantha as only a personal harness.
- `package.json` records `license: MIT`, repository, bugs, homepage, keywords,
  Bun `engines`, and a conservative `files` array.
- The npm package is public as `@lbk0523/samantha@0.1.0`.
- The supported package-runner command is `bunx @lbk0523/samantha
  demo:first-run`.
- `npx`, `npm exec`, and Node-general CLI support are not claimed.
- Package contents exclude dogfood/private evidence unless a specific artifact
  is intentionally public.
- Package contents exclude `references/thread-control/**` by default; it remains
  advanced dogfood/private evidence, excluded from public onboarding and package
  contents.
- Package contents dry-run evidence is recorded in
  `references/operations/open-source-package-readiness-final-pass.md`.
- New package-runner claims must be re-verified before `npm exec`, `npx`, or
  Node-general CLI support is advertised.

Decision debt that remains after first public release:

- whether to support `npx`, `npm exec`, or Node-general CLI behavior;
- whether to add broader examples beyond `demo:first-run`;
- whether to promote any advanced dogfood/private artifacts into public docs.

Stop conditions:

- The release would require package metadata changes beyond the published
  package boundary already implemented and verified.
- The release would require new package-runner support beyond Bun-first `bunx`.
- The release would require moving, deleting, redacting, or promoting
  dogfood/private artifacts outside an explicit task.

## Dogfood-Private Boundary Checks

Release gate:

- `runs/**` is not used as public onboarding data.
- `worktrees/**`, `.samantha-worktrees/**`, and `.samantha-demo/**` are treated
  as generated execution state.
- `references/tasks/**` remains dogfood/private unless a neutral example task
  is explicitly created.
- `references/thread-control/**` remains advanced dogfood/private unless a
  later public-docs or package-contents slice explicitly promotes a specific
  artifact with an advanced evidence label.
  It is excluded from public onboarding and package contents by default.
- Raw lesson inbox entries, lesson review JSON, and correction transcripts are
  not public onboarding docs.
- Target-project initiatives and reports for private work are not linked from
  the first public path.
- BatchSpec, launch agent, thread-control, background operation, connector, and
  multi-run governance artifacts are not framed as first-release features.
- Thread ids, thread summaries, manual linkage reports, and Chief-of-Staff
  evidence summaries are treated as advisory navigation/reporting surfaces, not
  trusted acceptance gates.
- Accepted dogfood reports are linked only when they prove a public-readiness
  slice and are labeled as evidence.

Stop conditions:

- A public path requires the reader to understand BK-specific workflows before
  running `demo:first-run`.
- A dogfood/private artifact needs redaction or movement before release and no
  scoped task exists for that work.
- Release packaging would accidentally include generated state, private
  evidence, or local machine paths.

## Release Blocker Checks

Block public release if any item is true:

- package metadata says "Personal Codex development harness";
- docs claim `npx`, `npm exec`, or Node-general CLI support without a verified
  implementation contract;
- package contents include dogfood/private surfaces such as
  `references/thread-control/**`, `references/tasks/**`, `references/lessons/**`,
  `runs/**`, `worktrees/**`, `.samantha-worktrees/**`, or `.samantha-demo/**`;
- `demo:first-run` fails or cannot be verified from a clean local checkout;
- README or release copy promises unsupported product surfaces;
- public docs blur worker output with trusted Samantha acceptance;
- private/dogfood evidence is required for onboarding.

## Final Release Gate

The first public release is ready only when all of these are true:

- S1 through S5 evidence is present and accepted.
- Governance/package readiness blockers are resolved for the public npm package.
- `bunx @lbk0523/samantha demo:first-run` is the public package entrypoint.
- `bun run samantha demo:first-run` remains available for clone-based local
  development.
- Public docs make the maturity level clear: active dogfood harness, not a
  polished platform.
- Feedback templates are available for first-run failures and trust-gate
  workflow feedback.
- Dogfood/private artifacts are excluded from onboarding and package contents.
- Thread-control artifacts are excluded from public onboarding and package
  contents by default; any later promotion requires a new reviewed slice.
- Package publication is complete for `@lbk0523/samantha@0.1.0`; no `npm exec`,
  `npx`, or Node-general CLI claims are made.
- No release blocker checks remain true.

If this gate fails, the next action is a scoped follow-up task, not a broad
release attempt.
