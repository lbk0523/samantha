# Open Source Public Artifact Map

Date: 2026-05-31
Status: decision-complete map
Source initiative: `references/initiatives/open-source-readiness.md`
Source audit: `references/operations/open-source-readiness-audit.md`
Source demo brief: `references/operations/open-source-first-run-demo-brief.md`
Accepted demo evidence: `references/operations/open-source-first-run-demo-dogfood.md`
Accepted demo commit: `413991128f3f0718c05846d23c018a38c4c33c7f`

## Purpose

This public artifact map defines the repository boundary required before the
README rewrite and first public release path. It classifies current release
surfaces into:

```text
publish as-is
generalize before publishing
dogfood/private
remove/exclude from first public release
```

This document does not move, delete, redact, or rewrite files. It fixes the
decision boundary that later docs and repository-hygiene slices must follow.

## Dogfood-Private Split Policy

The dogfood-private split is the governing rule for open-source readiness:

- Public artifacts explain Samantha's reusable trust loop, command path,
  fixture demo, authority model, and current limitations.
- Dogfood/private artifacts preserve BK's local operating evidence, target
  project history, run logs, correction transcripts, lesson review evidence,
  local paths, and private workflow assumptions.
- Dogfood evidence may be cited from public docs only when it has been
  explicitly accepted, redacted if needed, and framed as historical evidence,
  not as required user configuration.
- First public docs must not require users to understand BK-specific workflows,
  private project names, historical worker failures, lesson promotion history,
  BatchSpec operations, or background automation before running the demo.
- No public convenience may weaken task specs, isolated worktrees, target-file
  scope, forbidden-change checks, deterministic verification, `HARNESS_RESULT`,
  run logs, candidate commits, or Samantha-owned lifecycle transitions.

If the boundary requires moving, deleting, redacting, or packaging files, that
work must be a later explicit slice. This map records the decision only.

## Publish As-Is

These surfaces can remain visible in the first public path with at most link
placement changes in the README rewrite:

| Surface | Public role | Decision |
| --- | --- | --- |
| `examples/first-run-demo/fixture-repo/` | Neutral disposable fixture for `demo:first-run`. | Publish as-is. |
| `references/operations/open-source-first-run-demo-brief.md` | Accepted product contract for the public first-run demo. | Publish as-is as planning evidence. |
| `references/operations/open-source-first-run-demo-dogfood.md` | Accepted first-run demo evidence for commit `413991128f3f0718c05846d23c018a38c4c33c7f`. | Publish as-is if the public docs clearly label it as dogfood evidence. |
| `references/operations/open-source-readiness-audit.md` | Report-only blocker inventory that explains why this boundary exists. | Publish as-is if linked from a readiness appendix, not from the quickstart path. |
| `references/initiatives/open-source-readiness.md` | Initiative record for public release readiness. | Publish as-is after status is updated for S1, S2, S3/S5, and S4 evidence. |

The accepted first-run demo evidence is public-relevant because it proves the
demo command exercised the trust loop without mutating a real user repository.
It should not become the primary quickstart; the README should summarize the
result and link the report for readers who want evidence.

## Generalize Before Publishing

These surfaces are valuable public product docs or reusable configuration, but
they currently expose BK-centric assumptions, advanced authority surfaces, or
private-path expectations:

