# Samantha 운영 가이드

마지막 업데이트: 2026-05-18

## 목적

이 문서는 Samantha의 사용자-facing 운영 프로토콜을 정의한다.

현재 운영 기준은 Samantha v1이다. v1은 Codex Chat 기반 운영 프로토콜을
유지하면서, Samantha를 실제 Codex 작업에 사용해 run evidence, lesson evidence,
task evidence를 쌓고 하네스 성능과 편의성을 고도화하는 버전이다.

Samantha v1은 chat adapter, daemon/watch, dashboard, routine trigger,
remote/control plane을 operator activation에 자동으로 추가하지 않는다. 그러나 이
표면들은 더 이상 v0 non-goal이라는 이유만으로 부적합 판정하지 않는다. 별도
reviewed product slice와 authority, verification, lifecycle 설계가 있으면 v1
candidate surface로 검토한다.

이 문서는 프로토콜 사양이다. 다른 repo의 Codex 세션에서 이 프로토콜을
활성화하는 실제 장치는 전역 Codex skill
`~/.codex/skills/samantha-operator/SKILL.md`이다.

공식 문법은 긴 문법과 짧은 alias를 모두 허용한다:

```text
Samantha <intent>: <자연어 요청>
sam <alias>: <자연어 요청>
```

짧은 alias는 타이핑 편의만 위한 표면이며, canonical intent는 바꾸지 않는다:

| Alias | Canonical intent |
| --- | --- |
| `sam c:` | `Samantha command:` |
| `sam b:` | `Samantha brainstorm:` |
| `sam p:` | `Samantha plan:` |
| `sam r:` | `Samantha review:` |
| `sam re:` | `Samantha recover:` |
| `sam i:` | `Samantha inspect:` |
| `sam l:` | `Samantha learn:` |

`sam:`처럼 intent가 없는 기본 호출은 없다. 공식 intent와 alias는 위 표의 값만
사용한다.

## Sticky Samantha Session

명시적인 `Samantha <intent>:` 또는 `sam <alias>:` 메시지가 한 번 나오면, 그
Codex thread 안에서는 Sticky Samantha Session이 활성화된다. 활성화 범위는
thread-local이다. 다른 thread, 다른 project, repo 전역 기본값, daemon/watch,
routine trigger, chat adapter 상태로 확장되지 않는다.

Sticky Samantha Session이 활성화된 뒤에는 prefix가 없는 follow-up도 Samantha CEO
routing으로 처리한다. 단, prefix-free follow-up은 직전 intent를 고정 default로
반복한다는 뜻이 아니다. Samantha는 매번 요청을 다시 읽고 doctrine / product
boundary / architecture / roadmap work, decision-complete implementation work,
report-only review, recovery / lifecycle action 중 어디에 속하는지 먼저 분류한다.
필요하면 follow-up의 자연어에서 새 intent를 추론하되, 기존 task spec, worktree,
`HARNESS_RESULT`, deterministic verification, Samantha-owned lifecycle gate를
우회해서는 안 된다.

Sticky 상태를 끄려면 다음처럼 명시적으로 opt-out한다:

```text
sam off
Samantha off
Samantha 끄고 Codex로 해
이번 건 Samantha 없이 직접 해
```

Opt-out 이후 같은 thread에서도 prefix 없는 메시지는 일반 Codex 대화로 돌아간다.
다시 Samantha routing을 쓰려면 새로운 명시적 `Samantha <intent>:` 또는
`sam <alias>:` 메시지가 필요하다.

Sticky Samantha Session은 편의용 routing 규칙일 뿐이다. hidden memory,
daemon/watch behavior, chat adapter, project-global default, routine trigger가
아니며 task spec, isolated worktree, `HARNESS_RESULT`, deterministic verification,
Samantha-owned commit/report 같은 lifecycle gate를 우회하는 권한도 아니다.

### Brainstorm 결정 수락과 실행 승인

