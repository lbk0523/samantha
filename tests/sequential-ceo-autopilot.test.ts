import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import type {
  SequentialContinuationActionType,
  SequentialContinuationArtifact,
  SequentialContinuationRunAcceptCandidate,
  SequentialContinuationRunAcceptExecution,
  SequentialContinuationRunTaskCandidate,
  SequentialContinuationRunTaskExecution,
  SequentialContinuationStatusEvidenceDocument,
} from "../src/core/sequential-ceo-autopilot";
import {
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
  SEQUENTIAL_CONTINUATION_SLICE_STATUSES,
  buildSequentialContinuationLoop,
  buildSequentialContinuationNextArtifactReport,
  buildSequentialContinuationRunAcceptExecutionReport,
  buildSequentialContinuationRunAcceptPreflightReport,
  buildSequentialContinuationRunTaskExecutionReport,
  buildSequentialContinuationRunTaskPreflightReport,
  buildSequentialContinuationSingleStep,
  buildSequentialContinuationStatusUpdate,
  buildSequentialContinuationReport,
  validateSequentialContinuationArtifact,
  validateSequentialContinuationStatusEvidence,
} from "../src/core/sequential-ceo-autopilot";
import type { RunAcceptResult } from "../src/core/run-accept";
import type { WorkerRunLog } from "../src/core/run-log";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

function artifact(overrides: Partial<SequentialContinuationArtifact> = {}): SequentialContinuationArtifact {
  return {
    schemaVersion: 1,
    artifactId: "sequential-ceo-autopilot-s2",
    initiativePath: "references/initiatives/sequential-ceo-autopilot.md",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    currentSlice: {
      id: "S2",
      status: "ready",
      actionType: "run_task",
      dependencyStatus: "met",
      prerequisites: ["S1 completed"],
      targetFiles: ["src/core/sequential-ceo-autopilot.ts", "tests/sequential-ceo-autopilot.test.ts"],
      forbiddenChanges: ["src/cli.ts", "src/core/policy.ts", "references/playbooks/**"],
      verifyCommands: ["bun test tests/sequential-ceo-autopilot.test.ts", "bun run typecheck"],
    },
    autonomyEnvelope: {
      canSelectNextReadySlice: true,
      canRunReadinessChecks: true,
      canRunReportOnlyActions: true,
      canRunExplicitTaskSpecs: true,
      canRunRoutineBatchActions: true,
      canUpdateContinuationStatus: true,
      canLocallyCommitThroughExistingGates: true,
      pushAllowed: false,
      maxFailedEvidenceReworkCycles: 1,
    },
    stopConditionChecklist: SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS.map((id) => ({
      id,
      active: false,
      evidence: `${id} checked`,
    })),
    evidenceReferences: [
      {
        path: "references/playbooks/sequential-ceo-autopilot.md",
        summary: "Defines the continuation artifact contract and conservative action vocabulary.",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S2",
    },
    ...overrides,
  };
}

function runTaskTaskSpec(overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    id: "s12-run-task-preflight",
    title: "Implement S12 run_task preflight",
    targetAgent: "codex-worker",
    targetFiles: ["src/core/sequential-ceo-autopilot.ts", "tests/sequential-ceo-autopilot.test.ts"],
    forbiddenChanges: ["runs/**", "worktrees/**"],
    verifyCommands: ["bun test tests/sequential-ceo-autopilot.test.ts", "bun run typecheck"],
    instructions: "Implement deterministic preflight reporting without executing run_task.",
    status: "pending",
    ...overrides,
  };
}

function runTaskCandidate(
  taskSpecCommit: string,
  overrides: Partial<SequentialContinuationRunTaskCandidate> = {},
): SequentialContinuationRunTaskCandidate {
  const task = runTaskTaskSpec();
  return {
    taskSpecPath: "references/tasks/s12-run-task-preflight.json",
    requiredRuntime: "codex-sdk",
    executionMode: "preflight_only",
    worktreePolicy: "samantha_allocated_isolated",
    lifecycleOwner: "samantha",
    targetFiles: task.targetFiles,
    forbiddenChanges: task.forbiddenChanges,
    verifyCommands: task.verifyCommands,
    evidence: {
      taskSpecCommit,
      taskSpecStatus: "committed_clean",
      freshnessEvidencePath: "references/operations/s11-run-task-preflight-report.md",
    },
    expectedSideEffects: {
      runTaskCalled: false,
      workersDispatched: false,
      worktreesCreated: false,
      lifecycleMutated: false,
      mergePerformed: false,
      cleanupPerformed: false,
      commitPerformed: false,
      pushPerformed: false,
    },
    ...overrides,
  };
}

function runTaskExecution(
  overrides: Partial<SequentialContinuationRunTaskExecution> = {},
): SequentialContinuationRunTaskExecution {
  const task = runTaskTaskSpec();
  return {
    taskSpecPath: "references/tasks/s12-run-task-preflight.json",
    requiredRuntime: "codex-sdk",
    executionMode: "single_run_task",
    worktreePolicy: "samantha_allocated_isolated",
    lifecycleOwner: "samantha",
    targetFiles: task.targetFiles,
    forbiddenChanges: task.forbiddenChanges,
    verifyCommands: task.verifyCommands,
    pushAllowed: false,
    expectedSideEffects: {
      runTaskCalled: true,
      workersDispatched: true,
      worktreesCreated: true,
      runsCreated: true,
      deterministicVerification: true,
      batchesExecuteCalled: false,
      acceptPerformed: false,
      lifecycleMutated: false,
      mergePerformed: false,
      cleanupPerformed: false,
      commitPerformed: false,
      pushPerformed: false,
      multiStepLoopStarted: false,
      successorExecuted: false,
    },
    ...overrides,
  };
}

function runAcceptExpectedSideEffects() {
  return {
    runsAcceptCalled: false,
    mergeGateRecorded: false,
    mergePerformed: false,
    lifecycleMutated: false,
    cleanupPerformed: false,
    commitPerformed: false,
    pushPerformed: false,
    runTaskCalled: false,
    workersDispatched: false,
    batchesExecuteCalled: false,
    multiStepLoopStarted: false,
    successorExecuted: false,
  } as const;
}

function runAcceptCandidate(
  input: {
    baseCommit: string;
    workerCommit: string;
  },
  overrides: Partial<SequentialContinuationRunAcceptCandidate> = {},
): SequentialContinuationRunAcceptCandidate {
  return {
    runLogPath: "runs/accept-run.json",
    expectedRunId: "accept-run",
    expectedTaskId: "accept-fixture",
    expectedCommit: input.workerCommit,
    expectedBaseCommit: input.baseCommit,
    targetBranch: "main",
    requiredRuntime: "codex-sdk",
    executionMode: "accept_preflight_only",
    lifecycleOwner: "samantha",
    pushAllowed: false,
    expectedSideEffects: runAcceptExpectedSideEffects(),
    ...overrides,
  };
}

function runAcceptExecution(
  input: {
    baseCommit: string;
    workerCommit: string;
  },
  overrides: Partial<SequentialContinuationRunAcceptExecution> = {},
): SequentialContinuationRunAcceptExecution {
  return {
    runLogPath: "runs/accept-run.json",
    expectedRunId: "accept-run",
    expectedTaskId: "accept-fixture",
    expectedCommit: input.workerCommit,
    expectedBaseCommit: input.baseCommit,
    targetBranch: "main",
    requiredRuntime: "codex-sdk",
    executionMode: "single_run_accept",
    lifecycleOwner: "samantha",
    targetFiles: ["allowed.txt"],
    forbiddenChanges: ["runs/**", "worktrees/**"],
    verifyCommands: ["grep -q changed allowed.txt"],
    pushAllowed: false,
    expectedSideEffects: {
      runsAcceptCalled: true,
      mergeGateRecorded: true,
      mergePerformed: true,
      lifecycleMutated: true,
      cleanupPerformed: true,
      commitPerformed: false,
      pushPerformed: false,
      runTaskCalled: false,
      workersDispatched: false,
      batchesExecuteCalled: false,
      multiStepLoopStarted: false,
      successorExecuted: false,
    },
    ...overrides,
  };
}

function acceptedRunAcceptResult(input: {
  root: string;
  runLogPath: string;
  worktreePath: string;
  workerCommit: string;
}): RunAcceptResult {
  const lifecycle = {
    schemaVersion: 1 as const,
    runId: "accept-run",
    taskId: "accept-fixture",
    repoRoot: input.root,
    runLogPath: input.runLogPath,
    commit: input.workerCommit,
    mergedAt: "2026-05-20T00:02:00.000Z",
    cleanedAt: "2026-05-20T00:03:00.000Z",
    updatedAt: "2026-05-20T00:03:00.000Z",
  };
  return {
    accepted: true,
    status: "accepted",
    gate: {
      mayMerge: true,
      alreadyMerged: false,
      status: "mergeable",
      targetBranch: "main",
      commit: input.workerCommit,
      command: ["git", "merge", "--ff-only", input.workerCommit],
      violations: [],
    },
    merge: {
      command: ["git", "merge", "--ff-only", input.workerCommit],
      exitCode: 0,
      stdout: "",
      stderr: "",
    },
    lifecycle: {
      merged: lifecycle,
      cleaned: lifecycle,
    },
    cleanup: {
      mayCleanup: true,
      cleaned: true,
      classification: "completed",
      targetBranch: "main",
      worktreePath: input.worktreePath,
      branch: "samantha/accept-fixture",
      commit: input.workerCommit,
      violations: [],
    },
    lessonDraft: {
      status: "created",
      reason: "existing runs:accept lesson draft output",
      path: `${input.root}/references/lessons/inbox/accept-run.md`,
      runId: "accept-run",
    },
  };
}

async function writeRunAcceptPreflightFixture(overrides: {
  artifact?: Partial<SequentialContinuationArtifact>;
  candidate?: Partial<SequentialContinuationRunAcceptCandidate>;
  runLog?: (log: WorkerRunLog) => WorkerRunLog;
} = {}): Promise<{
  root: string;
  artifactPath: string;
  runLogPath: string;
  worktreePath: string;
  baseCommit: string;
  workerCommit: string;
  continuation: SequentialContinuationArtifact;
  runLog: WorkerRunLog;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-run-accept-preflight-"));
  tmpRoots.push(root);
  await git(["init", "-b", "main"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".gitignore"), "runs/\nworktrees/\n", "utf8");
  await writeFile(join(root, "allowed.txt"), "base\n", "utf8");
  await git(["add", ".gitignore", "allowed.txt"], root);
  await git(["commit", "-m", "chore: initial run accept fixture"], root);
  const baseCommit = await gitHead(root);

  await mkdir(join(root, "worktrees"), { recursive: true });
  const worktreePath = join(root, "worktrees", "accept-fixture");
  await git(["worktree", "add", "-b", "samantha/accept-fixture", worktreePath, "main"], root);
  await git(["config", "user.email", "samantha@example.local"], worktreePath);
  await git(["config", "user.name", "Samantha Test"], worktreePath);
  await writeFile(join(worktreePath, "allowed.txt"), "changed\n", "utf8");
  await git(["add", "allowed.txt"], worktreePath);
  await git(["commit", "-m", "feat: worker accept fixture"], worktreePath);
  const workerCommit = await gitHead(worktreePath);

  await mkdir(join(root, "runs"), { recursive: true });
  await mkdir(join(root, "references", "operations"), { recursive: true });
  const runLogPath = join(root, "runs", "accept-run.json");
  const artifactPath = join(root, "references", "operations", "s18-run-accept-preflight.json");
  const baseRunLog: WorkerRunLog = {
    schemaVersion: 1,
    runId: "accept-run",
    startedAt: "2026-05-20T00:00:00.000Z",
    finishedAt: "2026-05-20T00:01:00.000Z",
    task: {
      id: "accept-fixture",
      title: "Accept fixture",
      targetAgent: "codex-worker",
      targetFiles: ["allowed.txt"],
      forbiddenChanges: ["runs/**", "worktrees/**"],
      verifyCommands: ["grep -q changed allowed.txt"],
      instructions: "Change allowed.txt.",
      status: "pending",
    },
    agent: {
      id: "codex-worker",
      role: "writer",
      model: "gpt-5.5",
      writerClass: "writer",
      worktreePolicy: "per-task",
      mergePolicy: "samantha-controlled",
      skillPolicy: {
        requiredBundles: [],
        blockedSkills: [],
      },
    },
    input: { repoRoot: root, worktreesDir: join(root, "worktrees") },
    result: {
      preparation: {
        taskId: "accept-fixture",
        agentId: "codex-worker",
        worktreePath,
        allocation: {
          taskId: "accept-fixture",
          repoRoot: root,
          worktreePath,
          branch: "samantha/accept-fixture",
          baseCommit,
        },
        codex: { prompt: "prompt", command: ["codex", "exec"] },
      },
      setupResults: [],
      command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
      runtime: { kind: "codex-sdk", approvalPolicy: "never" },
      evaluation: {
        pass: true,
        harness: { status: "pass", note: "ok", commit: "" },
        changedFiles: ["allowed.txt"],
        scopeViolations: [],
        verifyResults: [{ command: "grep -q changed allowed.txt", exitCode: 0, stdout: "", stderr: "" }],
      },
      commit: {
        subject: "feat: worker accept fixture",
        files: ["allowed.txt"],
        add: { command: ["git", "add", "--", "allowed.txt"], exitCode: 0, stdout: "", stderr: "" },
        commit: { command: ["git", "commit", "-m", "feat: worker accept fixture"], exitCode: 0, stdout: "", stderr: "" },
        commitHash: workerCommit,
      },
      pass: true,
    },
  };
  const runLog: WorkerRunLog = overrides.runLog?.(baseRunLog) ?? baseRunLog;
  await writeFile(runLogPath, `${JSON.stringify(runLog, null, 2)}\n`, "utf8");
  const continuation = artifact({
    artifactId: "sequential-ceo-autopilot-s18",
    currentSlice: {
      id: "S18",
      status: "ready",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S17 completed"],
      targetFiles: runLog.task.targetFiles,
      forbiddenChanges: runLog.task.forbiddenChanges,
      verifyCommands: runLog.task.verifyCommands,
    },
    runAcceptCandidate: runAcceptCandidate({ baseCommit, workerCommit }, overrides.candidate),
    ...overrides.artifact,
  });
  await writeFile(artifactPath, `${JSON.stringify(continuation, null, 2)}\n`, "utf8");
  return { root, artifactPath, runLogPath, worktreePath, baseCommit, workerCommit, continuation, runLog };
}

