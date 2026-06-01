<div align="center">

[English](README.md) | 한국어

<img src="docs/assets/samantha-header.png" alt="Call From Samantha" width="100%" />

# Samantha Harness

[![npm](https://img.shields.io/npm/v/%40lbk0523%2Fsamantha?label=npm)](https://www.npmjs.com/package/@lbk0523/samantha) [![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![runtime: Bun](https://img.shields.io/badge/runtime-Bun-black.svg)](https://bun.sh)

[설치](#설치) · [왜 Samantha인가](#왜-samantha인가) · [신뢰 루프](#신뢰-루프) · [첫 실행](#첫-실행) · [프로젝트 상태](#프로젝트-상태) · [더 읽기](#더-읽기)

***"Samantha는 에이전트가 만든 작업을 받아들여도 되는지 판단하는 로컬 개발 하네스입니다."***

***"에이전트가 완료했다고 말했다는 이유만으로 그 출력이 신뢰 가능한 작업이 되면 안 됩니다."***

***"Samantha는 또 다른 자율 코딩 에이전트가 아닙니다. 코딩 에이전트를 둘러싼 신뢰 루프입니다."***

Samantha는 에이전트 작업을 범위가 정해진 작업, 격리된 실행, 결정적 검증, 검토 가능한 증거로 바꿉니다.

</div>

## 설치

npm에서 CLI를 설치합니다:

```bash
npm install -g @lbk0523/samantha
```

일회용 데모 저장소에서 첫 실행 검사를 실행합니다:

```bash
samantha demo:first-run
```

첫 실행 검사는 `.samantha-demo/` 아래의 일회용 fixture repository를 사용합니다.
실제 프로젝트를 수정하지 않습니다.

CLI를 설치하지 않고도 실행할 수 있습니다:

```bash
bunx @lbk0523/samantha demo:first-run
```

소스에서 개발할 때는 다음을 실행합니다:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

Samantha는 Bun-first입니다. 현재 `npx`, `npm exec`, 또는 일반 Node CLI 지원을
공식 지원으로 내세우지 않습니다.

## 왜 Samantha인가

코딩 에이전트는 유용하지만, 에이전트의 최종 메시지는 증거가 아닙니다. worker는
테스트가 통과했다고, 범위를 지켰다고, 변경사항을 merge해도 된다고 말할 수
있지만, 그런 주장은 worker의 판단 밖에서 다시 확인되어야 합니다.

Samantha는 이 경계를 분명히 둡니다:

- 실행 전에 작업 범위를 정합니다.
- writer 변경은 격리된 worktree에서 일어납니다.
- 변경된 파일, 금지 경로, worker 출력, 검증 결과를 증거로 기록합니다.
- 결과를 받아들일지 거절할지는 worker 밖에서 결정합니다.

목표는 에이전트를 더 독립적으로 만드는 데 있지 않습니다. 에이전트 작업을 더 쉽게
검사하고, 신뢰하고, 거절하고, 개선할 수 있게 만드는 데 있습니다.

## 신뢰 루프

```text
최소 사용자 목표
-> task spec
-> 격리된 worker worktree
-> HARNESS_RESULT를 포함한 worker 출력
-> 결정적 검증
-> run log와 candidate commit 증거
-> accept 또는 reject 결정
```

worker가 완료했다고 말하는 것만으로 worker 출력이 신뢰 가능한 작업이 되지는
않습니다. Samantha는 무엇이 바뀌었는지, worker가 범위 안에 머물렀는지, 검증이
통과했는지, 증거가 어디에 남았는지를 기록합니다.

## 첫 실행

첫 실행 명령은 설치 확인이자 신뢰 루프를 짧게 확인하는 경로입니다:

```bash
samantha demo:first-run
```

전체 흐름은 [First Run Guide](docs/first-run.md)를 참고하세요.

## 프로젝트 상태

Samantha의 첫 공개 경로는 의도적으로 작습니다. CLI를 설치하고, 로컬 첫 실행
검사를 실행하고, 하네스가 만든 증거를 검사하는 것이 현재 공개 경로입니다.

원격 운영, 백그라운드 자동화, 대시보드, connector control plane, budget
governance, writer parallelism, multi-project orchestration은 첫 공개 경로에
포함되지 않습니다. 이런 영역은 제품 표면이 되기 전에 명시적인 권한 경계와
검증을 먼저 갖춰야 합니다.

## 더 읽기

- [First Run Guide](docs/first-run.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