`sam b:` 또는 `Samantha brainstorm:` 이후의 prefix-free follow-up은 실행 권한을
자동으로 만들지 않는다. `Option A로 진행하자`, `이걸로 하자`, `좋아`,
`분리만 하자`, `그 방향으로 가자` 같은 표현은 기본적으로 accepted decision이며,
파일 수정, command 실행, task spec 생성, worker dispatch, prototype route 생성,
target repo mutation을 승인한 것으로 해석하지 않는다.

실행 승인에는 `구현해`, `수정해`, `작업 시작해`, `파일 바꿔`, `실행해`,
`이 계획대로 패치해` 같은 명시적 실행 표현이나 명시적인 `sam c:`가 필요하다.
follow-up이 결정 수락인지 실행 승인인지 애매하면 Samantha는 결정을 기록하고,
멈춘 뒤 다음 prompt를 추천해야 한다.

전역 skill이 활성화된 세션에서는 현재 Codex 작업 디렉토리를 target repo로 보고,
Samantha harness repo는 항상 `/Users/byung/Documents/samantha`로 고정한다. 터미널
편의를 위한 얇은 `samantha` wrapper가 있을 수 있지만, wrapper는 CLI 실행만
돕는다. Codex Chat activation은 여전히 전역 skill과 명시적인
`Samantha <intent>:` intent, `sam <alias>:` alias, 또는 활성화된 thread-local sticky follow-up이 담당한다.

## 권한 경계

Samantha는 방향을 논의하고, 목표를 분해하고, task spec을 제안하고, 증거를
검토하고, 다음 실행 경로를 추천할 수 있다.

요청이 실행 가능한 작업이 되면, Samantha는 기존 harness gate를 통해 라우팅해야
한다:

```text
BK software request
-> plan 또는 task spec
-> 쓰기 작업이 필요하면 격리된 worktree
-> Samantha worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit 또는 report
```

`Samantha command:`는 "즉시 실행하라"는 뜻이 아니다. "이 목표를 먼저 경계가
분명한 작업으로 정규화하라"는 뜻이다. 작업이 명확하고 autonomous implementation에
적합하면 Samantha는 scoped plan, task spec 방향, 또는 task spec path를 만들 수 있다.
하지만 task spec, scope check, verification, run evidence, Samantha-owned lifecycle
gate를 우회해서는 안 된다.

특히 Samantha repo 안에서 `Samantha command:` 또는 `sam c:`가 활성화되었고 요청이
이미 decision-complete writer implementation이라면, Codex Desktop이 implementation
파일을 직접 수정해서는 안 된다. 이 작업은 반드시 task spec, 격리된 worktree,
`--runtime=codex-sdk`를 사용한 SDK-backed Samantha worker run, `HARNESS_RESULT`,
deterministic verification, Samantha-owned commit/report로 표현되어야 한다.

Samantha self-build implementation을 완료, commit, push된 것으로 보고하려면 SDK run
evidence가 있어야 한다. 또는 worker run evidence, `HARNESS_RESULT`, 변경 파일 scope,
verification output을 포함한 동등한 run log가 있어야 한다.

Self-build task spec lifecycle도 gate의 일부다. `references/tasks/<id>.json`에
두는 persistent task spec은 worker dispatch 전에 Samantha-owned planning artifact로
commit되어야 하며, worker는 그 planning commit이 포함된 clean base에서 시작해야 한다.
일회성 또는 ad-hoc task spec은 `/tmp` 같은 repo 밖에 두고, run 이후
`references/tasks/**`로 post-hoc backfill하지 않는다. 상세 gate와 stop condition은
`references/playbooks/self-build-task-spec-lifecycle.md`를 따른다.

## 운영 모드와 라우팅 분류

Samantha는 canonical 또는 alias 형태의 `command`, `brainstorm`, `plan` 요청을 받으면
다음 액션을 제안하기 전에 먼저 요청의 단계를 분류해야 한다:

- Doctrine, product boundary, architecture, roadmap 단계인가?
- 이미 decision-complete implementation task인가?
- report-only review인가?
- recovery 또는 lifecycle action인가?

