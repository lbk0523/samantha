# Open Source Thread Policy Delta Audit

Date: 2026-05-31
Status: report-only delta audit

## 기준

Open-source readiness pause 기준:

- `references/operations/open-source-thread-policy-pause.md`
- Governance/package readiness accepted commit:
  `85c420205ddfaf2221c9d71c6a68c4876bac7223`

Thread-policy 기준 commit:

- `45197c6c4be3e17f258ac2f8c26522aa494552f7`
  (`docs: close thread control plane policy`)

검토한 thread-policy surface:

- `OPERATING_GUIDE_KR.md`
- `WORK-RULES.md`
- `references/thread-control/samantha-thread-control-plane.md`
- `references/thread-control/operator-playbook.md`
- `references/thread-control/manual-thread-creation-protocol.md`
- `references/thread-control/linkage-surface-decision.md`
- `references/thread-control/korean-operator-reporting-standard.md`
- `references/thread-control/run-progress-visibility-design.md`
- `references/thread-control/f0-visibility-surface-review.md`
- `references/thread-control/f7-final-git-status-capture-dogfood.md`
- `references/thread-control/g5-evidence-accessibility-review.md`
- `references/thread-control/g7-chief-of-staff-evidence-summary-review.md`

검토한 open-source readiness surface:

- `README.md`
- `references/operations/open-source-artifact-map.md`
- `references/operations/open-source-public-docs-plan.md`
- `references/operations/open-source-governance-package-readiness.md`
- `references/operations/open-source-public-release-checklist.md`
- `references/operations/open-source-release-note-draft.md`

이 감사는 report-only다. README rewrite, `package.json` 변경, governance file
생성, source/tests/examples 변경, references 이동/삭제, package publishing,
thread policy 구현은 수행하지 않았다.

## 요약 판단

Thread-policy landing은 open-source release를 막는 새 기능 요구사항을 만들지는
않는다. 오히려 기존 public positioning을 강화한다.

다만 public release 전에는 thread-control 관련 artifact를 더 명시적으로
dogfood/private 또는 advanced evidence surface로 분류해야 한다. 특히 manual
background thread creation protocol, advisory linkage report, Chief-of-Staff
verified evidence summary는 새 사용자 quickstart에 들어가면 안 된다.

핵심 delta:

- public path 영향: README의 첫 public path는 그대로 `demo:first-run`이어야 한다.
- dogfood/private 영향: `references/thread-control/**`는 first public path에서
  제외하고, advanced dogfood evidence로 분류해야 한다.
- package contents 영향: package tarball 또는 public docs bundle에서
  thread-control references를 기본 포함하면 public maturity message가 흐려질 수
  있다.
- governance/security 영향: `SECURITY`와 `CONTRIBUTING`은 thread id, thread
  summary, background thread evidence, prompt/run-log leakage를 명시할 필요가
  있다.

## Public Path 영향

Thread-policy는 public quickstart를 바꾸지 않는다.

현재 README의 first public path는 적절하다:

```bash
bun run samantha demo:first-run
```

Thread Control Plane은 새 사용자의 첫 실행 경로가 아니다. 기준 문서들은 thread id,
thread summary, `visibilitySummary`, Chief-of-Staff summary를 모두 advisory
navigation으로 제한하고, trusted evidence를 `HARNESS_RESULT`, changed-file scope,
deterministic verification, candidate commit, `final_git_status_captured`, and
lifecycle record에 남긴다.

따라서 public README에 thread-control을 넣는다면 quickstart가 아니라 later
advanced/dogfood note 수준이어야 한다. 현재 README가 remote operation,
background automation, connector/control-plane entrypoints, dashboards, budget
governance, writer parallelism, multi-project orchestration을 첫 public path에서
제외한다고 말하는 방향은 유지해야 한다.

필요한 후속 조정:

- README를 즉시 rewrite할 필요는 없다.
- package/governance implementation 전에 public release checklist에
  `references/thread-control/**` exclusion 또는 advanced labeling을 추가하는
  정도가 충분하다.
- Thread-policy를 public feature로 홍보하지 않는다.

