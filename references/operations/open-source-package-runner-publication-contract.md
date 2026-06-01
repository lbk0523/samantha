# Open Source Package Runner Publication Contract

## Implemented contract

- Package name: `@lbk0523/samantha`
- Public binary: `samantha`
- First supported package-runner command: `bunx @lbk0523/samantha demo:first-run`
- Supported runner posture: Bun-first only. Do not claim `npx`, `npm exec`, or Node-general CLI support.
- Publication posture: configured for npm public scoped publication, but this task does not publish.

## Package contents

`package.json` intentionally exposes a conservative public package:

- public docs: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- executable build output: `dist/`
- first-run fixture: `examples/first-run-demo/fixture-repo/`
- bundled default demo profile: `references/agent-profiles/codex-worker.json`

The package runner separates user working directory state from package assets. Demo output is written under the user's `repoRoot`/`demoRoot`; bundled fixture and default profile lookup use the package asset root.

## Dry-run expectation

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
