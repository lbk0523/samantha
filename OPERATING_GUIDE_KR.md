# Samantha 운영 가이드

마지막 업데이트: 2026-05-31

## 목적

이 문서는 Samantha의 사용자-facing 운영 프로토콜을 정의한다. BK가 어떤
intent를 쓰고, 어떤 handoff를 기대하고, 같은 Codex thread에서 어떻게 이어갈 수
있는지를 설명하는 문서다.

현재 운영 기준은 Samantha v1이다. v1은 Codex Chat 기반 운영 프로토콜을
유지하면서, Samantha를 실제 Codex 작업에 사용해 run evidence, lesson evidence,
task evidence를 쌓고 하네스 성능과 편의성을 고도화하는 버전이다.

Samantha v1은 메시징 통합, 백그라운드 동작, 운영자 UI, 예약 자동화,
remote/control plane을 operator activation에 자동으로 추가하지 않는다. 그러나 이
표면들은 더 이상 오래된 slice exclusion이라는 이유만으로 부적합 판정하지 않는다.
별도 reviewed product slice와 authority, verification, lifecycle 설계가 있으면
인접 제품 표면으로 검토한다.

이 문서는 한국어 canonical guide다. 영어판 운영 가이드는 유지하지 않는다. 다른
repo의 Codex 세션에서 이 프로토콜을 활성화하는 실제 장치는 전역 Codex skill
`~/.codex/skills/samantha-operator/SKILL.md`이다. Codex/Samantha의 내부 작업
규율과 완료 체크리스트는 `WORK-RULES.md`가 canonical이고, repo-level hard gate와
product boundary는 `AGENTS.md`가 canonical이다.

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
thread-local이다. 다른 thread, 다른 project, repo 전역 기본값, 백그라운드 동작,
예약 자동화, 메시징 통합 상태로 확장되지 않는다.

Sticky Samantha Session이 활성화된 뒤에는 prefix가 없는 follow-up도 Samantha CEO
routing으로 처리한다. 단, prefix-free follow-up은 직전 intent를 고정 default로
반복한다는 뜻이 아니다. Samantha는 매번 요청을 다시 읽고 doctrine / product
boundary / architecture / roadmap work, decision-complete implementation work,
report-only review, recovery / lifecycle action 중 어디에 속하는지 먼저 분류한다.
필요하면 follow-up의 자연어에서 새 intent를 추론하되, 기존 task spec, worktree,
`HARNESS_RESULT`, deterministic verification, Samantha-owned lifecycle gate를
우회해서는 안 된다.

Sticky Samantha Session 안에서 Samantha가 직전 응답에 `Recommended next prompt`를
제시했다면, BK는 그 prompt 전체를 다시 붙여넣지 않고 짧은 same-thread shortcut으로
승인할 수 있다. 예: `추천한 sam p로 계속`, `위 sam c로 진행`, `이 프롬프트 그대로
실행 정규화`, `방금 추천한 다음 단계로 가자`. 이 shortcut은 직전 assistant 응답의
recommended prompt를 routing input으로 재사용한다는 뜻이다.

Same-thread shortcut은 편의용 입력 축약일 뿐이다. 새 thread, 다른 repo, 나중 재개,
감사 가능한 로그 보존이 필요한 상황에서는 여전히 전체 fenced prompt를 사용한다.
또한 shortcut은 실행 gate를 완화하지 않는다. 직전 prompt가 `sam c:`이거나 파일 수정,
worker dispatch, commit/report 같은 mutation을 요구하는 경우, BK의 shortcut은 실행
의도를 명확히 담아야 한다. 내부 실행 규율은 `WORK-RULES.md`의 self-build,
verification, lifecycle, final-response 규칙을 따른다.

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
백그라운드 동작, 메시징 인터페이스, project-global default, 자동 routine이
아니며 `AGENTS.md`와 `WORK-RULES.md`의 authority/lifecycle gate를 우회하는 권한도
아니다.

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
한다. 사용자 관점의 흐름은 아래와 같다:

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
gate를 우회해서는 안 된다. 세부 self-build authority gate, task spec lifecycle,
completion rule, final response checklist는 `WORK-RULES.md`를 따른다. Persistent
task spec과 ephemeral task spec의 선택 기준은
`references/playbooks/self-build-task-spec-lifecycle.md`를 따른다.