async function writeRunTaskPreflightFixture(overrides: {
  artifact?: Partial<SequentialContinuationArtifact>;
  candidate?: Partial<SequentialContinuationRunTaskCandidate>;
  taskSpec?: Partial<TaskSpec>;
  commitTaskSpec?: boolean;
} = {}): Promise<{
  root: string;
  artifactPath: string;
  taskSpecPath: string;
  taskSpec: TaskSpec;
  taskSpecCommit: string;
  continuation: SequentialContinuationArtifact;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-run-task-preflight-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  await mkdir(join(root, "references", "operations"), { recursive: true });
  const taskSpecPath = join(root, "references", "tasks", "s12-run-task-preflight.json");
  const artifactPath = join(root, "references", "operations", "s12-continuation.json");
  const taskSpec = runTaskTaskSpec(overrides.taskSpec);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await writeFile(taskSpecPath, `${JSON.stringify(taskSpec, null, 2)}\n`, "utf8");
  await git(["add", ".fixture"], root);
  if (overrides.commitTaskSpec !== false) {
    await git(["add", "references/tasks/s12-run-task-preflight.json"], root);
  }
  await git(["commit", "-m", "chore: initial run task preflight fixture"], root);
  const taskSpecCommit = await gitHead(root);
  const candidate = runTaskCandidate(taskSpecCommit, overrides.candidate);
  const continuation = artifact({
    artifactId: "sequential-ceo-autopilot-s12",
    currentSlice: {
      id: "S12",
      status: "ready",
      actionType: "run_task",
      dependencyStatus: "met",
      prerequisites: ["S11 completed"],
      targetFiles: taskSpec.targetFiles,
      forbiddenChanges: taskSpec.forbiddenChanges,
      verifyCommands: taskSpec.verifyCommands,
    },
    runTaskCandidate: candidate,
    ...overrides.artifact,
  });
  await writeFile(artifactPath, `${JSON.stringify(continuation, null, 2)}\n`, "utf8");
  return { root, artifactPath, taskSpecPath, taskSpec, taskSpecCommit, continuation };
}

async function writeNextArtifactFixture(
  overrides: {
    predecessor?: Partial<SequentialContinuationArtifact>;
    successor?: Partial<SequentialContinuationArtifact>;
    successorEvidencePath?: string;
  } = {},
): Promise<{
  root: string;
  predecessorPath: string;
  successorPath: string;
  predecessor: SequentialContinuationArtifact;
  successor: SequentialContinuationArtifact;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-"));
  tmpRoots.push(root);
  const operationsDir = join(root, "references", "operations");
  await mkdir(operationsDir, { recursive: true });
  const predecessorPath = join(operationsDir, "s9.json");
  const successorPath = join(operationsDir, "s10.json");
  const predecessor = artifact({
    artifactId: "sequential-ceo-autopilot-s9",
    currentSlice: {
      ...artifact().currentSlice,
      id: "S9",
      status: "completed",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S8 completed"],
    },
    nextArtifactPath: "references/operations/s10.json",
    nextArtifactExpectedSliceId: "S10",
    ...overrides.predecessor,
  });
  const successor = artifact({
    artifactId: "sequential-ceo-autopilot-s10",
    currentSlice: {
      ...artifact().currentSlice,
      id: "S10",
      status: "ready",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S9 completed"],
    },
    evidenceReferences: [
      {
        path: overrides.successorEvidencePath ?? "references/operations/s9.json",
        summary: "S10 cites the predecessor continuation artifact.",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S10",
    },
    ...overrides.successor,
  });
  await writeFile(predecessorPath, `${JSON.stringify(predecessor, null, 2)}\n`, "utf8");
  await writeFile(successorPath, `${JSON.stringify(successor, null, 2)}\n`, "utf8");
  return { root, predecessorPath, successorPath, predecessor, successor };
}

function statusEvidence(
  overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
): SequentialContinuationStatusEvidenceDocument {
  return {
    schemaVersion: 1,
    currentSliceId: "S2",
    outcome: "completed",
    updatedAt: "2026-05-19T01:00:00.000Z",
    evidenceReferences: [
      {
        kind: "run_log",
        path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
        summary: "S2 worker run completed with passing deterministic verification.",
        result: "passed",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
    },
    ...overrides,
  };
}

describe("Sequential CEO Autopilot continuation artifact validation", () => {
  test("accepts a valid current-slice continuation artifact", () => {
    expect(validateSequentialContinuationArtifact(artifact())).toEqual([]);
  });

  test("accepts optional next artifact linkage fields in the closed schema", () => {
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          nextArtifactPath: "references/operations/sequential-ceo-autopilot-s10.json",
          nextArtifactExpectedSliceId: "S10",
        }),
      ),
    ).toEqual([]);
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          nextArtifactPath: null,
          nextArtifactExpectedSliceId: null,
        }),
      ),
    ).toEqual([]);
  });

  test("accepts optional runTaskCandidate as null or closed object", () => {
    expect(validateSequentialContinuationArtifact(artifact({ runTaskCandidate: null }))).toEqual([]);
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          runTaskCandidate: runTaskCandidate("abc123"),
        }),
      ),
    ).toEqual([]);
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        runTaskCandidate: {
          ...runTaskCandidate("abc123"),
          command: "bun run samantha run-task references/tasks/s12.json",
        },
      }),
    ).toContain("unknown runTaskCandidate field: command");
  });

  test("accepts optional runTaskExecution as null or closed object", () => {
    expect(validateSequentialContinuationArtifact(artifact({ runTaskExecution: null }))).toEqual([]);
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          runTaskExecution: runTaskExecution(),
        }),
      ),
    ).toEqual([]);
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        runTaskExecution: [runTaskExecution()],
      }),
    ).toContain("runTaskExecution must be a single object or null when present");
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        runTaskExecution: {
          ...runTaskExecution(),
          command: "bun run samantha run-task references/tasks/s12.json",
        },
      }),
    ).toContain("unknown runTaskExecution field: command");
  });

  test("accepts optional runAcceptCandidate and runAcceptExecution as null or closed objects", () => {
    const baseCommit = "a".repeat(40);
    const workerCommit = "b".repeat(40);
    expect(validateSequentialContinuationArtifact(artifact({ runAcceptCandidate: null }))).toEqual([]);
    expect(validateSequentialContinuationArtifact(artifact({ runAcceptExecution: null }))).toEqual([]);
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          currentSlice: {
            ...artifact().currentSlice,
            actionType: "report_only",
          },
          runAcceptCandidate: runAcceptCandidate({ baseCommit, workerCommit }),
          runAcceptExecution: runAcceptExecution({ baseCommit, workerCommit }),
        }),
      ),
    ).toEqual([]);
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "report_only",
        },
        runAcceptCandidate: {
          ...runAcceptCandidate({ baseCommit, workerCommit }),
          command: "bun run samantha continuation:show runs/run.json",
        },
      }),
    ).toContain("unknown runAcceptCandidate field: command");
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "report_only",
        },
        runAcceptExecution: {
          ...runAcceptExecution({ baseCommit, workerCommit }),
          command: "bun run samantha runs:accept",
        },
      }),
    ).toContain("unknown runAcceptExecution field: command");
  });

  test("builds a deterministic accepted report for the current slice", () => {
    expect(
      buildSequentialContinuationReport({
        artifactPath: "/repo/references/continuation/s3.json",
        artifact: artifact({
          currentSlice: {
            ...artifact().currentSlice,
            id: "S3",
            status: "ready",
            actionType: "report_only",
          },
          nextStep: {
            kind: "samantha_command",
            value: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
          },
        }),
      }),
    ).toEqual({
      artifactPath: "/repo/references/continuation/s3.json",
      status: "accepted",
      violations: [],
      currentSlice: {
        id: "S3",
        status: "ready",
        actionType: "report_only",
        dependencyStatus: "met",
      },
      activeStopConditions: [],
      blockingReasons: [],
      allowedActionType: "report_only",
      exactNextSamanthaCommand: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
      blockedReportText: null,
      trustedStateChanges: false,
      pushPerformed: false,
    });
  });

  test("reports active stop conditions and blocked handoff text without rejecting valid structure", () => {
    const stopConditionChecklist = artifact().stopConditionChecklist.map((check) =>
      check.id === "decision_required"
        ? {
            ...check,
            active: true,
            evidence: "BK must choose the next product boundary.",
          }
        : check,
    );

    const report = buildSequentialContinuationReport({
      artifactPath: "/repo/references/continuation/blocked.json",
      artifact: artifact({
        currentSlice: {
          ...artifact().currentSlice,
          dependencyStatus: "blocked",
          actionType: "manual_decision",
        },
        stopConditionChecklist,
        nextStep: {
          kind: "blocked_report",
          value: "Blocked until BK chooses the next product boundary.",
        },
      }),
    });

    expect(report.status).toBe("accepted");
    expect(report.allowedActionType).toBe("manual_decision");
    expect(report.activeStopConditions).toEqual([
      {
        id: "decision_required",
        evidence: "BK must choose the next product boundary.",
      },
    ]);
    expect(report.blockedReportText).toBe("Blocked until BK chooses the next product boundary.");
    expect(report.blockingReasons).toEqual([
      "decision_required: BK must choose the next product boundary.",
      "currentSlice.dependencyStatus is blocked",
      "Blocked until BK chooses the next product boundary.",
    ]);
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
  });

  test("builds a rejected report without granting an allowed action type", () => {
    const report = buildSequentialContinuationReport({
      artifactPath: "/repo/references/continuation/unsafe.json",
      artifact: artifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
    });

    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.allowedActionType).toBeNull();
    expect(report.blockingReasons).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
  });

  test("rejects raw prose instead of inferring continuation authority", () => {
    expect(validateSequentialContinuationArtifact("S2 is ready; continue automatically")).toEqual([
      "sequential continuation artifact must be an object",
    ]);
  });

  test("rejects unsafe action types outside the conservative vocabulary", () => {
    const violations = validateSequentialContinuationArtifact(
      artifact({
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "auto_continue" as SequentialContinuationActionType,
        },
      }),
    );

    expect(violations).toContain(
      "currentSlice.actionType must be manual_decision, report_only, readiness_check, run_task, or batch_plan: auto_continue",
    );
  });

  test("requires a non-empty stop-condition checklist", () => {
    expect(validateSequentialContinuationArtifact(artifact({ stopConditionChecklist: [] }))).toContain(
      "stopConditionChecklist must be a non-empty array",
    );

    const missingChecklist = artifact() as unknown as Record<string, unknown>;
    delete missingChecklist.stopConditionChecklist;

    expect(validateSequentialContinuationArtifact(missingChecklist)).toContain(
      "stopConditionChecklist must be a non-empty array",
    );
  });

  test("requires the closed stop-condition checklist ids", () => {
    const missingDecision = artifact().stopConditionChecklist.filter((check) => check.id !== "decision_required");

    expect(validateSequentialContinuationArtifact(artifact({ stopConditionChecklist: missingDecision }))).toContain(
      "stopConditionChecklist must include decision_required",
    );
  });

  test("rejects push authority and changed failed-evidence rework cycles", () => {
    const violations = validateSequentialContinuationArtifact(
      artifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
          maxFailedEvidenceReworkCycles: 2 as 1,
        },
      }),
    );

    expect(violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(violations).toContain("autonomyEnvelope.maxFailedEvidenceReworkCycles must be 1");
  });

  test("rejects hidden-memory and secret-like fields", () => {
    for (const field of ["hiddenMemory", "secretToken", "apiKey", "credentials"]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          [field]: "not allowed",
        }),
      ).toContain(`${field} field is not allowed in a sequential continuation artifact`);
    }
  });

  test("rejects daemon, watch, remote, dashboard, and routine trigger fields", () => {
    for (const field of ["daemon", "watchMode", "remoteAdapter", "dashboard", "routineTrigger"]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          nextStep: {
            ...artifact().nextStep,
            [field]: "not allowed",
          },
        }),
      ).toContain(`nextStep.${field} field is not allowed in a sequential continuation artifact`);
    }
  });

  test("rejects unknown top-level and nested fields", () => {
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        lifecycle: {},
      }),
    ).toContain("unknown top-level field: lifecycle");

    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        currentSlice: {
          ...artifact().currentSlice,
          dispatchWorker: true,
        },
      }),
    ).toContain("unknown currentSlice field: dispatchWorker");
  });

  test("rejects lifecycle-authorizing wording in artifact strings", () => {
    for (const value of [
      "accept run after verification",
      "merge the branch",
      "cleanup worktree",
      "commit the result",
      "push upstream",
      "mutate lifecycle state",
      "create task for S3",
      "dispatch worker now",
      "automatic continuation may proceed",
    ]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          nextStep: {
            kind: "samantha_command",
            value,
          },
        }),
      ).toContain(`nextStep.value must not authorize lifecycle action: ${value}`);
    }
  });

  test("requires write-capable actions to declare target files, forbidden changes, and verify commands", () => {
    for (const actionType of ["run_task", "batch_plan"] as const) {
      const currentSlice = artifact().currentSlice as unknown as Record<string, unknown>;
      currentSlice.actionType = actionType;
      delete currentSlice.targetFiles;
      delete currentSlice.forbiddenChanges;
      delete currentSlice.verifyCommands;

      const violations = validateSequentialContinuationArtifact(
        artifact({
          currentSlice: currentSlice as unknown as SequentialContinuationArtifact["currentSlice"],
        }),
      );

      expect(violations).toContain(`currentSlice.targetFiles must be a non-empty string array for ${actionType}`);
      expect(violations).toContain(`currentSlice.forbiddenChanges must be a non-empty string array for ${actionType}`);
      expect(violations).toContain(`currentSlice.verifyCommands must be a non-empty string array for ${actionType}`);
    }
  });

  test("allows non-write action types without write-scope fields", () => {
    for (const actionType of ["manual_decision", "report_only", "readiness_check"] as const) {
      const currentSlice = artifact().currentSlice as unknown as Record<string, unknown>;
      currentSlice.actionType = actionType;
      delete currentSlice.targetFiles;
      delete currentSlice.forbiddenChanges;
      delete currentSlice.verifyCommands;

      expect(
        validateSequentialContinuationArtifact(
          artifact({
            currentSlice: currentSlice as unknown as SequentialContinuationArtifact["currentSlice"],
          }),
        ),
      ).toEqual([]);
    }
  });
});

