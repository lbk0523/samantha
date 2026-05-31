# Open Source First-Run Demo Dogfood

Date: 2026-05-31
Status: passed
Accepted implementation commit: `413991128f3f0718c05846d23c018a38c4c33c7f`
Command:

```bash
bun run samantha demo:first-run --runtime=codex-sdk
```

## Result

The accepted `demo:first-run` command successfully exercised the public first-run
trust loop against a disposable fixture repo.

Console summary:

```text
Samantha first-run demo: pass
demo id: demo-2026-05-31T03-03-03-140Z
fixture repo: .samantha-demo/demo-2026-05-31T03-03-03-140Z/fixture-repo
worker worktree: .samantha-demo/demo-2026-05-31T03-03-03-140Z/worktrees/open-source-first-run-demo
run log: .samantha-demo/demo-2026-05-31T03-03-03-140Z/runs/2026-05-31T03-03-03-221Z-open-source-first-run-demo.json
HARNESS_RESULT: pass
verification: pass
candidate commit: 2fe7e36730c6dd749711dc1b4f667587650a3a0b
merge: not performed (disposable worker worktree only)
cleanup: rm -rf .samantha-demo/demo-2026-05-31T03-03-03-140Z
```

## Evidence

Generated task spec:

```text
.samantha-demo/demo-2026-05-31T03-03-03-140Z/task.json
```

Generated run log:

```text
.samantha-demo/demo-2026-05-31T03-03-03-140Z/runs/2026-05-31T03-03-03-221Z-open-source-first-run-demo.json
```

Harness evidence from the generated run log:

```json
{
  "runId": "2026-05-31T03-03-03-221Z-open-source-first-run-demo",
  "pass": true,
  "harnessStatus": "pass",
  "changedFiles": ["demo-output.txt"],
  "scopeViolations": [],
  "verifyResults": [
    {
      "command": "test -f demo-output.txt",
      "exitCode": 0
    },
    {
      "command": "grep -Fx \"Samantha first-run demo passed\" demo-output.txt",
      "exitCode": 0
    }
  ],
  "candidateCommit": "2fe7e36730c6dd749711dc1b4f667587650a3a0b"
}
```

Worker output file content:

```text
Samantha first-run demo passed
```

Worker candidate commit:

```text
2fe7e36 docs: add first-run demo output
demo-output.txt | 1 +
```

Git ignore evidence:

```text
git check-ignore .samantha-demo
=> .samantha-demo
```

Final target repo status after dogfood execution was clean. The generated demo
directory remains intentionally ignored and inspectable.

## Contract Check

| Contract item | Status | Evidence |
| --- | --- | --- |
| Runs from main with accepted implementation | passed | `HEAD` was `413991128f3f0718c05846d23c018a38c4c33c7f` before execution. |
| Creates disposable fixture repo | passed | `.samantha-demo/demo-2026-05-31T03-03-03-140Z/fixture-repo` exists. |
| Saves inspectable task spec | passed | `.samantha-demo/demo-2026-05-31T03-03-03-140Z/task.json` exists and targets only `demo-output.txt`. |
| Dispatches bounded worker task | passed | Generated run log records one worker run for `open-source-first-run-demo`. |
| Requires `HARNESS_RESULT` | passed | Generated run log parsed `HARNESS_RESULT: pass`. |
| Runs deterministic verification | passed | `test -f demo-output.txt` and exact `grep -Fx` check both passed. |
| Does not merge disposable worker commit | passed | Console output says `merge: not performed (disposable worker worktree only)`. |
| Prints cleanup guidance | passed | `rm -rf .samantha-demo/demo-2026-05-31T03-03-03-140Z`. |

## Follow-Up

No rework task is required from this dogfood run.

Recommended next public-readiness slice:

```text
sam p: Samantha open-source public artifact map and dogfood/private split policy를 설계해주세요.
Context: first-run demo command는 accepted commit 413991128f3f0718c05846d23c018a38c4c33c7f에서 구현됐고, dogfood report는 references/operations/open-source-first-run-demo-dogfood.md 입니다.
Ask: 공개 repo에 남길 product docs/examples와 dogfood/private evidence로 분리할 references/runs/operations/lessons/tasks surface를 분류하고, README rewrite 전에 적용할 artifact map을 제안해주세요.
Scope: 아직 파일 이동이나 삭제는 하지 않습니다. 공개/비공개 분류와 후속 task 후보만 작성합니다.
Output: references/operations/open-source-artifact-map.md
Stop: public package에 포함할 evidence boundary나 dogfood archive 정책이 불명확하면 질문으로 멈추세요.
```
