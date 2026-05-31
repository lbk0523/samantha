# Open Source Governance And Package Readiness

Date: 2026-05-31
Status: decision-complete brief before implementation
Source initiative: `references/initiatives/open-source-readiness.md`
Accepted README and feedback intake commit:
`b059a2485fd17b051beb1b061c40bd64e86c4218`
Accepted demo commit: `413991128f3f0718c05846d23c018a38c4c33c7f`
Thread-policy delta audit:
`references/operations/open-source-thread-policy-delta-audit.md`
Accepted thread-policy commit: `45197c6c4be3e17f258ac2f8c26522aa494552f7`

## Purpose

This brief defines the governance and package readiness boundary for the first
public Samantha release before any top-level governance files or package
metadata are changed.

This slice is documentation-only. It does not create `LICENSE`,
`CONTRIBUTING`, `SECURITY`, or `CODE_OF_CONDUCT`; it does not edit
`package.json`; it does not remove `private: true`; it does not add
`publishConfig`, `bin`, or `files`; and it does not perform package publishing.

The goal is to make the remaining decisions explicit enough that the next
implementation task can be narrow, reviewable, and blocked on BK decisions
where needed.

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

The remaining public release blockers are governance decisions, package
readiness decisions, and final dogfood-private release checks.

## Governance Surfaces

### LICENSE

Decision needed: BK must choose the license before a public release that invites
use, modification, or package distribution.

Recommended options:

- MIT: simplest adoption path and common for early developer tools.
- Apache-2.0: permissive adoption path with explicit patent language.
- Source-available or no public license yet: acceptable only if the release is
  intentionally feedback-only and clearly not open-source distribution.

Decision debt:

- Choose the license.
- Decide whether copyright owner should be BK personally or an organization.
- Confirm whether dependencies and examples are compatible with the chosen
  license.

Release gate: do not present the repository as open source or publish a package
until `LICENSE` exists and matches the intended distribution posture.

### CONTRIBUTING

Decision needed: BK must decide what kinds of external contribution are welcome
in the first public path.

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

Decision debt:

- Decide whether first-release contributions are issues-only or PRs accepted.
- Decide whether PRs require tests, dogfood evidence, or Samantha run evidence.
- Decide whether governance-sensitive changes need report-only review before
  implementation.
- Decide whether any thread-control documentation PRs are accepted before a
  reviewed thread-control public initiative exists.

Release gate: do not invite broad contributions until `CONTRIBUTING` states the
first-release scope and authority boundaries.

### SECURITY

Decision needed: BK must choose a security reporting channel before public
release.

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

Decision debt:

- Choose the reporting channel.
- Decide expected response time language.
- Decide whether unsupported areas such as remote operation, connectors,
  dashboards, or background automation are explicitly out of scope for security
  reporting in the first release.
- Decide how reporters should redact thread ids, prompts, run logs, lifecycle
  evidence, local paths, and manual linkage reports before submitting security
  reports.

Release gate: do not publish a public package or solicit public adoption until
`SECURITY` gives reporters a private path.

### CODE_OF_CONDUCT

Decision needed: BK must decide whether the first release adopts a standard
code of conduct and what community surface it covers.

Recommended options:

- Contributor Covenant for ordinary public collaboration.
- Minimal project conduct policy focused on issues, discussions, PRs, and
  feedback templates.
- Defer community expansion while still stating basic conduct expectations in
  `CONTRIBUTING`.

Decision debt:

- Choose the policy text.
- Decide enforcement contact.
- Decide whether the code of conduct applies only to GitHub interactions or to
  future community channels as well.

Release gate: do not open broad community discussion spaces until
`CODE_OF_CONDUCT` scope and enforcement contact are decided.

## Package Readiness

Current `package.json` state:

```json
{
  "name": "samantha",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Personal Codex development harness"
}
```

This is not package-runner ready. The current repository can document:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

It should not claim npm or `bunx` package execution until package metadata is
reviewed and `private: true` removal is intentionally approved.

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
registry ownership is confirmed.

### Package Metadata

Required metadata before package publication:

- public-facing `description` that does not say "Personal Codex development
  harness";
- `license` matching the chosen `LICENSE`;
- `repository`, `bugs`, and `homepage` fields once the public remote is final;
- `keywords` that describe local harness, agent verification, and trust loop
  without overclaiming autonomy;