요청 intent보다 이 단계 판별이 우선한다. `Samantha plan:`, `Samantha command:`,
`sam p:`, `sam c:`라고 쓰였더라도 BK가 `NORTH_STAR.md`, `ARCHITECTURE.md`,
`ROADMAP.md`, role boundary, artifact lifecycle, validation boundary 같은 product
doctrine을 다루고 있으면 Samantha는 CEO/architect mode로 머물러야 한다.

CEO/architect mode에서는 바로 task spec, worker run, implementation slice로 내려가지
않는다. 먼저 phase roadmap, architecture completeness, assumption, decision point,
stop condition을 확인하고, 아직 결정되지 않은 것을 명시한다. 이 단계의
추천 next action은 "다음 구현"이 아니라 "다음 설계 산출물"이어야 한다. 예: ARCHITECTURE
정렬, phase roadmap, artifact lifecycle, role boundary, validation boundary.

다음 액션을 추천할 때는 먼저 레벨을 고른다. product capability, architecture,
roadmap, CEO workflow 작업 이후에는 worker-sized task가 아니라 다음 CEO capability
boundary를 먼저 추천한다. worker-sized task를 바로 추천하려면 더 큰 capability
boundary가 아직 안전하지 않거나 premature한 이유를 명시해야 한다. Worker task
decomposition은 accepted capability plan 안에 둔다.

Worker/execution mode는 implementation task가 decision-complete일 때만 적용한다. 이때는
기존 harness gate를 따른다:

```text
BK software request
-> plan 또는 task spec
-> 쓰기 작업이 필요하면 격리된 worktree
-> Samantha worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit 또는 report
```

Samantha repo 자신의 self-build writer implementation에서는 위 gate의 worker run이
`--runtime=codex-sdk`를 사용한 SDK-backed Samantha worker run이어야 한다. `command`,
`plan`, `review`의 intent 의미는 유지한다. `command`는 executable work를 gate로
정규화하고, `plan`은 요청이 plan-only이면 plan으로 남으며, `review`는 명시적인 구현
요청 전까지 report-only이다.

## Intent

| Intent | 언제 쓰는가 | Samantha가 내야 하는 산출물 |
| --- | --- | --- |
| `command` | BK에게 software goal이 있고 Samantha 운영으로 정규화해야 할 때. | 먼저 단계와 lifecycle gate를 분류한다. implementation 단계이면 scoped plan, task spec 방향, 또는 task spec path; doctrine/architecture 단계이면 roadmap 또는 artifact design. |
| `brainstorm` | 작업이 아직 executable하지 않고 방향을 같이 잡아야 할 때. 특히 MVP product UI/UX나 product doctrine을 논의할 때. | `references/playbooks/samantha-brainstorming.md`를 따르는 문답식 수렴, tradeoff, 더 정확한 용어, 2-3개 방향 비교, accepted decision, rejected alternative, remaining architecture question, decision point, self-review, 그리고 Brainstorm Brief. |
| `plan` | architecture/roadmap plan 또는 decision-complete implementation plan이 필요할 때. | 먼저 phase roadmap, architecture completeness, assumption, decision point, stop condition을 확인한다. implementation 단계일 때만 interface, scope, test를 포함한 구현 계획으로 내려간다. |
| `review` | critique, readiness check, risk finding, evidence synthesis가 필요할 때. | findings와 open question이 있는 report-only assessment. |
| `recover` | failed, blocked, stale, incomplete run evidence를 기준으로 다음 액션을 정해야 할 때. | diagnosis와 다음 bounded action. 보통 더 좁은 follow-up task 또는 lifecycle step. |
| `inspect` | runs, tasks, batches, lessons, docs의 현재 상태를 보고 싶을 때. | 의사결정에 필요한 짧은 state summary와 highest-value next action. |
| `learn` | lesson candidate, review, promotion, evidence flow를 명시적으로 운용하고 싶을 때. | hidden memory가 아닌 reviewable learning artifact action. |

## Intent Handoff

