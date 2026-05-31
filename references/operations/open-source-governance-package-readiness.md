# Open Source Governance And Package Readiness

Date: 2026-05-31
Status: completed for clone-only package readiness; package publication deferred
Source initiative: `references/initiatives/open-source-readiness.md`
Accepted README and feedback intake commit:
`b059a2485fd17b051beb1b061c40bd64e86c4218`
Accepted demo commit: `413991128f3f0718c05846d23c018a38c4c33c7f`
Thread-policy delta audit:
`references/operations/open-source-thread-policy-delta-audit.md`
Accepted thread-policy commit: `45197c6c4be3e17f258ac2f8c26522aa494552f7`
Accepted governance files commit: `17d6349`
Package final pass:
`references/operations/open-source-package-readiness-final-pass.md`

## Purpose

This brief records the governance and package readiness boundary for the first
public Samantha release.

Governance files were accepted at commit `17d6349`. The package final pass
updated public-facing package metadata and added a conservative `files` array,
but it did not remove `private: true`, add `publishConfig`, add `bin`, claim
package-runner readiness, or perform package publishing.

The current supported public path remains clone-only:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

## Current Evidence Baseline

The governance/package slice starts after these accepted public-readiness
artifacts:

| Evidence | Status | Public role |
| --- | --- | --- |
| S1 readiness audit | completed | `references/operations/open-source-readiness-audit.md` records blockers and private/public classification needs. |
| S2 first-run demo contract | completed | `references/operations/open-source-first-run-demo-brief.md` defines `demo:first-run`, fixture behavior, and trust gates. |
| S3 public docs and README rewrite | completed | `README.md`, `references/operations/open-source-artifact-map.md`, and `references/operations/open-source-public-docs-plan.md` establish public framing and dogfood-private routing. Accepted at `b059a2485fd17b051beb1b061c40bd64e86c4218`. |
| S4 first-run demo implementation evidence | completed | `references/operations/open-source-first-run-demo-dogfood.md` records `bun run samantha demo:first-run --runtime=codex-sdk`, `HARNESS_RESULT: pass`, deterministic verification, and no merge into a real user repository. Accepted implementation commit: `413991128f3f0718c05846d23c018a38c4c33c7f`. |
| S5 feedback intake | completed | `.github/ISSUE_TEMPLATE/first-run-demo.yml`, `.github/ISSUE_TEMPLATE/workflow-feedback.yml`, and `references/operations/open-source-release-note-draft.md` ask for first-run evidence and gate-friction feedback. Accepted at `b059a2485fd17b051beb1b061c40bd64e86c4218`. |
| Thread-policy delta | completed | `references/operations/open-source-thread-policy-delta-audit.md` records that `references/thread-control/**` remains advanced dogfood/private evidence after accepted thread-policy commit `45197c6c4be3e17f258ac2f8c26522aa494552f7`. |
| Governance files | completed | `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` were accepted at commit `17d6349`. |
| Package metadata and contents | completed for clone-only readiness | `package.json` has public metadata, `license: MIT`, Bun `engines`, and conservative `files`; package contents dry-run evidence is recorded in `references/operations/open-source-package-readiness-final-pass.md`. |

The remaining release decisions are outside package metadata hygiene: package
publication, package-runner executable contract, `private: true` removal,
`publishConfig`, `bin`, and GitHub repository visibility remain deferred.

## Governance Surfaces

### LICENSE

Decision: BK chose MIT for the clone-only public path. `LICENSE` exists and was
accepted at commit `17d6349`.

Recommended options:

- MIT: simplest adoption path and common for early developer tools.
- Apache-2.0: permissive adoption path with explicit patent language.
- Source-available or no public license yet: acceptable only if the release is
  intentionally feedback-only and clearly not open-source distribution.

Release gate: package metadata must keep `license: MIT` unless a later
governance task changes the license intentionally.

### CONTRIBUTING

Decision: `CONTRIBUTING.md` defines the limited first-release contribution
scope and was accepted at commit `17d6349`.

Recommended first-release policy:

- Accept bug reports and workflow feedback around `demo:first-run`.
- Accept small docs fixes that clarify the trust loop, first-run demo, or
  public/dogfood boundary.
- Accept thread-control docs clarification only when it preserves the advanced
  dogfood/private label and does not promote advisory thread evidence into a
  public acceptance gate.
