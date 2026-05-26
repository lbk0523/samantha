# Hermes × Samantha Workflow 적용 검토 보고서

작성일: 2026-05-26  
대상: `lbk0523/samantha`, NousResearch `hermes-agent`  
목적: Hermes Agent를 Samantha 기반 개발 워크플로우에 적용할 수 있는지 검토하고, 실제 적용을 시작할 때 어느 쪽에서 먼저 착수해야 하는지 판단한다.

---

## 1. Executive Summary

결론은 명확하다.

> Hermes를 Samantha 워크플로우에 붙이는 것은 가능하다.  
> 그러나 Hermes를 “개발자”나 “상위 자율 PM”으로 두면 안 된다.  
> Hermes는 **Samantha Maintenance Operator**로 시작해야 한다.

권장 구조는 다음과 같다.

```text
병관
= 제품 방향, 요구사항, 권한 확장, promotion 승인자

Hermes
= Samantha 운영 보조자 / AI PMO / evidence triage agent
- runs, lessons, task evidence를 읽고 요약
- 반복 실패와 lesson 후보를 찾음
- task spec 초안을 제안
- 승인 필요한 지점을 병관에게 올림
- Samantha CLI allowlist 안에서만 동작

Samantha
= 신뢰 경계 / 실행 하네스
- task spec
- isolated worktree
- dispatch policy
- HARNESS_RESULT
- deterministic verification
- Samantha-owned commit/report
- lifecycle evidence

Codex with Samantha harness
= 구현 담당
- Samantha가 할당한 worktree 안에서만 구현
- worker는 merge, push, cleanup, promotion, policy mutation을 소유하지 않음
```

이 구조는 병관의 운영 피로를 줄이면서도 Samantha의 핵심 가치인 **권한 경계, 검증, 증거 기록, 실행 통제**를 유지한다.

---

## 2. 핵심 판단

### 2.1 Hermes를 붙이는 목적은 “개발 위임”이 아니라 “운영 피로 감소”여야 한다

현재 피로의 본질은 다음에 가깝다.

```text
매번 병관이 직접:
- Samantha에게 다음 작업을 설명하고
- run 상태를 확인하고
- lesson 후보를 판단하고
- follow-up task를 만들고
- 검수 지점을 챙김
```

따라서 Hermes에게 맡길 1차 업무는 구현이 아니다.

가장 적절한 1차 위임 영역은 다음이다.

```text
Hermes가 Samantha evidence를 읽고,
병관이 결정해야 할 액션을 1~3개로 줄여주는 것.
```

즉, Hermes의 첫 역할은 **작업자**가 아니라 **운영 비서 / triage agent / maintenance operator**다.

---

### 2.2 Samantha의 역할은 약화시키면 안 된다

Samantha는 Codex의 내부 코딩 능력을 재구현하는 프로젝트가 아니다. Samantha의 포지션은 Codex 바깥에서 **작업 명세, 권한 경계, 검증, 증거 기록, commit lifecycle**을 통제하는 상위 업무 하네스다.

Samantha 저장소 README는 핵심 루프를 다음처럼 정의한다.

```text
minimal user goal
-> Samantha CEO decomposition
-> task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

따라서 Hermes가 이 루프를 우회하면 안 된다.

금지해야 하는 우회 경로는 다음이다.

```text
Hermes → Codex 직접 실행 → 코드 수정
Hermes → git commit/push/merge 직접 실행
Hermes → lesson 자동 promotion
Hermes → task spec 없이 파일 수정
Hermes → daemon/watch로 자동 구현 실행
```

Hermes는 반드시 Samantha가 제공하는 CLI와 artifact를 통해서만 움직여야 한다.

---

### 2.3 시작점은 “Hermes 적용”이 아니라 “Hermes가 안전하게 붙을 수 있는 Samantha 운영 경계 정의”다

Hermes는 자율권을 가질수록 위험해진다.  
Samantha의 존재 이유는 그 자율권을 안전한 software delivery unit으로 묶는 것이다.

따라서 실제 작업 착수 순서는 다음이어야 한다.

```text
1. Samantha 쪽에서 operator boundary와 core loop 안전장치를 먼저 정리
2. 그 다음 Hermes 쪽에 Samantha Maintenance Operator skill/profile 추가
3. 마지막에 제한적 cron/read-only summary부터 실험
```

---

## 3. 권장 적용 아키텍처

### 3.1 권장 흐름

```text
[병관]
  제품 방향 / 요구사항 / 권한 확장 승인

      ↓ 위임