Samantha의 자연스러운 흐름은 `sam b:` -> `sam p:` -> `sam c:`이다. 단, 모든 요청을
기계적으로 세 단계를 통과시키지는 않는다. 각 intent는 다음 경계가 충분히 명확할 때만
다음 intent로 넘긴다.

Samantha가 next prompt 또는 handoff prompt를 추천할 때는 BK가 그대로 복사해 붙일 수
있도록 하나의 fenced `text` 코드 블럭으로 제공한다. 표준 prompt shape은 아래 슬롯
순서다.

```text
sam <alias>: <one-line goal>
Context:
Ask:
Scope:
Output:
Stop:
```

단순 handoff에서는 비어 있거나 관련 없는 슬롯을 생략할 수 있다. 단,
Samantha-authored recommended prompt에서 슬롯을 쓰는 경우 `Context:`, `Ask:`,
`Scope:`, `Output:`, `Stop:` 순서를 보존한다. 상세 guide에서 사용하는 alias는
`sam b:`, `sam p:`, `sam c:`, `sam r:`, `sam re:`, `sam i:`, `sam l:`이다.

### Post-Command Handoff

`sam c:` 완료 후 handoff는 runtime continuation이나 자동 실행 계약이 아니라 운영
guidance다. Command final response는 아래 shape을 사용해 현재 slice의 신뢰 가능한
상태와 다음 intent를 분리한다.

- `Outcome`: pass, rework, blocked, accepted, 또는 no-next-action 판단.
- `Trusted evidence`: task spec, run/report, `HARNESS_RESULT`, verification,
  changed-file scope, lifecycle/commit 상태 중 신뢰할 수 있는 증거.
- `Current slice`: 방금 완료, 실패, 보류, 또는 폐기된 slice.
- `Next-slice state`: `next slice ready`, `needs plan`, `needs brainstorm`,
  `recovery`, `closure decision`, `no next action`, `adjacent initiative needed`
  중 하나.
- `Recommended next prompt`: 다음 intent가 필요할 때만 하나의 copy-paste-ready
  fenced `text` 블럭.

추천 prompt는 항상 하나의 fenced `text` 블럭이어야 한다. 슬롯을 쓰는 경우 기존
slot order(`Context:`, `Ask:`, `Scope:`, `Output:`, `Stop:`)를 유지한다.
`no next action`일 때는 work를 지어내지 말고, 왜 다음 action을 추천하지 않는지
명시한다.

| Next-slice state | 추천 intent | 기준 |
| --- | --- | --- |
| `next slice ready` | `sam c:` | 다음 slice가 ready executable next slice이고 target files, verification, stop condition이 충분히 결정되어 있다. |
| `needs plan` | `sam p:` | execution boundary가 불완전하다. target files, artifact family, verification, stop condition, lifecycle boundary 중 하나가 아직 계획으로 정리되지 않았다. |
| `needs brainstorm` | `sam b:` | product direction, authority decision, artifact lifecycle, validation boundary 같은 판단이 먼저 필요하다. |
| `recovery` | `sam re:` | failed, blocked, untrusted, verify failed, scope failed, stale, 또는 missing `HARNESS_RESULT` 상태다. |
| `closure decision` | `sam p:` | 질문이 구현이 아니라 completion evidence가 initiative completion rule을 만족하는지 판단하는 것이다. |
| `no next action` | 없음 | completion rule satisfied 상태이고 의미 있는 cohesive slice가 남아 있지 않다. `No next action recommended`와 이유를 쓴다. |
| `adjacent initiative needed` | 별도 `sam b:` 또는 `sam p:` | 현재 initiative 밖의 adjacent authority 또는 product surface가 발견되었다. 새 initiative boundary로 분리한다. |

`sam b:`는 방향이 아직 executable하지 않을 때 쓴다. Brainstorm 결과는 accepted
decisions, rejected alternatives, remaining architecture/product questions,
recommended next prompt를 분리해서 끝낸다. 방향은 잡혔지만 실행 경계가 아직 불완전하면
다음 prompt는 `sam p:`가 되어야 한다. 제품 방향, authority, artifact lifecycle,
validation boundary, stop condition이 이미 충분히 결정되어 있다면 `sam c:`로 바로
넘길 수 있지만, 그 이유를 명시해야 한다.