describe("Sequential CEO Autopilot next-artifact linkage report", () => {
  test("accepts a local repo-relative nextArtifactPath without executing the successor", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture();

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("accepted");
    expect(report.nextArtifactPath).toBe("references/operations/s10.json");
    expect(report.normalizedNextArtifactPath).toBe("references/operations/s10.json");
    expect(report.nextArtifactExpectedSliceId).toBe("S10");
    expect(report.successor).toMatchObject({
      artifactPath: "references/operations/s10.json",
      currentSliceId: "S10",
      initiativePath: "references/initiatives/sequential-ceo-autopilot.md",
      actionType: "report_only",
    });
    expect(report.blockingReasons).toEqual([]);
    expect(report.trustedStateChanges).toBe(false);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      pushPerformed: false,
    });
  });

  test("rejects prose, command strings, URLs, off-repo paths, traversal, env expansion, globs, and empty strings", () => {
    const cases: Array<{ value: string; reason: string }> = [
      {
        value: "Continue with S10 next",
        reason: "nextArtifactPath must be a normalized repo-relative local .json path: Continue with S10 next",
      },
      {
        value: "sam c: continue S10",
        reason: "nextArtifactPath must not be a command string: sam c: continue S10",
      },
      {
        value: "bun run samantha continuation:show",
        reason: "nextArtifactPath must not be a command string: bun run samantha continuation:show",
      },
      {
        value: "https://example.com/s10.json",
        reason: "nextArtifactPath must not be a URL: https://example.com/s10.json",
      },
      {
        value: "/tmp/s10.json",
        reason: "nextArtifactPath must be repo-relative and stay inside repoRoot: /tmp/s10.json",
      },
      {
        value: "../references/operations/s10.json",
        reason: "nextArtifactPath must be repo-relative and stay inside repoRoot: ../references/operations/s10.json",
      },
      {
        value: "$ROOT/references/operations/s10.json",
        reason: "nextArtifactPath must not use environment expansion: $ROOT/references/operations/s10.json",
      },
      {
        value: "references/operations/*.json",
        reason: "nextArtifactPath must not be glob-like: references/operations/*.json",
      },
      {
        value: "",
        reason: "nextArtifactPath must be a non-empty repo-relative .json path or null",
      },
    ];

    for (const { value, reason } of cases) {
      expect(validateSequentialContinuationArtifact(artifact({ nextArtifactPath: value }))).toContain(reason);
    }
  });

  test("blocks a present nextArtifactPath when the file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-missing-"));
    tmpRoots.push(root);
    const predecessor = artifact({
      nextArtifactPath: "references/operations/missing.json",
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: join(root, "references", "operations", "s9.json"),
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      `nextArtifactPath file not found: ${join(root, "references", "operations", "missing.json")}`,
    ]);
  });

  test("blocks non-string nextArtifactPath as an invalid predecessor before successor inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-malformed-"));
    tmpRoots.push(root);
    const predecessor = {
      ...artifact({
        nextArtifactExpectedSliceId: "S10",
      }),
      nextArtifactPath: ["references/operations/s10.json"],
    };

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: join(root, "references", "operations", "s9.json"),
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.nextArtifactPath).toBeNull();
    expect(report.nextArtifactExpectedSliceId).toBeNull();
    expect(report.successor).toBeNull();
    expect(report.blockingReasons).toEqual([
      "current artifact must validate before successor linkage is inspected",
      "nextArtifactPath must be a non-empty repo-relative .json path or null",
    ]);
  });

  test("blocks invalid predecessors with absent or null nextArtifactPath instead of reporting absent linkage", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-invalid-predecessor-"));
    tmpRoots.push(root);
    const invalidAutonomyEnvelope = {
      ...artifact().autonomyEnvelope,
      pushAllowed: true as false,
    };

    for (const predecessor of [
      artifact({
        autonomyEnvelope: invalidAutonomyEnvelope,
      }),
      artifact({
        autonomyEnvelope: invalidAutonomyEnvelope,
        nextArtifactPath: null,
      }),
    ]) {
      const report = await buildSequentialContinuationNextArtifactReport({
        repoRoot: root,
        artifactPath: join(root, "references", "operations", "s9.json"),
        artifact: predecessor,
      });

      expect(report.status).toBe("blocked");
      expect(report.nextArtifactPath).toBeNull();
      expect(report.successor).toBeNull();
      expect(report.blockingReasons).toContain("current artifact must validate before successor linkage is inspected");
      expect(report.blockingReasons).toContain("autonomyEnvelope.pushAllowed must be false");
    }
  });

  test("blocks successor initiative mismatches and expected slice id mismatches", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture({
      successor: {
        initiativePath: "references/initiatives/other.md",
        currentSlice: {
          ...artifact().currentSlice,
          id: "S11",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain(
      "successor initiativePath must match predecessor initiativePath: references/initiatives/other.md",
    );
    expect(report.blockingReasons).toContain(
      "successor currentSlice.id must match nextArtifactExpectedSliceId S10: S11",
    );
  });

  test("blocks artifact path and currentSlice.id cycles", async () => {
    const pathCycle = await writeNextArtifactFixture({
      predecessor: {
        nextArtifactPath: "references/operations/s9.json",
      },
    });
    const pathCycleReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: pathCycle.root,
      artifactPath: pathCycle.predecessorPath,
      artifact: pathCycle.predecessor,
    });

    expect(pathCycleReport.status).toBe("blocked");
    expect(pathCycleReport.blockingReasons).toContain(
      "nextArtifactPath creates artifact path cycle: references/operations/s9.json",
    );

    const sliceCycle = await writeNextArtifactFixture({
      successor: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S9",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });
    const sliceCycleReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: sliceCycle.root,
      artifactPath: sliceCycle.predecessorPath,
      artifact: sliceCycle.predecessor,
    });

    expect(sliceCycleReport.status).toBe("blocked");
    expect(sliceCycleReport.blockingReasons).toContain("successor currentSlice.id creates slice cycle: S9");
  });

  test("blocks stale successor evidence when references are missing or do not cite predecessor evidence", async () => {
    const missingEvidence = await writeNextArtifactFixture({
      successorEvidencePath: "references/reports/missing.json",
    });
    const missingEvidenceReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: missingEvidence.root,
      artifactPath: missingEvidence.predecessorPath,
      artifact: missingEvidence.predecessor,
    });

    expect(missingEvidenceReport.status).toBe("blocked");
    expect(missingEvidenceReport.blockingReasons).toContain(
      "successor evidence reference file is missing: references/reports/missing.json",
    );
    expect(missingEvidenceReport.blockingReasons).toContain(
      "successor evidenceReferences must cite predecessor artifact or evidence reference",
    );

    const noCitation = await writeNextArtifactFixture({
      successorEvidencePath: "references/reports/unrelated.json",
    });
    await mkdir(join(noCitation.root, "references", "reports"), { recursive: true });
    await writeFile(join(noCitation.root, "references", "reports", "unrelated.json"), "{}\n", "utf8");
    const noCitationReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: noCitation.root,
      artifactPath: noCitation.predecessorPath,
      artifact: noCitation.predecessor,
    });

    expect(noCitationReport.status).toBe("blocked");
    expect(noCitationReport.blockingReasons).toEqual([
      "successor evidenceReferences must cite predecessor artifact or evidence reference",
    ]);
  });

  test("blocks active stop conditions and push requirements in the successor", async () => {
    const activeStop = await writeNextArtifactFixture({
      successor: {
        stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
          check.id === "decision_required"
            ? {
                ...check,
                active: true,
                evidence: "BK must choose the next product boundary.",
              }
            : check,
        ),
      },
    });
    const activeStopReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: activeStop.root,
      artifactPath: activeStop.predecessorPath,
      artifact: activeStop.predecessor,
    });

    expect(activeStopReport.status).toBe("blocked");
    expect(activeStopReport.blockingReasons).toContain(
      "successor stop condition active: decision_required: BK must choose the next product boundary.",
    );

    const pushRequired = await writeNextArtifactFixture({
      successor: {
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      },
    });
    const pushRequiredReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: pushRequired.root,
      artifactPath: pushRequired.predecessorPath,
      artifact: pushRequired.predecessor,
    });

    expect(pushRequiredReport.status).toBe("blocked");
    expect(pushRequiredReport.blockingReasons).toContain(
      "successor artifact invalid: autonomyEnvelope.pushAllowed must be false",
    );
    expect(pushRequiredReport.blockingReasons).toContain("successor autonomyEnvelope.pushAllowed must be false");
  });

  test("blocks independently invalid successor artifacts", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture({
      successor: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S10",
          status: "ready",
          actionType: "auto_dispatch" as SequentialContinuationActionType,
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain(
      "successor artifact invalid: currentSlice.actionType must be manual_decision, report_only, readiness_check, run_task, or batch_plan: auto_dispatch",
    );
  });
});