[Hermes: Samantha Maintenance Operator]
  run evidence 읽기
  lesson 후보 정리
  failed/blocked run 진단 후보 요약
  task spec 초안 제안
  approval-needed items만 병관에게 escalation

      ↓ allowlisted Samantha CLI only

[Samantha CLI / Harness]
  task preflight
  worktree allocation
  Codex dispatch
  HARNESS_RESULT parse
  changed file scope check
  deterministic verification
  commit/report lifecycle evidence

      ↓

[Codex Worker]
  isolated worktree 안에서 구현
```

핵심 원칙은 간단하다.

> Hermes는 Codex를 직접 부르지 않는다.  
> Hermes는 Samantha를 통해 Codex를 간접적으로 다룬다.

---

### 3.2 Hermes가 호출해도 되는 명령

초기 허용 명령은 read/report/lesson-triage 중심으로 제한한다.

```bash
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha runs:diagnose --run-log=<path>
bun run samantha batches:list
bun run samantha batches:show --batch-id=<id>
bun run samantha readiness:check ...
bun run samantha lessons:draft --run-log=<path>
bun run samantha lessons:review <candidate.md>
bun run samantha lessons:review-inbox --repo-root=<repo>
bun run samantha lessons:promotion-queue --repo-root=<repo>
```

조건부 허용 후보:

```bash
bun run samantha tasks:from-template ...
bun run samantha tasks:from-run ...
bun run samantha lessons:record-evidence ...
```

초기 금지:

```bash
bun run samantha run-task ...
bun run samantha lessons:promote ...
git commit
git push
git merge
codex exec
claude
```

---

### 3.3 Hermes 산출물 포맷

Hermes는 매번 다음 형식의 `Samantha Maintenance Brief`를 내야 한다.

```markdown
# Samantha Maintenance Brief

## 1. Current State
- 최근 run 상태:
- failed / blocked / pass 분류:
- lesson inbox 상태:
- promotion queue 상태:

## 2. Highest-Value Next Action
- 추천 액션:
- 이유:
- 근거 run / file / command:
- 예상 리스크:

## 3. Decisions Required from BK
- [ ] approve / reject / hold:
- [ ] 실행 허용 여부:
- [ ] 권한 확장 필요 여부:

## 4. Commands Already Run
- ...

