# Samantha Thread Control Plane 수동 링크 보고 template

## 목적

이 문서는 Samantha Thread Control Plane의 수동 링크 보고를 작성할 때 쓰는
한국어 운영자 template이다. 목적은 운영자가 background thread와 Samantha
run evidence를 빠르게 찾아가도록 돕는 advisory navigation aid를 제공하는
것이다.

이 template은 manual operator template이다. 이 문서와 이 문서로 작성한
보고서는 trusted evidence가 아니며, JSON schema, formal data contract,
CLI output contract, run-log field definition이 아니다.

thread id, thread summary, operator finding은 증거 위치를 좁히는 보조
정보일 뿐이다. accept, merge, cleanup, lifecycle gate는 계속
Samantha-owned evidence와 Samantha-owned lifecycle transition으로만
판단한다.

## 작성 원칙

- 누락되었거나 실패한 evidence는 반드시 명시한다. thread summary 뒤에
  숨기지 않는다.
- `HARNESS_RESULT`, top-level pass, changed-file scope, deterministic
  verification, candidate commit, lifecycle, final git status evidence를
  별도로 확인한다.
- background threads와 workers는 orchestration, merge, cleanup, push,
  lifecycle, policy, doctrine authority를 갖지 않는다.
- 이 template은 링크와 보고 문장을 정리하는 수동 양식이다. schema,
  CLI, run-log field, thread API automation, scheduler, daemon, UI, MCP,
  connector 설계로 확장하지 않는다.

## Copy-Fill Report

아래 항목을 복사해 수동 보고서에 채운다. 값이 없거나 확인하지 못한 경우
`missing`, `not_captured`, `unavailable`, `blocked`처럼 빈칸이 아니라
명시적 상태로 적는다.

### 제목

- Report title:
- 대상 run 또는 작업명:
- 작성자 / 작성 시각:

### 범위

- Scope:
- 포함한 run evidence:
- 제외한 항목:
- 이 보고가 하지 않는 판단:

### Advisory Thread Reference

- thread id:
- optional thread summary/excerpt:
- thread summary 사용 경계:
  thread summary는 advisory navigation only이며 trusted evidence가 아니다.
- thread id 사용 경계:
  thread id는 관련 thread를 찾기 위한 참조일 뿐 success, accept, merge,
  cleanup, lifecycle 판단을 증명하지 않는다.

### Samantha Command

- Samantha command:
- task spec 또는 작업 식별자:
- worker/run 호출 경로:
- 이 command가 만든 trusted state 여부:
  수동 보고서는 trusted state를 만들지 않는다.

### Samantha Run Evidence

- run log path:
- `HARNESS_RESULT` status:
- top-level pass:
- candidate commit:
- run id:
- evidence source note:
  trusted evidence는 Samantha run evidence에서 확인한다. operator 요약,
  worker 문장, thread summary만으로 통과를 판단하지 않는다.

### Verification And Scope

- changed-file scope:
- scope violation:
- deterministic verification:
- failed verification:
- missing evidence:
- evidence interpretation:
  실패, 누락, 불일치 evidence는 별도 항목으로 드러낸다. thread summary나
  operator finding으로 대체하지 않는다.

### Lifecycle And Final Git Status

- merge status:
- cleanup status:
- lifecycle status:
- lifecycle evidence path 또는 event:
- `final_git_status_captured`:
- `finalGitStatus`:
- `finalGitStatus not_captured/unavailable`:
- final status interpretation:
  final git status가 `not_captured` 또는 `unavailable`이면 그렇게 적는다.
  merge/cleanup/lifecycle 완료를 final git status cleanliness로 과장하지
  않는다.

### Failed / Rework / Blocked Indicators

- failed indicator:
- rework indicator:
- blocked indicator:
- blocked reason:
- missing evidence:
- required follow-up evidence:
- operator caution:
  blocked나 rework 상태는 수동 보고 문장으로 숨기지 않는다. accept, merge,
  cleanup, lifecycle gate 통과 여부는 Samantha가 별도 evidence로 판단한다.

### Operator Finding

- finding:
- evidence-backed conclusion:
- advisory-only note:
- risk:
- confidence boundary:
  operator finding은 판단 보조 자료다. policy, doctrine, lifecycle,
  orchestration authority를 만들지 않는다.

### Next Action Recommendation

- recommendation:
- Samantha-owned next gate:
- required deterministic check:
- do not proceed if:
- handoff note:
  다음 행동은 Samantha orchestration, verification, commit/report evidence,
  lifecycle gate를 보존해야 한다. background thread나 worker에게 merge,
  cleanup, push, lifecycle, policy, doctrine authority를 넘기지 않는다.

## Missing Evidence Handling

다음 항목이 없거나 실패하면 보고서 본문에 명시한다.

- run log path missing
- `HARNESS_RESULT` missing 또는 failed
- top-level pass missing 또는 false
- changed-file scope missing 또는 out of scope
- deterministic verification missing 또는 failed
- candidate commit missing
- merge/cleanup/lifecycle status missing 또는 incomplete
- `final_git_status_captured` missing
- `finalGitStatus` `not_captured` 또는 `unavailable`
- blocked reason missing

누락 evidence는 thread summary, worker prose, operator finding으로 보완할 수
없다. 수동 링크 보고는 어디를 봐야 하는지 알려줄 수 있지만, gate를
통과시키는 증거가 될 수 없다.

## G4 Candidate Note

G4 후보 작업은 이 manual template을 완료된 Thread Control Plane run 또는
미래의 manual background thread run에 dogfood하는 것이다. 목적은 운영자가
수동 보고 양식으로 run evidence를 더 빨리 찾는지 확인하는 데 있다.

G4에서도 schema, CLI output, run-log field, thread API automation,
`create_thread`, `read_thread`, `send_message_to_thread`, scheduler, daemon,
UI, MCP, connector, lifecycle authority를 설계하거나 구현하지 않는다.

## G4 Stop Conditions

- 이 template이 JSON schema나 formal data contract로 바뀌기 시작하면
  중단한다.
- thread API automation, background scheduler, daemon, UI, MCP, connector
  설계가 시작되면 중단한다.
- thread id 또는 thread summary가 trusted evidence로 취급되면 중단한다.
- 링크 보고가 accept, merge, cleanup, lifecycle gate를 대체하려 하면
  중단한다.
- background thread나 worker가 orchestration, merge, cleanup, push,
  lifecycle, policy, doctrine authority를 갖는 것처럼 쓰이면 중단한다.
- failed, rework, blocked, missing evidence가 operator summary 뒤에 숨겨지면
  중단한다.
