<div align="center">

English | [한국어](README.ko.md)

<img src="docs/assets/samantha-header.png" alt="Call From Samantha" width="100%" />

# Samantha Harness

[![npm](https://img.shields.io/npm/v/%40lbk0523%2Fsamantha?label=npm)](https://www.npmjs.com/package/@lbk0523/samantha) [![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![runtime: Bun](https://img.shields.io/badge/runtime-Bun-black.svg)](https://bun.sh)

[Install](#install) · [Why Samantha](#why-samantha) · [Trust Loop](#trust-loop) · [First Run](#first-run) · [Project Status](#project-status) · [Further Reading](#further-reading)

***"Samantha is a local development harness for deciding whether agent-produced work is safe to accept."***

***"Agent output is not trusted work just because the agent says it is done."***

***"It is not another autonomous coding agent. It is a trust loop around coding agents."***

Samantha turns agent work into scoped tasks, isolated execution, deterministic verification, and reviewable evidence.

</div>

## Install

Install the CLI from npm:

```bash
npm install -g @lbk0523/samantha
```

Run the first check in a disposable demo repository:

```bash
samantha demo:first-run
```

The first-run check uses a disposable fixture repository under
`.samantha-demo/`. It does not modify your real project.

You can also run without installing the CLI:

```bash
bunx @lbk0523/samantha demo:first-run
```

When working from source:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

Samantha is Bun-first. It does not currently claim `npx`, `npm exec`, or
general Node CLI support.

## Why Samantha

Coding agents are useful, but their final messages are not evidence. A worker
can say that tests passed, that scope was respected, or that a change is ready
to merge, but those claims still need to be checked outside the worker's
judgment.

Samantha keeps that boundary explicit:

- work is scoped before execution;
- writer changes happen in isolated worktrees;
- changed files, forbidden paths, worker output, and verification results are
  recorded as evidence;
- accepting or rejecting the result stays outside the worker.

The goal is not to make agents more independent. It is to make agent work easier
to inspect, trust, reject, and improve.

## Trust Loop

```text
minimal user goal
-> task spec
-> isolated worker worktree
-> worker output with HARNESS_RESULT
-> deterministic verification
-> run log and candidate commit evidence
-> accept or reject decision
```

Worker output does not become trusted work just because the worker says it is
done. Samantha records what changed, whether the worker stayed in scope,
whether verification passed, and where the evidence lives.

## First Run

Use the first-run command as an installation check and a small walkthrough of
the trust loop:

```bash
samantha demo:first-run
```

For the full workflow, see [First Run Guide](docs/first-run.md).

## Project Status

Samantha's first public path is intentionally small: install the CLI, run a
local first-run check, and inspect the evidence created by the harness.

Remote operation, background automation, dashboards, connector control planes,
budget governance, writer parallelism, and multi-project orchestration are not
part of the first public path. Those areas need explicit authority boundaries
and verification before they are exposed as product surfaces.

## Further Reading

- [First Run Guide](docs/first-run.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