## 5. Commands Proposed But Not Run
- ...
```

이 포맷의 목적은 병관의 사고 부담을 줄이는 것이다.  
Hermes가 선택지를 10개 늘어놓으면 실패다. 매번 1~3개의 결정 지점으로 압축해야 한다.

---

## 4. 권한 레벨 설계

### Level 0 — 읽기/요약 전용

즉시 가능.

허용:

```bash
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha batches:list
bun run samantha batches:show --batch-id=<id>
```

기대 효과:

- 최근 작업 상태 파악 피로 감소
- failed/blocked run 확인 시간 감소
- 다음 액션 후보 압축

위험도: 낮음

---

### Level 1 — lesson draft/review 보조

가장 먼저 실험할 실사용 영역.

허용:

```bash
bun run samantha lessons:draft --run-log=<path>
bun run samantha lessons:review <candidate.md>
bun run samantha lessons:review-inbox --repo-root=<repo>
bun run samantha lessons:promotion-queue --repo-root=<repo>
```

금지:

```bash
bun run samantha lessons:promote ...
```

기대 효과:

- 병관이 직접 lesson 후보를 찾고 판단하는 피로 감소
- Samantha의 explicit learning model 유지
- hidden memory 없이 reviewable artifact 기반 학습 가능

위험도: 낮음~중간

---

### Level 2 — task spec 초안 생성

가능하지만 승인 필요.

허용 후보:

```bash
bun run samantha tasks:from-template ...
bun run samantha tasks:from-run ...
```

운영 방식:

```text
Hermes가 task spec 초안 생성
→ 병관이 scope, targetFiles, forbiddenChanges, verifyCommands 확인
→ Samantha readiness/preflight
→ 그 다음에만 run-task 고려
```

위험도: 중간

---

### Level 3 — run-task 실행

초기에는 금지.  
나중에 제한적으로 허용 가능.

허용 조건:

```text
- writer no-op pass gate 구현 완료
- verify command sequential execution 구현 완료
- command timeout 구현 완료
- verification quality preflight 구현 완료
- 10~20회 read-only/lesson-triage dogfood evidence 확보
- docs-only 또는 lesson-maintenance 계열부터 시작
```

위험도: 중상~높음

---

### Level 4 — promotion / policy / template 변경

초기 금지.  
장기적으로도 별도 승인 없이는 금지.

금지 대상:

```text
- lessons:promote 자동 실행
- task template 자동 수정
- agent profile 자동 수정
- policy.ts 자동 수정
- AGENTS.md / NORTH_STAR.md / ARCHITECTURE.md / ROADMAP.md 자동 수정
- Samantha doctrine 변경
```

위험도: 높음

---

## 5. 선행 보강이 필요한 Samantha Core Loop

Hermes에게 write/run-task 권한을 주기 전, Samantha core loop에서 다음 네 가지를 먼저 보강해야 한다.

### 5.1 Writer no-op pass gate

문제:

```text
writer task가 HARNESS_RESULT: pass를 내고
verify command가 통과했지만
changedFiles가 0개인 경우 false success가 될 수 있음
```

필요 정책:

```text
writer task
+ resultMode !== report
+ allowNoop !== true
+ changedFiles.length === 0
→ fail
```

명시적 예외:

```ts
allowNoop?: boolean;
noopRationale?: string;
```

---

### 5.2 Verify commands 순차 실행

기본값은 병렬이 아니라 순차여야 한다.

필요 정책:

```text
verifyCommands는 선언 순서대로 실행
첫 실패에서 중단
각 command result에 timing, exitCode, stdout/stderr, timeout 여부 기록
```

이유:

```text
- shared cache 충돌 방지
- snapshot/temp output 충돌 방지
- DB fixture 충돌 방지
- 실패 원인 추적 단순화
```

---

### 5.3 Command timeout

필요한 timeout:

```ts
setupTimeoutMs?: number;
verifyTimeoutMs?: number;
workerTimeoutMs?: number;
```

막아야 할 명령:

```bash
bun test --watch
npm run dev
tail -f log.txt
sleep 999999
vite dev
next dev
```

timeout 발생 시 command result에 evidence를 남겨야 한다.

```ts
timedOut?: boolean;
timeoutMs?: number;
timeoutDetails?: string;
```

---

### 5.4 Verification quality preflight

`verifyCommands: ["true"]` 같은 형식적 검증을 막아야 한다.

MVP deterministic rule:

```text
- writer task의 verifyCommands는 no-op command만으로 구성될 수 없음
- watch/dev/server 계열 command 금지
- 빈 command 금지
- tdd-first/core-module 작업은 test 또는 typecheck 계열 command 최소 하나 필요
- lifecycle-sensitive 작업은 broad verification 최소 하나 필요
```

---

## 6. 실제 적용 순서 제안

### Phase 0 — 결정

결정할 것:

```text
Hermes는 Samantha Maintenance Operator로 시작한다.
Hermes에게 직접 구현 권한은 주지 않는다.
Hermes는 Samantha CLI allowlist만 사용한다.
lesson promotion, run-task, git mutation은 초기 금지한다.
```

---

### Phase 1 — Samantha 쪽 선행 작업

목표:

```text
Hermes가 붙기 전에 Samantha의 실행 신뢰 경계를 강화한다.
```

작업:

```text
1. writer no-op pass gate
2. verify command sequential execution
3. command timeout
4. verification quality preflight
5. 20-run dogfood evidence plan
```

이 작업은 Samantha 또는 Codex with Samantha harness로 수행하는 것이 맞다.

---

### Phase 2 — Hermes용 skill/profile 작성

목표:

```text
Hermes가 Samantha를 우회하지 않도록 별도 skill/profile을 만든다.
```

예상 skill 이름:

```text
samantha-maintenance-operator
```

포함 내용:

```text
- Samantha authority model 요약
- allowed commands
- forbidden commands
- lesson management flow
- when to stop and ask BK
- output brief format
- no direct Codex
- no direct git mutation
- no lesson promotion without approval
```

---

### Phase 3 — Read-only / lesson-triage dogfood

목표:

```text
Hermes가 실제로 병관의 운영 피로를 줄이는지 검증한다.
```

허용:

```text
- runs/list/show 요약
- lesson inbox review
- promotion queue 요약
- draft 후보 추천
```

금지:

```text
- run-task
- lessons:promote
- git mutation
- Codex 직접 호출
```

측정 지표:

```text
- 병관이 run 상태 파악에 쓰는 시간
- lesson 후보 판단 시간
- Hermes brief의 useful rate
- false recommendation 수
- 병관이 실제 승인한 제안 비율
- Hermes가 권한 경계를 위반하려 한 횟수
```

---

### Phase 4 — 제한적 task spec 초안 생성

조건:

```text
- Phase 3에서 useful rate가 충분함
- 권한 위반 사례가 없음
- 병관이 brief를 보고 실제 피로 감소를 체감함
```

허용:

```text
- docs-only task 초안
- lesson maintenance task 초안
- failed run 기반 follow-up task 초안
```

여전히 금지:

```text
- 자동 run-task
- 자동 promotion
- 자동 policy/template 변경
```

---

### Phase 5 — 제한적 run-task

나중에만 고려한다.

시작 대상:

```text
- docs-only
- report-only
- lesson/report 정리
- low-risk refactor
```

필수 조건:

```text
- Samantha core loop hardening 완료
- human approval gate 유지
- branch/worktree isolation 유지
- Samantha-owned commit 유지
- run evidence 남김
```

---

## 7. 누구와 시작해야 하는가?

### 결론: Samantha와 먼저 시작한다

Hermes를 워크플로우에 적용하려는 작업이라도, 실제 첫 착수점은 **Samantha**가 맞다.

이유는 네 가지다.

---

### 이유 1. Samantha가 신뢰 경계다

Hermes는 자율권을 가진 agent다.  
Samantha는 자율권을 통제하는 harness다.

따라서 먼저 강화해야 할 것은 agent가 아니라 boundary다.

```text
나쁜 순서:
Hermes skill부터 만든다
→ Hermes가 Samantha를 운영하기 시작한다
→ Samantha core loop의 false pass / timeout / weak verification 리스크가 증폭된다