describe("Sequential CEO Autopilot run_task preflight report", () => {
  test("accepts a committed-clean TaskSpec candidate without execution side effects", async () => {
    const { root, artifactPath, taskSpecPath, taskSpec, continuation } = await writeRunTaskPreflightFixture();

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
    });

    expect(report.status).toBe("accepted");
    expect(report.normalizedTaskSpecPath).toBe("references/tasks/s12-run-task-preflight.json");
    expect(report.resolvedTaskSpecPath).toBe(taskSpecPath);
    expect(report.task).toEqual({
      id: taskSpec.id,
      title: taskSpec.title,
    });
    expect(report.blockingReasons).toEqual([]);
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      lifecycleMutated: false,
      mergePerformed: false,
      cleanupPerformed: false,
      commitPerformed: false,
      pushPerformed: false,
    });
  });

  test("blocks malformed candidates through current artifact validation first", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture();
    const malformed = {
      ...continuation,
      runTaskCandidate: "bun run samantha run-task references/tasks/s12-run-task-preflight.json",
    };

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: malformed,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "current artifact must validate before runTaskCandidate is inspected",
      "runTaskCandidate must be an object or null when present",
    ]);
  });

  test("blocks invalid predecessor artifacts before absent or null runTaskCandidate reports", async () => {
    const invalidAutonomyEnvelope = {
      ...artifact().autonomyEnvelope,
      pushAllowed: true as false,
    };
    const cases: Array<{ name: string; continuation: SequentialContinuationArtifact }> = [
      {
        name: "absent",
        continuation: artifact({ autonomyEnvelope: invalidAutonomyEnvelope }),
      },
      {
        name: "null",
        continuation: artifact({ autonomyEnvelope: invalidAutonomyEnvelope, runTaskCandidate: null }),
      },
    ];

    for (const { name, continuation } of cases) {
      const report = await buildSequentialContinuationRunTaskPreflightReport({
        repoRoot: ".",
        artifactPath: `references/operations/s12-${name}.json`,
        artifact: continuation,
      });

      expect(report.status).toBe("blocked");
      expect(report.taskSpecPath).toBeNull();
      expect(report.blockingReasons).toEqual([
        "current artifact must validate before runTaskCandidate is inspected",
        "autonomyEnvelope.pushAllowed must be false",
      ]);
    }
  });

  test("blocks unsafe taskSpecPath strings before reading files", async () => {
    const { root, artifactPath, continuation, taskSpecCommit } = await writeRunTaskPreflightFixture();
    const cases: Array<{ value: string; reason: string }> = [
      {
        value: "Continue with the S12 TaskSpec",
        reason:
          "runTaskCandidate.taskSpecPath must be a normalized repo-relative local references/tasks/*.json path: Continue with the S12 TaskSpec",
      },
      {
        value: "bun run samantha run-task references/tasks/s12-run-task-preflight.json",
        reason:
          "runTaskCandidate.taskSpecPath must not be a command string: bun run samantha run-task references/tasks/s12-run-task-preflight.json",
      },
      {
        value: "https://example.com/s12.json",
        reason: "runTaskCandidate.taskSpecPath must not be a URL: https://example.com/s12.json",
      },
      {
        value: "/tmp/s12.json",
        reason: "runTaskCandidate.taskSpecPath must be repo-relative and stay inside repoRoot: /tmp/s12.json",
      },
      {
        value: "../references/tasks/s12.json",
        reason:
          "runTaskCandidate.taskSpecPath must be repo-relative and stay inside repoRoot: ../references/tasks/s12.json",
      },
      {
        value: "$ROOT/references/tasks/s12.json",
        reason:
          "runTaskCandidate.taskSpecPath must not use environment expansion: $ROOT/references/tasks/s12.json",
      },
      {
        value: "references/tasks/*.json",
        reason: "runTaskCandidate.taskSpecPath must not be glob-like: references/tasks/*.json",
      },
      {
        value: "",
        reason: "runTaskCandidate.taskSpecPath must be a non-empty string",
      },
    ];

    for (const { value, reason } of cases) {
      const report = await buildSequentialContinuationRunTaskPreflightReport({
        repoRoot: root,
        artifactPath,
        artifact: {
          ...continuation,
          runTaskCandidate: runTaskCandidate(taskSpecCommit, { taskSpecPath: value }),
        },
      });

      expect(report.status).toBe("blocked");
      expect(report.blockingReasons).toContain(reason);
    }
  });

  test("blocks missing, off-repo, and invalid JSON TaskSpec files", async () => {
    const missing = await writeRunTaskPreflightFixture({
      candidate: {
        taskSpecPath: "references/tasks/missing.json",
      },
    });
    const missingReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: missing.root,
      artifactPath: missing.artifactPath,
      artifact: missing.continuation,
    });
    expect(missingReport.status).toBe("blocked");
    expect(missingReport.blockingReasons).toEqual([
      `runTaskCandidate.taskSpecPath file not found: ${join(missing.root, "references", "tasks", "missing.json")}`,
    ]);

    const offRepo = await writeRunTaskPreflightFixture();
    const outsideRoot = await mkdtemp(join(tmpdir(), "samantha-run-task-preflight-outside-"));
    tmpRoots.push(outsideRoot);
    const outsideTaskSpecPath = join(outsideRoot, "outside.json");
    await writeFile(outsideTaskSpecPath, `${JSON.stringify(runTaskTaskSpec(), null, 2)}\n`, "utf8");
    await rm(offRepo.taskSpecPath);
    await symlink(outsideTaskSpecPath, offRepo.taskSpecPath);
    await git(["add", "references/tasks/s12-run-task-preflight.json"], offRepo.root);
    await git(["commit", "-m", "chore: replace task spec with symlink"], offRepo.root);
    const offRepoCommit = await gitHead(offRepo.root);
    const offRepoReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: offRepo.root,
      artifactPath: offRepo.artifactPath,
      artifact: {
        ...offRepo.continuation,
        runTaskCandidate: runTaskCandidate(offRepoCommit),
      },
    });
    expect(offRepoReport.status).toBe("blocked");
    expect(offRepoReport.blockingReasons).toEqual([
      "runTaskCandidate.taskSpecPath must stay inside repoRoot after resolving symlinks: references/tasks/s12-run-task-preflight.json",
    ]);

    const invalidJson = await writeRunTaskPreflightFixture();
    await writeFile(invalidJson.taskSpecPath, "{ invalid json\n", "utf8");
    await git(["add", "references/tasks/s12-run-task-preflight.json"], invalidJson.root);
    await git(["commit", "-m", "chore: make task spec invalid json"], invalidJson.root);
    const invalidJsonCommit = await gitHead(invalidJson.root);
    const invalidJsonReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: invalidJson.root,
      artifactPath: invalidJson.artifactPath,
      artifact: {
        ...invalidJson.continuation,
        runTaskCandidate: runTaskCandidate(invalidJsonCommit),
      },
    });
    expect(invalidJsonReport.status).toBe("blocked");
    expect(invalidJsonReport.blockingReasons[0]).toStartWith("runTaskCandidate.taskSpecPath JSON could not be parsed:");
  });

  test("blocks invalid TaskSpec fields before git cleanliness checks", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      taskSpec: {
        id: "",
      },
    });

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain("TaskSpec.id must be a non-empty string");
  });

  test("blocks untracked, dirty, and stale TaskSpec commit evidence", async () => {
    const untracked = await writeRunTaskPreflightFixture({ commitTaskSpec: false });
    const untrackedReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: untracked.root,
      artifactPath: untracked.artifactPath,
      artifact: untracked.continuation,
    });
    expect(untrackedReport.status).toBe("blocked");
    expect(untrackedReport.blockingReasons).toContain(
      "runTaskCandidate.taskSpecPath must be tracked and committed_clean: references/tasks/s12-run-task-preflight.json",
    );

    const dirty = await writeRunTaskPreflightFixture();
    await writeFile(
      dirty.taskSpecPath,
      `${JSON.stringify({ ...dirty.taskSpec, title: "Dirty TaskSpec" }, null, 2)}\n`,
      "utf8",
    );
    const dirtyReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: dirty.root,
      artifactPath: dirty.artifactPath,
      artifact: dirty.continuation,
    });
    expect(dirtyReport.status).toBe("blocked");
    expect(dirtyReport.blockingReasons).toContain(
      "runTaskCandidate.taskSpecPath must be tracked and committed_clean: references/tasks/s12-run-task-preflight.json",
    );

    const stale = await writeRunTaskPreflightFixture();
    await writeFile(
      stale.taskSpecPath,
      `${JSON.stringify({ ...stale.taskSpec, title: "Newer committed TaskSpec" }, null, 2)}\n`,
      "utf8",
    );
    await git(["add", "references/tasks/s12-run-task-preflight.json"], stale.root);
    await git(["commit", "-m", "chore: update task spec after evidence"], stale.root);
    const staleReport = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: stale.root,
      artifactPath: stale.artifactPath,
      artifact: stale.continuation,
    });
    expect(staleReport.status).toBe("blocked");
    expect(staleReport.blockingReasons).toContain(
      `runTaskCandidate.evidence.taskSpecCommit is stale for taskSpecPath: ${stale.taskSpecCommit} references/tasks/s12-run-task-preflight.json`,
    );
  });

  test("blocks active stop conditions before candidate inspection proceeds", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
          check.id === "dirty_or_stale_repo"
            ? {
                ...check,
                active: true,
                evidence: "target repo has dirty TaskSpec evidence risk",
              }
            : check,
        ),
      },
    });

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "stop condition active: dirty_or_stale_repo: target repo has dirty TaskSpec evidence risk",
    ]);
  });

  test("blocks non-run_task action types before task file inspection", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S12",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
        },
      },
    });

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "currentSlice.actionType must be run_task for run_task preflight: report_only",
    ]);
  });

  test("blocks runtime, mode, worktree, and lifecycle ownership mismatches", async () => {
    const { root, artifactPath, continuation, taskSpecCommit } = await writeRunTaskPreflightFixture({
      candidate: {
        requiredRuntime: "exec-json",
        executionMode: "execute",
        worktreePolicy: "worker_allocated",
        lifecycleOwner: "worker",
      },
    });

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: {
        ...continuation,
        runTaskCandidate: runTaskCandidate(taskSpecCommit, {
          requiredRuntime: "exec-json",
          executionMode: "execute",
          worktreePolicy: "worker_allocated",
          lifecycleOwner: "worker",
        }),
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "runTaskCandidate.requiredRuntime must be codex-sdk: exec-json",
      "runTaskCandidate.executionMode must be preflight_only: execute",
      "runTaskCandidate.worktreePolicy must be samantha_allocated_isolated: worker_allocated",
      "runTaskCandidate.lifecycleOwner must be samantha: worker",
    ]);
  });

  test("blocks target, forbidden, and verify handoff mismatches", async () => {
    const { root, artifactPath, continuation, taskSpecCommit } = await writeRunTaskPreflightFixture();

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: {
        ...continuation,
        runTaskCandidate: runTaskCandidate(taskSpecCommit, {
          targetFiles: ["src/cli.ts"],
          forbiddenChanges: ["references/tasks/**"],
          verifyCommands: ["bun test tests/cli.test.ts"],
        }),
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "runTaskCandidate.targetFiles must match TaskSpec targetFiles",
      "runTaskCandidate.forbiddenChanges must match TaskSpec forbiddenChanges",
      "runTaskCandidate.verifyCommands must match TaskSpec verifyCommands",
      "runTaskCandidate.targetFiles must match currentSlice targetFiles",
      "runTaskCandidate.forbiddenChanges must match currentSlice forbiddenChanges",
      "runTaskCandidate.verifyCommands must match currentSlice verifyCommands",
    ]);
  });

  test("blocks push and side-effect requests", async () => {
    const { root, artifactPath, continuation, taskSpecCommit } = await writeRunTaskPreflightFixture();

    const report = await buildSequentialContinuationRunTaskPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: {
        ...continuation,
        runTaskCandidate: runTaskCandidate(taskSpecCommit, {
          expectedSideEffects: {
            ...runTaskCandidate(taskSpecCommit).expectedSideEffects,
            pushPerformed: true,
          },
        }),
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual(["runTaskCandidate.expectedSideEffects.pushPerformed must be false"]);
    expect(report.sideEffects.pushPerformed).toBe(false);
    expect(report.trustedStateChanges).toBe(false);
  });
});

