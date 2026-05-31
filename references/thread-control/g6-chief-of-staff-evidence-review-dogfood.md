# G6 Chief-of-Staff evidence review dogfood

## 목적

이 문서는 G5 D-only recommendation을 dogfood한 report-only 문서다.
목적은 Chief-of-Staff가 main repo에서 historical Samantha run evidence를
먼저 확인하고, worker는 그 검증된 요약을 바탕으로 manual linkage review를
기록하는 경로를 점검하는 것이다.

이 보고서는 한국어 운영 보고서이며, `Chief-of-Staff`, `main repo`,
`Samantha run evidence`, `HARNESS_RESULT`, `changed-file scope`,
`deterministic verification`, `candidate commit`, `final_git_status_captured`,
`finalGitStatus`, `lifecycle`, `thread id`, `thread summary`,
`trusted evidence` 같은 운영 토큰은 원문을 유지한다.

이 문서는 trusted evidence가 아니다. 이 문서는 Samantha run evidence,
accept/merge/cleanup/lifecycle gate, Samantha-owned lifecycle transition,
deterministic verification을 대체하지 않는다.

## Dogfood 범위

- Scope: G3 manual linkage report template run에 대해 Chief-of-Staff가
  main repo evidence를 검증한 뒤, worker가 report-only manual linkage review를
  작성한다.
- Source run:
  `2026-05-31T05-35-35-164Z-samantha-thread-control-plane-g3-manual-linkage-report-template`
- Source run log path:
  `runs/2026-05-31T05-35-35-164Z-samantha-thread-control-plane-g3-manual-linkage-report-template.json`
- 제외한 항목: schema, CLI, run-log field, formal data contract,
  thread API automation, `create_thread`, `read_thread`,
  `send_message_to_thread`, background scheduler, daemon, UI, MCP, connector,
  task spec 작성, run log 수정.
- 이 보고가 하지 않는 판단: G3 또는 G6의 accept, merge, cleanup, lifecycle
  완료를 이 문서만으로 판단하지 않는다.

## Chief-of-Staff Verified Evidence

Chief-of-Staff는 worker report-writing task 전에 main repo에서 source run
evidence를 확인했다. Worker는 historical `runs/**` evidence를 독립적으로
inspect했다고 주장하지 않는다.

- `HARNESS_RESULT` status: `pass`
- top-level pass: `true`
- changed-file scope:
  `references/thread-control/manual-linkage-report-template.md`
- scope violations: none
- deterministic verification: passed
  - `test -f references/thread-control/manual-linkage-report-template.md`
  - `git diff --check HEAD -- references/thread-control/manual-linkage-report-template.md`
  - `rg -n "한국어|template|thread id|thread summary|advisory|trusted evidence|Samantha run evidence|HARNESS_RESULT|changed-file scope|deterministic verification|candidate commit|final_git_status_captured|finalGitStatus|lifecycle|not_captured|blocked|G4" references/thread-control/manual-linkage-report-template.md`
- candidate commit: `7986ba219e4d4144d0f2fc99b82f234171e6fb91`
- merge status: completed
- cleanup status: completed
- lifecycle status: merged and cleaned
- `final_git_status_captured`: completed
- `finalGitStatus`: clean

## Advisory Thread Reference

- thread id: `019e7c87-cfe0-7f30-8ad6-c92d833453e5`
- thread id 사용 경계: 이 값은 관련 background thread를 찾기 위한 advisory
  navigation only 참조다. success, accept, merge, cleanup, lifecycle 판단을
  증명하지 않는다.
- thread summary: not used.
- thread summary 사용 경계: 이 G6 보고서는 thread summary를 사용하지 않았다.
  thread summary가 있더라도 advisory navigation only이며 trusted evidence가
  아니다.
- trusted evidence 경계: thread id와 thread summary는 Samantha run evidence를
  대신하지 않는다.

## Manual Linkage Review