좋은 순서:
Samantha core loop를 먼저 보강한다
→ Hermes가 접근할 allowed surface를 정의한다
→ Hermes skill을 그 경계에 맞게 만든다
```

---

### 이유 2. 현재 위험은 Hermes 부재가 아니라 Samantha core loop의 false confidence다

첨부 분석 문서 기준으로 현재 핵심 리스크는 다음이다.

```text
- writer no-op pass
- verify command 병렬 실행
- command timeout 부족
- verification quality preflight 부족
```

이 상태에서 Hermes를 붙이면 생산성이 오르는 것처럼 보일 수 있지만, 실제로는 **잘못된 성공 보고와 자동화 피로**가 늘 수 있다.

---

### 이유 3. Hermes는 나중에 교체 가능하지만 Samantha boundary는 워크플로우의 중심이다

Hermes가 아니어도 운영 agent는 바뀔 수 있다.  
하지만 Samantha의 task spec, worktree, verification, run evidence, lesson flow는 네 개발 워크플로우의 핵심 자산이다.

따라서 첫 작업은 “Hermes를 잘 쓰는 법”이 아니라 “어떤 agent가 와도 Samantha를 우회하지 못하게 만드는 법”이어야 한다.

---

### 이유 4. Samantha와 시작하면 실행 단위가 작고 검증 가능하다

Samantha 쪽 첫 작업은 이미 작게 쪼갤 수 있다.

```text
Task 1. no-op writer pass gate
Task 2. verify commands sequential execution
Task 3. command timeout
Task 4. verification quality preflight
Task 5. 20-run dogfood evidence plan
```

반면 Hermes부터 시작하면 범위가 곧바로 넓어진다.

```text
- skill design
- cron design
- toolset restriction
- workdir config
- command allowlist
- messaging/notification
- report format
- approval flow
```

지금은 넓힐 때가 아니다.  
먼저 좁고 검증 가능한 경계부터 단단히 해야 한다.

---

## 8. 단, 빠른 체감 실험은 Hermes로 해도 된다

“첫 구현 작업”은 Samantha가 맞다.  
하지만 “가치 체감 실험”은 Hermes로 매우 작게 해도 된다.

허용 가능한 1일 PoC:

```text
Hermes에게 Samantha repo를 읽게 한다.
허용 명령은 runs:list / runs:show / lessons:review-inbox / promotion-queue만 준다.
Hermes가 Maintenance Brief만 작성한다.
아무 파일도 수정하지 않는다.
아무 command도 실행하지 않는다.
promotion도 하지 않는다.
```

이 PoC의 목적은 하나다.

```text
Hermes가 정말 내 운영 피로를 줄이는가?
```

다만 이 PoC는 workflow integration의 시작이 아니라 **read-only shadow trial**로 봐야 한다.

---

## 9. 추천 첫 작업 지시문

### 9.1 Samantha에게 줄 첫 지시문

```text
sam c: Hermes를 Samantha Maintenance Operator로 붙이기 전에 Samantha core loop의 신뢰 경계를 먼저 강화하자.

Context:
Hermes는 나중에 runs, lessons, task evidence를 읽고 운영 보조를 할 예정이다. 하지만 Hermes에게 run-task나 lesson promotion 권한을 주기 전에 Samantha 자체의 false pass/hang/weak verification 리스크를 줄여야 한다.

