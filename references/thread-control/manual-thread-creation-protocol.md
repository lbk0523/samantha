# Manual Background Thread Creation Protocol

## 목적

이 문서는 사람이 Samantha Thread Control Plane 작업을 위해 Codex background
thread를 manual로 만들고, 그 thread를 Samantha run evidence에 advisory
navigation으로 연결하는 절차를 정한다.

이 문서는 thread API automation 이전 단계의 운영자 프로토콜이다. `create_thread`,
`read_thread`, `send_message_to_thread`, JSON schema, CLI, run-log field,
scheduler, daemon, UI, MCP, connector, task spec 자동화를 설계하거나 구현하지
않는다.

## Scope

적용 범위는 다음으로 제한한다.

- 사람이 Codex background thread를 수동으로 생성한다.
- 생성 목적은 Samantha Thread Control Plane 작업의 실행 위치와 검토 위치를
  찾기 쉽게 만드는 것이다.
- thread id와 thread summary를 Samantha run evidence에 advisory linkage로
  연결한다.
- 연결은 운영자 navigation을 돕는 표식일 뿐 trusted state change가 아니다.

background thread 생성은 advisory execution/navigation surface다. 완료, 수용,
merge, cleanup, push, lifecycle, policy, doctrine 판단을 만들거나 바꾸지
않는다.

## Evidence Boundary

thread id와 thread summary는 advisory navigation only다. 이 둘은 관련 대화와
작업 위치를 찾는 데 도움을 줄 수 있지만 trusted evidence가 아니다.

trusted evidence는 계속 Samantha run evidence에 남는다.

- run log
- `HARNESS_RESULT`
- changed-file scope
- deterministic verification
- candidate commit
- merge / cleanup / lifecycle trajectory
- `final_git_status_captured`

한국어 thread summary, worker 요약, thread link는 위 증거를 대체하지 않는다.
특히 top-level `pass: false` 상태에서는 worker의 `HARNESS_RESULT: pass`만으로
accept하지 않는다.

## Authority Boundary

worker-owned orchestration은 계속 금지된다. background thread와 worker는
Samantha orchestration, implementation outside assigned scope, merge, cleanup,
push, lifecycle, policy, doctrine authority를 갖지 않는다.

background thread는 범위 내 산출물과 검토 보조 정보를 보고할 수 있다. 하지만
Samantha가 decomposition, dispatch, verification, commit/report evidence,
accept, merge, cleanup, lifecycle trajectory를 계속 소유한다.

## Manual Protocol

### Preconditions

- Samantha가 작업 범위와 target repo를 이미 정했다.
- 작업은 Thread Control Plane의 manual background thread 연결 범위에 머문다.
- thread 생성이 trusted state change가 아니라 advisory navigation임을 운영자가
  확인했다.
- self-build gate가 필요한 작업이면 Samantha-owned task spec, isolated worktree,
  worker run, `HARNESS_RESULT`, deterministic verification, commit/report evidence
  경로를 유지한다.
- background thread가 Samantha orchestration이나 lifecycle authority를 갖지
  않는다는 조건을 thread 지시문에 포함할 수 있다.

### Required Inputs

manual thread를 만들기 전에 운영자는 다음 값을 명시한다.

- target repo path
- TaskSpec path 또는 temporary TaskSpec path
- runtime
- allowed scope와 forbidden scope
- push policy
- worker-owned orchestration prohibition
- direct-edit permission status
- self-build gate requirement
- expected output evidence

expected output evidence에는 다음 항목이 포함되어야 한다.

- thread id
- Samantha command
- run log path
- `HARNESS_RESULT`
- changed-file scope
- verification result
- candidate commit
- merge / cleanup / lifecycle status
- final git status evidence

### Pre-Thread Checklist

thread를 만들기 전에 다음을 확인한다.

- clean main repo check를 수행했는가?
- TaskSpec existence check를 수행했는가?
- noop 또는 superseded risk를 확인했는가?
- Samantha CLI clarity check를 수행했는가?
- direct implementation drift 가능성을 확인했는가?
- thread summary가 trusted evidence가 아님을 명시했는가?
- top-level `pass: false` 상태에서 accept하지 않는다는 조건을 명시했는가?
- post-accept `runs:show` visibilitySummary / trajectory 확인을 남겼는가?