describe("Sequential CEO Autopilot runs:accept preflight report", () => {
  test("omits absent or null candidates for valid artifacts", async () => {
    for (const continuation of [artifact(), artifact({ runAcceptCandidate: null })]) {
      const report = await buildSequentialContinuationRunAcceptPreflightReport({
        repoRoot: ".",
        artifactPath: "references/operations/s18.json",
        artifact: {
          ...continuation,
          currentSlice: {
            ...continuation.currentSlice,
            actionType: "report_only",
          },
        },
      });

      expect(report.status).toBe("absent");
      expect(report.blockingReasons).toEqual([]);
    }
  });

  test("blocks invalid predecessor artifacts before candidate inspection", async () => {
    const fixture = await writeRunAcceptPreflightFixture({
      candidate: { expectedRunId: "" },
      artifact: {
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      },
    });

    const report = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: fixture.continuation,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "current artifact must validate before runAcceptCandidate is inspected",
      "autonomyEnvelope.pushAllowed must be false",
    ]);
  });

  test("accepts a clean writer run candidate without lifecycle side effects", async () => {
    const { root, artifactPath, runLogPath, baseCommit, workerCommit, continuation } =
      await writeRunAcceptPreflightFixture();

    const report = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
    });

    expect(report).toMatchObject({
      status: "accepted",
      runLogPath: "runs/accept-run.json",
      normalizedRunLogPath: "runs/accept-run.json",
      resolvedRunLogPath: runLogPath,
      run: { id: "accept-run", taskId: "accept-fixture" },
      expectedRunId: "accept-run",
      expectedTaskId: "accept-fixture",
      expectedCommit: workerCommit,
      expectedBaseCommit: baseCommit,
      targetBranch: "main",
      requiredRuntime: "codex-sdk",
      executionMode: "accept_preflight_only",
      lifecycleOwner: "samantha",
      pushAllowed: false,
      cleanupReadiness: { classification: "ready", violations: [] },
      blockingReasons: [],
      trustedStateChanges: false,
      pushPerformed: false,
      sideEffects: runAcceptExpectedSideEffects(),
    });
  });

  test("validates closed schema and required false side effects", async () => {
    const fixture = await writeRunAcceptPreflightFixture({
      candidate: {
        pushAllowed: true as false,
        expectedSideEffects: {
          ...runAcceptExpectedSideEffects(),
          pushPerformed: true,
        },
      },
    });
    const continuation = {
      ...fixture.continuation,
      runAcceptCandidate: {
        ...fixture.continuation.runAcceptCandidate,
        extra: true,
      },
    };

    const report = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: continuation,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      "unknown runAcceptCandidate field: extra",
      "runAcceptCandidate.pushAllowed must be false",
      "runAcceptCandidate.expectedSideEffects.pushPerformed must be false",
    ]);
    expect(report.sideEffects).toEqual(runAcceptExpectedSideEffects());
  });

  test("blocks unsafe, missing, off-repo, and invalid run log paths", async () => {
    const fixture = await writeRunAcceptPreflightFixture();
    const unsafeCases: Array<{ value: string; reason: string }> = [
      {
        value: "Use the S16 run log",
        reason: "runAcceptCandidate.runLogPath must be a normalized repo-relative local runs/*.json path: Use the S16 run log",
      },
      {
        value: "bun run samantha continuation:show runs/accept-run.json",
        reason: "runAcceptCandidate.runLogPath must not be a command string: bun run samantha continuation:show runs/accept-run.json",
      },
      {
        value: "https://example.com/run.json",
        reason: "runAcceptCandidate.runLogPath must not be a URL: https://example.com/run.json",
      },
      {
        value: "/tmp/run.json",
        reason: "runAcceptCandidate.runLogPath must be repo-relative and stay inside repoRoot: /tmp/run.json",
      },
      {
        value: "../runs/run.json",
        reason: "runAcceptCandidate.runLogPath must be repo-relative and stay inside repoRoot: ../runs/run.json",
      },
      {
        value: "$ROOT/runs/run.json",
        reason: "runAcceptCandidate.runLogPath must not use environment expansion: $ROOT/runs/run.json",
      },
      {
        value: "runs/*.json",
        reason: "runAcceptCandidate.runLogPath must not be glob-like: runs/*.json",
      },
      {
        value: "",
        reason: "runAcceptCandidate.runLogPath must be a non-empty string",
      },
    ];

    for (const { value, reason } of unsafeCases) {
      const report = await buildSequentialContinuationRunAcceptPreflightReport({
        repoRoot: fixture.root,
        artifactPath: fixture.artifactPath,
        artifact: {
          ...fixture.continuation,
          runAcceptCandidate: runAcceptCandidate(
            { baseCommit: fixture.baseCommit, workerCommit: fixture.workerCommit },
            { runLogPath: value },
          ),
        },
      });

      expect(report.status).toBe("blocked");
      expect(report.blockingReasons).toContain(reason);
    }

    const missing = await writeRunAcceptPreflightFixture({
      candidate: { runLogPath: "runs/missing.json" },
    });
    const missingReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: missing.root,
      artifactPath: missing.artifactPath,
      artifact: missing.continuation,
    });
    expect(missingReport.blockingReasons).toEqual([
      `runAcceptCandidate.runLogPath file not found: ${join(missing.root, "runs", "missing.json")}`,
    ]);

    const offRepo = await writeRunAcceptPreflightFixture();
    const outsideRoot = await mkdtemp(join(tmpdir(), "samantha-run-accept-outside-"));
    tmpRoots.push(outsideRoot);
    const outsideLogPath = join(outsideRoot, "outside.json");
    await writeFile(outsideLogPath, `${JSON.stringify(offRepo.runLog, null, 2)}\n`, "utf8");
    await rm(offRepo.runLogPath);
    await symlink(outsideLogPath, offRepo.runLogPath);
    const offRepoReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: offRepo.root,
      artifactPath: offRepo.artifactPath,
      artifact: offRepo.continuation,
    });
    expect(offRepoReport.blockingReasons).toEqual([
      "runAcceptCandidate.runLogPath must stay inside repoRoot after resolving symlinks: runs/accept-run.json",
    ]);

    const invalidJson = await writeRunAcceptPreflightFixture();
    await writeFile(invalidJson.runLogPath, "{ invalid json\n", "utf8");
    const invalidJsonReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: invalidJson.root,
      artifactPath: invalidJson.artifactPath,
      artifact: invalidJson.continuation,
    });
    expect(invalidJsonReport.blockingReasons[0]).toStartWith(
      "runAcceptCandidate.runLogPath JSON could not be parsed:",
    );
  });

  test("blocks current-slice gates, active stops, stale base, dirty repo, and wrong branch", async () => {
    const activeStop = await writeRunAcceptPreflightFixture({
      artifact: {
        stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
          check.id === "dirty_or_stale_repo"
            ? { ...check, active: true, evidence: "target repo advanced after worker base" }
            : check,
        ),
      },
    });
    const activeStopReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: activeStop.root,
      artifactPath: activeStop.artifactPath,
      artifact: activeStop.continuation,
    });
    expect(activeStopReport.blockingReasons).toEqual([
      "stop condition active: dirty_or_stale_repo: target repo advanced after worker base",
    ]);

    const wrongAction = await writeRunAcceptPreflightFixture({
      artifact: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S18",
          status: "active",
          actionType: "run_task",
          dependencyStatus: "blocked",
          targetFiles: ["allowed.txt"],
          forbiddenChanges: ["runs/**", "worktrees/**"],
          verifyCommands: ["grep -q changed allowed.txt"],
        },
      },
    });
    const wrongActionReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: wrongAction.root,
      artifactPath: wrongAction.artifactPath,
      artifact: wrongAction.continuation,
    });
    expect(wrongActionReport.blockingReasons).toContain("currentSlice.status must be ready for runs:accept preflight: active");
    expect(wrongActionReport.blockingReasons).toContain("currentSlice.actionType must be report_only for runs:accept preflight: run_task");
    expect(wrongActionReport.blockingReasons).toContain("currentSlice.dependencyStatus must be met for runs:accept preflight: blocked");

    const stale = await writeRunAcceptPreflightFixture();
    await writeFile(join(stale.root, "target.txt"), "advanced\n", "utf8");
    await git(["add", "target.txt"], stale.root);
    await git(["commit", "-m", "feat: advance target"], stale.root);
    const staleReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: stale.root,
      artifactPath: stale.artifactPath,
      artifact: stale.continuation,
    });
    expect(staleReport.blockingReasons).toContain("target repo HEAD no longer matches the worker base commit");

    const dirty = await writeRunAcceptPreflightFixture();
    await writeFile(join(dirty.root, "dirty.txt"), "dirty\n", "utf8");
    const dirtyReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: dirty.root,
      artifactPath: dirty.artifactPath,
      artifact: dirty.continuation,
    });
    expect(dirtyReport.blockingReasons).toContain("target repo has uncommitted changes");

    const wrongBranch = await writeRunAcceptPreflightFixture({ candidate: { targetBranch: "release" } });
    const wrongBranchReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: wrongBranch.root,
      artifactPath: wrongBranch.artifactPath,
      artifact: wrongBranch.continuation,
    });
    expect(wrongBranchReport.blockingReasons).toContain("target repo is on main, expected release");
  });

  test("blocks mismatched run identity, commits, runtime, evaluation, scope, and verify evidence", async () => {
    const fixture = await writeRunAcceptPreflightFixture({
      runLog: (log) => ({
        ...log,
        result: {
          ...log.result,
          pass: false,
          runtime: { kind: "exec-json" },
          evaluation: {
            pass: false,
            harness: { status: "rework", note: "needs work", commit: "" },
            changedFiles: ["allowed.txt"],
            scopeViolations: [{ file: "outside.txt", reason: "outside-target" }],
            verifyResults: [{ command: "grep -q changed allowed.txt", exitCode: 1, stdout: "", stderr: "failed" }],
          },
        },
      }),
    });

    const report = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: {
        ...fixture.continuation,
        runAcceptCandidate: runAcceptCandidate(
          { baseCommit: fixture.baseCommit, workerCommit: fixture.workerCommit },
          {
            expectedRunId: "other-run",
            expectedTaskId: "other-task",
            expectedCommit: fixture.baseCommit,
            expectedBaseCommit: "b".repeat(40),
          },
        ),
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain("runAcceptCandidate.expectedRunId must match run log runId: other-run !== accept-run");
    expect(report.blockingReasons).toContain("runAcceptCandidate.expectedTaskId must match run log task.id: other-task !== accept-fixture");
    expect(report.blockingReasons).toContain(
      `runAcceptCandidate.expectedCommit must match run log candidate commit: ${fixture.baseCommit} !== ${fixture.workerCommit}`,
    );
    expect(report.blockingReasons).toContain(
      `runAcceptCandidate.expectedBaseCommit must match run log worker base commit: ${"b".repeat(40)} !== ${fixture.baseCommit}`,
    );
    expect(report.blockingReasons).toContain("run log runtime.kind must match runAcceptCandidate.requiredRuntime codex-sdk: exec-json");
    expect(report.blockingReasons).toContain("run did not pass Samantha evaluation");
    expect(report.blockingReasons).toContain("run log HARNESS_RESULT.status must be pass: rework");
    expect(report.blockingReasons).toContain("run log scope violation: outside.txt outside-target");
    expect(report.blockingReasons).toContain("run log verify command failed: grep -q changed allowed.txt");
  });

  test("blocks missing, non-descendant commits and cleanup readiness risks", async () => {
    const missingCommit = await writeRunAcceptPreflightFixture({
      candidate: { expectedCommit: "a".repeat(40) },
      runLog: (log) => ({
        ...log,
        result: {
          ...log.result,
          commit: log.result.commit
            ? {
                ...log.result.commit,
                commitHash: "a".repeat(40),
              }
            : undefined,
        },
      }),
    });
    const missingCommitReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: missingCommit.root,
      artifactPath: missingCommit.artifactPath,
      artifact: missingCommit.continuation,
    });
    expect(missingCommitReport.blockingReasons).toContain(
      `runAcceptCandidate.expectedCommit must name a local commit: ${"a".repeat(40)}`,
    );

    const nonDescendant = await writeRunAcceptPreflightFixture();
    const orphanCommit = await git(["commit-tree", `${nonDescendant.baseCommit}^{tree}`, "-m", "orphan accept fixture"], nonDescendant.root);
    const nonDescendantLog = JSON.parse(await readFile(nonDescendant.runLogPath, "utf8")) as WorkerRunLog;
    if (!nonDescendantLog.result.commit) throw new Error("fixture commit missing");
    nonDescendantLog.result.commit.commitHash = orphanCommit;
    await writeFile(nonDescendant.runLogPath, `${JSON.stringify(nonDescendantLog, null, 2)}\n`, "utf8");
    const nonDescendantReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: nonDescendant.root,
      artifactPath: nonDescendant.artifactPath,
      artifact: {
        ...nonDescendant.continuation,
        runAcceptCandidate: runAcceptCandidate(
          { baseCommit: nonDescendant.baseCommit, workerCommit: orphanCommit },
        ),
      },
    });
    expect(nonDescendantReport.blockingReasons).toContain("candidate commit is not descended from the worker base commit");

    const cleanupRisk = await writeRunAcceptPreflightFixture();
    await git(["worktree", "remove", "--force", cleanupRisk.worktreePath], cleanupRisk.root);
    const cleanupRiskReport = await buildSequentialContinuationRunAcceptPreflightReport({
      repoRoot: cleanupRisk.root,
      artifactPath: cleanupRisk.artifactPath,
      artifact: cleanupRisk.continuation,
    });
    expect(cleanupRiskReport.blockingReasons).toContain(
      "cleanup readiness risk: allocated worktree path is missing or invalid",
    );
  });
});