- Defer feature PRs for remote operation, background automation, dashboards,
  connector/control-plane entrypoints, budget governance, writer parallelism,
  multi-project orchestration, thread API automation, scheduler/daemon
  behavior, run-log schema expansion, CLI exposure, UI, MCP integration, and
  package-manager expansion.
- Require contributors to preserve task specs, isolated worktrees,
  target-file/forbidden-file checks, deterministic verification,
  `HARNESS_RESULT`, run evidence, and Samantha-owned lifecycle transitions.

Release gate: do not invite broad contributions until `CONTRIBUTING` states the
first-release scope and authority boundaries.

### SECURITY

Decision: `SECURITY.md` uses GitHub private vulnerability reporting when
available and instructs reporters not to disclose sensitive details publicly if
that private channel is unavailable. It was accepted at commit `17d6349`.

Recommended options:

- GitHub private vulnerability reporting, if enabled for the repository.
- A dedicated security email alias.
- Temporary instruction to avoid public issue disclosure, paired with a named
  private contact path.

Security reporting policy should cover:

- suspected command injection, path traversal, unsafe cleanup, or repository
  mutation outside declared scope;
- leakage of private run logs, local paths, prompts, task specs, or dogfood
  evidence;
- leakage of thread ids, thread summaries, manual linkage reports,
  Chief-of-Staff summaries, background thread evidence, worker output, or
  lifecycle evidence;
- unsafe handling of worker output, `HARNESS_RESULT`, verification logs, or
  candidate commits;
- use of advisory thread evidence as trusted state, including thread summaries
  replacing run logs, `HARNESS_RESULT`, changed-file scope, deterministic
  verification, candidate commits, `final_git_status_captured`, or lifecycle
  records;
- thread-control behavior that appears to grant orchestration, merge, cleanup,
  push, lifecycle, policy, or doctrine authority to a background thread;
- dependency vulnerability reports for the runtime path.

Release gate: do not publish a public package or solicit public adoption until
`SECURITY` gives reporters a private path.

### CODE_OF_CONDUCT

Decision: `CODE_OF_CONDUCT.md` defines a repository-scoped policy for GitHub
issues, pull requests, discussions, and feedback templates. It was accepted at
commit `17d6349`.

Recommended options:

- Contributor Covenant for ordinary public collaboration.
- Minimal project conduct policy focused on issues, discussions, PRs, and
  feedback templates.
- Defer community expansion while still stating basic conduct expectations in
  `CONTRIBUTING`.

Release gate: do not open broad community discussion spaces until
`CODE_OF_CONDUCT` scope and enforcement contact are decided.

## Package Readiness

Current `package.json` state after the final pass:

```json
{
  "name": "samantha",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Local harness for verifying agent-produced code before accepting it",
  "license": "MIT",
  "engines": {
    "bun": ">=1.2.0"
  },
  "files": [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "src/",
    "examples/first-run-demo/fixture-repo/"
  ]
}
```

This is clone-only ready, not package-runner ready. The current repository can
document:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

It should not claim npm, `bunx`, `npx`, or package execution until package
publication is explicitly designed, `private: true` removal is approved,
`publishConfig` and `bin` are added, and a package-runner path is verified.

### Package Name

Decision needed: BK must choose a publishable package name.

Recommended options:

- Keep `samantha` only if the package registry name is available and the public
  identity is acceptable.
- Use a scoped package such as `@bk/samantha` or another owned scope if BK
  wants a clearer namespace.
- Use a more specific name such as `samantha-harness` if unscoped `samantha` is
  unavailable or too broad.

Decision debt:

- Check registry availability.
- Decide whether the public name should emphasize "Samantha" or "harness".
- Decide owner scope and package provenance.

Release gate: package publishing is blocked until the name is chosen and
registry ownership is confirmed. Clone-only public release does not require
package name or registry ownership resolution.

### Package Metadata

Metadata completed for clone-only readiness:

- public-facing `description` that does not say "Personal Codex development
  harness";
- `license` matching the chosen `LICENSE`;
- `repository`, `bugs`, and `homepage` fields for
  `https://github.com/lbk0523/samantha`;
- `keywords` that describe local harness, agent verification, and trust loop
  without overclaiming autonomy;
- clear Bun `engines` runtime expectation.

Metadata still deferred for package publication:

- package `version` strategy tied to release maturity.

Decision debt:

- Decide whether the first package is Bun-only or Node-compatible.
- Decide whether to publish from source TypeScript or built artifacts.
- Decide whether package metadata should reference Codex-specific runtime
  support or present a broader worker-runtime boundary.

Release gate: do not remove `private: true` until package publication is
explicitly approved.

### publishConfig, bin, and files

`files` is now defined for clone-only package contents hygiene. `publishConfig`
and `bin` remain deferred and need explicit design before any package-runner
claim.

Readiness questions:

- `bin`: what executable name should users run, and should it invoke
  `src/cli.ts` directly or a built entrypoint?
- `references/thread-control/**`: excluded from public onboarding and package
  contents by default; it remains advanced dogfood/private evidence.
- `publishConfig`: should the package be public, scoped-public, or restricted
  while feedback remains early?
- package runner: should the supported path be `bunx`, `npm exec`, `npx`, or
  clone-plus-`bun run` only?

Decision debt:

- Define the executable contract.
- Decide build output and TypeScript execution strategy.
- Decide whether fixture examples remain included in package tarballs once a
  real package runner path exists.

Release gate: do not document npm/package-runner readiness until `bin`,
`files`, and `publishConfig` are reviewed with package-tarball evidence. The
clone-only final pass verified that package contents exclude dogfood/private
surfaces including `references/thread-control/**`, `references/tasks/**`,
`references/lessons/**`, `runs/**`, `worktrees/**`,
`.samantha-worktrees/**`, and `.samantha-demo/**`.

### private: true Removal

Removing `private: true` is an implementation action, not a docs decision.

Preconditions:

- license chosen and `LICENSE` added;
- contribution and security policies added;
- package name and metadata reviewed;
- package contents verified with a dry-run or equivalent tarball inspection;
- `references/thread-control/**` explicitly excluded from the package or
  intentionally labeled as advanced dogfood evidence;
- first public docs still route users through `demo:first-run` and do not expose
  dogfood/private evidence as required setup.

Release gate: `private: true` remains after clone-only metadata readiness and
must stay until package publication is intentionally approved.

## Explicit Decision Debt

Deferred decisions required before package publication:

- Package name: `samantha`, scoped package, or alternate public name.
- Package target beyond clone-only first release: Bun package runner, npm
  package runner, or delayed package publishing.
- `private: true`: removal only after governance/package gates pass.
- `publishConfig` and `bin`: exact executable and publication contract.

Until these are decided, the honest public posture is:

```text
Clone the repository, install with Bun, run demo:first-run, and report feedback
through the provided templates. Package publishing is deferred.
```

## Release Gates

Governance/package release gate:

- `LICENSE` exists and matches package metadata.
- `CONTRIBUTING` limits first-release contribution scope.
- `CONTRIBUTING` excludes thread API automation and background/control-plane
  feature PRs unless a later reviewed initiative authorizes them.
- `SECURITY` gives a private reporting channel.
- `SECURITY` covers thread-control leakage and misuse of advisory evidence as
  trusted state.
- `CODE_OF_CONDUCT` scope is decided before broad community spaces open.
- `package.json` has public-ready package metadata.
- `private: true` remains until package publication intent is approved.
- `publishConfig` and `bin` are absent while package publication is deferred.
- `files` excludes dogfood/private package contents by default.
- `references/thread-control/**` is excluded from public onboarding and package
  contents by default.
- npm/package-runner readiness is not advertised until proven with deterministic
  packaging checks.
- Public docs still separate public artifacts from dogfood/private evidence.
- `demo:first-run` remains the first public command path.

Stop condition: if any gate requires package publishing, `private: true`
removal, `publishConfig`, `bin`, artifact movement/deletion, or a changed
public/private boundary, stop and create a separate implementation task instead
of broadening this clone-only readiness slice.

## Next Implementation Task Boundary

The next implementation task boundary should be one narrow task after BK
chooses whether to stay clone-only or pursue package publication.

Recommended sequence:

1. Clone-only release decision: report-only check of repository visibility,
   release note wording, and final stop conditions without changing package
   publication state.
2. Package publication design, only if BK wants it: decide package name,
   registry ownership, executable contract, `bin`, `publishConfig`, build
   output, package-runner command, `private: true` removal timing, and package
   contents verification.
3. Package publication implementation, only after design acceptance: implement
   the executable package contract and rerun package tarball verification before
   making any npm, `bunx`, `npm exec`, or `npx` claim.

Do not combine governance files, package metadata, package publication, and
public/private artifact movement into one worker task.
