# G7 Chief-of-Staff verified evidence summary review

## 목적

이 문서는 G6가 권장한 `Chief-of-Staff verified evidence summary` 운영
관행을 검토하는 G7 report-only review다. 목적은 schema, CLI, run-log field,
evidence bundle, thread API automation 전에, Chief-of-Staff가 `main repo`에서
source run evidence를 먼저 확인하고 worker가 그 요약을 바탕으로 보고서를 쓰는
방식이 near-term 운영 관행으로 충분한지 판단하는 것이다.

이 문서는 구현, schema, formal contract, lifecycle gate, trusted state가
아니다. 이 문서는 Samantha-owned accept/merge/cleanup/lifecycle gate,
deterministic verification, run evidence, commit/report evidence를 대체하지
않는다.

## Trust boundary

Trusted evidence는 계속 `Samantha run evidence`다.

다음 항목은 trusted evidence가 아니다.

- Chief-of-Staff prose
- worker prose
- `thread id`
- `thread summary`
- manual report
- 이 G7 review 문서

`thread id`와 `thread summary`는 advisory navigation only다. 관련 thread나
보고서를 찾아가는 데 도움을 줄 수는 있지만, `HARNESS_RESULT`, top-level pass,
changed-file scope, deterministic verification, candidate commit,
final_git_status_captured, finalGitStatus, merge/cleanup/lifecycle 완료 여부를
증명하지 않는다.

## 검토 배경

G4는 worker worktree가 historical `runs/**` evidence를 볼 수 없을 때 manual
linkage template이 missing evidence를 숨기지 않고 드러낸다는 점을 확인했다.
이는 template의 장점이지만, worker가 source run evidence를 직접 확정할 수
없다는 evidence accessibility 문제도 남겼다.

G5는 이 문제를 worker 권한 확장, evidence bundle, schema, CLI, run-log field,
thread API automation으로 풀지 말고, near-term에는 D-only 경로를 쓰라고
권장했다. 즉 Chief-of-Staff가 `main repo`의 Samantha run evidence를 확인하고,
worker는 그 verified summary를 report-only 입력으로 사용한다.

G6는 이 경로를 dogfood했다. Chief-of-Staff가 G3 source run evidence를 먼저
검증했고, worker는 historical `runs/**` evidence를 독립적으로 inspect했다고
주장하지 않은 채 manual linkage review를 작성했다. 남은 불편은 evidence 선택과
전사가 Chief-of-Staff의 수동 판단에 의존한다는 점이다.

## Required evidence fields

G6-style summary는 near-term 운영에 충분하려면 최소한 다음 evidence field를
명시해야 한다.

- source run id
- source run path
- `HARNESS_RESULT`
- top-level pass
- changed-file scope
- scope violations
- deterministic verification
- candidate commit
- merge/cleanup/lifecycle state
- final_git_status_captured
- finalGitStatus
- missing evidence state

중요한 기준은 모든 항목이 항상 present여야 한다는 뜻이 아니다. 확인되지 않은
항목은 명시적으로 `missing evidence`, unavailable, not inspected 같은 상태로
남아야 한다. failed, rework, blocked evidence도 prose로 부드럽게 바꾸지 않고
원래 상태를 드러내야 한다.

## Operator value

이 관행의 값은 작지만 실용적이다.

첫째, worker에게 historical `runs/**` access를 부여하지 않아도 된다. Worker는
report-only 문서를 작성하면서도 source run evidence를 독립적으로 inspect했다는
claim을 하지 않는다. 이는 worker-owned orchestration, merge, cleanup, push,
policy, doctrine, lifecycle authority를 만들지 않는다.

둘째, audit path가 짧아진다. Chief-of-Staff summary가 source run id/path와 gate
항목을 같은 곳에 놓으면 operator는 manual report의 결론을 곧바로 믿는 대신,
어떤 Samantha run evidence로 되돌아가야 하는지 빠르게 확인할 수 있다.

셋째, missing evidence가 더 잘 보인다. G4처럼 worker worktree에서 `runs/**`가
없을 때 무리하게 추정하지 않고, G6처럼 Chief-of-Staff가 확인한 항목과 확인하지
않은 항목을 분리하면 review가 더 감사 가능해진다.

## Risk

Near-term practice로 쓸 수는 있지만 위험은 분명하다.

- manual transcription error: Chief-of-Staff가 source run evidence를 요약하는
  과정에서 run id, path, status, commit, verification command, lifecycle state를
  잘못 옮길 수 있다.
- selective evidence omission: 편한 항목만 고르고 failed/rework/blocked 또는
  missing evidence를 빼면 manual report가 실제 gate 상태보다 좋아 보인다.