describe("Sequential CEO Autopilot guarded single-runs_accept execution", () => {
  test("accepts one explicit execution trigger after accepted preflight and stops at lifecycle evidence", async () => {
    const fixture = await writeRunAcceptPreflightFixture();
    const continuation = {
      ...fixture.continuation,
      runAcceptExecution: runAcceptExecution({
        baseCommit: fixture.baseCommit,
        workerCommit: fixture.workerCommit,
      }),
    };
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: continuation,
      executeAcceptRun: (input) => {
        executorCalls += 1;
        expect(input.requiredRuntime).toBe("codex-sdk");
        expect(input.runLogPath).toBe("runs/accept-run.json");
        expect(input.resolvedRunLogPath).toBe(fixture.runLogPath);
        expect(input.targetBranch).toBe("main");
        return acceptedRunAcceptResult(fixture);
      },
    });

    expect(executorCalls).toBe(1);
    expect(report).toMatchObject({
      status: "accepted",
      violations: [],
      blockingReasons: [],
      selectedActionType: "runs_accept",
      runLogPath: "runs/accept-run.json",
      normalizedRunLogPath: "runs/accept-run.json",
      resolvedRunLogPath: fixture.runLogPath,
      run: { id: "accept-run", taskId: "accept-fixture" },
      expectedRunId: "accept-run",
      expectedTaskId: "accept-fixture",
      expectedCommit: fixture.workerCommit,
      expectedBaseCommit: fixture.baseCommit,
      targetBranch: "main",
      requiredRuntime: "codex-sdk",
      lifecycleOwner: "samantha",
      acceptResultSummary: {
        accepted: true,
        status: "accepted",
        gateStatus: "mergeable",
        mergeExitCode: 0,
        lessonDraftStatus: "created",
        lessonDraftPath: `${fixture.root}/references/lessons/inbox/accept-run.md`,
      },
      lifecycleEvidenceSummary: {
        merged: true,
        cleaned: true,
        runId: "accept-run",
        taskId: "accept-fixture",
        commit: fixture.workerCommit,
      },
      cleanupEvidenceSummary: {
        cleaned: true,
        classification: "completed",
        worktreePath: fixture.worktreePath,
        branch: "samantha/accept-fixture",
        violations: [],
      },
      actionAttemptCount: 1,
      actionExecuted: true,
      continued: false,
      stopReason: "run_accept_lifecycle_recorded",
      trustedStateChanges: ["run_log_trajectory", "lifecycle_record", "merge_result", "cleanup_result"],
      pushPerformed: false,
      sideEffects: {
        runsAcceptCalled: true,
        mergeGateRecorded: true,
        mergePerformed: true,
        lifecycleMutated: true,
        cleanupPerformed: true,
        commitPerformed: false,
        pushPerformed: false,
        runTaskCalled: false,
        workersDispatched: false,
        batchesExecuteCalled: false,
        multiStepLoopStarted: false,
        successorExecuted: false,
      },
    });
    expect(report.runAcceptPreflight?.status).toBe("accepted");
  });

  test("blocks accepted preflight without a distinct execution trigger", async () => {
    const fixture = await writeRunAcceptPreflightFixture();
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: fixture.continuation,
      executeAcceptRun: () => {
        executorCalls += 1;
        return acceptedRunAcceptResult(fixture);
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain("runAcceptExecution must be present for single-runs_accept execution");
    expect(report.actionAttemptCount).toBe(0);
    expect(report.actionExecuted).toBe(false);
    expect(report.runAcceptPreflight?.status).toBe("accepted");
    expect(report.sideEffects).toEqual(runAcceptExpectedSideEffects());
  });

  test("blocks accept_preflight_only as an execution trigger before executor invocation", async () => {
    const fixture = await writeRunAcceptPreflightFixture();
    const continuation = {
      ...fixture.continuation,
      runAcceptExecution: runAcceptExecution(
        { baseCommit: fixture.baseCommit, workerCommit: fixture.workerCommit },
        { executionMode: "accept_preflight_only" },
      ),
    };
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: continuation,
      executeAcceptRun: () => {
        executorCalls += 1;
        return acceptedRunAcceptResult(fixture);
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain(
      "runAcceptExecution.executionMode must be single_run_accept, not accept_preflight_only",
    );
  });

  test("blocks blocked preflight and execution/preflight mismatches without execution", async () => {
    const blocked = await writeRunAcceptPreflightFixture({
      candidate: { targetBranch: "release" },
      artifact: {
        runAcceptExecution: runAcceptExecution({
          baseCommit: "unused-base",
          workerCommit: "unused-worker",
        }),
      },
    });
    let executorCalls = 0;
    const blockedReport = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: blocked.root,
      artifactPath: blocked.artifactPath,
      artifact: blocked.continuation,
      executeAcceptRun: () => {
        executorCalls += 1;
        return acceptedRunAcceptResult(blocked);
      },
    });

    expect(executorCalls).toBe(0);
    expect(blockedReport.status).toBe("blocked");
    expect(blockedReport.violations).toContain("runAcceptPreflight is blocked and cannot trigger single-runs_accept execution");
    expect(blockedReport.violations).toContain("runAcceptPreflight: target repo is on main, expected release");

    const mismatch = await writeRunAcceptPreflightFixture();
    const mismatchReport = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: mismatch.root,
      artifactPath: mismatch.artifactPath,
      artifact: {
        ...mismatch.continuation,
        runAcceptExecution: runAcceptExecution(
          { baseCommit: mismatch.baseCommit, workerCommit: mismatch.workerCommit },
          {
            runLogPath: "runs/other.json",
            expectedRunId: "other-run",
            targetBranch: "release",
            targetFiles: ["other.txt"],
          },
        ),
      },
      executeAcceptRun: () => {
        executorCalls += 1;
        return acceptedRunAcceptResult(mismatch);
      },
    });

    expect(executorCalls).toBe(0);
    expect(mismatchReport.status).toBe("blocked");
    expect(mismatchReport.violations).toContain("runAcceptExecution.runLogPath must match accepted runAcceptPreflight runLogPath");
    expect(mismatchReport.violations).toContain("runAcceptExecution.expectedRunId must match accepted runAcceptPreflight expectedRunId");
    expect(mismatchReport.violations).toContain("runAcceptExecution.targetBranch must match accepted runAcceptPreflight targetBranch");
    expect(mismatchReport.violations).toContain("runAcceptExecution.targetFiles must match currentSlice targetFiles");
  });

  test("blocks active stops, non-ready/report-only gates, and unmet dependencies without execution", async () => {
    const cases: Array<{
      name: string;
      artifact: Partial<SequentialContinuationArtifact>;
      reason: string;
    }> = [
      {
        name: "active-stop",
        artifact: {
          stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
            check.id === "decision_required"
              ? { ...check, active: true, evidence: "BK decision required." }
              : check,
          ),
        },
        reason: "stop condition active: decision_required: BK decision required.",
      },
      {
        name: "not-ready",
        artifact: {
          currentSlice: {
            ...artifact().currentSlice,
            id: "S20",
            status: "active",
            actionType: "report_only",
            dependencyStatus: "met",
            targetFiles: ["allowed.txt"],
            forbiddenChanges: ["runs/**", "worktrees/**"],
            verifyCommands: ["grep -q changed allowed.txt"],
          },
        },
        reason: "currentSlice.status must be ready for single-runs_accept execution: active",
      },
      {
        name: "wrong-action",
        artifact: {
          currentSlice: {
            ...artifact().currentSlice,
            id: "S20",
            status: "ready",
            actionType: "run_task",
            dependencyStatus: "met",
            targetFiles: ["allowed.txt"],
            forbiddenChanges: ["runs/**", "worktrees/**"],
            verifyCommands: ["grep -q changed allowed.txt"],
          },
        },
        reason: "currentSlice.actionType must be report_only for single-runs_accept execution: run_task",
      },
      {
        name: "blocked-dependency",
        artifact: {
          currentSlice: {
            ...artifact().currentSlice,
            id: "S20",
            status: "ready",
            actionType: "report_only",
            dependencyStatus: "blocked",
            targetFiles: ["allowed.txt"],
            forbiddenChanges: ["runs/**", "worktrees/**"],
            verifyCommands: ["grep -q changed allowed.txt"],
          },
        },
        reason: "currentSlice.dependencyStatus must be met for single-runs_accept execution: blocked",
      },
    ];

    for (const item of cases) {
      const fixture = await writeRunAcceptPreflightFixture();
      let executorCalls = 0;
      const report = await buildSequentialContinuationRunAcceptExecutionReport({
        repoRoot: fixture.root,
        artifactPath: fixture.artifactPath,
        artifact: {
          ...fixture.continuation,
          ...item.artifact,
          runAcceptExecution: runAcceptExecution({
            baseCommit: fixture.baseCommit,
            workerCommit: fixture.workerCommit,
          }),
        },
        executeAcceptRun: () => {
          executorCalls += 1;
          return acceptedRunAcceptResult(fixture);
        },
      });

      expect(executorCalls, item.name).toBe(0);
      expect(report.status, item.name).toBe("blocked");
      expect(report.violations, item.name).toContain(item.reason);
      expect(report.sideEffects, item.name).toEqual(runAcceptExpectedSideEffects());
    }
  });

  test("blocks push, commit, run_task, worker, batch, multi-step, and successor side-effect requests", async () => {
    const fixture = await writeRunAcceptPreflightFixture();
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: fixture.root,
      artifactPath: fixture.artifactPath,
      artifact: {
        ...fixture.continuation,
        runAcceptExecution: runAcceptExecution(
          { baseCommit: fixture.baseCommit, workerCommit: fixture.workerCommit },
          {
            expectedSideEffects: {
              ...runAcceptExecution({ baseCommit: fixture.baseCommit, workerCommit: fixture.workerCommit }).expectedSideEffects,
              commitPerformed: true,
              pushPerformed: true,
              runTaskCalled: true,
              workersDispatched: true,
              batchesExecuteCalled: true,
              multiStepLoopStarted: true,
              successorExecuted: true,
            },
          },
        ),
      },
      executeAcceptRun: () => {
        executorCalls += 1;
        return acceptedRunAcceptResult(fixture);
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.commitPerformed must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.pushPerformed must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.runTaskCalled must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.workersDispatched must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.batchesExecuteCalled must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.multiStepLoopStarted must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.successorExecuted must be false");
  });

  test("reports executor failure and non-accepted results without accepted side effects", async () => {
    const failure = await writeRunAcceptPreflightFixture();
    let failureCalls = 0;
    const failureReport = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: failure.root,
      artifactPath: failure.artifactPath,
      artifact: {
        ...failure.continuation,
        runAcceptExecution: runAcceptExecution({
          baseCommit: failure.baseCommit,
          workerCommit: failure.workerCommit,
        }),
      },
      executeAcceptRun: () => {
        failureCalls += 1;
        throw new Error("stub accept unavailable");
      },
    });

    expect(failureCalls).toBe(1);
    expect(failureReport.status).toBe("blocked");
    expect(failureReport.violations).toEqual(["runs:accept executor failed: stub accept unavailable"]);
    expect(failureReport.actionAttemptCount).toBe(1);
    expect(failureReport.actionExecuted).toBe(false);
    expect(failureReport.trustedStateChanges).toEqual([]);
    expect(failureReport.sideEffects).toEqual(runAcceptExpectedSideEffects());

    const rejected = await writeRunAcceptPreflightFixture();
    let rejectedCalls = 0;
    const rejectedReport = await buildSequentialContinuationRunAcceptExecutionReport({
      repoRoot: rejected.root,
      artifactPath: rejected.artifactPath,
      artifact: {
        ...rejected.continuation,
        runAcceptExecution: runAcceptExecution({
          baseCommit: rejected.baseCommit,
          workerCommit: rejected.workerCommit,
        }),
      },
      executeAcceptRun: () => {
        rejectedCalls += 1;
        return {
          ...acceptedRunAcceptResult(rejected),
          accepted: false,
          status: "not_mergeable",
          merge: undefined,
          lifecycle: undefined,
          cleanup: undefined,
        };
      },
    });

    expect(rejectedCalls).toBe(1);
    expect(rejectedReport.status).toBe("blocked");
    expect(rejectedReport.violations).toContain("runs:accept result must be accepted: not_mergeable");
    expect(rejectedReport.violations).toContain("runs:accept result must include a successful merge result");
    expect(rejectedReport.violations).toContain("runs:accept result must include merged lifecycle evidence");
    expect(rejectedReport.violations).toContain("runs:accept result must include completed cleanup evidence");
    expect(rejectedReport.actionExecuted).toBe(false);
    expect(rejectedReport.sideEffects).toEqual(runAcceptExpectedSideEffects());
  });
});