Ask:
첨부 분석 보고서의 우선순위에 따라 core worker execution loop만 개선해줘.
1. writer no-op pass gate
2. verifyCommands sequential execution
3. command timeout
4. verification quality preflight
5. 20-run dogfood evidence plan

Scope:
새 product surface, dashboard, daemon, remote adapter, chat adapter, Hermes integration code는 만들지 말 것.
Samantha의 기존 CLI/core loop 안에서만 개선할 것.

Output:
각 작업을 작은 task spec으로 나누고, targetFiles, forbiddenChanges, verifyCommands를 명확히 제안해줘.

Stop:
바로 구현하지 말고, 먼저 실행 계획과 task slicing을 제시해줘.
```

---

### 9.2 Hermes에게 줄 첫 지시문

```text
You are Samantha Maintenance Operator.

Goal:
Reduce BK's Samantha operation fatigue without expanding Samantha authority.

Allowed commands:
- bun run samantha runs:list
- bun run samantha runs:show <run-id>
- bun run samantha runs:diagnose --run-log=<path>
- bun run samantha lessons:draft --run-log=<path>
- bun run samantha lessons:review <candidate.md>
- bun run samantha lessons:review-inbox --repo-root=<repo>
- bun run samantha lessons:promotion-queue --repo-root=<repo>
- bun run samantha readiness:check ...

Forbidden:
- codex exec
- claude
- git commit
- git push
- git merge
- bun run samantha run-task unless BK explicitly approves
- bun run samantha lessons:promote unless BK explicitly approves
- editing AGENTS.md, NORTH_STAR.md, ARCHITECTURE.md, ROADMAP.md, policy.ts, task templates, or agent profiles

Output:
Produce a concise Maintenance Brief with:
1. Current state
2. Highest-value next action
3. Decisions requiring BK
4. Commands already run
5. Commands proposed but not run
```

---

## 10. 의사결정 기준

Hermes 적용을 계속할지 판단하는 기준은 다음이다.

### 계속 진행해도 되는 신호

```text
- Hermes brief가 매번 실제 다음 액션을 1~3개로 압축한다
- 병관의 run/lesson 확인 시간이 줄어든다
- Hermes가 권한 경계를 위반하지 않는다
- lesson 후보 추천의 precision이 높다
- failed/blocked run diagnosis가 유용하다
- task spec 초안이 Samantha readiness check에 자주 통과한다
```

### 중단해야 하는 신호

```text
- Hermes가 Codex 직접 실행을 반복 제안한다
- 자동 promotion / 자동 run-task를 자주 요구한다
- 실행보다 architecture 확장을 더 많이 제안한다
- 병관이 검토해야 할 항목이 오히려 늘어난다
- Samantha evidence가 아니라 Hermes 추측에 기반한 보고가 늘어난다
- brief가 길고 산만해서 의사결정 피로가 늘어난다
```

---

## 11. 최종 권고

### 11.1 운영 모델

권장 운영 모델은 다음이다.

```text
병관 = 최종 결정권자
Hermes = Samantha Maintenance Operator
Samantha = authority boundary / execution harness
Codex = bounded implementation worker
```

### 11.2 시작 순서

```text
1. Samantha core loop hardening
2. Hermes Samantha Maintenance Operator skill/profile
3. read-only / lesson-triage shadow trial
4. task spec draft delegation
5. limited approved run-task
```

### 11.3 한 문장 결론

> Hermes를 도입하려면 Hermes부터 시작하지 말고 Samantha부터 시작해야 한다.  
> 먼저 Samantha의 신뢰 경계를 단단히 만들고, 그 다음 Hermes를 그 경계 안에서 움직이는 운영 보조자로 붙여라.

---

## 12. Source References

- User-provided document: `samantha_harness_analysis_and_codex_action_plan.md`
- Samantha repository: https://github.com/lbk0523/samantha
- Samantha README / core loop and CLI surface: https://github.com/lbk0523/samantha
- Samantha North Star: https://raw.githubusercontent.com/lbk0523/samantha/main/NORTH_STAR.md
- Samantha Architecture: https://raw.githubusercontent.com/lbk0523/samantha/main/ARCHITECTURE.md
- Samantha Roadmap: https://raw.githubusercontent.com/lbk0523/samantha/main/ROADMAP.md
- Hermes Cron docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- Hermes Skills System docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes Skills Hub: https://hermes-agent.nousresearch.com/docs/skills/
- Hermes Codex skill: https://github.com/NousResearch/hermes-agent/blob/main/skills/autonomous-ai-agents/codex/SKILL.md
- Hermes API Server docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