## Dogfood / Private Artifact 영향

기존 artifact map은 thread-control artifacts를 advanced dogfood surface로
분류한다. 이 판단은 thread-policy landing 이후에도 유효하다.

추가로 dogfood/private로 명시해야 하는 surface:

- `references/thread-control/manual-thread-creation-protocol.md`
- `references/thread-control/linkage-surface-decision.md`
- `references/thread-control/korean-operator-reporting-standard.md`
- `references/thread-control/g5-evidence-accessibility-review.md`
- `references/thread-control/g7-chief-of-staff-evidence-summary-review.md`
- manual linkage reports and templates under `references/thread-control/**`

이 문서들은 유용하지만 first public path에 노출되면 Samantha가 background thread
operation 또는 control-plane product를 이미 제공하는 것처럼 보일 수 있다. 현재
정책의 의도는 반대다. Thread state는 navigation/supervision surface이고,
trusted state가 아니다.

Dogfood/private boundary 문구는 다음 invariant를 유지해야 한다.

- thread id는 advisory navigation only다.
- thread summary는 trusted evidence가 아니다.
- Chief-of-Staff summary는 report-only input이지 trusted state가 아니다.
- worker-owned orchestration은 계속 금지된다.
- accept/merge/cleanup/lifecycle authority는 Samantha가 가진다.
- manual linkage report는 run log와 lifecycle evidence를 찾아가기 위한 색인일 뿐
  gate를 대체하지 않는다.

## Package Contents 영향

Package contents boundary에는 thread-control 관련 exclusion 판단이 필요하다.

현재 first release가 clone-plus-`bun run` 중심이면 즉시 package contents를
바꿀 필요는 없다. 하지만 `publishConfig`, `bin`, `files`, package tarball dry-run을
설계할 때는 `references/thread-control/**`를 기본 포함하지 않는 쪽이 더 안전하다.

이유:

- thread-control docs는 public quickstart 문서가 아니다.
- 일부 문서는 manual background thread creation, advisory linkage,
  Chief-of-Staff summary practice를 다룬다.
- package user가 이를 첫 public feature로 오해하면 README의 non-goals와 충돌한다.
- `references/thread-control/**`에는 historical dogfood evidence와 operator-only
  reporting practices가 섞여 있다.

Package readiness에 추가할 gate:

- package tarball에서 `references/thread-control/**` 포함 여부를 명시적으로
  결정한다.
- 포함한다면 `advanced dogfood evidence` label 또는 docs routing이 필요하다.
- 제외한다면 README 또는 package docs는 thread-control artifacts를 required setup
  으로 참조하지 않아야 한다.
- `files` field 또는 equivalent package contents check가 이 결정을 검증해야 한다.

## Governance / Security 영향

Thread-policy는 governance files를 바로 만들 필요를 만들지는 않지만,
`SECURITY`와 `CONTRIBUTING` 내용에는 반영되어야 한다.

### SECURITY 영향

`SECURITY` reporting policy는 다음 유형을 포함해야 한다.

- thread id, thread summary, prompt, run log, lifecycle evidence, worker output
  leakage;
- background thread가 orchestration, merge, cleanup, push, lifecycle, policy,
  doctrine authority를 가진 것처럼 동작하는 문제;
- advisory thread evidence가 trusted state처럼 쓰이는 문제;
- `final_git_status_captured` 또는 lifecycle evidence가 누락/왜곡되어 accept 판단이
  흐려지는 문제;
- manual linkage report가 private run evidence 또는 local path를 노출하는 문제.

### CONTRIBUTING 영향

`CONTRIBUTING`은 thread-control 관련 PR scope를 제한해야 한다.

권장 first-release stance:

- thread-control docs clarification은 받을 수 있다.
- thread API automation, run-log field, JSON schema, CLI exposure, scheduler,
  daemon, UI, MCP, connector, background operation은 first-release contribution
  scope에서 제외한다.
- thread-control을 구현하려면 별도 reviewed initiative와 Samantha self-build gate가
  필요하다고 명시한다.

### CODE_OF_CONDUCT 영향

