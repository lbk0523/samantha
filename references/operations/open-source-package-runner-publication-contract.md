# Open Source Package Runner Publication Contract

## Implemented contract

- Package name: `@lbk0523/samantha`
- Public binary: `samantha`
- First supported package-runner command: `bunx @lbk0523/samantha demo:first-run`
- Supported runner posture: Bun-first only. Do not claim `npx`, `npm exec`, or Node-general CLI support.
- Publication posture: published to npm as public package version `0.1.0`.

## Package contents

`package.json` intentionally exposes a conservative public package:

- public docs: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- executable build output: `dist/`
- first-run fixture: `examples/first-run-demo/fixture-repo/`
- bundled default demo profile: `references/agent-profiles/codex-worker.json`

The package runner separates user working directory state from package assets. Demo output is written under the user's `repoRoot`/`demoRoot`; bundled fixture and default profile lookup use the package asset root.

## Publication closeout evidence

Operator preflight for the publication closeout recorded:

- GitHub repository `lbk0523/samantha` is public.
- `npm view` with fresh cache returned name `@lbk0523/samantha`, version
  `0.1.0`, and `dist-tags.latest` `0.1.0`.
- npm access/status checks showed package public, owner `lbk0523`, and latest
  `0.1.0`.
- `npm pack @lbk0523/samantha@0.1.0 --dry-run` returned 10 files including
  `dist/cli.js`, fixture files, `package.json`, governance docs, and
  `references/agent-profiles/codex-worker.json`.
- Public package dogfood from `/tmp/samantha-bunx-dogfood-w2dUIn` using
  `npm_config_cache=/tmp/samantha-npm-bunx-cache bunx @lbk0523/samantha demo:first-run --runtime=codex-sdk`
  passed with `HARNESS_RESULT: pass`, verification pass, candidate commit
  `1e71145b9d226f3c10f66634b62d5fbb98226100`, merge not performed, and cleanup
  `rm -rf .samantha-demo/demo-2026-06-01T07-57-51-987Z`.

## Future dry-run expectation

Run this before any real publication:

```sh
rm -rf dist && bun run build
test -f dist/cli.js
mkdir -p /tmp/samantha-npm-cache
npm_config_cache=/tmp/samantha-npm-cache npm pack --dry-run --json > /tmp/samantha-package-runner-dry-run.json
```

Expected tarball evidence:

- includes `dist/cli.js`
- includes `examples/first-run-demo/fixture-repo/README.md`
- excludes source, tests, runs, worktrees, `.samantha-worktrees`, `.samantha-demo`, task records, lesson records, and thread-control records

After dry-run verification, remove generated build output before Samantha scope evaluation:

```sh
rm -r dist
```

## Remaining publish step

After Samantha verifies scope, tests, dry-run tarball contents, and lifecycle gates, a separate release task may run the final npm publication. This task intentionally does not run `npm publish`.
