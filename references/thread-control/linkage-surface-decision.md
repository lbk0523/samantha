# Thread Control Plane G2 linkage surface 결정

## 목적

이 문서는 G1 이후 Samantha Thread Control Plane의 첫 manual linkage surface를
결정한다.

이 결정은 구현 계획이 아니다. JSON schema, CLI behavior, run-log fields,
thread API automation, background scheduler, daemon, UI, MCP, connector를
정의하지 않는다.

## 수용 결정

다음 단계의 thread id/linkage는 `references/thread-control/**` 아래에 놓는
수동 한국어 advisory linkage report에 기록한다.

thread id, 선택적 thread summary, Samantha command, run evidence 위치를 한
곳에 모아 운영자의 증거 탐색 시간을 줄일 수는 있다. 그러나 이 보고서는
trusted evidence가 아니며, Samantha run evidence를 대체하지 않는다.

따라서 thread id/linkage는 지금 다음 표면에 두지 않는다.

- run-log fields
- JSON schema
- CLI output
- scheduler
- daemon
- UI
- MCP
- connector
- automated thread API calls

## 가장 작은 안전 표면인 이유

수동 한국어 advisory linkage report는 증거 탐색의 이점만 제공한다. 운영자는
thread id와 run log path를 함께 보고 필요한 Samantha run evidence로 더 빨리
이동할 수 있다.

동시에 이 표면은 trusted state confusion을 피한다. thread summary는 작업
맥락을 설명할 수 있지만 완료, 수용, merge, cleanup, lifecycle, repository
cleanliness를 증명하지 않는다. pass/fail 판단은 여전히 `HARNESS_RESULT`,
changed-file scope, deterministic verification, candidate commit,
merge/cleanup/lifecycle evidence, `final_git_status_captured` 또는
`finalGitStatus` evidence에 근거해야 한다.

이 접근은 G2에서 권한 모델을 바꾸지 않는다. worker나 background thread는
orchestration, accept, merge, cleanup, push, lifecycle, policy, doctrine
authority를 얻지 않는다.

## deferred 결정

다음 결정은 deferred 상태로 남긴다.

- JSON schema remains deferred.
- run-log field linkage remains deferred.
- thread API automation remains deferred.
- UI/connector surfaces remain deferred.

이 deferred 항목들은 별도 검토 없이 G2 문서에서 우회 정의하지 않는다.

## 이후 수동 linkage report에 포함할 항목

G3 이후의 수동 linkage report template 또는 example은 다음 항목을 포함할 수
있다. 모든 항목은 advisory navigation 목적이며 trusted evidence 원천이
아니다.

- thread id
- 선택적 advisory thread summary 또는 excerpt
- Samantha command
- run log path
- `HARNESS_RESULT` status
- changed-file scope
- verification result
- candidate commit
- merge / cleanup / lifecycle status
- `final_git_status_captured` 또는 `finalGitStatus` evidence
- operator finding

각 항목은 원본 run log, lifecycle record, deterministic verification, candidate
commit evidence를 찾기 위한 색인 역할만 한다. 값이 없거나 모호하면 보고서는
그 결손을 숨기지 말고 그대로 표시해야 한다.

## 금지 사항

수동 linkage report는 다음을 포함하거나 수행해서는 안 된다.

- thread summary를 trusted evidence로 만들지 않는다.
- Samantha run evidence를 대체하지 않는다.
- worker-owned orchestration을 허용하지 않는다.
- accept / merge / cleanup / lifecycle gates를 대체하지 않는다.
- background threads에게 merge, push, cleanup을 수행하라고 지시하지 않는다.
- thread id만으로 run 성공, candidate commit 적합성, lifecycle 완료를
  주장하지 않는다.
- operator finding을 deterministic verification처럼 취급하지 않는다.

## failed / rework / blocked run 처리

linkage는 실패, rework, blocked 상태를 thread summary 뒤에 숨기면 안 된다.
다음 상태는 명시적으로 드러나야 한다.

- candidate commit missing
- verification failed
- lifecycle incomplete
- top-level pass false
- `finalGitStatus` unavailable
- `final_git_status_captured` not_captured
- blocked reason present

이 상태 중 하나라도 있으면 linkage report는 탐색 보조 자료로만 남아야 한다.
수용 판단은 Samantha-owned evidence와 lifecycle gates를 다시 확인해야 한다.

## G3 후보

G3 후보는 docs-only 수동 linkage report template 또는 example 추가다.

G3도 여전히 schema, CLI, run-log fields, thread API automation을 추가하지
않는다. G3 산출물은 한국어 운영자 보고 기준을 따르고, thread id와 thread
summary를 advisory navigation only로 유지해야 한다.

## G3 stop conditions

G3는 다음 상황에서 중단한다.

- template이나 example이 JSON schema 또는 formal data contract로 변하는 경우
- CLI output, run-log fields, scheduler, daemon, UI, MCP, connector 설계가
  필요한 경우
- create_thread, read_thread, send_message_to_thread 자동화 설계가 시작되는
  경우
- thread id 또는 thread summary가 trusted evidence처럼 쓰이는 경우
- linkage가 accept, merge, cleanup, lifecycle gates를 대체하는 경우
- background thread 또는 worker가 orchestration, merge, push, cleanup,
  lifecycle authority를 갖는 것처럼 쓰이는 경우
