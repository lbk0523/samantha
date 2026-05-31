# Open Source Package Readiness Final Pass

Date: 2026-05-31
Status: ready for clone-only public release; package publishing deferred
Source initiative: `references/initiatives/open-source-readiness.md`
Governance files commit: `17d6349`
Accepted demo evidence:
`references/operations/open-source-first-run-demo-dogfood.md`

## Purpose

This final pass closes the safe package metadata and package contents scope for
the clone-only public release path.

This pass does not publish a package, remove `private: true`, add
`publishConfig`, add `bin`, change package version, change package scripts,
change dependencies, rewrite `README.md`, move artifacts, change GitHub
repository visibility, or claim npm, `bunx`, `npm exec`, or `npx` readiness.

## Package Metadata Changes

`package.json` now has public-facing metadata instead of the previous personal
description:

- `description`: local harness for verifying agent-produced code before
  accepting it.
- `license`: `MIT`, matching `LICENSE`.
- `repository`: `git+https://github.com/lbk0523/samantha.git`.
- `bugs`: `https://github.com/lbk0523/samantha/issues`.
- `homepage`: `https://github.com/lbk0523/samantha#readme`.
- `keywords`: `agent`, `codex`, `harness`, `verification`, `trust-loop`,
  `worktree`.
- `engines`: Bun `>=1.2.0`.
- `files`: conservative package contents boundary for top-level public docs,
  `src/`, and the first-run fixture example.

`private: true` remains. `publishConfig` and `bin` remain absent. Package
publication and package-runner claims remain deferred.

## Package Contents Boundary

The package `files` boundary is intentionally conservative:

```json
[
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "src/",
  "examples/first-run-demo/fixture-repo/"
]
```

Package contents include the first-run fixture because it is the public
clone-only demo input. Package contents exclude dogfood/private and generated
state by default:

- `runs/**`;
- `worktrees/**`;
- `.samantha-worktrees/**`;
- `.samantha-demo/**`;
- `references/thread-control/**`;
- `references/tasks/**`;
- `references/lessons/**`;
- other mixed `references/**` evidence unless a later package/docs slice
  explicitly promotes a specific artifact.

`references/thread-control/**` remains advanced dogfood/private evidence. It is
excluded from public onboarding and package contents by default.

## Package Dry-Run Evidence

Command:

```bash
mkdir -p /tmp/samantha-npm-cache && npm_config_cache=/tmp/samantha-npm-cache npm pack --dry-run --json > /tmp/samantha-package-dry-run-rework.json
```

Result:

```text
package: samantha@0.1.0
filename: samantha-0.1.0.tgz
entry count: 71
required files present: package.json, README.md, LICENSE, CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, src/cli.ts, examples/first-run-demo/fixture-repo/README.md
banned private/dogfood files present: none
```

The dry-run used a task-owned npm cache under `/tmp/samantha-npm-cache` to avoid
the previous blocked run's user npm cache ownership issue.

The dry-run package file list contains top-level governance docs, the first-run
fixture files, `package.json`, and `src/**`. It does not contain
`references/thread-control/**`, `references/tasks/**`, `references/lessons/**`,
`runs/**`, `worktrees/**`, `.samantha-worktrees/**`, or `.samantha-demo/**`.

## Accepted Demo Evidence

The worker did not rerun `demo:first-run` because nested worker dispatch is
outside worker authority. The accepted demo evidence remains:

- `references/operations/open-source-first-run-demo-dogfood.md`;
- accepted implementation commit `413991128f3f0718c05846d23c018a38c4c33c7f`;
- command `bun run samantha demo:first-run --runtime=codex-sdk`;
- `HARNESS_RESULT: pass`;
- deterministic verification pass;
- disposable fixture repository;
- no merge into a real user repository.

## Remaining Blockers

No package publishing is authorized by this pass.

Deferred blockers before package publication:

- registry/package name availability and ownership;
- executable package contract;
- build output strategy for TypeScript source;
- `bin`;
- `publishConfig`;
- `private: true` removal timing;
- package-runner command support and verification;
- any decision to include additional `references/**` artifacts in a package.

Deferred release-owner decision:

- GitHub repository visibility change, if BK chooses to make the repository
  public.

## Next Action

For clone-only public release, the next action is a report-only Samantha release
decision review: confirm GitHub repository visibility intent, release note use,
and final checklist stop conditions.

For package publication, the next action is a separate package publication
design task. It must decide `bin`, `publishConfig`, package name, build output,
package-runner command, and `private: true` removal before any implementation
or package publishing occurs.
