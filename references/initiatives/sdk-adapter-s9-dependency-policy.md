# SDK Adapter S9 Dependency And Version Policy

Date: 2026-05-16
Status: completed
Source: `references/initiatives/sdk-adapter-promotion-plan.md`

## Scope

This policy defines how Samantha maintains `@openai/codex-sdk` while the SDK
runtime remains explicit and experimental.

This policy does not promote `codex-sdk` to the default runtime, does not add
automatic dependency updates, does not add recurring checks, and does not add
App Server integration.

## Current Package State

As checked on 2026-05-16:

- `package.json` pins `@openai/codex-sdk` to `0.130.0`.
- `bun.lock` resolves `@openai/codex-sdk@0.130.0`.
- npm metadata reports `@openai/codex-sdk@0.130.0` depends on
  `@openai/codex@0.130.0`.
- npm metadata reports `latest` as `0.130.0` and `alpha` as
  `0.131.0-alpha.22`.

No package version change is required for S9.

## Version Coupling Decision

`@openai/codex-sdk` and its bundled `@openai/codex` package must move together
through normal package resolution. Samantha should keep the SDK dependency
pinned to an exact version in `package.json`, and `bun.lock` must record the
matching transitive `@openai/codex` version selected by the SDK package.

The external Codex CLI used by the `exec-json` runtime is not pinned to the SDK
package. It remains a separate baseline runtime. A mismatch between the
external CLI version and the SDK's bundled Codex version is not itself a
blocker, but any SDK promotion review must record both versions and run the
smoke tests below before changing normal behavior.

Do not use SDK alpha releases for routine Samantha work. An alpha SDK may be
tested only through a separate BK-approved spike with its own rollback plan.

## Owner Authority

Samantha may:

- verify the currently pinned SDK dependency;
- document observed SDK and CLI versions;
- run fake SDK tests and bounded dogfood checks;
- propose an SDK dependency update with evidence.

BK must approve:

- changing the normal runtime default;
- adopting alpha, beta, or native Codex packages for routine work;
- adding automatic update infrastructure or recurring dependency checks;
- changing dependency strategy in a way that affects normal `exec-json`
  operation or routine worker dispatch.

Runtime adapters still own only prompt preparation, runtime invocation, raw
output capture, and optional runtime metadata. They must not own verification,
scope checks, commits, lifecycle, cleanup, push, recovery, or orchestration.

## Upgrade Cadence

There is no recurring SDK update job.

Check `@openai/codex-sdk` versions only when one of these happens:

- BK asks for an SDK upgrade or promotion review;
- S10 or a later SDK status decision needs fresh dependency evidence;
- a live SDK dogfood run shows an SDK-specific regression;
- a security or compatibility issue is explicitly identified.

This keeps dependency maintenance reviewable without creating a new product
surface.

## Upgrade Smoke Tests

Before accepting an SDK package update, run at minimum:

```bash
bun install --frozen-lockfile
bun test tests/codex-dispatch.test.ts tests/worker-dispatch.test.ts
bun test tests/run-diagnose.test.ts tests/task-from-run.test.ts
bun run typecheck
git diff --check
```

If the update changes SDK runtime behavior or event shape, also run:

```bash
bun test
```

If credentials and local conditions make it safe, run one bounded
report-only SDK dogfood and one bounded SDK runtime failure dogfood with
production writes disabled or isolated outside production run storage.

The dogfood evidence must show:

- `runtime.kind` is `codex-sdk`;
- `threadId` is recorded when the SDK reaches `thread.started`;
- event counts are recorded when available;
- `HARNESS_RESULT` is still evaluated by Samantha-owned code;
- SDK runtime failures expose exit code and stderr in run logs;
- no Samantha-owned commit is created when runtime execution fails.

## Rollback Criteria

Rollback to the last known good pinned SDK version if any of these occur:

- fake SDK success or failure tests fail;
- SDK runtime errors cannot be diagnosed from Samantha run logs;
- `HARNESS_RESULT` preservation regresses;
- SDK metadata stops recording `runtime.kind`;
- SDK event or thread metadata changes require App Server state to diagnose;
- SDK behavior pressures verification, scope checks, commits, lifecycle,
  cleanup, push, recovery, or orchestration into the runtime adapter;
- bounded live dogfood produces production writes outside the declared task
  authority.

Rollback means reverting `package.json` and `bun.lock` to the last known good
SDK version and keeping `exec-json` as the default runtime. If the adapter code
was changed for the upgrade, revert or narrow those changes until the smoke
tests pass again.

## Promotion Implication

S9 removes the dependency maintenance policy gap for a future S10 review.
It does not remove the need for an explicit S10 decision, and it does not
authorize S11 application or any default runtime change.