| Surface | Current issue | Required generalization |
| --- | --- | --- |
| `README.md` | Starts from BK's personal harness and broad CLI surface before the public demo. | Rewrite around the trust loop, `demo:first-run`, public maturity, and explicit non-goals. |
| `NORTH_STAR.md`, `ARCHITECTURE.md`, `ROADMAP.md` | Product direction is useful but includes private/local framing and internal sequencing. | Generalize operator language and distinguish public MVP from dogfood roadmap. |
| `OPERATING_GUIDE.md`, `OPERATING_GUIDE_KR.md` | Contain local paths and BK-specific operational defaults. | Keep as advanced dogfood guides or rewrite public excerpts with neutral paths. |
| `AGENTS.md`, `WORK-RULES.md` | Authority rules are important but include BK/Samantha self-build discipline. | Link selectively after public-facing explanation of worker boundaries; do not make them the first-run entrypoint. |
| `package.json` and CLI help surfaces | Package is private and help lists advanced commands alongside `demo:first-run`. | Later packaging/docs slice must make public command order obvious before package publication. |
| `references/task-templates/*.json` | Templates are reusable but assume internal task families and forbidden paths. | Publish only generic templates after reviewing copy, path assumptions, and first-run suitability. |
| `references/agent-profiles/*.json` | Profiles are core to the harness but currently describe local worktree policies. | Publish with a short public explanation of profile roles and no private registry assumptions. |
| `references/playbooks/*.md` | Some playbooks encode real operational knowledge; others are dogfood-only. | Split public trust-loop playbooks from private dogfood and target-project playbooks. |
| `src/cli.ts` help text and command list | Public users see advanced lifecycle, batch, lesson, and continuation commands too early. | README and help docs should put `demo:first-run` first and move advanced commands behind a clear warning. |

Generalization must preserve the authority model. Do not simplify docs by
removing evidence gates or by implying direct worker output is trusted.

## Dogfood/Private

These artifacts should not be on the first public path. They may remain in the
repository during readiness work, but public docs should treat them as
dogfood/private unless a later slice redacts and promotes a specific artifact.

| Surface | Boundary |
| --- | --- |
| `runs/**` | Local run evidence and lifecycle state. Exclude from first public release and never use as quickstart input. |
| `worktrees/**`, `.samantha-worktrees/**`, `.samantha-demo/**` | Generated execution state. Keep ignored or out of public release artifacts. |
| Historical `references/operations/*.json` and dogfood reports | Dogfood evidence. Keep as internal evidence unless specifically accepted and framed. |
| `references/tasks/**` | Historical and active Samantha task specs. Dogfood/private by default because they encode local repo history and authority-sensitive work. |
| `references/lessons/inbox/**` and `references/lessons/reviews/**` | Learning evidence and correction transcripts. Dogfood/private unless a lesson is explicitly promoted into a public playbook or policy. |
| Target-project initiatives such as Haechi, HaLucy, Hermes, Toss, or other product-specific artifacts | Private/dogfood context, not public Samantha product docs. |
| Batch plans, batch specs, hooks evidence, launch agent templates, thread-control artifacts | Advanced dogfood surfaces. Exclude from first public path because they imply background operation, orchestration expansion, or multi-run governance. |

Dogfood/private does not mean "delete." It means the artifact should not be
presented as public setup, public doctrine, or required user knowledge.

## Remove Or Exclude From First Public Release

The first public release should exclude or keep unreachable from the public
entry path:

- private run logs and generated lifecycle evidence;
- local machine paths such as `/Users/byung/...`;
- target-project histories unrelated to Samantha's reusable harness;
- correction transcripts that quote private operator interaction;
- LaunchAgent/background-operation artifacts;
- unreviewed lesson candidates and lesson review JSON;
- advanced BatchSpec writer orchestration, batch-plan preparation, and
  replacement workflows;
- remote operation, connector/control-plane surfaces, budget governance,
  dashboards, and multi-project orchestration;
- package-runner publication claims until package metadata, license, and public
  governance files are ready.

If these exclusions require actual file movement, archive creation, or package
metadata changes, stop and create a separate task. This docs slice does not
authorize those mutations.

## Surface Decisions

### References

`references/` remains a mixed evidence registry during readiness work. Public
docs must not link the whole directory as user documentation.

Public path:

- this public artifact map;
- the open-source readiness initiative;
- the readiness audit;
- the first-run demo brief;
- the accepted first-run demo dogfood report;
- later public-specific docs created by the README restructuring plan.