G3 run은 Chief-of-Staff verified summary 기준으로 `HARNESS_RESULT: pass`,
top-level pass `true`, 단일 changed-file scope, deterministic verification
통과, candidate commit 존재, merge completed, cleanup completed,
lifecycle merged and cleaned, `final_git_status_captured: completed`,
`finalGitStatus: clean` 상태로 기록된다.

이 기록은 manual linkage report다. Worker-owned evidence가 아니며,
worker-owned orchestration, merge, cleanup, push, policy, doctrine,
lifecycle authority를 만들지 않는다. Trusted evidence는 계속 main repo의
Samantha run evidence에 남는다.

## G4 대비 G6 결과

G4는 manual linkage template의 장점을 보여 주면서도 missing evidence를
노출했다. 이유는 G4 worker worktree가 historical `runs/**` evidence를 볼 수
없었기 때문이다. G4는 이를 operator summary나 thread summary로 보완하지 않고
missing evidence로 남겨, template의 trust boundary를 지켰다.

G6는 같은 문제를 worker 권한 확장으로 풀지 않았다. Chief-of-Staff가 main repo
에서 source run evidence를 먼저 확인하고, worker는 그 verified summary를
report-only 문서로 전사했다. 따라서 G6는 historical `runs/**` access를
worker에게 위임하지 않으면서도 G3 manual linkage report를 간결하게 채울 수
있음을 확인했다.

남은 불편은 분명하다. 이 방식은 Chief-of-Staff가 어떤 evidence를 선택하고
어떻게 전사할지 수동으로 판단하는 데 의존한다. 이 불편을 hidden automation,
implicit trusted state, schema, automation, run-log field, thread API
automation으로 몰래 바꾸면 안 된다.

## G7 Candidate Recommendation

G7 후보는 schema, CLI, run-log field, evidence bundle, thread API automation
전에, Chief-of-Staff verified evidence summary가 운영 관행으로 충분한지
report-only review하는 작업을 권장한다.

G7에서 검토할 질문은 작아야 한다.

- Chief-of-Staff verified summary가 worker report-writing task에 필요한
  evidence 항목을 충분히 포함하는가.
- Summary가 Samantha run evidence를 대체하지 않고 source run path와 gate
  항목을 찾아가기 쉽게 만드는가.
- Worker가 historical `runs/**` access 없이도 missing evidence를 숨기지 않고
  report-only 문서를 작성할 수 있는가.
- Manual transcription risk가 운영자가 감수할 만한 수준인지, 아니면 더 작은
  report-only checklist가 필요한지.

G7에서도 trusted evidence는 Samantha run evidence다. Chief-of-Staff summary,
thread id, thread summary, worker prose, manual report는 advisory only다.

## G7 Stop Conditions

G7는 다음 상황에서 중단한다.

- schema, JSON schema, formal data contract, CLI output contract, run-log
  field, evidence bundle 설계가 시작되는 경우.
- `create_thread`, `read_thread`, `send_message_to_thread`, thread API
  automation, scheduler, daemon, UI, MCP, connector 설계가 시작되는 경우.
- Chief-of-Staff summary가 trusted evidence나 lifecycle gate 대체물처럼
  쓰이는 경우.
- thread id 또는 thread summary가 trusted evidence처럼 쓰이는 경우.
- Worker-owned orchestration, merge, cleanup, push, policy, doctrine,
  lifecycle authority가 생기는 경우.
- Report가 accept, merge, cleanup, lifecycle gate를 대체하려는 경우.
- Missing, failed, blocked, rework evidence를 operator prose로 보완하려는 경우.

## Trust Boundary

이 G6 report-only dogfood는 trusted evidence가 아니다. 이 문서는
Chief-of-Staff main repo evidence review path를 점검하는 manual linkage
review이며, Samantha run evidence와 lifecycle gate를 찾아가기 위한 advisory
navigation aid다.

G6의 결론은 구현 권한이나 automation 설계가 아니다. 지금 확인된 것은
Chief-of-Staff가 main repo에서 source run evidence를 먼저 검증하면, worker가
historical `runs/**` evidence를 독립적으로 inspect하지 않고도 report-only
manual linkage review를 작성할 수 있다는 점이다.
