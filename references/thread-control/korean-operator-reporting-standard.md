# Thread Control Plane 한국어 운영자 보고 기준

## 목적

이 문서는 BK가 검토하는 Samantha Thread Control Plane 산출물의 기본
언어 기준을 정한다. 목적은 운영자 가독성을 높이는 것이며, 증거,
권한, lifecycle 판단을 대체하지 않는다.

## 적용 범위

이 기준은 앞으로 작성되는 Thread Control Plane의 운영자 대상 산출물에
적용한다.

- BK가 읽는 보고서
- BK가 읽는 리뷰
- dogfood findings
- operator handoffs
- planning outputs

기존 Thread Control Plane 문서를 대량 번역할 필요는 없다. 이 기준은
새 산출물과 이후 갱신되는 산출물에 적용한다.

## 기본 규칙

리뷰어가 읽는 서술, 결론, 위험, 결정 사항, 다음 행동은 한국어 기반으로
작성한다.

한국어 기반이라는 말은 모든 토큰을 번역하라는 뜻이 아니다. 운영자가
판단해야 하는 문장은 한국어로 쓰고, 정밀도를 유지해야 하는 기술 토큰은
원문을 보존한다.

## 좁은 예외

다음 항목은 영어 또는 원문 표기가 허용되거나 선호된다.

- code identifiers
- CLI commands
- file paths
- JSON field names
- commit subjects
- `HARNESS_RESULT` lines
- 직접 인용한 evidence snippets
- product/tool proper names
- 번역하면 의미가 흐려지는 source terms

예외는 정밀도를 위한 것이다. 영어 문장 전체를 기본 보고 언어로 되돌리는
근거가 아니다.

## 증거 경계

한국어 문구는 운영자 가독성 기준일 뿐이다. 한국어로 잘 정리된 보고서는
trusted evidence가 아니다.

완료, 수용, 회수, 정리 판단에는 여전히 Samantha run evidence가 필요하다.
이 기준은 다음 증거와 권한을 대체하지 않는다.

- `HARNESS_RESULT`
- changed-file scope
- deterministic verification
- candidate commit evidence
- merge / cleanup / lifecycle trajectory
- final_git_status_captured evidence

worker의 한국어 요약이나 handoff 문장은 판단 보조 자료일 수 있지만,
Samantha-owned 검증과 lifecycle record 없이 trusted state가 되지 않는다.

## thread 경계

thread summary와 thread id는 advisory navigation only다. 이 둘은 작업
맥락을 찾고 후속 검토 위치를 좁히는 데 도움을 줄 수 있지만, 완료,
수용, 회수, 병합, 정리, lifecycle 결정을 증명하지 않는다.

## 권한 경계

background threads와 workers는 Samantha orchestration, merge, cleanup,
push, lifecycle, policy, doctrine authority를 갖지 않는다.

Thread Control Plane의 한국어 보고 기준은 권한 모델을 바꾸지 않는다.
background thread는 관찰, 범위 내 산출물, 검토 보조 정보를 보고할 수
있지만, Samantha가 decomposition, dispatch, verification, commit/report
evidence, lifecycle state를 계속 소유한다.

## G1/G2/G3 체크리스트

미래 G1/G2/G3 Thread Control Plane 산출물은 작성 전에 다음을 확인한다.

- BK가 읽는 narrative, conclusion, risk, decision, next action이 한국어로
  쓰였는가?
- field, code, path, command, error, API, config key는 필요한 만큼 원문을
  유지했는가?
- `HARNESS_RESULT`, run log, changed-file scope, deterministic verification,
  candidate commit, lifecycle evidence를 한국어 요약으로 대체하지 않았는가?
- thread summary와 thread id를 advisory navigation으로만 다루었는가?
- background thread나 worker가 orchestration, merge, cleanup, push,
  lifecycle, policy, doctrine authority를 가진 것처럼 쓰지 않았는가?
- 기존 Thread Control Plane 문서를 대량 번역하거나 새 report template,
  schema, thread API automation을 정의하지 않았는가?

## G1 pre-decision notes

G1 산출물은 한국어 narrative를 기본값으로 사용한다. field, code, path,
command, JSON key, evidence term은 원문을 유지한다.

G1은 언어 기준을 고정하는 단계이지 report templates나 thread API
automation을 정의하는 단계가 아니다. 이후 slice가 명시적으로 허용하기
전에는 template, schema, CLI, run-log fields, background scheduler,
daemon, UI, MCP, connector, task spec 자동화를 설계하거나 구현하지 않는다.