Dogfood/private path:

- historical tasks;
- lesson inbox and review artifacts;
- target-project initiatives;
- operation reports not explicitly accepted for public release;
- batch, hook, launch agent, and thread-control artifacts.

### Runs

`runs/**` is local trust evidence, not public documentation. Public docs may
describe the run-log shape and show a redacted fixture excerpt, but must not
publish BK's private run history as onboarding material.

### Operations Reports

Operations reports are public only when an open-source readiness slice names
them as public evidence. Current public-relevant reports are:

- `references/operations/open-source-readiness-audit.md`;
- `references/operations/open-source-first-run-demo-brief.md`;
- `references/operations/open-source-first-run-demo-dogfood.md`;
- `references/operations/open-source-artifact-map.md`;
- `references/operations/open-source-public-docs-plan.md`.

All other operation reports remain dogfood/private unless individually reviewed.

### Task Specs

`references/tasks/**` is dogfood/private by default. Public examples should use
the generated `demo:first-run` task spec under `.samantha-demo/<demo-id>/task.json`
or a neutral checked-in example created by a later docs/examples slice.

### Lesson Artifacts

Lesson candidates and review JSON are not public onboarding docs. Public docs
may explain the learning model at a high level: lessons become trusted only
through explicit reviewable artifacts. Do not expose raw lesson inbox material
or correction transcripts in the first public path.

### Task Templates

Task templates are candidates for public release after review. Keep
`docs-only`, `report-only-review`, `core-module-with-tests`,
`cli-command-with-tests`, and `drift-review` out of quickstart flow until they
are documented as examples of scoped task contracts rather than required setup.

### Agent Profiles

`references/agent-profiles/codex-worker.json` and
`references/agent-profiles/codex-reviewer.json` are public candidates because
they explain the writer/reviewer boundary. They need a public explanation before
publication so users do not mistake profiles for autonomous orchestration
authority.

### Examples

`examples/first-run-demo/fixture-repo/` is the first public example. Do not add
more examples to the first public path until the README proves the demo loop is
understandable.

### Top-Level Docs

Top-level docs should be ordered for public readers:

1. `README.md` quickstart and trust loop.
2. Public architecture or direction docs that explain authority boundaries.
3. Advanced operating guides and dogfood evidence after clear labels.

Top-level docs should use neutral user/operator language unless explicitly
discussing historical dogfood evidence.

### CLI And Help Surfaces

The public command path starts with:

```bash
bun run samantha demo:first-run
```

All other command families are advanced until the README rewrite explains their
authority boundaries:

- `run-task`;
- `runs:*`;
- `worktree:cleanup`;
- `reports:*`;
- `lessons:*`;
- `continuation:*`;
- `batches:*`;
- `batch-plans:*`;
- `readiness:check`;
- `tasks:*`.

Do not expose advanced command families as the first public path.

### Accepted First-Run Demo Evidence

The accepted first-run demo evidence is the strongest current public proof:

- accepted implementation commit:
  `413991128f3f0718c05846d23c018a38c4c33c7f`;
- evidence report:
  `references/operations/open-source-first-run-demo-dogfood.md`;
- command:
  `bun run samantha demo:first-run --runtime=codex-sdk`;
- result:
  `HARNESS_RESULT: pass`, deterministic verification pass, disposable fixture
  repo, no merge into a real user repository.

The README should reference this evidence briefly, then route users to run the
demo themselves.

## Follow-Up Boundaries

This map unblocks the README rewrite and public docs restructuring plan. It
does not authorize:

- rewriting `README.md`;
- changing package metadata;
- adding `LICENSE`, `CONTRIBUTING`, `SECURITY`, or `CODE_OF_CONDUCT`;
- moving or deleting references;
- deleting runs or dogfood evidence;
- changing task templates, agent profiles, playbooks, lessons, source, tests,
  or examples.