- summary becoming trusted state by habit: 반복 사용 중 Chief-of-Staff summary가
  사실상 trusted evidence처럼 취급될 수 있다.
- stale source run path: source run path가 오래되었거나 다른 worktree 기준이면
  operator가 잘못된 evidence를 따라갈 수 있다.
- softened failure prose: failed, rework, blocked evidence가 prose 안에서
  "대체로 통과"처럼 약화되면 Samantha gate의 fail-loud 성격이 사라진다.

이 위험 때문에 G7은 Chief-of-Staff summary를 자동화 대상으로 격상하지 않는다.
불편하다는 이유만으로 schema, CLI, run-log field, evidence bundle,
thread API automation, background scheduler, daemon, UI, MCP, connector를
만들면 scope가 바뀐다.

## Controls

이 관행을 near-term으로 유지하려면 다음 controls가 필요하다.

- source run id와 source run path를 반드시 포함한다.
- 확인하지 못한 항목은 explicit missing evidence로 남긴다.
- worker가 historical `runs/**`를 independent inspection했다고 주장하지 않게
  한다.
- final report는 Chief-of-Staff prose가 아니라 Samantha run evidence로 다시
  돌아가는 경로를 포함한다.
- `thread id`와 `thread summary`는 advisory navigation only라고 반복 명시한다.
- accept/merge/cleanup/lifecycle gate는 그대로 유지한다.
- failed, rework, blocked, missing evidence는 prose로 완화하지 않는다.
- worker-owned orchestration, merge, cleanup, push, policy, doctrine,
  lifecycle authority를 만들지 않는다.

이 controls는 새 formal contract가 아니다. G7의 결론은 운영 관행에 대한
report-only 판단이며, enforcement나 data model 변경을 요구하지 않는다.

## Decision

Decision: keep with a small revision.

G6-style `Chief-of-Staff verified evidence summary`는 near-term practice로
충분히 유용하다. 이유는 worker historical `runs/**` dependency를 줄이고,
manual report가 source Samantha run evidence를 찾아가기 쉽게 만들며, 현재
authority boundary를 넓히지 않기 때문이다.

다만 그대로 반복하기에는 수동 전사 위험과 선택적 누락 위험이 남는다. 따라서
reject하지도, automation으로 확장하지도 않는다. Near-term에서는 이 관행을
유지하되, G8에서 docs-only micro-template/checklist를 작성해 summary에 포함할
최소 항목과 missing evidence 표기 방식을 작게 고정하는 편이 적절하다.

## G8 candidate

G8 후보는 Chief-of-Staff verified evidence summary를 위한 docs-only
micro-template/checklist 작성이다.

G8의 목적은 자동화가 아니라 반복 가능한 수동 체크리스트를 제공하는 것이다.
Checklist는 source run id/path, `HARNESS_RESULT`, top-level pass,
changed-file scope, scope violations, deterministic verification,
candidate commit, merge/cleanup/lifecycle, final_git_status_captured,
finalGitStatus, missing evidence state를 빠짐없이 물어야 한다.

G8은 다음 문장을 명시해야 한다.

- trusted evidence는 Samantha run evidence다.
- Chief-of-Staff summary는 report-only input이다.
- worker는 historical `runs/**` independent inspection claim을 하지 않는다.
- `thread id`와 `thread summary`는 advisory navigation only다.
- manual report는 accept/merge/cleanup/lifecycle gate를 대체하지 않는다.

## G8 stop conditions

G8은 다음 상황에서 중단한다.

- schema, JSON schema, formal data contract, CLI output contract, run-log
  field, evidence bundle 설계가 시작되는 경우.
- `create_thread`, `read_thread`, `send_message_to_thread`, thread API
  automation, scheduler, daemon, UI, MCP, connector 설계가 시작되는 경우.
- Checklist가 trusted evidence나 lifecycle gate처럼 쓰이는 경우.
- Chief-of-Staff summary, `thread id`, `thread summary`, worker prose, manual
  report가 Samantha run evidence를 대체하는 경우.
- Worker에게 orchestration, merge, cleanup, push, policy, doctrine, lifecycle
  authority를 주는 문장이 생기는 경우.
- Failed, rework, blocked, missing evidence를 prose로 보완하거나 약화하는
  경우.

## 결론

G7의 결론은 near-term 유지와 작은 문서 보완이다. Chief-of-Staff verified
evidence summary는 지금 단계에서 worker의 historical `runs/**` 접근 문제를
줄이고 report auditability를 높이는 데 충분하다. 하지만 그 summary는 trusted
evidence가 아니며, Samantha run evidence와 lifecycle gate를 찾아가기 위한
advisory report-writing input으로만 남아야 한다.
