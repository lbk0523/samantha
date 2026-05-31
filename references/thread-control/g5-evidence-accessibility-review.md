# G5 evidence accessibility review

## 목적

이 문서는 G4 manual linkage template dogfood에서 드러난 evidence
accessibility 문제를 검토한다. 작성 언어는 한국어를 기본으로 하며,
`TaskSpec`, `runs/**`, `Samantha run evidence`, `HARNESS_RESULT`,
`thread id`, `thread summary`, `trusted evidence`, `Chief-of-Staff` 같은
운영 토큰은 원문을 유지한다.

이 문서는 report-only review다. schema, CLI, run-log field, thread API
automation, scheduler, daemon, UI, MCP, connector, lifecycle authority를
구현하거나 설계하지 않는다.

## G4 finding 요약

G4 dogfood는 manual linkage report template의 장점을 확인했다. Template은
`HARNESS_RESULT`, top-level pass, changed-file scope, deterministic
verification, candidate commit, `final_git_status_captured`,
`finalGitStatus`, lifecycle status를 별도 항목으로 드러내 누락 evidence를
숨기기 어렵게 했다.

동시에 evidence accessibility inconvenience도 확인했다. G4 worker worktree는
historical `runs/**` evidence를 inspect할 수 없었고, 그 결과 G3 run evidence는
`missing evidence`로 표시되었다. 이것은 template 실패라기보다 worker
worktree가 historical run evidence에 접근하지 못한 운영 접근성 문제다.

따라서 두 판단은 분리해야 한다.

- Template benefit: 누락된 evidence를 명시하게 만들고, thread summary나
  operator prose 뒤에 숨기지 않게 한다.
- Evidence accessibility inconvenience: worker에게 historical `runs/**`
  원문 접근권이 없으면 template을 채워도 G3의 trusted evidence를 확정할 수
  없다.

## 선택지 비교

### A. Keep current behavior: mark missing evidence and have the operator verify from main repo separately

- Benefits: 현재 권한 모델을 바꾸지 않는다. Worker worktree가 볼 수 없는
  evidence를 추정하지 않고 `missing evidence`로 남기므로 trusted evidence
  confusion을 피한다.
- Risks: Operator가 main repo에서 별도 확인해야 하므로 증거 탐색 비용이 남는다.
  같은 누락이 반복되면 report-only dogfood의 속도가 느려진다.
- Appropriate when: historical run evidence 접근이 불필요하거나, worker가
  확인하지 못한 evidence를 명시하는 것 자체가 review 목적일 때.
- Adopt now or defer: fallback으로 유지한다. Near-term 기본 경로로 삼기에는
  운영 비용이 크지만, 권한 경계가 불명확할 때는 가장 안전한 중단 방식이다.

### B. Include required run evidence excerpts directly in TaskSpec instructions

- Benefits: Worker worktree가 `runs/**`를 직접 열지 않아도 필요한 run evidence
  excerpt를 기준으로 report-only 검토를 수행할 수 있다. Evidence excerpt가
  Samantha run evidence에서 온 것임을 명시하면 thread summary나 worker prose를
  trusted evidence처럼 쓰는 문제를 줄일 수 있다.
- Risks: TaskSpec에 복사되는 excerpt의 선택, 누락, 전사 오류가 새로운 판단
  위험이 된다. Excerpt만으로 accept, merge, cleanup, lifecycle gate를
  대체하려는 문장이 생기면 권한 경계가 흐려진다.
- Appropriate when: 검토 범위가 좁고 필요한 evidence 항목이 작으며, TaskSpec이
  원본 run evidence path와 excerpt 출처를 함께 제공하는 report-only 작업일 때.
- Adopt now or defer: 조건부 adopt 가능하다. 단, trusted evidence는 계속
  Samantha run evidence이고, TaskSpec excerpt는 report-only 입력으로만 취급해야
  한다.

### C. Provide a separate read-only source run evidence bundle to the worker worktree

- Benefits: Worker가 main repo의 `runs/**` 전체에 접근하지 않고도 필요한 source
  run evidence를 읽을 수 있다. 여러 run을 비교하는 review에는 편의성이 높다.
- Risks: Bundle 생성 기준, 무결성, 최신성, provenance, scope 제한이 별도 설계를
  요구한다. 설계 없이 도입하면 bundle 자체가 새로운 trusted evidence surface처럼
  오해될 수 있다.
- Appropriate when: 별도 design에서 bundle format, provenance, freshness,
  read-only boundary, verification boundary가 먼저 합의된 뒤.
- Adopt now or defer: defer한다. G5 report-only review 안에서 evidence bundle
  설계를 시작하지 않는다.

### D. Do not delegate historical run evidence access to the worker; the Chief-of-Staff thread verifies from main repo and writes the report

- Benefits: Historical run evidence 확인을 main repo 접근이 가능한
  Chief-of-Staff thread에 남긴다. Worker worktree에 `runs/**` 접근을 부여하거나
  evidence bundle을 만들지 않아도 되므로 권한 표면이 작다. Report-only review가
  accept, merge, cleanup, lifecycle authority로 확장될 위험도 낮다.
