# Open Source Npm Publication Closeout

Date: 2026-06-01
Status: published and dogfooded

## Scope

This closeout records operator-side publication and dogfood evidence for
`@lbk0523/samantha@0.1.0`. It does not create package state, publish a package,
change package metadata, or broaden the supported runner contract.

## Publication Evidence

Operator preflight recorded:

- GitHub repository `lbk0523/samantha` is public.
- `npm view` with fresh cache returned name `@lbk0523/samantha`, version
  `0.1.0`, and `dist-tags.latest` `0.1.0`.
- npm access/status checks showed package public, owner `lbk0523`, and latest
  `0.1.0`.
- `npm pack @lbk0523/samantha@0.1.0 --dry-run` returned 10 files including
  `dist/cli.js`, fixture files, `package.json`, governance docs, and
  `references/agent-profiles/codex-worker.json`.

## Package Dogfood Evidence

Operator-side public package dogfood was run from
`/tmp/samantha-bunx-dogfood-w2dUIn` with:

```bash
npm_config_cache=/tmp/samantha-npm-bunx-cache bunx @lbk0523/samantha demo:first-run --runtime=codex-sdk
```

Recorded result:

- demo id: `demo-2026-06-01T07-57-51-987Z`
- run log:
  `.samantha-demo/demo-2026-06-01T07-57-51-987Z/runs/2026-06-01T07-57-52-089Z-open-source-first-run-demo.json`
- `HARNESS_RESULT: pass`
- verification: pass
- candidate commit: `1e71145b9d226f3c10f66634b62d5fbb98226100`
- merge: not performed
- cleanup: `rm -rf .samantha-demo/demo-2026-06-01T07-57-51-987Z`

## Supported Public Path

The supported package-runner path is Bun-first:

```bash
bunx @lbk0523/samantha demo:first-run
```

Clone-based local development remains supported with:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

Samantha does not currently claim `npx`, `npm exec`, or Node-general CLI
support.

## Boundary

This closeout does not promote remote operation, background automation,
dashboards, connector/control-plane entrypoints, budget governance, writer
parallelism, multi-project orchestration, or advanced dogfood/private evidence
into the first public path.