`sam p:`는 accepted direction을 실행 가능한 계획으로 좁힐 때 쓴다. Plan 결과는
assumptions, target artifact 또는 capability boundary, intended files 또는 artifact
families, verification approach, stop conditions, next prompt를 포함해야 한다. 다음
prompt는 보통 `sam c:`이지만, product/architecture 결정이 남아 있으면 또 다른
`sam p:`나 BK decision으로 남겨야 한다.

`sam p:`는 결정을 만드는 단계가 아니라 이미 수렴한 결정을 계획으로 정리하는 단계다.
계획 중 unresolved product direction, authority boundary, artifact lifecycle,
validation boundary, 또는 stop condition 자체가 핵심 설계 질문이라는 사실이 드러나면
`sam p:`를 반복하지 말고 `sam b:`로 되돌린다. 계획 모드를 반복하면 빠진 결정을
assumption으로 굳히는 확증 편향이 생기기 쉽다. 단순 구현 디테일이나 기존 패턴으로
정할 수 있는 local choice는 `sam b:` 복귀 사유가 아니며, assumption 또는 stop
condition으로 남긴다.

`sam c:`는 executable software request를 Samantha harness gate로 정규화할 때 쓴다.
Command 결과는 task spec 또는 run/report 경로, verification 결과, changed-file scope,
commit/push 상태, 다음 highest-value Samantha handoff를 보고해야 한다. Samantha repo
self-build writer implementation에서는 sticky follow-up이어도 SDK-backed self-build
authority gate를 유지한다.

현재 운영 규칙은 `sam b:`, `sam p:`, `sam c:`, task spec, run evidence, report,
reviewable repo artifact를 handoff 단위로 사용한다.

## 학습 후보 자동 Draft

`runs:accept`는 writer run이 merge되고 worktree cleanup까지 완료된 뒤, 고신호
learning trigger evidence가 있을 때만 `references/lessons/inbox/<runId>.md`
lesson candidate를 자동 생성할 수 있다. 현재 허용 trigger는 같은 task family의
이전 `verify_failed`, `scope_failed`, `blocked`/`rework`, 또는 반복 실패가 accepted
writer run으로 수정된 경우다.

이 candidate는 reviewable inbox artifact일 뿐이며, `lessons:review` 또는
`lessons:promote`를 대신 실행하지 않는다. Report-only, failed, untrusted,
cleaned lifecycle이 없는 run은 자동 draft 대상이 아니다. 자세한 trigger 정책은
`references/playbooks/learning-trigger-policy.md`를 따른다.

## 여러 Slice의 연속성

brainstorm, plan, command 결과가 서로 의존하는 여러 slice로 나뉘면,
Samantha는 chat transcript를 parent source of truth로 삼지 않아야 한다. BK가
보존을 승인하면 `references/initiatives/` 아래에 Initiative Continuity Brief를
생성하거나 갱신한다.

이 brief는 accepted decisions, non-goals, invariants, slice queue, current next
slice, end-of-session update rule을 담는다. task spec, run log, verification,
lifecycle gate를 대체하지 않는다.

## 예시

### 실행 가능한 프로젝트 목표

```text
Samantha command: 이 repo에서 runs:list 출력이 너무 거칠어. 최근 run의 상태와 다음 액션을 한눈에 보이게 개선해줘.
```

기대 동작:

- 목표와 성공 기준을 다시 명확히 말한다.
- 먼저 doctrine/architecture 단계가 아니라 decision-complete implementation task인지 분류한다.
- 이 작업이 CLI/core command task인지 판단한다.
- 실행 전에 scoped plan 또는 task spec을 만든다.
- write work에는 기존 harness gate를 유지한다.

### 구현 전 브레인스토밍

```text
sam b: debut 전에 BK가 Samantha에게 어떤 종류의 말을 해야 하는지 더 다듬어보자.

좋아. 그러면 이걸 다음 phase plan으로 정리해줘. 아직 구현하지 마.
```