### Background Thread Instruction Boundary

background thread에 전달하는 지시는 다음 경계를 포함해야 한다.

- assigned scope 안에서만 작업한다.
- target file 또는 target artifact 범위를 벗어나면 멈춘다.
- thread id와 thread summary는 advisory navigation으로만 보고한다.
- Samantha run evidence 없이 완료, accept, merge, cleanup, push, lifecycle 변경을
  주장하지 않는다.
- worker-owned orchestration, worker merge, worker cleanup, worker push,
  lifecycle authority, policy authority, doctrine authority를 갖지 않는다.
- automation, schema, connector, scheduler, UI, MCP 설계를 요구받으면 멈추고
  rework 또는 blocked evidence로 보고한다.

### Post-Thread Outputs

thread 완료 후 운영자는 다음을 advisory output으로 수집한다.

- thread id
- thread summary
- Samantha command
- run log path
- `HARNESS_RESULT`
- changed-file scope
- verification result
- candidate commit
- merge / cleanup / lifecycle status
- final git status evidence

이 output은 검토 위치를 찾기 위한 목록이다. trusted evidence 여부는 Samantha가
별도로 run evidence와 lifecycle record를 확인해 판단한다.

### Samantha Evidence Verification

Samantha는 background thread output을 수용하기 전에 다음을 확인한다.

- run log가 존재하고 해당 작업과 연결되는가?
- `HARNESS_RESULT`가 존재하는가?
- top-level pass state가 accept 가능한가?
- changed-file scope가 TaskSpec과 targetFiles에 맞는가?
- deterministic verification 결과가 남아 있는가?
- candidate commit evidence가 존재하는가?
- final git status evidence에 `final_git_status_captured`가 남아 있는가?
- failure, rework, blocked 상태가 thread summary로 숨겨지지 않았는가?

thread id나 thread summary가 있어도 위 항목이 없으면 trusted completion으로
간주하지 않는다.

### Accept/Merge/Cleanup Lifecycle Boundary

manual background thread linkage는 accept, merge, cleanup, lifecycle gate를
대체하지 않는다.

- accept는 Samantha-owned run evidence와 top-level pass state를 확인한 뒤에만
  진행한다.
- merge는 Samantha-owned candidate commit과 mergeability 확인 뒤에만 진행한다.
- cleanup은 Samantha-owned cleanup/lifecycle trajectory에 따라 진행한다.
- push는 push policy와 Samantha-owned lifecycle 판단을 따른다.
- post-accept에는 `runs:show`에서 visibilitySummary와 trajectory를 확인한다.

### Stop Conditions

다음 상황에서는 manual protocol을 중단하고 rework 또는 blocked evidence로
보고한다.

- 대상 파일 또는 지정 scope 밖의 수정이 필요하다.
- thread API automation design으로 확장된다.
- JSON schema, CLI, run-log field, scheduler, daemon, UI, MCP, connector 설계가
  필요해진다.
- thread id나 thread summary가 trusted evidence처럼 쓰인다.
- background thread가 Samantha orchestration, merge, cleanup, push, lifecycle,
  policy, doctrine authority를 갖는 것처럼 지시된다.
- manual linkage가 accept, merge, cleanup, lifecycle gate를 대체하려 한다.
- top-level `pass: false`인데 accept를 진행하려 한다.

## G2 Linkage Surface Pre-Decisions

G2에서 linkage surface를 다루기 전에 다음 결정을 먼저 내려야 한다.

- thread id와 linkage는 어디에 저장할 것인가?
- JSON schema는 계속 deferred 상태로 둘 것인가?
- thread summary를 저장할 것인가, 저장한다면 advisory navigation임을 어떻게
  표시할 것인가?
- failed, rework, blocked runs는 linkage surface에서 어떻게 표현할 것인가?
- linkage가 accept, merge, cleanup, lifecycle gate를 대체하지 않도록 어떤
  문구와 검증 경계를 둘 것인가?

이 항목들은 pre-decision 질문이다. G1 manual protocol은 저장 형식, schema,
automation, UI, connector, lifecycle mutation을 정의하지 않는다.
