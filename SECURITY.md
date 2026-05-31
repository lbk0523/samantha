# Security Policy

Use GitHub private vulnerability reporting for private vulnerability reports
when it is available on this repository.

Do not use a public issue, public pull request, discussion, or feedback template
for security reports. If the private reporting button is unavailable, do not
post sensitive details publicly; wait for maintainers to publish a private
reporting channel or share only non-sensitive symptoms.

## What To Report

Report issues that could affect Samantha's trust boundary, including:

- command injection, path traversal, unsafe cleanup, or repository mutation
  outside declared scope;
- leakage of private prompts, task specs, run log content, lifecycle evidence,
  local path details, worker output, manual linkage reports, or private dogfood
  evidence;
- misuse of `HARNESS_RESULT`, verification logs, candidate commits, or worker
  prose as trusted state;
- thread-control behavior that appears to grant orchestration, merge, cleanup,
  push, lifecycle, policy, or doctrine authority to a background thread;
- advisory thread evidence being used as trusted state, including a thread id,
  thread summary, Chief-of-Staff summary, or manual linkage report replacing
  run logs, changed-file scope, deterministic verification, candidate commits,
  final git status evidence, or lifecycle records.

## Redaction Requirements

Before submitting a private report, redact sensitive details unless the exact
value is essential to reproduce the vulnerability. Redact at least:

- thread id values;
- thread summary text;
- prompt content;
- run log excerpts;
- lifecycle evidence;
- local path values;
- manual linkage report details;
- worker output;
- private dogfood evidence;
- target-project names and private repository details.

Prefer a minimal reproduction using a disposable fixture or sanitized excerpt.
Do not attach generated worktrees, raw run directories, private prompts, or
unredacted lifecycle records.

## Public Discussion

Public discussion should stay limited to non-sensitive symptoms, fixed-version
notes, or documentation clarification after maintainers have reviewed the
private report. Public issues are not an acceptable first disclosure channel for
security reports.