Thread Control Plane 또는 background thread를 사용할 때도 같은 경계를 유지한다.
background thread는 navigation/supervision surface일 뿐이며, `thread id`,
`thread summary`, `visibilitySummary`는 advisory navigation only다. Trusted
evidence는 `HARNESS_RESULT`, changed-file scope, deterministic verification,
candidate commit, `final_git_status_captured`, lifecycle record를 포함한
Samantha run evidence에 남는다. accept, merge, cleanup, lifecycle authority는
계속 Samantha가 가진다. 반복되는 수동 마찰이 충분히 크면 thread API automation은
별도 reviewed initiative에서 authority, provenance, freshness, lifecycle 설계를
먼저 다룬다.

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

Worker/execution mode는 implementation task가 decision-complete일 때만 적용한다.
이때도 `command`, `plan`, `review`의 intent 의미는 유지한다. `command`는 executable
work를 gate로 정규화하고, `plan`은 요청이 plan-only이면 plan으로 남으며, `review`는
명시적인 구현 요청 전까지 report-only이다. 내부 execution discipline은
`WORK-RULES.md`가 canonical이다.

## Intent

| Intent | 언제 쓰는가 | Samantha가 내야 하는 산출물 |
| --- | --- | --- |
| `command` | BK에게 software goal이 있고 Samantha 운영으로 정규화해야 할 때. | 먼저 단계와 lifecycle gate를 분류한다. implementation 단계이면 scoped plan, task spec 방향, 또는 task spec path; doctrine/architecture 단계이면 roadmap 또는 artifact design. |
| `brainstorm` | 작업이 아직 executable하지 않고 방향을 같이 잡아야 할 때. 특히 MVP product UI/UX나 product doctrine을 논의할 때. | `references/playbooks/samantha-brainstorming.md`를 따르되, 기본 대화는 grill-style one-question decision loop로 운영한다. 한 번에 하나의 질문을 묻고, recommended answer, tradeoff, why this matters를 함께 제시한다. 코드나 문서 탐색으로 답할 수 있는 질문은 BK에게 묻기 전에 먼저 탐색한다. 종료 시에만 accepted decision, rejected alternative, open decision, decision debt, readiness verdict, continuity artifact decision, recommended next prompt를 담은 Brainstorm Brief로 닫는다. |
| `plan` | architecture/roadmap plan 또는 decision-complete implementation plan이 필요할 때. | 먼저 phase roadmap, architecture completeness, assumption, decision point, stop condition을 확인한다. implementation 단계일 때만 Plan Readiness Review로 내려간다. Plan Readiness Review는 Artifact decision, durable artifact path, accepted decisions, decision debt, target capability/artifact boundary, proposed execution units, Slice sizing gate, verification strategy, stop conditions, plan verdict, recommended next prompt를 포함해야 한다. |
| `review` | critique, readiness check, risk finding, evidence synthesis가 필요할 때. | findings와 open question이 있는 report-only assessment. |
| `recover` | failed, blocked, stale, incomplete run evidence를 기준으로 다음 액션을 정해야 할 때. | diagnosis와 다음 bounded action. 보통 더 좁은 follow-up task 또는 lifecycle step. |
| `inspect` | runs, tasks, batches, lessons, docs의 현재 상태를 보고 싶을 때. | 의사결정에 필요한 짧은 state summary와 highest-value next action. |
| `learn` | lesson candidate, review, promotion, evidence flow를 명시적으로 운용하고 싶을 때. | hidden memory가 아닌 reviewable learning artifact action. |

## Intent Handoff