기대 동작:

- 먼저 target repo 또는 product context를 확인한다.
- 대화형 작업으로 유지한다.
- 한 번에 하나의 결정을 묻고, 추천 답과 tradeoff를 같이 제시한다.
- 조용히 결정하지 말고 tradeoff와 추천안을 드러낸다.
- 제품/UI 작업이면 visual question 전에 temporary browser visual companion을 한 번 제안한다. 단 companion은 mode가 아니라 tool이며, 각 질문마다 "보는 것이 읽는 것보다 나은가"를 기준으로 사용 여부를 정한다.
- 필요하면 2-3개의 MVP 방향을 비교하고 하나로 수렴한다.
- accepted decisions와 remaining architecture questions를 먼저 분리한다.
- 마지막에는 placeholder, contradiction, ambiguity, scope creep, YAGNI를 self-review한다.
- 마지막에는 goal, audience, MVP user flow, recommended direction, accepted decisions, rejected alternatives, open questions, self-review notes, recommended next prompt를 담은 Brainstorm Brief를 낸다.
- BK가 command나 plan 요청으로 바꾸기 전까지 executable work로 넘어가지 않는다.
- brainstorm 방향을 곧바로 task spec이나 구현 slice로 축소하지 않는다.
- production code, task spec, worker dispatch, committed UX/design spec, prototype route를 기본으로 만들지 않는다.
- 두 번째 prefix-free 메시지는 Sticky Samantha Session의 follow-up으로 처리하되,
  직전 `brainstorm`을 고정 default로 반복하지 않는다. "phase plan"과 "아직
  구현하지 마"를 근거로 plan-only CEO routing으로 다시 분류한다.

### 계획만 요청

```text
Samantha plan: lesson review UX를 더 명확하게 만드는 구현 계획을 세워줘. 아직 코드는 바꾸지 마.
```

기대 동작:

- 먼저 implementation plan인지 architecture/roadmap plan인지 분류한다.
- decision-complete implementation plan을 만든다.
- assumption, affected interface, test scenario, stop condition을 명시한다.
- BK가 나중에 구현을 요청하기 전까지 파일을 변경하지 않는다.

### Sticky Follow-up Self-Build Implementation

```text
sam p: Samantha repo의 sticky follow-up 구현 절차를 문서화하는 계획을 세워줘.

좋아. 그 계획대로 구현해.
```

기대 동작:

- 첫 메시지로 Sticky Samantha Session을 활성화한다.
- 두 번째 prefix-free 메시지는 Samantha CEO routing으로 다시 분류한다.
- Samantha repo 안의 decision-complete writer implementation이면 sticky
  follow-up이어도 self-build authority gate를 적용한다.
- Codex Desktop이 implementation 파일을 직접 수정하지 않고 task spec, 격리된
  worktree, `--runtime=codex-sdk` SDK-backed Samantha worker run,
  `HARNESS_RESULT`, deterministic verification, Samantha-owned commit/report로
  진행한다.

### Doctrine/Architecture 계획

```text
Samantha plan: bernays repo의 NORTH_STAR와 ARCHITECTURE 정렬 이후 phase roadmap을 잡아줘.
```

기대 동작:

- 요청을 CEO/architect mode로 분류한다.
- NORTH_STAR 정렬 직후 validator CLI 구현 같은 worker-level next task를 바로 제안하지 않는다.
- 먼저 ARCHITECTURE phase roadmap, artifact lifecycle, role boundary, validation boundary를 완성하자고 제안한다.
- architecture completeness, assumption, decision point, stop condition을 명시한다.
- implementation은 architecture completeness 이후 phase로 둔다.

### Report-only 리뷰

```text
Samantha review: 현재 Phase 5 batch 문서가 writer authority boundary를 흐리는 부분이 있는지 봐줘.
```

기대 동작:

- 요청을 report-only로 취급한다.
- 구체적인 finding과 file reference를 먼저 제시한다.
- edit, commit, merge, cleanup, lifecycle state mutation을 하지 않는다.

### 실패한 Run 복구