describe("Sequential CEO Autopilot guarded single-run_task execution", () => {
  test("accepts one explicit execution trigger after accepted preflight and stops at run log evidence", async () => {
    const { root, artifactPath, taskSpecPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        runTaskExecution: runTaskExecution(),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: (input) => {
        executorCalls += 1;
        expect(input.runtimeKind).toBe("codex-sdk");
        expect(input.taskPath).toBe(taskSpecPath);
        expect(input.normalizedTaskSpecPath).toBe("references/tasks/s12-run-task-preflight.json");
        return {
          runLogPath: join(root, "runs", "s15.json"),
          pass: true,
          harnessResult: { status: "pass", note: "s15 accepted", commit: "" },
        };
      },
    });

    expect(executorCalls).toBe(1);
    expect(report).toMatchObject({
      status: "accepted",
      violations: [],
      blockingReasons: [],
      selectedActionType: "run_task",
      normalizedTaskSpecPath: "references/tasks/s12-run-task-preflight.json",
      resolvedTaskSpecPath: taskSpecPath,
      runLogPath: join(root, "runs", "s15.json"),
      executorEvidencePath: join(root, "runs", "s15.json"),
      harnessResult: { status: "pass", note: "s15 accepted", commit: "" },
      executionPass: true,
      actionAttemptCount: 1,
      actionExecuted: true,
      continued: false,
      stopReason: "run_task_evidence_recorded",
      trustedStateChanges: ["run_log", "execution_report"],
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: true,
        batchesExecuteCalled: false,
        workersDispatched: true,
        runsCreated: true,
        worktreesCreated: true,
        deterministicVerification: true,
        acceptPerformed: false,
        lifecycleMutated: false,
        mergePerformed: false,
        cleanupPerformed: false,
        commitPerformed: false,
        pushPerformed: false,
        multiStepLoopStarted: false,
        successorExecuted: false,
      },
    });
    expect(report.runTaskPreflight?.status).toBe("accepted");
  });

  test("blocks accepted preflight without a distinct execution trigger", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture();
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        return { executorEvidencePath: "unused", pass: true };
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain("runTaskExecution must be present for single-run_task execution");
    expect(report.actionAttemptCount).toBe(0);
    expect(report.sideEffects.runTaskCalled).toBe(false);
  });

  test("blocks preflight_only as an execution trigger before executor invocation", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        runTaskExecution: runTaskExecution({ executionMode: "preflight_only" }),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        return { executorEvidencePath: "unused", pass: true };
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain(
      "runTaskExecution.executionMode must be single_run_task, not preflight_only",
    );
  });

  test("blocks active stop conditions, non-run_task actions, and unmet dependencies without execution", async () => {
    const cases: Array<{
      name: string;
      artifact: Partial<SequentialContinuationArtifact>;
      reason: string;
    }> = [
      {
        name: "active-stop",
        artifact: {
          stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
            check.id === "decision_required"
              ? { ...check, active: true, evidence: "BK decision required." }
              : check,
          ),
          runTaskExecution: runTaskExecution(),
        },
        reason: "stop condition active: decision_required: BK decision required.",
      },
      {
        name: "wrong-action",
        artifact: {
          currentSlice: {
            ...artifact().currentSlice,
            id: "S12",
            status: "ready",
            actionType: "report_only",
            dependencyStatus: "met",
          },
          runTaskExecution: runTaskExecution(),
        },
        reason: "currentSlice.actionType must be run_task for single-run_task execution: report_only",
      },
      {
        name: "blocked-dependency",
        artifact: {
          currentSlice: {
            ...artifact().currentSlice,
            id: "S12",
            status: "ready",
            actionType: "run_task",
            dependencyStatus: "blocked",
            targetFiles: runTaskTaskSpec().targetFiles,
            forbiddenChanges: runTaskTaskSpec().forbiddenChanges,
            verifyCommands: runTaskTaskSpec().verifyCommands,
          },
          runTaskExecution: runTaskExecution(),
        },
        reason: "currentSlice.dependencyStatus must be met for single-run_task execution: blocked",
      },
    ];

    for (const item of cases) {
      const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({ artifact: item.artifact });
      let executorCalls = 0;
      const report = await buildSequentialContinuationRunTaskExecutionReport({
        repoRoot: root,
        artifactPath,
        artifact: continuation,
        executeRunTask: () => {
          executorCalls += 1;
          return { executorEvidencePath: "unused", pass: true };
        },
      });

      expect(executorCalls, item.name).toBe(0);
      expect(report.status, item.name).toBe("blocked");
      expect(report.violations, item.name).toContain(item.reason);
      expect(report.sideEffects.runTaskCalled, item.name).toBe(false);
    }
  });

  test("blocks missing or blocked runTaskPreflight before execution", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      candidate: {
        requiredRuntime: "exec-json",
      },
      artifact: {
        runTaskExecution: runTaskExecution(),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        return { executorEvidencePath: "unused", pass: true };
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain("runTaskPreflight is blocked and cannot trigger single-run_task execution");
    expect(report.violations).toContain("runTaskPreflight: runTaskCandidate.requiredRuntime must be codex-sdk: exec-json");
  });

  test("blocks runtime, mode, worktree, lifecycle, and handoff mismatches", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        runTaskExecution: runTaskExecution({
          requiredRuntime: "exec-json",
          executionMode: "single_run_task",
          worktreePolicy: "worker_allocated",
          lifecycleOwner: "worker",
          targetFiles: ["src/cli.ts"],
          forbiddenChanges: ["references/tasks/**"],
          verifyCommands: ["bun test tests/cli.test.ts"],
        }),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        return { executorEvidencePath: "unused", pass: true };
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toEqual([
      "runTaskExecution.requiredRuntime must be codex-sdk: exec-json",
      "runTaskExecution.requiredRuntime must match accepted runTaskPreflight requiredRuntime",
      "runTaskExecution.worktreePolicy must be samantha_allocated_isolated: worker_allocated",
      "runTaskExecution.worktreePolicy must match accepted runTaskPreflight worktreePolicy",
      "runTaskExecution.lifecycleOwner must be samantha: worker",
      "runTaskExecution.lifecycleOwner must match accepted runTaskPreflight lifecycleOwner",
      "runTaskExecution.targetFiles must match accepted runTaskPreflight targetFiles",
      "runTaskExecution.forbiddenChanges must match accepted runTaskPreflight forbiddenChanges",
      "runTaskExecution.verifyCommands must match accepted runTaskPreflight verifyCommands",
    ]);
  });

  test("blocks lifecycle, push, batch, multi-step, and successor side-effect requests", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        runTaskExecution: runTaskExecution({
          expectedSideEffects: {
            ...runTaskExecution().expectedSideEffects,
            acceptPerformed: true,
            lifecycleMutated: true,
            pushPerformed: true,
            batchesExecuteCalled: true,
            multiStepLoopStarted: true,
            successorExecuted: true,
          },
        }),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        return { executorEvidencePath: "unused", pass: true };
      },
    });

    expect(executorCalls).toBe(0);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.lifecycleMutated must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.acceptPerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.pushPerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.batchesExecuteCalled must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.multiStepLoopStarted must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.successorExecuted must be false");
  });

  test("reports executor failure as blocked without accepted side effects", async () => {
    const { root, artifactPath, continuation } = await writeRunTaskPreflightFixture({
      artifact: {
        runTaskExecution: runTaskExecution(),
      },
    });
    let executorCalls = 0;

    const report = await buildSequentialContinuationRunTaskExecutionReport({
      repoRoot: root,
      artifactPath,
      artifact: continuation,
      executeRunTask: () => {
        executorCalls += 1;
        throw new Error("stub worker unavailable");
      },
    });

    expect(executorCalls).toBe(1);
    expect(report.status).toBe("blocked");
    expect(report.violations).toEqual(["run_task executor failed: stub worker unavailable"]);
    expect(report.actionAttemptCount).toBe(1);
    expect(report.actionExecuted).toBe(false);
    expect(report.trustedStateChanges).toEqual([]);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      deterministicVerification: false,
      acceptPerformed: false,
      lifecycleMutated: false,
      mergePerformed: false,
      cleanupPerformed: false,
      commitPerformed: false,
      pushPerformed: false,
      multiStepLoopStarted: false,
      successorExecuted: false,
    });
  });
});

describe("Sequential CEO Autopilot status update evidence", () => {
  test("accepts a completed update from cited trusted run-log evidence", () => {
    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence: statusEvidence(),
    });

    expect(result.report).toEqual({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      status: "accepted",
      violations: [],
      requestedOutcome: "completed",
      acceptedOutcome: "completed",
      currentSlice: {
        id: "S2",
        previousStatus: "ready",
        updatedStatus: "completed",
        actionType: "run_task",
        dependencyStatus: "met",
      },
      evidenceReferences: [
        {
          kind: "run_log",
          path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
          summary: "S2 worker run completed with passing deterministic verification.",
          result: "passed",
        },
      ],
      exactNextSamanthaCommand: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
      blockedReportText: null,
      artifactUpdated: true,
      trustedStateChanges: true,
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
      },
    });
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
    expect(result.updatedArtifact?.updatedAt).toBe("2026-05-19T01:00:00.000Z");
    expect(result.updatedArtifact?.evidenceReferences).toEqual(statusEvidence().evidenceReferences);
    expect(result.updatedArtifact?.autonomyEnvelope.pushAllowed).toBe(false);
  });

  test("accepts failed evidence as a blocked transition with cited failure evidence", () => {
    const evidence = statusEvidence({
      outcome: "failed",
      evidenceReferences: [
        {
          kind: "run_log",
          path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
          summary: "Verification failed after the allowed worker run.",
          result: "failed",
        },
      ],
      nextStep: {
        kind: "blocked_report",
        value: "Blocked: verification failed; prepare a narrow rework report before continuing.",
      },
    });

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence,
    });

    expect(result.report.status).toBe("accepted");
    expect(result.report.requestedOutcome).toBe("failed");
    expect(result.report.acceptedOutcome).toBe("blocked");
    expect(result.report.currentSlice.updatedStatus).toBe("blocked");
    expect(result.report.blockedReportText).toBe(
      "Blocked: verification failed; prepare a narrow rework report before continuing.",
    );
    expect(result.updatedArtifact?.currentSlice.status).toBe("blocked");
    expect(result.updatedArtifact?.currentSlice.dependencyStatus).toBe("blocked");
    expect(result.updatedArtifact?.nextStep.kind).toBe("blocked_report");
    expect(validateSequentialContinuationArtifact(result.updatedArtifact)).toEqual([]);
  });

  test("rejects worker prose-only evidence instead of trusting stdout text", () => {
    const evidence = statusEvidence({
      evidenceReferences: [
        {
          kind: "worker_output_text_only" as SequentialContinuationStatusEvidenceDocument["evidenceReferences"][number]["kind"],
          path: "runs/worker-output.txt",
          summary: "Worker prose says HARNESS_RESULT pass.",
          result: "passed",
        },
      ],
    });

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence,
    });

    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain(
      "status evidence evidenceReferences[0].kind must be run_log, readiness_report, continuation_report, or report_review: worker_output_text_only",
    );
    expect(result.updatedArtifact).toBeNull();
  });

  test("rejects report-only recommendation evidence as trusted completion", () => {
    const reportOnlyArtifact = artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "report_only",
      },
    });
    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: reportOnlyArtifact,
      evidence: statusEvidence({
        evidenceReferences: [
          {
            kind: "report_review",
            path: "references/reports/recommendation.json",
            summary: "Reviewer recommends marking S2 complete but did not cite deterministic completion.",
            result: "recommendation_only",
          },
        ],
      }),
    });

    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain("report-only recommendation-only evidence cannot complete a slice");
    expect(result.report.violations).toContain("completed update requires trusted structured evidence for report_only");
    expect(result.updatedArtifact).toBeNull();
  });

  test("rejects missing citations and unknown status evidence fields", () => {
    expect(
      validateSequentialContinuationStatusEvidence({
        ...statusEvidence(),
        evidenceReferences: [],
      }),
    ).toContain("status evidence evidenceReferences must be a non-empty array");

    expect(
      validateSequentialContinuationStatusEvidence({
        ...statusEvidence(),
        markdownRoadmapText: "S2 is done.",
      }),
    ).toContain("unknown status evidence field: markdownRoadmapText");
  });

  test("preserves failed-as-blocked status vocabulary", () => {
    expect(SEQUENTIAL_CONTINUATION_SLICE_STATUSES as readonly string[]).not.toContain("failed");
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          currentSlice: {
            ...artifact().currentSlice,
            status: "failed" as SequentialContinuationArtifact["currentSlice"]["status"],
          },
        }),
      ),
    ).toContain("currentSlice.status must be completed, active, ready, pending, blocked, or dropped: failed");

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence: statusEvidence({
        outcome: "failed",
        evidenceReferences: [
          {
            kind: "run_log",
            path: "runs/failed.json",
            summary: "Run log records failed verification.",
            result: "failed",
          },
        ],
        nextStep: {
          kind: "blocked_report",
          value: "Blocked: failed verification must be handled as rework.",
        },
      }),
    });

    expect(result.report.status).toBe("accepted");
    expect(result.updatedArtifact?.currentSlice.status).toBe("blocked");
  });
});

