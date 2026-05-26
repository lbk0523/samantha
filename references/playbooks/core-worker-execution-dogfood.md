# Playbook: Core Worker Execution Dogfood

## Purpose

Use this playbook after Slices 1-4 of core worker execution trust hardening to
judge Samantha core worker execution reliability from evidence, not
architecture optimism.

The output is a concise 20-run dogfood evidence set from real Samantha work.
It should show whether task specs, isolated worker runs, deterministic
verification, scope checks, and Samantha-owned review are reliable enough for
continued use.

## 20-Run Dogfood Plan

Run 20 real Samantha tasks through the core worker execution path. Prefer normal
Samantha self-build maintenance, documentation, narrow policy tests, and focused
repair work. Do not invent synthetic tasks just to make the numbers look clean.

For each run:

1. Write or select a bounded task spec with explicit target files, forbidden
   changes, and verify commands.
2. Dispatch exactly one worker through the Samantha-owned run path.
3. Preserve the run log, changed-file scope result, verify command output, and
   `HARNESS_RESULT`.
4. Record manual review findings before Samantha commits or rejects the result.
5. Classify the run as accepted, rework, blocked, or rejected, and record the
   evidence that justified that classification.

Use the same evidence sheet or run-summary format for all 20 runs. The point is
comparison across real work, not a new reporting system.

## Metrics To Record

Record these fields for every run:

- Task id and task family.
- Task spec writing time.
- Worker runtime.
- Verification time.
- Manual review time.
- Retry or rework time.
- false pass count, when Samantha accepted or nearly accepted output that later
  proved wrong.
- false block count, when Samantha blocked or rejected output that evidence
  later showed was acceptable.
- Timeout count.
- Scope violation count.
- Task template reuse, including the template name or `none`.
- Verify command quality note, especially when commands are missing, too broad,
  flaky, or unable to prove the intended behavior.

Keep counts literal. Do not infer reliability from architecture shape when the
run evidence is missing or ambiguous.

## Review After 20 Runs

After the 20-run dogfood set is complete, review the evidence and answer these
questions:

- Did Samantha reduce manual review time compared with comparable direct Codex
  work?
- Is task spec friction too high for the work families being attempted?
- Which task families fail most often, and are the failures caused by task
  specs, worker behavior, verification commands, or review gates?
- Do verify command quality issues recur across runs?
- Which task templates are justified by evidence from repeated work rather than
  by anticipated future convenience?

Treat the answers as operating evidence. They may justify a follow-up task,
template proposal, or policy review, but this playbook is not itself an
implementation backlog.

## Stop Conditions And Non-Goals

Stop the dogfood set, or mark the affected run for rework, when:

- The task lacks explicit target files, forbidden changes, or deterministic
  verify commands.
- The run cannot preserve `HARNESS_RESULT`, changed-file scope, and verify
  command evidence.
- Manual review cannot tell whether Samantha accepted the correct artifact.
- A worker writes outside its declared authority.
- Repeated timeouts make worker runtime evidence unusable.
- A task requires semantic judgment that cannot be checked by deterministic
  review and verify evidence.

This playbook does not authorize:

- dashboards;
- daemon/watch services;
- remote adapters;
- multi-project orchestration;
- hidden memory;
- autonomous push;
- writerCap increase;
- broad batch expansion;
- LLM semantic verification;
- new task templates without evidence from repeated runs;
- implementation changes to runtime, policy, lifecycle, or orchestration.

Keep the dogfood operational: run bounded work, record comparable evidence, and
review the 20-run result before changing Samantha authority or scope.