직접 영향은 작다. 다만 thread summaries, prompts, run logs, private evidence를
issue/discussion에 붙일 때 개인 정보와 민감 정보가 섞일 수 있으므로, feedback
template 또는 contribution docs에서 redaction expectation을 안내하는 편이 좋다.

## Release Checklist 영향

`references/operations/open-source-public-release-checklist.md`는 다음 항목을
추가하는 후속 docs slice가 필요하다.

- Thread-control artifacts are advanced dogfood/private surfaces unless
  explicitly promoted.
- Public quickstart must not require `references/thread-control/**`.
- Package contents must decide whether `references/thread-control/**` is
  excluded or clearly labeled as advanced evidence.
- Security policy must include thread id/summary/run-log leakage and advisory
  evidence misuse.
- Contribution scope must exclude thread API automation and background operation
  from first-release goals.

이 변경은 release checklist에 대한 작은 docs update로 충분하다. README 전체 rewrite
또는 package metadata implementation을 먼저 할 필요는 없다.

## Required Follow-Up Tasks

### 1. Release checklist / artifact map delta update

Type: docs-only

Goal:

- `references/operations/open-source-artifact-map.md`
- `references/operations/open-source-public-release-checklist.md`
- 필요 시 `references/operations/open-source-governance-package-readiness.md`

에 thread-control delta를 반영한다.

Do not include:

- README rewrite
- package metadata changes
- governance files
- source/tests/examples
- references movement/deletion
- package publishing
- thread API automation

### 2. Governance files implementation after BK decisions

Type: docs implementation after BK decisions

Goal:

- `LICENSE`
- `CONTRIBUTING`
- `SECURITY`
- `CODE_OF_CONDUCT`

를 BK 결정에 따라 작성한다.

Thread-policy-specific requirements:

- `SECURITY` includes thread id/summary/run-log leakage and advisory evidence
  misuse.
- `CONTRIBUTING` excludes thread API automation/background operation from
  first-release scope unless a reviewed initiative exists.

### 3. Package metadata / package contents implementation after governance

Type: package/docs implementation

Goal:

- `package.json` public metadata
- `private: true` removal only when approved
- `publishConfig`, `bin`, `files`
- package contents dry-run

Thread-policy-specific requirements:

- decide whether `references/thread-control/**` ships;
- if it ships, label as advanced dogfood evidence;
- if it does not ship, ensure README/package docs do not require it.

## Recommended Next Prompt

```text
sam c: thread-policy delta를 open-source artifact map과 release checklist에 반영해주세요.
Context: 기준 delta audit은 references/operations/open-source-thread-policy-delta-audit.md 입니다. Thread-policy accepted commit은 45197c6c4be3e17f258ac2f8c26522aa494552f7 입니다. Governance/package readiness는 references/operations/open-source-governance-package-readiness.md 입니다.
Ask: thread-control artifacts를 advanced dogfood/private surface로 명확히 분류하고, package contents / SECURITY / CONTRIBUTING gate를 release checklist와 artifact map에 반영해주세요.
Scope: docs-only 입니다. 허용 대상은 references/operations/open-source-artifact-map.md, references/operations/open-source-public-release-checklist.md, references/operations/open-source-governance-package-readiness.md 입니다. README rewrite, package.json 변경, governance files 생성, source/tests/examples 변경, references 이동/삭제, package publishing, thread policy 구현은 하지 않습니다.
Output: task spec path 또는 direct docs update evidence, 변경 파일 목록, 검증 결과, 다음 governance implementation prompt를 한국어로 보고해주세요.
Stop: README rewrite, package metadata, governance files, package contents dry-run, thread API automation이 필요하면 멈추고 별도 task로 분리하세요.
```

## 결론

Thread-policy는 open-source public path를 확장하지 않는다. First public path는
계속 `demo:first-run`이다.

Open-source readiness는 재개할 수 있지만, 다음 구현으로 바로
`LICENSE`/`package.json`에 들어가기 전에 thread-control delta를 artifact map,
release checklist, governance/package readiness 문서에 반영하는 작은 docs-only
slice를 먼저 수행하는 것이 안전하다.