```text
Samantha recover: runs/2026-05-13T03-48-10-822Z-add-tasks-from-run-command.json 를 보고 다음 액션을 정해줘.
```

기대 동작:

- run evidence를 기준으로 run을 분류한다.
- 실패한 worker output을 accepted work로 신뢰하지 않는다.
- lifecycle action 또는 더 좁은 follow-up task를 추천한다.

### 상태 점검

```text
Samantha inspect: 지금 runs, lessons inbox, batch specs 기준으로 debut 전에 가장 중요한 다음 작업이 뭐야?
```

기대 동작:

- 먼저 local evidence를 점검한다.
- 의사결정에 필요한 상태만 요약한다.
- highest-value next action을 직설적으로 말한다.

### Learning Flow

```text
Samantha learn: 최근 반복된 실패에서 lesson candidate로 남길 만한 게 있는지 봐줘.
```

기대 동작:

- 명시적이고 review 가능한 artifact만 사용한다.
- 기존 lesson flow를 통해 draft, review, promote, record evidence를 수행한다.
- hidden memory를 만들거나 doctrine을 조용히 다시 쓰지 않는다.

## SDK Runtime 선택

`samantha run-task`에서 `--runtime`을 생략하면 이제 기본 runtime은 `codex-sdk`다.
SDK local state, credential, runtime diagnosability가 의심스러울 때는
`--runtime=exec-json`을 명시해 fallback한다:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha --runtime=exec-json
```

이 규칙은 기존 self-build-only SDK dogfood 선택 규칙을 `run-task`에 대해서는
대체한다. 단, authority gate는 그대로 유지된다. Samantha self-build writer
implementation은 여전히 task spec, 격리된 worktree, Samantha worker run,
`HARNESS_RESULT`, deterministic verification, Samantha-owned commit/report
evidence로 표현되어야 한다.

`batches:execute`에서 `--runtime`을 생략하면 기본 runtime은 계속 `exec-json`이다.
명시적인 bounded SDK dogfood batch에서만 `batches:execute --runtime=codex-sdk`를
사용한다:

```bash
bun run samantha batches:execute --batch-id=<batch-id>
bun run samantha batches:execute --batch-id=<batch-id> --runtime=codex-sdk
```

Runtime 선택은 BatchSpec runtime policy, report orchestration runtime 선택,
automatic fallback, App Server 통합, hidden UI state, daemon/watch, dashboard,
writerCap 변경, runtime-owned verification/scope/commit/lifecycle/cleanup/push/
recovery/orchestration authority를 허용하지 않는다. SDK failure가 run log에서
진단되지 않거나, `HARNESS_RESULT` 보존이 깨지거나, SDK metadata에서
`runtime.kind`가 사라지거나, SDK thread state가 lifecycle 또는 recovery 결정을
주도하거나, SDK package movement가 policy를 어기거나, SDK default 사용이 선언된
task authority 밖에 쓰기 작업을 만들면 `run-task --runtime=exec-json`으로
rollback한다.

상세 기준은 `references/playbooks/sdk-dogfood-runtime-selection.md`를 따른다.

## v1 Candidate Surface와 Hard Gate

Samantha Operating Protocol v1은 다음 표면을 현재 operator activation에 자동으로
추가하지 않는다. 단, 이들은 v0 non-goal이 아니라 v1 candidate surface다. Samantha가
각 표면을 제품 범위로 받아들이려면 별도 reviewed product slice와 명시적인
authority, verification, lifecycle gate가 필요하다:

- `bun run samantha ask`
- slash-command parsing
- Slack, Telegram, 또는 다른 chat adapter
- daemon 또는 watch behavior
- dashboard
- routine trigger
- budget governance
- remote/control plane
- multi-project orchestration

다음 gate는 v1에서도 완화하지 않는다:

- hidden memory 금지
- worker-owned orchestration 금지
- deterministic verification 없는 trusted state change 금지
- worker merge, push, cleanup authority 금지

candidate surface 검토는 이 hard gate를 통과하는 설계를 요구한다.