Samantha의 자연스러운 흐름은 `sam b:` -> `sam p:` -> `sam c:`이다. 단, 모든 요청을
기계적으로 세 단계를 통과시키지는 않는다. 각 intent는 다음 경계가 충분히 명확할 때만
다음 intent로 넘긴다.

### Language Policy

Samantha의 BK-facing control plane은 한국어가 기본값이다. BK에게 보여주는 요약,
판단, 리스크, 최종 보고, recommended prompt는 BK가 명시적으로 다른 언어를 요청하거나
대상 artifact 자체가 영어여야 하는 경우가 아니면 한국어로 작성한다.

실행 표면은 원문을 유지한다. code symbol, file path, CLI command, log, API name,
error message, test name, `HARNESS_RESULT`, config key, package name은 레포,
테스트, 로그와 직접 매칭되어야 하므로 번역하지 않는다.

Samantha-authored handoff prompt는 기본적으로 영어-only로 만들지 않는다. 섹션별
언어 일관성을 유지하고, code/command/log 식별자만 원문으로 보존한다. Worker-facing
task spec에서 구현 정밀도에 실질적으로 도움이 될 때만 짧은 영어
`Technical execution:` 섹션을 추가할 수 있다.

Samantha가 next prompt 또는 handoff prompt를 추천할 때는 BK가 그대로 복사해 붙일 수
있도록 하나의 fenced `text` 코드 블럭으로 제공한다. 표준 prompt shape은 아래 슬롯
순서다.

```text
sam <alias>: <one-line goal>
Context:
Ask:
Technical execution:
Scope:
Output:
Stop:
```

단순 handoff에서는 비어 있거나 관련 없는 슬롯을 생략할 수 있다. 단,
Samantha-authored recommended prompt에서 슬롯을 쓰는 경우 `Context:`, `Ask:`,
`Scope:`, `Output:`, `Stop:` 순서를 보존한다. `Technical execution:`은 선택
슬롯이며, 포함할 때는 `Ask:`와 `Scope:` 사이에 둔다. `Output:`에는 최종 보고를
한국어로 하고 파일명, 함수명, CLI command, `HARNESS_RESULT` key, test name은 원문으로
둔다는 요구를 포함한다. 상세 guide에서 사용하는 alias는 `sam b:`, `sam p:`,
`sam c:`, `sam r:`, `sam re:`, `sam i:`, `sam l:`이다.

같은 Codex thread에서 바로 이어갈 때는 이 fenced prompt가 감사 가능하고 재현 가능한
전체 입력이며, BK가 반드시 다시 붙여넣어야 하는 입력은 아니다. Samantha는
`Recommended next prompt` 아래에 필요하면 `Same-thread shortcut`을 함께 제시할 수
있다. Shortcut은 짧은 승인 문구여야 하며, 직전 recommended prompt를 벗어난 새 scope,
새 authority, 새 실행 권한을 암묵적으로 추가하지 않는다.

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
- `Same-thread shortcut`: 같은 thread에서 직전 `Recommended next prompt`를 그대로
  진행할 때 BK가 입력할 수 있는 짧은 승인 문구. 다음 prompt가 없거나 새 thread
  handoff가 필요한 경우에는 생략한다.

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

`sam b:`는 방향이 아직 executable하지 않을 때 쓴다. 진행 중에는 grill-style
one-question decision loop를 기본값으로 사용한다:

```text
Question:
Recommended answer:
Tradeoff:
Why this matters:
```

한 번에 하나의 결정을 묻고, 코드나 문서 탐색으로 답할 수 있는 질문은 BK에게 묻기 전에
먼저 탐색한다. `sam b:`는 매 턴마다 긴 상태 보고서를 내지 않는다. Samantha-specific
gate는 종료 시 Brainstorm Brief에만 둔다:

```text
Brainstorm Brief
- Goal:
- Accepted decisions:
- Rejected alternatives:
- Open decisions:
- Decision debt:
- Ready for: continue_brainstorm | plan | command | blocked
- Continuity artifact decision:
- Recommended next prompt:
```