- Risks: Worker dogfood가 아니라 Chief-of-Staff report가 되므로 worker template
  작성 경험을 직접 검증하는 범위는 줄어든다. Chief-of-Staff report도
  Samantha-owned lifecycle gates를 대체하지 않는다는 문구가 필요하다.
- Appropriate when: historical run evidence 원문 확인이 review의 핵심이고,
  worker worktree에 과거 `runs/**`를 노출하는 것이 목적이 아닐 때.
- Adopt now or defer: near-term adopt를 권장한다. 단, report-only로 유지하고
  trusted evidence는 Samantha run evidence에 남겨야 한다.

### E. Keep run-log field/schema/CLI/linkage automation deferred

- Benefits: G2의 가장 작은 안전 표면을 유지한다. Manual advisory linkage
  report가 schema, CLI output, run-log field, thread API automation으로
  확대되지 않는다.
- Risks: 접근성 불편을 자동화로 해결하지 않기 때문에 수동 확인 비용은 남는다.
  Deferred 상태가 오래 지속되면 반복 작업의 마찰이 누적될 수 있다.
- Appropriate when: 현재 문제의 핵심이 automation 부재가 아니라 evidence 접근
  경계와 report-only 책임 분리일 때.
- Adopt now or defer: defer를 유지한다. G5에서는 run-log
  field/schema/CLI/linkage automation을 설계하지 않는다.

## Near-term recommendation

Near-term path는 D를 기본으로 하고 B를 제한적 대안으로 둔다.

Historical `runs/**` evidence가 review 결론의 중심이면, worker에게 historical
run evidence access를 위임하지 말고 Chief-of-Staff thread가 main repo에서
Samantha run evidence를 확인한 뒤 report-only 문서를 작성하는 편이 더 안전하다.
이 방식은 evidence를 복사하거나 bundle화하지 않고, worker-owned orchestration을
새로 만들지 않으며, accept/merge/cleanup/lifecycle gates를 그대로 보존한다.

B는 필요한 run evidence excerpt가 작고 고정되어 있을 때만 적합하다. 이 경우에도
`TaskSpec` instructions의 excerpt는 원본 Samantha run evidence를 찾아가기 위한
report-only 입력이지 trusted evidence 자체가 아니다.

A는 fallback으로 유지한다. Worker가 확인할 수 없는 evidence는 계속
`missing evidence`로 표시하고, operator가 main repo에서 별도 확인한다.

C는 separate read-only source run evidence bundle design이 필요하므로 defer한다.
E도 그대로 defer한다. G5에서 schema, CLI, run-log field, linkage automation,
thread API automation으로 넘어가지 않는다.

## G6 candidate direction

G6 후보는 D-only Chief-of-Staff main repo evidence review dogfood를 권장한다.

이 선택이 B-only source evidence excerpt dogfood보다 안전한 이유는, historical
run evidence를 worker assignment 안으로 복사하지 않기 때문이다. Chief-of-Staff가
main repo에서 Samantha run evidence를 확인하고 report-only 문서를 작성하면,
excerpt 선택 오류나 bundle provenance 문제를 만들지 않고도 G4에서 막힌
evidence accessibility 문제를 검증할 수 있다.

G6는 다음 범위 안에 머물러야 한다.

- Chief-of-Staff thread가 main repo의 Samantha run evidence를 확인한다.
- Report는 advisory review로만 남긴다.
- `thread id`와 `thread summary`는 advisory navigation only다.
- Trusted evidence는 Samantha run evidence다.
- Worker-owned orchestration은 금지된다.
- Review는 accept/merge/cleanup/lifecycle gates를 대체하지 않는다.

## G6 stop conditions

G6는 다음 상황에서 중단한다.

- schema, CLI, run-log field, formal data contract, linkage automation 설계가
  시작되는 경우.
- `create_thread`, `read_thread`, `send_message_to_thread`, scheduler, daemon,
  UI, MCP, connector 설계가 시작되는 경우.
- `thread id` 또는 `thread summary`가 trusted evidence처럼 쓰이는 경우.
- Worker가 orchestration, merge, cleanup, push, lifecycle, policy, doctrine
  authority를 갖는 것처럼 쓰이는 경우.
- Report가 accept, merge, cleanup, lifecycle gates를 대체하려는 경우.
- Missing evidence를 operator summary, thread summary, worker prose로
  보완하려는 경우.
- Historical `runs/**` 접근을 worker worktree에 부여하거나 evidence bundle로
  우회하려는 경우.

## Trust boundary

이 review는 trusted evidence가 아니다. 이 문서는 evidence accessibility와
manual linkage report 운영 방식을 검토하는 advisory report다.

`thread id`와 `thread summary`는 계속 advisory navigation only다. Trusted
evidence는 Samantha run evidence에 남는다. Worker-owned orchestration은 계속
금지된다. 이 review는 accept/merge/cleanup/lifecycle gates를 대체하지 않는다.