describe("Sequential CEO Autopilot guarded single-step continuation", () => {
  function readinessArtifact(
    overrides: Partial<SequentialContinuationArtifact> = {},
  ): SequentialContinuationArtifact {
    return artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "readiness_check",
      },
      ...overrides,
    });
  }

  function readinessStatusEvidence(
    overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
  ): SequentialContinuationStatusEvidenceDocument {
    return statusEvidence({
      evidenceReferences: [
        {
          kind: "readiness_report",
          path: "inline:readiness:references/initiatives/sequential-ceo-autopilot.md",
          summary: "Readiness check returned clear for the current initiative.",
          result: "clear",
        },
      ],
      nextStep: {
        kind: "samantha_command",
        value: "sam c: references/initiatives/sequential-ceo-autopilot.md next single step",
      },
      ...overrides,
    });
  }

  test("executes one ready readiness_check and updates status through S4 evidence handling", async () => {
    let executorCalls = 0;

    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/s5.json",
      artifact: readinessArtifact(),
      executeAction: ({ actionType }) => {
        executorCalls += 1;
        expect(actionType).toBe("readiness_check");
        return {
          evidence: readinessStatusEvidence(),
          inlineEvidenceSummary: "Readiness check returned clear for the current initiative.",
        };
      },
    });

    expect(executorCalls).toBe(1);
    expect(result.report.status).toBe("accepted");
    expect(result.report.selectedActionType).toBe("readiness_check");
    expect(result.report.actionExecuted).toBe(true);
    expect(result.report.actionAttemptCount).toBe(1);
    expect(result.report.generatedEvidencePath).toBeNull();
    expect(result.report.inlineEvidenceSummary).toBe("Readiness check returned clear for the current initiative.");
    expect(result.report.statusUpdateReport?.status).toBe("accepted");
    expect(result.report.statusUpdateReport?.evidencePath).toBe(
      "inline:sequential-continuation:sequential-ceo-autopilot-s2:S2:readiness_check",
    );
    expect(result.report.continued).toBe(false);
    expect(result.report.multiStepLoopStarted).toBe(false);
    expect(result.report.pushPerformed).toBe(false);
    expect(result.report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      pushPerformed: false,
    });
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
    expect(result.updatedArtifact?.evidenceReferences).toEqual(readinessStatusEvidence().evidenceReferences);
  });

  test("blocks active stop conditions before calling the executor", async () => {
    let executorCalls = 0;
    const blockedArtifact = readinessArtifact({
      stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
        check.id === "decision_required"
          ? {
              ...check,
              active: true,
              evidence: "BK must choose the product boundary.",
            }
          : check,
      ),
    });

    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/blocked.json",
      artifact: blockedArtifact,
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "stop condition active: decision_required: BK must choose the product boundary.",
    );
    expect(result.report.actionExecuted).toBe(false);
    expect(result.report.actionAttemptCount).toBe(0);
    expect(result.updatedArtifact).toBeNull();
  });

  test("blocks unmet dependencies before calling the executor", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/dependency-blocked.json",
      artifact: readinessArtifact({
        currentSlice: {
          ...readinessArtifact().currentSlice,
          dependencyStatus: "blocked",
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "currentSlice.dependencyStatus must be met for single-step continuation",
    );
    expect(result.updatedArtifact).toBeNull();
  });

  test("stops manual_decision without executing an action", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/manual.json",
      artifact: artifact({
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "manual_decision",
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "manual_decision requires BK input and cannot be executed by single-step continuation",
    );
    expect(result.report.actionExecuted).toBe(false);
  });

  test("blocks write-capable actions without reviewed explicit path support", async () => {
    for (const actionType of ["run_task", "batch_plan"] as const) {
      let executorCalls = 0;
      const result = await buildSequentialContinuationSingleStep({
        artifactPath: `/repo/references/continuation/${actionType}.json`,
        artifact: artifact({
          currentSlice: {
            ...artifact().currentSlice,
            actionType,
          },
        }),
        executeAction: () => {
          executorCalls += 1;
          return { evidence: readinessStatusEvidence() };
        },
      });

      expect(executorCalls).toBe(0);
      expect(result.report.status).toBe("blocked");
      expect(result.report.violations).toContain(
        `${actionType} is blocked until reviewed explicit taskSpecPath/batchSpecPath support exists`,
      );
      expect(result.report.sideEffects.workersDispatched).toBe(false);
      expect(result.updatedArtifact).toBeNull();
    }
  });

  test("rejects invalid artifacts without attempting execution", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/invalid.json",
      artifact: readinessArtifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(result.report.actionAttemptCount).toBe(0);
    expect(result.updatedArtifact).toBeNull();
  });

  test("does not execute a second slice after the first accepted action", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/no-loop.json",
      artifact: readinessArtifact(),
      executeAction: () => {
        executorCalls += 1;
        return {
          evidence: readinessStatusEvidence({
            nextStep: {
              kind: "samantha_command",
              value: "sam c: references/initiatives/sequential-ceo-autopilot.md S6",
            },
          }),
          inlineEvidenceSummary: "Readiness check returned clear; S6 is only reported as the next command.",
        };
      },
    });

    expect(executorCalls).toBe(1);
    expect(result.report.actionAttemptCount).toBe(1);
    expect(result.report.continued).toBe(false);
    expect(result.report.multiStepLoopStarted).toBe(false);
    expect(result.report.nextStep).toEqual({
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S6",
    });
    expect(result.updatedArtifact?.currentSlice.id).toBe("S2");
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
  });
});

describe("Sequential CEO Autopilot bounded continuation loop", () => {
  function readinessArtifact(
    overrides: Partial<SequentialContinuationArtifact> = {},
  ): SequentialContinuationArtifact {
    return artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "readiness_check",
      },
      ...overrides,
    });
  }

  function loopReadinessArtifact(sliceId: string): SequentialContinuationArtifact {
    return readinessArtifact({
      artifactId: `sequential-ceo-autopilot-${sliceId.toLowerCase()}`,
      currentSlice: {
        id: sliceId,
        status: "ready",
        actionType: "readiness_check",
        dependencyStatus: "met",
        prerequisites: ["previous slice completed"],
      },
      nextStep: {
        kind: "samantha_command",
        value: `sam c: references/initiatives/sequential-ceo-autopilot.md ${sliceId}`,
      },
    });
  }

  function readinessStatusEvidenceFor(
    artifact: SequentialContinuationArtifact,
    overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
  ): SequentialContinuationStatusEvidenceDocument {
    return statusEvidence({
      currentSliceId: artifact.currentSlice.id,
      evidenceReferences: [
        {
          kind: "readiness_report",
          path: `inline:readiness:${artifact.currentSlice.id}`,
          summary: `${artifact.currentSlice.id} readiness check returned clear.`,
          result: "clear",
        },
      ],
      nextStep: {
        kind: "samantha_command",
        value: `sam c: references/initiatives/sequential-ceo-autopilot.md after ${artifact.currentSlice.id}`,
      },
      ...overrides,
    });
  }

  test("continues across two successful readiness_check artifacts without side effects", async () => {
    const firstArtifact = loopReadinessArtifact("S6A");
    const secondArtifact = loopReadinessArtifact("S6B");
    let executorCalls = 0;
    const executedSlices: string[] = [];

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/s6a.json",
      artifact: firstArtifact,
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact, actionType }) => {
        executorCalls += 1;
        executedSlices.push(currentArtifact.currentSlice.id);
        expect(actionType).toBe("readiness_check");
        return {
          evidence: readinessStatusEvidenceFor(currentArtifact),
          inlineEvidenceSummary: `${currentArtifact.currentSlice.id} readiness check returned clear.`,
        };
      },
      selectNextArtifact: ({ updatedArtifact, stepCount, failedEvidenceReworkCyclesUsed }) => {
        expect(updatedArtifact.currentSlice.status).toBe("completed");
        expect(failedEvidenceReworkCyclesUsed).toBe(0);
        if (stepCount === 1) {
          return {
            artifactPath: "/repo/references/continuation/s6b.json",
            artifact: secondArtifact,
          };
        }
        return null;
      },
    });

    expect(executorCalls).toBe(2);
    expect(executorCalls).toBe(
      result.report.singleStepReports.filter((stepReport) => stepReport.status === "accepted").length,
    );
    expect(executedSlices).toEqual(["S6A", "S6B"]);
    expect(result.report).toMatchObject({
      artifactPath: "/repo/references/continuation/s6a.json",
      status: "accepted",
      violations: [],
      stepCount: 2,
      maxSteps: 3,
      stopReason: "no_deterministic_next_artifact",
      failedEvidenceReworkCyclesUsed: 0,
      failedEvidenceReworkCyclesRemaining: 1,
      continued: true,
      multiStepLoopStarted: true,
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
        pushPerformed: false,
      },
    });
    expect(result.report.singleStepReports).toHaveLength(2);
    expect(result.report.singleStepReports.map((stepReport) => stepReport.statusUpdateReport?.currentSlice.id)).toEqual([
      "S6A",
      "S6B",
    ]);
    expect(result.updatedArtifacts.map((entry) => entry.artifactPath)).toEqual([
      "/repo/references/continuation/s6a.json",
      "/repo/references/continuation/s6b.json",
    ]);
    expect(result.updatedArtifacts.every((entry) => entry.artifact.currentSlice.status === "completed")).toBe(true);
  });

  test("stops at maxSteps even when a deterministic next artifact is available", async () => {
    let executorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/max-a.json",
      artifact: loopReadinessArtifact("S6A"),
      maxSteps: 2,
      executeAction: ({ artifact: currentArtifact }) => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidenceFor(currentArtifact) };
      },
      selectNextArtifact: ({ stepCount }) => ({
        artifactPath: `/repo/references/continuation/max-${stepCount + 1}.json`,
        artifact: loopReadinessArtifact(`S6${stepCount + 1}`),
      }),
    });

    expect(executorCalls).toBe(2);
    expect(result.report.status).toBe("accepted");
    expect(result.report.stepCount).toBe(2);
    expect(result.report.maxSteps).toBe(2);
    expect(result.report.stopReason).toBe("max_steps_reached");
    expect(result.report.continued).toBe(true);
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(0);
  });

  test("spends one failed-evidence rework cycle and stops on the next failed evidence", async () => {
    const firstFailure = loopReadinessArtifact("S6F1");
    const secondFailure = loopReadinessArtifact("S6F2");
    let executorCalls = 0;
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/failure-1.json",
      artifact: firstFailure,
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => {
        executorCalls += 1;
        return {
          evidence: readinessStatusEvidenceFor(currentArtifact, {
            outcome: "failed",
            evidenceReferences: [
              {
                kind: "readiness_report",
                path: `inline:readiness:${currentArtifact.currentSlice.id}`,
                summary: `${currentArtifact.currentSlice.id} readiness check failed verification.`,
                result: "failed",
              },
            ],
            nextStep: {
              kind: "blocked_report",
              value: `Blocked: ${currentArtifact.currentSlice.id} needs narrow rework evidence.`,
            },
          }),
        };
      },
      selectNextArtifact: ({ failedEvidenceReworkCyclesUsed }) => {
        selectorCalls += 1;
        expect(failedEvidenceReworkCyclesUsed).toBe(1);
        return {
          artifactPath: "/repo/references/continuation/failure-2.json",
          artifact: secondFailure,
        };
      },
    });

    expect(executorCalls).toBe(2);
    expect(selectorCalls).toBe(1);
    expect(result.report.status).toBe("blocked");
    expect(result.report.stepCount).toBe(2);
    expect(result.report.stopReason).toBe(
      "verification_rework_spent: failed evidence rework budget is already spent",
    );
    expect(result.report.violations).toEqual([
      "verification_rework_spent: failed evidence rework budget is already spent",
    ]);
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(1);
    expect(result.report.failedEvidenceReworkCyclesRemaining).toBe(0);
    expect(result.report.singleStepReports.map((stepReport) => stepReport.statusUpdateReport?.requestedOutcome)).toEqual([
      "failed",
      "failed",
    ]);
    expect(result.report.continued).toBe(true);
    expect(result.report.nextStep).toEqual({
      kind: "blocked_report",
      value: "Blocked: verification_rework_spent; failed evidence rework budget is already spent.",
    });
    expect(result.report.sideEffects.workersDispatched).toBe(false);
    expect(result.updatedArtifacts).toHaveLength(2);
  });

  test("stops when status evidence is rejected and does not select a next artifact", async () => {
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/rejected-evidence.json",
      artifact: loopReadinessArtifact("S6R"),
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => ({
        evidence: readinessStatusEvidenceFor(currentArtifact, {
          evidenceReferences: [],
        }),
      }),
      selectNextArtifact: () => {
        selectorCalls += 1;
        return {
          artifactPath: "/repo/references/continuation/should-not-run.json",
          artifact: loopReadinessArtifact("S6X"),
        };
      },
    });

    expect(selectorCalls).toBe(0);
    expect(result.report.status).toBe("rejected");
    expect(result.report.stepCount).toBe(1);
    expect(result.report.stopReason).toBe("status_evidence_rejected");
    expect(result.report.violations).toContain("status evidence evidenceReferences must be a non-empty array");
    expect(result.report.continued).toBe(false);
    expect(result.updatedArtifacts).toEqual([]);
  });

  test("stops when accepted status evidence blocks the current slice", async () => {
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/blocked-evidence.json",
      artifact: loopReadinessArtifact("S6B"),
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => ({
        evidence: readinessStatusEvidenceFor(currentArtifact, {
          outcome: "blocked",
          evidenceReferences: [
            {
              kind: "readiness_report",
              path: `inline:readiness:${currentArtifact.currentSlice.id}`,
              summary: `${currentArtifact.currentSlice.id} readiness check found a blocker.`,
              result: "blocked",
            },
          ],
          nextStep: {
            kind: "blocked_report",
            value: "Blocked: prerequisite evidence is not ready.",
          },
        }),
      }),
      selectNextArtifact: () => {
        selectorCalls += 1;
        return {
          artifactPath: "/repo/references/continuation/should-not-run.json",
          artifact: loopReadinessArtifact("S6X"),
        };
      },
    });

    expect(selectorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.stepCount).toBe(1);
    expect(result.report.stopReason).toBe("status_evidence_blocked: accepted evidence blocked the current slice");
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(0);
    expect(result.report.failedEvidenceReworkCyclesRemaining).toBe(1);
    expect(result.report.singleStepReports[0]?.statusUpdateReport?.acceptedOutcome).toBe("blocked");
    expect(result.updatedArtifacts).toHaveLength(1);
    expect(result.updatedArtifacts[0]?.artifact.currentSlice.dependencyStatus).toBe("blocked");
  });
});