- clear `engines` or runtime expectations if Bun is required;
- package `version` strategy tied to release maturity.

Decision debt:

- Decide whether the first package is Bun-only or Node-compatible.
- Decide whether to publish from source TypeScript or built artifacts.
- Decide whether package metadata should reference Codex-specific runtime
  support or present a broader worker-runtime boundary.

Release gate: do not remove `private: true` until this metadata is complete and
reviewed.

### publishConfig, bin, and files

`publishConfig`, `bin`, and `files` need explicit design before any package
runner claim.

Readiness questions:

- `bin`: what executable name should users run, and should it invoke
  `src/cli.ts` directly or a built entrypoint?
- `files`: which public files should ship, and how will dogfood/private
  artifacts under `references/`, `runs/`, worktrees, and generated demo state be
  excluded?
- `references/thread-control/**`: should these files be excluded from package
  tarballs, or included only with an advanced dogfood evidence label and no
  quickstart references?
- `publishConfig`: should the package be public, scoped-public, or restricted
  while feedback remains early?
- package runner: should the supported path be `bunx`, `npm exec`, `npx`, or
  clone-plus-`bun run` only?

Decision debt:

- Define the executable contract.
- Define package contents and exclusions.
- Decide `references/thread-control/**` inclusion or exclusion and verify the
  decision in package contents checks.
- Decide build output and TypeScript execution strategy.
- Decide whether fixture examples must be included in package tarballs.

Release gate: do not document npm/package-runner readiness until `bin`,
`files`, and `publishConfig` are reviewed with package-tarball evidence.

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

Release gate: `private: true` must remain until governance and package metadata
are ready together.

## Explicit Decision Debt

BK decisions required before implementation:

- `LICENSE`: MIT, Apache-2.0, or another explicit posture.
- `CONTRIBUTING`: issues-only, PRs accepted, or limited PR scope.
- `SECURITY`: GitHub private vulnerability reporting, email alias, or another
  private channel.
- SECURITY redaction expectations for thread ids, thread summaries, prompts,
  run logs, lifecycle evidence, local paths, and manual linkage reports.
- `CODE_OF_CONDUCT`: standard policy, minimal policy, or deferred community
  expansion with basic conduct language elsewhere.
- Package name: `samantha`, scoped package, or alternate public name.
- Package target: clone-only first release, Bun package runner, npm package
  runner, or delayed package publishing.
- `private: true`: removal only after governance/package gates pass.
- `publishConfig`, `bin`, and `files`: exact executable and package contents.
- `references/thread-control/**`: excluded from package contents, or included
  only as advanced dogfood evidence.

Until these are decided, the honest public posture is:

```text
Clone the repository, install with Bun, run demo:first-run, and report feedback
through the provided templates. Package publishing is not ready.
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
- `private: true` removal is reviewed with package publication intent.
- `publishConfig`, `bin`, and `files` are present only after package contents
  are verified.
- `references/thread-control/**` package contents behavior is explicitly
  decided and verified.
- npm/package-runner readiness is proven with deterministic packaging checks
  before being advertised.
- Public docs still separate public artifacts from dogfood/private evidence.
- `demo:first-run` remains the first public command path.

Stop condition: if any gate requires actual top-level governance files,
package metadata changes, package publishing, artifact movement/deletion, or a
changed public/private boundary, stop and create a separate implementation task
instead of broadening this docs slice.

## Next Implementation Task Boundary

The next implementation task boundary should be one narrow task after BK
answers the decision debt above.

Recommended sequence:

1. Governance files task: add `LICENSE`, `CONTRIBUTING`, `SECURITY`, and
   `CODE_OF_CONDUCT` from BK-approved choices. Verification should check file
   existence, required contact/channel text, first-release scope limits,
   thread-control leakage/security language, thread API automation exclusions,
   and no package metadata changes unless explicitly included.
2. Package metadata task: update `package.json` only after governance files are
   accepted. Verification should include metadata checks, `bun install
   --frozen-lockfile` if needed, `bun run samantha demo:first-run` or a focused
   packaging-safe check, and a package contents dry run that proves the
   `references/thread-control/**` decision before any package publishing claim.
3. Release checklist closeout: run the public release checklist and record
   blockers without moving dogfood/private artifacts unless explicitly scoped.

Do not combine governance files, package metadata, package publication, and
public/private artifact movement into one worker task.