방향은 잡혔지만 실행 경계가 아직 불완전하면 다음 prompt는 `sam p:`가 되어야 한다.
제품 방향, authority, artifact lifecycle, validation boundary, stop condition이 이미
충분히 결정되어 있다면 `sam c:`로 바로 넘길 수 있지만, 그 이유를 명시해야 한다.

`sam p:`는 accepted direction을 실행 가능한 계획으로 좁힐 때 쓴다. 단순한 단일
slice가 아니면 Plan Readiness Review로 닫아야 한다:

```text
Plan Readiness Review
- Stage classification:
- Artifact decision:
- Durable artifact path:
- Accepted decisions used:
- Decision debt:
- Codebase evidence:
- Target capability / artifact boundary:
- Proposed execution units:
- Slice sizing gate:
  - Are we splitting by cohesive work surface, not tiny invariants?
  - Can related changes sharing validator / artifact shape / command workflow /
    verification boundary be grouped safely?
  - If split smaller, what authority, verification, lifecycle, product
    uncertainty, broad framework, or repository-risk reason justifies it?
- Slice sizing rationale:
- HITL vs AFK classification:
- Intended files / artifact families:
- Verification strategy:
- Stop conditions:
- Plan verdict:
- Recommended next prompt:
```

`Artifact decision`은 `none`, `create_initiative_brief`,
`update_initiative_brief`, `create_short_prd_section` 중 하나로 둔다. 작은 단일
slice는 `none`과 text-only plan으로 충분할 수 있다. 장기 또는 multi-slice work에서
다음 session이 chat transcript만으로 broader objective를 놓칠 위험이 있으면
`references/initiatives/<slug>.md`의 Initiative Continuity Brief를 생성하거나
갱신해야 한다. Short PRD나 checklist는 별도 parent artifact로 흩뜨리지 말고,
기본적으로 해당 brief 안의 section으로 둔다.

Slice sizing gate가 실패하면 `ready_for_command` verdict를 내면 안 된다. 같은
validator, artifact shape, command workflow, verification boundary를 공유하는 관련
변경은 authority boundary를 넘지 않고 함께 test, verify, commit, push할 수 있는 한
하나의 cohesive command slice로 묶는 것을 기본값으로 삼는다. 더 작게 나누려면
authority, verification, lifecycle, product uncertainty, broad framework risk, 또는
repo risk 같은 명확한 이유를 밝혀야 한다.

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

## Learning Flow

Samantha의 learning은 hidden memory가 아니라 review 가능한 artifact flow다. BK가
`sam l:` 또는 `Samantha learn:`으로 명시적으로 요청하면 Samantha는 candidate,
review, promotion, evidence record 중 어떤 단계인지 분리해서 보고해야 한다. 자동
lesson candidate와 trigger의 세부 정책은
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
- Codex Desktop이 implementation 파일을 직접 수정하지 않고 `WORK-RULES.md`의
  self-build authority gate와 completion checklist를 따른다.

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

## 인접 제품 표면과 Hard Gate

Samantha Operating Protocol v1은 다음 표면을 현재 operator activation에 자동으로
추가하지 않는다. 단, 이들은 blanket exclusion도 아니다. Samantha가 각 표면을 제품
범위로 받아들이려면 별도 reviewed product slice와 명시적인 authority,
verification, lifecycle gate가 필요하다:

- `bun run samantha ask`
- slash-command parsing
- Slack/Telegram식 메시징 통합
- 백그라운드/감시 동작
- 운영자 UI
- 예약 자동화
- budget governance
- remote/control plane
- multi-project orchestration

다음 gate는 v1에서도 완화하지 않는다:

- hidden memory 금지
- worker-owned orchestration 금지
- deterministic verification 없는 trusted state change 금지
- worker merge, push, cleanup authority 금지

candidate surface 검토는 이 hard gate를 통과하는 설계를 요구한다.
