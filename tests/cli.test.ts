import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseCliArgs } from "../src/cli";
import type { AuthorBatchPlanDraftInput } from "../src/core/batch-plan-authoring";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";
import type { BatchSpec } from "../src/core/batch-spec";
import { DEFAULT_SERIAL_ONLY_RULES } from "../src/core/batch-spec";
import type { TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import type {
  SequentialContinuationArtifact,
  SequentialContinuationRunAcceptCandidate,
  SequentialContinuationRunAcceptExecution,
  SequentialContinuationRunTaskCandidate,
  SequentialContinuationRunTaskExecution,
  SequentialContinuationStatusEvidenceDocument,
} from "../src/core/sequential-ceo-autopilot";
import { SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS } from "../src/core/sequential-ceo-autopilot";
import type { WorkerRunLog } from "../src/core/run-log";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

function cliBatchTask(
  taskId: string,
  overrides: Partial<BatchSpec["tasks"][number]> = {},
): BatchSpec["tasks"][number] {
  return {
    taskId,
    taskSpecPath: `references/tasks/${taskId}.json`,
    targetAgent: "codex-worker",
    declaredTargetFiles: [`tests/${taskId}.test.ts`],
    declaredForbiddenChanges: ["runs/**"],
    expectedVerifyCommands: [`bun test ${taskId}`],
    writeSetClassification: "parallel_eligible",
    classificationReasons: [],
    dispatchGroup: "group-1",
    status: "planned",
    ...overrides,
  };
}

function cliTaskSpecFor(batchTask: BatchSpec["tasks"][number], overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    id: batchTask.taskId,
    title: `Task ${batchTask.taskId}`,
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetAgent: batchTask.targetAgent,
    targetFiles: batchTask.declaredTargetFiles,
    forbiddenChanges: batchTask.declaredForbiddenChanges,
    verifyCommands: batchTask.expectedVerifyCommands,
    instructions: "Make the requested focused change.",
    status: "pending",
    ...overrides,
  };
}

function cliVerification(overrides: Partial<BatchSpec["verification"]> = {}): BatchSpec["verification"] {
  return {
    preflightChecks: [
      "validate batch identity and baseCommit",
      "validate task references against TaskSpec",
      "validate dependency DAG",
      "validate disjoint write sets",
      "validate serial-only classifications",
      "validate integration queue",
    ],
    afterEachAcceptedMerge: ["run focused verify commands for the accepted queue item"],
    afterFinalAcceptedMerge: ["bun run typecheck", "bun test"],
    ...overrides,
  };
}

function cliLifecyclePolicy(overrides: Partial<BatchSpec["lifecyclePolicy"]> = {}): BatchSpec["lifecyclePolicy"] {
  return {
    staleBase: "block_and_replan",
    rebase: "explicit_samantha_owned_rebase_only",
    partialFailure: "block_dependents_allow_independent_candidates",
    cleanup: "explicit_per_worker_lifecycle_after_resolution",
    ...overrides,
  };
}

function cliBatchPlanTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "cli-batch-plan-task",
    title: "Add BatchPlan CLI surface",
    summary: "Expose BatchPlan list, show, and prepare through local CLI commands.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetFileHints: ["src/cli.ts", "tests/cli.test.ts"],
    forbiddenChangeHints: ["src/core/batch-plan-operator.ts", "runs/**", "worktrees/**"],
    verifyCommandHints: ["bun test tests/cli.test.ts"],
    independentlyVerifiableRationale: "Parser and command behavior tests verify the CLI surface.",
    ...overrides,
  };
}

function cliBatchPlanDraft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "cli-batch-plan-draft",
    createdAt: "2026-05-17T00:00:00.000Z",
    sourceGoal: "Expose Phase 5.5 BatchPlan through local CLI commands.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: ["src/cli.ts", "src/core/batch-plan-operator.ts", "src/core/batch-plan-draft-store.ts"],
      currentStateSummary: "BatchPlan operator and draft store exist; CLI wiring is missing.",
      candidateWriteSurfaces: ["src/cli.ts", "tests/cli.test.ts"],
      authorityBoundarySurfaces: ["src/core/batch-plan-operator.ts", "src/core/batch-execution.ts"],
      assumptions: ["CLI prepare only reports the next batches:execute action and never dispatches workers."],
    },
    proposedTasks: [cliBatchPlanTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["cli-batch-plan-task"],
        rationale: "Single CLI surface task with focused verification.",
      },
    ],
    structuredPlaceholders: [],
    autonomyEnvelope: {
      localCommitAllowed: true,
      pushAllowed: false,
      maxReworkCycles: 1,
    },
    promotionReadiness: {
      status: "ready",
      reasons: ["The draft is ready for routine writer batch preparation."],
    },
    report: {
      summary: "BatchPlan CLI commands can expose stored drafts and prepare execution BatchSpecs.",
      nextAction: "Run batches:execute only after prepare returns a passing report.",
    },
    ...overrides,
  };
}

function cliBatchPlanDraftInput(overrides: Partial<AuthorBatchPlanDraftInput> = {}): AuthorBatchPlanDraftInput {
  return {
    draftId: "cli-authored-batch-plan",
    createdAt: "2026-05-17T00:00:00.000Z",
    sourceGoal:
      "Create a local CLI command that turns the CEO's natural-language source goal into BatchPlanDraft evidence.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: ["src/cli.ts", "tests/cli.test.ts", "src/core/batch-plan-authoring.ts"],
      currentStateSummary: "BatchPlanDraft authoring core exists; local CLI authoring command is missing.",
      candidateWriteSurfaces: ["src/cli.ts", "tests/cli.test.ts"],
      authorityBoundarySurfaces: ["src/core/batch-plan-operator.ts", "src/core/batch-execution.ts"],
      assumptions: ["Authoring writes draft evidence only and leaves preparation and dispatch to later commands."],
    },
    proposedTasks: [
      {
        id: "cli-authoring-command",
        title: "Add BatchPlan draft CLI command",
        summary: "Wire the existing BatchPlanDraft authoring core into the local CLI.",
        taskFamily: "core-module",
        workMode: "tdd-first",
        riskClass: "lifecycle-sensitive",
        targetFileHints: ["src/cli.ts", "tests/cli.test.ts"],
        forbiddenChangeHints: ["src/core/batch-plan-authoring.ts", "runs/**", "worktrees/**"],
        verifyCommandHints: ["bun test tests/cli.test.ts tests/batch-plan-authoring.test.ts"],
        independentlyVerifiableRationale:
          "Parser and command tests prove authoring succeeds without preparing or dispatching a batch.",
      },
    ],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["cli-authoring-command"],
        rationale: "Single focused CLI task with deterministic tests.",
      },
    ],
    structuredPlaceholders: [],
    ...overrides,
  };
}

function cliSequentialContinuationArtifact(
  overrides: Partial<SequentialContinuationArtifact> = {},
): SequentialContinuationArtifact {
  return {
    schemaVersion: 1,
    artifactId: "cli-continuation-s3",
    initiativePath: "references/initiatives/sequential-ceo-autopilot.md",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    currentSlice: {
      id: "S3",
      status: "ready",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S2 completed"],
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
        path: "references/initiatives/sequential-ceo-autopilot.md",
        summary: "S3 requests a report-only continuation CLI.",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
    },
    ...overrides,
  };
}

function cliSequentialContinuationStatusEvidence(
  overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
): SequentialContinuationStatusEvidenceDocument {
  return {
    schemaVersion: 1,
    currentSliceId: "S3",
    outcome: "completed",
    updatedAt: "2026-05-19T02:00:00.000Z",
    evidenceReferences: [
      {
        kind: "continuation_report",
        path: "references/reports/s3-continuation-report.json",
        summary: "S3 report-only continuation review completed with deterministic output.",
        result: "completed",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S4",
    },
    ...overrides,
  };
}

function cliRunTaskSpec(overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    id: "cli-run-task-preflight",
    title: "CLI run_task preflight",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetAgent: "codex-worker",
    targetFiles: ["src/core/sequential-ceo-autopilot.ts", "src/cli.ts"],
    forbiddenChanges: ["runs/**", "worktrees/**"],
    verifyCommands: ["bun test tests/cli.test.ts", "bun run typecheck"],
    instructions: "Expose deterministic run_task preflight reporting without execution.",
    status: "pending",
    ...overrides,
  };
}

function cliRunTaskCandidate(
  taskSpecCommit: string,
  overrides: Partial<SequentialContinuationRunTaskCandidate> = {},
): SequentialContinuationRunTaskCandidate {
  const task = cliRunTaskSpec();
  return {
    taskSpecPath: "references/tasks/cli-run-task-preflight.json",
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
      freshnessEvidencePath: "references/operations/cli-preflight-evidence.json",
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

function cliRunTaskExecution(
  overrides: Partial<SequentialContinuationRunTaskExecution> = {},
): SequentialContinuationRunTaskExecution {
  const task = cliRunTaskSpec();
  return {
    taskSpecPath: "references/tasks/cli-run-task-preflight.json",
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

function cliRunAcceptExpectedSideEffects() {
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

function cliRunAcceptCandidate(
  input: {
    baseCommit: string;
    workerCommit: string;
  },
  overrides: Partial<SequentialContinuationRunAcceptCandidate> = {},
): SequentialContinuationRunAcceptCandidate {
  return {
    runLogPath: "runs/cli-accept-run.json",
    expectedRunId: "cli-accept-run",
    expectedTaskId: "cli-accept-fixture",
    expectedCommit: input.workerCommit,
    expectedBaseCommit: input.baseCommit,
    targetBranch: "main",
    requiredRuntime: "codex-sdk",
    executionMode: "accept_preflight_only",
    lifecycleOwner: "samantha",
    pushAllowed: false,
    expectedSideEffects: cliRunAcceptExpectedSideEffects(),
    ...overrides,
  };
}

function cliRunAcceptExecution(
  input: {
    baseCommit: string;
    workerCommit: string;
  },
  overrides: Partial<SequentialContinuationRunAcceptExecution> = {},
): SequentialContinuationRunAcceptExecution {
  return {
    runLogPath: "runs/cli-accept-run.json",
    expectedRunId: "cli-accept-run",
    expectedTaskId: "cli-accept-fixture",
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

async function writeCliRunTaskPreflightFixture(overrides: {
  artifact?: Partial<SequentialContinuationArtifact>;
  candidate?: Partial<SequentialContinuationRunTaskCandidate>;
  taskSpec?: Partial<TaskSpec>;
} = {}): Promise<{
  root: string;
  artifactPath: string;
  taskSpecPath: string;
  artifactText: string;
  taskSpecText: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-run-task-preflight-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  await mkdir(join(root, "references", "operations"), { recursive: true });
  const taskSpec = cliRunTaskSpec(overrides.taskSpec);
  const taskSpecPath = join(root, "references", "tasks", "cli-run-task-preflight.json");
  const artifactPath = join(root, "references", "operations", "cli-run-task-preflight.json");
  const taskSpecText = `${JSON.stringify(taskSpec, null, 2)}\n`;
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await writeFile(taskSpecPath, taskSpecText, "utf8");
  await git(["add", ".fixture", "references/tasks/cli-run-task-preflight.json"], root);
  await git(["commit", "-m", "chore: initial cli run task preflight fixture"], root);
  const taskSpecCommit = await gitHead(root);
  const artifact = cliSequentialContinuationArtifact({
    artifactId: "cli-continuation-s12",
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
    runTaskCandidate: cliRunTaskCandidate(taskSpecCommit, overrides.candidate),
    ...overrides.artifact,
  });
  const artifactText = `${JSON.stringify(artifact, null, 2)}\n`;
  await writeFile(artifactPath, artifactText, "utf8");
  return { root, artifactPath, taskSpecPath, artifactText, taskSpecText };
}

async function writeCliRunAcceptPreflightFixture(overrides: {
  artifact?: Partial<SequentialContinuationArtifact>;
  candidate?: Partial<SequentialContinuationRunAcceptCandidate>;
  runLog?: (log: WorkerRunLog) => WorkerRunLog;
} = {}): Promise<{
  root: string;
  artifactPath: string;
  runLogPath: string;
  artifactText: string;
  runLogText: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-run-accept-preflight-"));
  tmpRoots.push(root);
  await git(["init", "-b", "main"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".gitignore"), "runs/\nworktrees/\n", "utf8");
  await writeFile(join(root, "allowed.txt"), "base\n", "utf8");
  await git(["add", ".gitignore", "allowed.txt"], root);
  await git(["commit", "-m", "chore: initial cli run accept fixture"], root);
  const baseCommit = await gitHead(root);
  await mkdir(join(root, "worktrees"), { recursive: true });
  const worktreePath = join(root, "worktrees", "cli-accept-fixture");
  await git(["worktree", "add", "-b", "samantha/cli-accept-fixture", worktreePath, "main"], root);
  await git(["config", "user.email", "samantha@example.local"], worktreePath);
  await git(["config", "user.name", "Samantha Test"], worktreePath);
  await writeFile(join(worktreePath, "allowed.txt"), "changed\n", "utf8");
  await git(["add", "allowed.txt"], worktreePath);
  await git(["commit", "-m", "feat: cli worker accept fixture"], worktreePath);
  const workerCommit = await gitHead(worktreePath);

  await mkdir(join(root, "runs"), { recursive: true });
  await mkdir(join(root, "references", "operations"), { recursive: true });
  const runLogPath = join(root, "runs", "cli-accept-run.json");
  const artifactPath = join(root, "references", "operations", "cli-run-accept-preflight.json");
  const baseRunLog: WorkerRunLog = {
    schemaVersion: 1,
    runId: "cli-accept-run",
    startedAt: "2026-05-20T00:00:00.000Z",
    finishedAt: "2026-05-20T00:01:00.000Z",
    task: {
      id: "cli-accept-fixture",
      title: "CLI accept fixture",
      taskFamily: "core-module",
      workMode: "tdd-first",
      riskClass: "lifecycle-sensitive",
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
      skillPolicy: { requiredBundles: [], blockedSkills: [] },
    },
    input: { repoRoot: root, worktreesDir: join(root, "worktrees") },
    result: {
      preparation: {
        taskId: "cli-accept-fixture",
        agentId: "codex-worker",
        worktreePath,
        allocation: {
          taskId: "cli-accept-fixture",
          repoRoot: root,
          worktreePath,
          branch: "samantha/cli-accept-fixture",
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
        subject: "feat: cli worker accept fixture",
        files: ["allowed.txt"],
        add: { command: ["git", "add", "--", "allowed.txt"], exitCode: 0, stdout: "", stderr: "" },
        commit: { command: ["git", "commit", "-m", "feat: cli worker accept fixture"], exitCode: 0, stdout: "", stderr: "" },
        commitHash: workerCommit,
      },
      pass: true,
    },
  };
  const runLog = overrides.runLog?.(baseRunLog) ?? baseRunLog;
  const runLogText = `${JSON.stringify(runLog, null, 2)}\n`;
  await writeFile(runLogPath, runLogText, "utf8");
  const artifact = cliSequentialContinuationArtifact({
    artifactId: "cli-continuation-s18",
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
    runAcceptCandidate: cliRunAcceptCandidate({ baseCommit, workerCommit }, overrides.candidate),
    ...overrides.artifact,
  });
  const artifactText = `${JSON.stringify(artifact, null, 2)}\n`;
  await writeFile(artifactPath, artifactText, "utf8");
  return { root, artifactPath, runLogPath, artifactText, runLogText };
}

async function writeCliPostAcceptFixture(overrides: {
  acceptReport?: Record<string, unknown>;
} = {}): Promise<{
  root: string;
  artifactPath: string;
  acceptReportPath: string;
  runLogPath: string;
  artifactText: string;
  acceptReportText: string;
  runLogText: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-post-accept-"));
  tmpRoots.push(root);
  await mkdir(join(root, "references", "operations"), { recursive: true });
  await mkdir(join(root, "runs"), { recursive: true });
  const artifactPath = join(root, "references", "operations", "s22.json");
  const acceptReportPath = join(root, "references", "operations", "s22-accept-report.json");
  const runLogPath = join(root, "runs", "cli-post-accept.json");
  const artifactText = `${JSON.stringify(
    cliSequentialContinuationArtifact({
      artifactId: "cli-continuation-s22",
      currentSlice: {
        id: "S22",
        status: "ready",
        actionType: "report_only",
        dependencyStatus: "met",
        prerequisites: ["S21 completed"],
      },
      nextStep: {
        kind: "samantha_command",
        value: "sam c: references/initiatives/sequential-ceo-autopilot.md S22",
      },
    }),
    null,
    2,
  )}\n`;
  const runLogText = `${JSON.stringify(
    {
      schemaVersion: 1,
      runId: "cli-post-accept",
      finishedAt: "2026-05-20T01:00:00.000Z",
      trajectory: [
        {
          sequence: 1,
          event: "merge_checked",
          status: "completed",
          note: "merge gate checked",
        },
        {
          sequence: 2,
          event: "lifecycle_marked",
          status: "completed",
          note: "run lifecycle marked",
          details: { event: "merged", updatedAt: "2026-05-20T01:01:00.000Z" },
        },
        {
          sequence: 3,
          event: "cleanup_finished",
          status: "completed",
          note: "worker worktree cleanup finished",
        },
        {
          sequence: 4,
          event: "lifecycle_marked",
          status: "completed",
          note: "run lifecycle marked",
          details: { event: "cleaned", updatedAt: "2026-05-20T01:02:00.000Z" },
        },
      ],
    },
    null,
    2,
  )}\n`;
  const acceptReport = {
    artifactPath,
    repoRoot: root,
    status: "accepted",
    violations: [],
    blockingReasons: [],
    selectedActionType: "runs_accept",
    runLogPath: "runs/cli-post-accept.json",
    normalizedRunLogPath: "runs/cli-post-accept.json",
    resolvedRunLogPath: runLogPath,
    run: { id: "cli-post-accept", taskId: "cli-post-accept-task" },
    expectedRunId: "cli-post-accept",
    expectedTaskId: "cli-post-accept-task",
    expectedCommit: "a".repeat(40),
    expectedBaseCommit: "b".repeat(40),
    targetBranch: "main",
    requiredRuntime: "codex-sdk",
    lifecycleOwner: "samantha",
    runAcceptPreflight: { status: "accepted" },
    acceptResultSummary: {
      accepted: true,
      status: "accepted",
      gateStatus: "mergeable",
      mergeExitCode: 0,
      lessonDraftStatus: null,
      lessonDraftPath: null,
    },
    lifecycleEvidenceSummary: {
      merged: true,
      cleaned: true,
      runId: "cli-post-accept",
      taskId: "cli-post-accept-task",
      commit: "a".repeat(40),
    },
    cleanupEvidenceSummary: {
      cleaned: true,
      classification: "completed",
      worktreePath: join(root, "worktrees", "cli-post-accept"),
      branch: "samantha/cli-post-accept",
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
    ...overrides.acceptReport,
  };
  const acceptReportText = `${JSON.stringify(acceptReport, null, 2)}\n`;
  await writeFile(artifactPath, artifactText, "utf8");
  await writeFile(runLogPath, runLogText, "utf8");
  await writeFile(acceptReportPath, acceptReportText, "utf8");
  return { root, artifactPath, acceptReportPath, runLogPath, artifactText, acceptReportText, runLogText };
}

async function writeCliBatchStoreFixture(
  taskSpecOverrides: Partial<TaskSpec> = {},
  batchOverrides: Partial<BatchSpec> = {},
): Promise<{ batchPath: string; batchesDir: string; root: string; baseCommit: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-batch-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  const batchesDir = join(root, "references", "batch-specs");
  await mkdir(batchesDir, { recursive: true });
  const batchTask = cliBatchTask("task-a");
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await writeFile(
    join(root, batchTask.taskSpecPath),
    `${JSON.stringify(cliTaskSpecFor(batchTask, taskSpecOverrides), null, 2)}\n`,
    "utf8",
  );
  await git(["add", ".fixture", batchTask.taskSpecPath], root);
  await git(["commit", "-m", "chore: initial cli batch fixture"], root);
  const baseCommit = await gitHead(root);
  const batch: BatchSpec = {
    schemaVersion: 1,
    batchId: "cli-preflight",
    repoRoot: root,
    baseCommit,
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
    tasks: [batchTask],
    dependencies: [],
    integrationQueue: [
      {
        order: 1,
        taskId: "task-a",
        requiresAccepted: [],
        focusedVerifyCommands: ["bun test task-a"],
        status: "pending",
      },
    ],
    verification: cliVerification(),
    lifecyclePolicy: cliLifecyclePolicy(),
    ...batchOverrides,
  };
  const batchPath = join(batchesDir, "cli-preflight.json");
  await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  return { batchPath, batchesDir, root, baseCommit };
}

async function writeCliBatchPreflightFixture(taskSpecOverrides: Partial<TaskSpec> = {}): Promise<string> {
  return (await writeCliBatchStoreFixture(taskSpecOverrides)).batchPath;
}

async function writeCliBatchPlanStoreFixture(
  drafts: BatchPlanDraft[],
): Promise<{ draftsDir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-batch-plan-"));
  tmpRoots.push(root);
  const draftsDir = join(root, "references", "batch-plans");
  for (const draft of drafts) {
    await writeBatchPlanDraft({ draftsDir, draft });
  }
  return { draftsDir, root };
}

async function writeCliBatchPlanRepoFixture(
  storedDraft: BatchPlanDraft,
): Promise<{ draftsDir: string; executionBatchesDir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-batch-plan-repo-"));
  const executionRoot = await mkdtemp(join(tmpdir(), "samantha-cli-batch-plan-execution-"));
  tmpRoots.push(root, executionRoot);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await git(["add", ".fixture"], root);
  await git(["commit", "-m", "chore: initial cli batch plan fixture"], root);
  const draftsDir = join(root, "references", "batch-plans");
  await writeBatchPlanDraft({ draftsDir, draft: storedDraft });
  return { draftsDir, executionBatchesDir: join(executionRoot, "execution-batches"), root };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

async function runCliCapturingStdout(argv: string[]): Promise<{ exitCode: number; stdout: string }> {
  const originalLog = console.log;
  let stdout = "";
  console.log = (message?: unknown) => {
    stdout = String(message);
  };
  try {
    return {
      exitCode: await main(argv),
      stdout,
    };
  } finally {
    console.log = originalLog;
  }
}

describe("samantha cli", () => {
  test("parses continuation report arguments", () => {
    expect(parseCliArgs(["continuation:show", "--artifact=references/continuation/s3.json"])).toEqual({
      command: "continuation:show",
      artifactPath: "references/continuation/s3.json",
    });
    expect(
      parseCliArgs([
        "continuation:show",
        "--artifact=references/continuation/s3.json",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "continuation:show",
      artifactPath: "references/continuation/s3.json",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(() => parseCliArgs(["continuation:show"])).toThrow(
      "usage: bun run samantha continuation:show --artifact=<path>",
    );
    expect(
      parseCliArgs([
        "continuation:update-status",
        "--artifact=references/continuation/s3.json",
        "--evidence=references/continuation/s3-evidence.json",
      ]),
    ).toEqual({
      command: "continuation:update-status",
      artifactPath: "references/continuation/s3.json",
      evidencePath: "references/continuation/s3-evidence.json",
    });
    expect(() => parseCliArgs(["continuation:update-status", "--artifact=references/continuation/s3.json"])).toThrow(
      "usage: bun run samantha continuation:update-status --artifact=<path> --evidence=<path>",
    );
    expect(
      parseCliArgs([
        "continuation:update-status-after-accept",
        "--artifact=references/continuation/s22.json",
        "--accept-report=references/reports/s22-accept.json",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "continuation:update-status-after-accept",
      artifactPath: "references/continuation/s22.json",
      acceptReportPath: "references/reports/s22-accept.json",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(() =>
      parseCliArgs([
        "continuation:update-status-after-accept",
        "--artifact=references/continuation/s22.json",
        "--accept-report=references/reports/s22-accept.json",
      ]),
    ).toThrow(
      "usage: bun run samantha continuation:update-status-after-accept --artifact=<path> --accept-report=<path> --repo-root=<repo>",
    );
    expect(parseCliArgs(["continuation:step", "--artifact=references/continuation/s5.json"])).toEqual({
      command: "continuation:step",
      artifactPath: "references/continuation/s5.json",
    });
    expect(() => parseCliArgs(["continuation:step"])).toThrow(
      "usage: bun run samantha continuation:step --artifact=<path>",
    );
    expect(
      parseCliArgs([
        "continuation:loop",
        "--artifact=references/continuation/s6.json",
        "--max-steps=3",
      ]),
    ).toEqual({
      command: "continuation:loop",
      artifactPath: "references/continuation/s6.json",
      maxSteps: 3,
    });
    expect(() => parseCliArgs(["continuation:loop", "--artifact=references/continuation/s6.json"])).toThrow(
      "usage: bun run samantha continuation:loop --artifact=<path> --max-steps=<n>",
    );
    expect(() =>
      parseCliArgs([
        "continuation:loop",
        "--artifact=references/continuation/s6.json",
        "--max-steps=0",
      ]),
    ).toThrow("usage: bun run samantha continuation:loop --artifact=<path> --max-steps=<n>");
    expect(
      parseCliArgs([
        "continuation:run-task-once",
        "--artifact=references/continuation/s15.json",
        "--repo-root=/tmp/samantha-repo",
        "--agent=references/agent-profiles/codex-worker.json",
        "--worktrees-dir=worktrees",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
      ]),
    ).toEqual({
      command: "continuation:run-task-once",
      artifactPath: "references/continuation/s15.json",
      repoRoot: "/tmp/samantha-repo",
      agentPath: "references/agent-profiles/codex-worker.json",
      worktreesDir: "worktrees",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
    });
    expect(() => parseCliArgs(["continuation:run-task-once", "--artifact=references/continuation/s15.json"])).toThrow(
      "usage: bun run samantha continuation:run-task-once --artifact=<path> --repo-root=<repo> [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--codex-bin=<path>]",
    );
    expect(
      parseCliArgs([
        "continuation:accept-run-once",
        "--artifact=references/continuation/s20.json",
        "--repo-root=/tmp/samantha-repo",
        "--state-dir=/tmp/samantha-state",
      ]),
    ).toEqual({
      command: "continuation:accept-run-once",
      artifactPath: "references/continuation/s20.json",
      repoRoot: "/tmp/samantha-repo",
      stateDir: "/tmp/samantha-state",
    });
    expect(() => parseCliArgs(["continuation:accept-run-once", "--artifact=references/continuation/s20.json"])).toThrow(
      "usage: bun run samantha continuation:accept-run-once --artifact=<path> --repo-root=<repo> [--state-dir=<dir>]",
    );
  });

  test("continuation show prints a valid report without creating execution artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const artifactText = `${JSON.stringify(cliSequentialContinuationArtifact(), null, 2)}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout(["continuation:show", `--artifact=${artifactPath}`]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      artifactPath,
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
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show reports accepted next-artifact linkage without execution side effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-next-"));
    tmpRoots.push(root);
    const operationsDir = join(root, "references", "operations");
    await mkdir(operationsDir, { recursive: true });
    const artifactPath = join(operationsDir, "s9.json");
    const successorPath = join(operationsDir, "s10.json");
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-s9",
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          id: "S9",
          status: "completed",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S8 completed"],
        },
        nextArtifactPath: "references/operations/s10.json",
        nextArtifactExpectedSliceId: "S10",
      }),
      null,
      2,
    )}\n`;
    const successorText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-s10",
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          id: "S10",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
        evidenceReferences: [
          {
            path: "references/operations/s9.json",
            summary: "S10 cites the predecessor continuation artifact.",
          },
        ],
      }),
      null,
      2,
    )}\n`;
    await writeFile(artifactPath, artifactText, "utf8");
    await writeFile(successorPath, successorText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.nextArtifactLinkage).toMatchObject({
      nextArtifactPath: "references/operations/s10.json",
      nextArtifactExpectedSliceId: "S10",
      normalizedNextArtifactPath: "references/operations/s10.json",
      status: "accepted",
      successor: {
        artifactPath: "references/operations/s10.json",
        currentSliceId: "S10",
        actionType: "report_only",
      },
      blockingReasons: [],
      trustedStateChanges: false,
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
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(successorPath, "utf8")).toBe(successorText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show reports blocked next-artifact reasons without creating runs or worktrees", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-next-blocked-"));
    tmpRoots.push(root);
    const operationsDir = join(root, "references", "operations");
    await mkdir(operationsDir, { recursive: true });
    const artifactPath = join(operationsDir, "s9.json");
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-s9",
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          id: "S9",
          status: "completed",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S8 completed"],
        },
        nextArtifactPath: "references/operations/missing.json",
        nextArtifactExpectedSliceId: "S10",
      }),
      null,
      2,
    )}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("accepted");
    expect(report.nextArtifactLinkage).toMatchObject({
      nextArtifactPath: "references/operations/missing.json",
      nextArtifactExpectedSliceId: "S10",
      normalizedNextArtifactPath: "references/operations/missing.json",
      status: "blocked",
      blockingReasons: [`nextArtifactPath file not found: ${join(root, "references", "operations", "missing.json")}`],
      trustedStateChanges: false,
      pushPerformed: false,
    });
    expect(report.blockingReasons).toContain(
      `nextArtifactPath: nextArtifactPath file not found: ${join(root, "references", "operations", "missing.json")}`,
    );
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show exposes blocked linkage for malformed non-string nextArtifactPath", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-next-malformed-"));
    tmpRoots.push(root);
    const operationsDir = join(root, "references", "operations");
    await mkdir(operationsDir, { recursive: true });
    const artifactPath = join(operationsDir, "s9.json");
    const malformedArtifact = {
      ...cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-s9",
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          id: "S9",
          status: "completed",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S8 completed"],
        },
        nextArtifactExpectedSliceId: "S10",
      }),
      nextArtifactPath: ["references/operations/s10.json"],
    };
    const artifactText = `${JSON.stringify(malformedArtifact, null, 2)}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("nextArtifactPath must be a non-empty repo-relative .json path or null");
    expect(report.nextArtifactLinkage).toMatchObject({
      nextArtifactPath: null,
      nextArtifactExpectedSliceId: null,
      status: "blocked",
      successor: null,
      blockingReasons: [
        "current artifact must validate before successor linkage is inspected",
        "nextArtifactPath must be a non-empty repo-relative .json path or null",
      ],
      trustedStateChanges: false,
      pushPerformed: false,
    });
    expect(report.blockingReasons).toContain(
      "nextArtifactPath: current artifact must validate before successor linkage is inspected",
    );
    expect(report.blockingReasons).toContain(
      "nextArtifactPath: nextArtifactPath must be a non-empty repo-relative .json path or null",
    );
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show exposes accepted run_task preflight without creating runs or worktrees", async () => {
    const { root, artifactPath, taskSpecPath, artifactText, taskSpecText } =
      await writeCliRunTaskPreflightFixture();

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.runTaskPreflight).toMatchObject({
      status: "accepted",
      taskSpecPath: "references/tasks/cli-run-task-preflight.json",
      normalizedTaskSpecPath: "references/tasks/cli-run-task-preflight.json",
      resolvedTaskSpecPath: taskSpecPath,
      task: {
        id: "cli-run-task-preflight",
        title: "CLI run_task preflight",
      },
      blockingReasons: [],
      trustedStateChanges: false,
      pushPerformed: false,
      sideEffects: {
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
      },
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(taskSpecPath, "utf8")).toBe(taskSpecText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show exposes blocked run_task preflight without mutating inputs", async () => {
    const { root, artifactPath, taskSpecPath, artifactText, taskSpecText } =
      await writeCliRunTaskPreflightFixture({
        candidate: {
          taskSpecPath: "references/tasks/missing-cli-run-task-preflight.json",
        },
      });

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("accepted");
    expect(report.runTaskPreflight).toMatchObject({
      status: "blocked",
      taskSpecPath: "references/tasks/missing-cli-run-task-preflight.json",
      normalizedTaskSpecPath: "references/tasks/missing-cli-run-task-preflight.json",
      blockingReasons: [
        `runTaskCandidate.taskSpecPath file not found: ${join(
          root,
          "references",
          "tasks",
          "missing-cli-run-task-preflight.json",
        )}`,
      ],
      trustedStateChanges: false,
      pushPerformed: false,
    });
    expect(report.blockingReasons).toContain(
      `runTaskPreflight: runTaskCandidate.taskSpecPath file not found: ${join(
        root,
        "references",
        "tasks",
        "missing-cli-run-task-preflight.json",
      )}`,
    );
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(taskSpecPath, "utf8")).toBe(taskSpecText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show exposes blocked run_task preflight for invalid artifacts with absent or null runTaskCandidate", async () => {
    const invalidAutonomyEnvelope = {
      ...cliSequentialContinuationArtifact().autonomyEnvelope,
      pushAllowed: true as false,
    };
    const cases: Array<{ name: string; artifact: SequentialContinuationArtifact }> = [
      {
        name: "absent",
        artifact: cliSequentialContinuationArtifact({ autonomyEnvelope: invalidAutonomyEnvelope }),
      },
      {
        name: "null",
        artifact: cliSequentialContinuationArtifact({
          autonomyEnvelope: invalidAutonomyEnvelope,
          runTaskCandidate: null,
        }),
      },
    ];

    for (const { name, artifact } of cases) {
      const root = await mkdtemp(join(tmpdir(), `samantha-cli-run-task-invalid-${name}-`));
      tmpRoots.push(root);
      const artifactPath = join(root, `${name}.json`);
      const artifactText = `${JSON.stringify(artifact, null, 2)}\n`;
      await writeFile(artifactPath, artifactText, "utf8");

      const result = await runCliCapturingStdout([
        "continuation:show",
        `--artifact=${artifactPath}`,
        `--repo-root=${root}`,
      ]);
      const report = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(report.status).toBe("rejected");
      expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
      expect(report.runTaskPreflight).toMatchObject({
        status: "blocked",
        taskSpecPath: null,
        blockingReasons: [
          "current artifact must validate before runTaskCandidate is inspected",
          "autonomyEnvelope.pushAllowed must be false",
        ],
        trustedStateChanges: false,
        pushPerformed: false,
      });
      expect(report.blockingReasons).toContain(
        "runTaskPreflight: current artifact must validate before runTaskCandidate is inspected",
      );
      expect(report.blockingReasons).toContain(
        "runTaskPreflight: autonomyEnvelope.pushAllowed must be false",
      );
      expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
      expect(await pathExists(join(root, "runs"))).toBe(false);
      expect(await pathExists(join(root, "worktrees"))).toBe(false);
    }
  });

  test("continuation show exposes accepted runs:accept preflight without mutating inputs", async () => {
    const { root, artifactPath, runLogPath, artifactText, runLogText } =
      await writeCliRunAcceptPreflightFixture();

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report.runAcceptPreflight).toMatchObject({
      status: "accepted",
      runLogPath: "runs/cli-accept-run.json",
      normalizedRunLogPath: "runs/cli-accept-run.json",
      resolvedRunLogPath: runLogPath,
      run: { id: "cli-accept-run", taskId: "cli-accept-fixture" },
      targetBranch: "main",
      requiredRuntime: "codex-sdk",
      executionMode: "accept_preflight_only",
      lifecycleOwner: "samantha",
      pushAllowed: false,
      cleanupReadiness: { classification: "ready", violations: [] },
      blockingReasons: [],
      trustedStateChanges: false,
      pushPerformed: false,
      sideEffects: cliRunAcceptExpectedSideEffects(),
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation show exposes blocked runs:accept preflight non-zero without file mutation", async () => {
    const { root, artifactPath, runLogPath, artifactText, runLogText } =
      await writeCliRunAcceptPreflightFixture({
        candidate: { runLogPath: "runs/missing-cli-accept-run.json" },
      });

    const result = await runCliCapturingStdout([
      "continuation:show",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("accepted");
    expect(report.runAcceptPreflight).toMatchObject({
      status: "blocked",
      runLogPath: "runs/missing-cli-accept-run.json",
      normalizedRunLogPath: "runs/missing-cli-accept-run.json",
      blockingReasons: [
        `runAcceptCandidate.runLogPath file not found: ${join(root, "runs", "missing-cli-accept-run.json")}`,
      ],
      trustedStateChanges: false,
      pushPerformed: false,
      sideEffects: cliRunAcceptExpectedSideEffects(),
    });
    expect(report.blockingReasons).toContain(
      `runAcceptPreflight: runAcceptCandidate.runLogPath file not found: ${join(
        root,
        "runs",
        "missing-cli-accept-run.json",
      )}`,
    );
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation accept-run-once blocks accepted preflight without execution trigger and mutates nothing", async () => {
    const { root, artifactPath, runLogPath, artifactText, runLogText } =
      await writeCliRunAcceptPreflightFixture();

    const result = await runCliCapturingStdout([
      "continuation:accept-run-once",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
      `--state-dir=${join(root, "s20-state")}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      status: "blocked",
      violations: ["runAcceptExecution must be present for single-runs_accept execution"],
      selectedActionType: null,
      actionAttemptCount: 0,
      actionExecuted: false,
      pushPerformed: false,
      sideEffects: cliRunAcceptExpectedSideEffects(),
    });
    expect(report.runAcceptPreflight.status).toBe("accepted");
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await pathExists(join(root, "s20-state"))).toBe(false);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation accept-run-once blocks invalid execution trigger without artifact mutation", async () => {
    const { root, artifactPath, runLogPath, artifactText, runLogText } =
      await writeCliRunAcceptPreflightFixture();
    const artifact = JSON.parse(artifactText) as SequentialContinuationArtifact;
    if (!artifact.runAcceptCandidate) throw new Error("fixture runAcceptCandidate missing");
    const nextArtifact: SequentialContinuationArtifact = {
      ...artifact,
      runAcceptExecution: cliRunAcceptExecution(
        {
          baseCommit: artifact.runAcceptCandidate.expectedBaseCommit,
          workerCommit: artifact.runAcceptCandidate.expectedCommit,
        },
        {
          executionMode: "accept_preflight_only",
          expectedSideEffects: {
            ...cliRunAcceptExecution({
              baseCommit: artifact.runAcceptCandidate.expectedBaseCommit,
              workerCommit: artifact.runAcceptCandidate.expectedCommit,
            }).expectedSideEffects,
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
    };
    const nextArtifactText = `${JSON.stringify(nextArtifact, null, 2)}\n`;
    await writeFile(artifactPath, nextArtifactText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:accept-run-once",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain(
      "runAcceptExecution.executionMode must be single_run_accept, not accept_preflight_only",
    );
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.commitPerformed must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.pushPerformed must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.runTaskCalled must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.workersDispatched must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.batchesExecuteCalled must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.multiStepLoopStarted must be false");
    expect(report.violations).toContain("runAcceptExecution.expectedSideEffects.successorExecuted must be false");
    expect(report.actionAttemptCount).toBe(0);
    expect(report.actionExecuted).toBe(false);
    expect(report.trustedStateChanges).toEqual([]);
    expect(report.sideEffects).toEqual(cliRunAcceptExpectedSideEffects());
    expect(await readFile(artifactPath, "utf8")).toBe(nextArtifactText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation run-task-once blocks accepted preflight without execution trigger and mutates nothing", async () => {
    const { root, artifactPath, taskSpecPath, artifactText, taskSpecText } =
      await writeCliRunTaskPreflightFixture();

    const result = await runCliCapturingStdout([
      "continuation:run-task-once",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
      `--runs-dir=${join(root, "s15-runs")}`,
      `--worktrees-dir=${join(root, "s15-worktrees")}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      status: "blocked",
      violations: ["runTaskExecution must be present for single-run_task execution"],
      selectedActionType: "run_task",
      actionAttemptCount: 0,
      actionExecuted: false,
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
        deterministicVerification: false,
        lifecycleMutated: false,
        mergePerformed: false,
        cleanupPerformed: false,
        commitPerformed: false,
        pushPerformed: false,
        multiStepLoopStarted: false,
        successorExecuted: false,
      },
    });
    expect(report.runTaskPreflight.status).toBe("accepted");
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(taskSpecPath, "utf8")).toBe(taskSpecText);
    expect(await pathExists(join(root, "s15-runs"))).toBe(false);
    expect(await pathExists(join(root, "s15-worktrees"))).toBe(false);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation run-task-once blocks invalid execution trigger without accept merge cleanup commit or push effects", async () => {
    const { root, artifactPath, taskSpecPath, artifactText, taskSpecText } =
      await writeCliRunTaskPreflightFixture({
        artifact: {
          runTaskExecution: cliRunTaskExecution({
            executionMode: "preflight_only",
            expectedSideEffects: {
              ...cliRunTaskExecution().expectedSideEffects,
              acceptPerformed: true,
              mergePerformed: true,
              cleanupPerformed: true,
              commitPerformed: true,
              pushPerformed: true,
            },
          }),
        },
      });

    const result = await runCliCapturingStdout([
      "continuation:run-task-once",
      `--artifact=${artifactPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("blocked");
    expect(report.violations).toContain(
      "runTaskExecution.executionMode must be single_run_task, not preflight_only",
    );
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.acceptPerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.mergePerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.cleanupPerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.commitPerformed must be false");
    expect(report.violations).toContain("runTaskExecution.expectedSideEffects.pushPerformed must be false");
    expect(report.actionAttemptCount).toBe(0);
    expect(report.actionExecuted).toBe(false);
    expect(report.trustedStateChanges).toEqual([]);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      acceptPerformed: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      deterministicVerification: false,
      lifecycleMutated: false,
      mergePerformed: false,
      cleanupPerformed: false,
      commitPerformed: false,
      pushPerformed: false,
      multiStepLoopStarted: false,
      successorExecuted: false,
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(taskSpecPath, "utf8")).toBe(taskSpecText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation loop does not execute run_task even when S15 execution trigger is present", async () => {
    const { root, artifactPath, taskSpecPath, artifactText, taskSpecText } =
      await writeCliRunTaskPreflightFixture({
        artifact: {
          runTaskExecution: cliRunTaskExecution(),
        },
      });

    const result = await runCliCapturingStdout([
      "continuation:loop",
      `--artifact=${artifactPath}`,
      "--max-steps=2",
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("blocked");
    expect(report.singleStepReports[0]).toMatchObject({
      status: "blocked",
      selectedActionType: "run_task",
      actionExecuted: false,
      actionAttemptCount: 0,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
        pushPerformed: false,
      },
    });
    expect(report.stopReason).toBe(
      "step_blocked: run_task is blocked until reviewed explicit taskSpecPath/batchSpecPath support exists",
    );
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(taskSpecPath, "utf8")).toBe(taskSpecText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation show prints a rejected report and exits non-zero for invalid artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-invalid-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    await writeFile(
      artifactPath,
      `${JSON.stringify(
        cliSequentialContinuationArtifact({
          autonomyEnvelope: {
            ...cliSequentialContinuationArtifact().autonomyEnvelope,
            pushAllowed: true as false,
          },
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runCliCapturingStdout(["continuation:show", `--artifact=${artifactPath}`]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.allowedActionType).toBeNull();
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
  });

  test("continuation update-status updates only the artifact file and prints deterministic JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-update-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const evidencePath = join(root, "evidence.json");
    const markerPath = join(root, "marker.txt");
    const artifactText = `${JSON.stringify(cliSequentialContinuationArtifact(), null, 2)}\n`;
    const evidenceText = `${JSON.stringify(cliSequentialContinuationStatusEvidence(), null, 2)}\n`;
    await writeFile(artifactPath, artifactText, "utf8");
    await writeFile(evidencePath, evidenceText, "utf8");
    await writeFile(markerPath, "leave me alone\n", "utf8");

    const result = await runCliCapturingStdout([
      "continuation:update-status",
      `--artifact=${artifactPath}`,
      `--evidence=${evidencePath}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toEqual({
      artifactPath,
      evidencePath,
      status: "accepted",
      violations: [],
      requestedOutcome: "completed",
      acceptedOutcome: "completed",
      currentSlice: {
        id: "S3",
        previousStatus: "ready",
        updatedStatus: "completed",
        actionType: "report_only",
        dependencyStatus: "met",
      },
      evidenceReferences: cliSequentialContinuationStatusEvidence().evidenceReferences,
      exactNextSamanthaCommand: "sam c: references/initiatives/sequential-ceo-autopilot.md S4",
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
    const updatedArtifact = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(updatedArtifact.currentSlice.status).toBe("completed");
    expect(updatedArtifact.evidenceReferences).toEqual(cliSequentialContinuationStatusEvidence().evidenceReferences);
    expect(await readFile(evidencePath, "utf8")).toBe(evidenceText);
    expect(await readFile(markerPath, "utf8")).toBe("leave me alone\n");
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation update-status rejects invalid evidence non-zero without updating the artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-update-invalid-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const evidencePath = join(root, "evidence.json");
    const artifactText = `${JSON.stringify(cliSequentialContinuationArtifact(), null, 2)}\n`;
    await writeFile(artifactPath, artifactText, "utf8");
    await writeFile(
      evidencePath,
      `${JSON.stringify(
        cliSequentialContinuationStatusEvidence({
          evidenceReferences: [],
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runCliCapturingStdout([
      "continuation:update-status",
      `--artifact=${artifactPath}`,
      `--evidence=${evidencePath}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("status evidence evidenceReferences must be a non-empty array");
    expect(report.artifactUpdated).toBe(false);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation update-status-after-accept completes the artifact from accepted lifecycle evidence", async () => {
    const { root, artifactPath, acceptReportPath, runLogPath, acceptReportText, runLogText } =
      await writeCliPostAcceptFixture();
    const markerPath = join(root, "marker.txt");
    await writeFile(markerPath, "leave me alone\n", "utf8");

    const result = await runCliCapturingStdout([
      "continuation:update-status-after-accept",
      `--artifact=${artifactPath}`,
      `--accept-report=${acceptReportPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      status: "accepted",
      stopReason: "no_deterministic_next_artifact",
      artifactUpdated: true,
      currentSliceId: "S22",
      runLogPath: "runs/cli-post-accept.json",
      normalizedRunLogPath: "runs/cli-post-accept.json",
      nextArtifactLinkage: {
        status: "absent",
        trustedStateChanges: false,
        pushPerformed: false,
      },
      sideEffects: {
        runTaskCalled: false,
        workersDispatched: false,
        batchesExecuteCalled: false,
        multiStepLoopStarted: false,
        successorExecuted: false,
        commitPerformed: false,
        pushPerformed: false,
      },
    });
    expect(report.statusEvidence).toMatchObject({
      currentSliceId: "S22",
      outcome: "completed",
      updatedAt: "2026-05-20T01:02:00.000Z",
      evidenceReferences: [
        {
          kind: "continuation_report",
          path: "references/operations/s22-accept-report.json",
          result: "completed",
        },
        {
          kind: "run_log",
          path: "runs/cli-post-accept.json",
          result: "passed",
        },
      ],
      nextStep: {
        kind: "blocked_report",
        value: "no_deterministic_next_artifact: S22 completed from structured post-run evidence; no nextArtifactPath is present.",
      },
    });
    const updatedArtifact = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(updatedArtifact.currentSlice.status).toBe("completed");
    expect(updatedArtifact.currentSlice.dependencyStatus).toBe("met");
    expect(updatedArtifact.evidenceReferences).toEqual(report.statusEvidence.evidenceReferences);
    expect(await readFile(acceptReportPath, "utf8")).toBe(acceptReportText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await readFile(markerPath, "utf8")).toBe("leave me alone\n");
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation update-status-after-accept rejects invalid accept reports without artifact mutation", async () => {
    const { root, artifactPath, acceptReportPath, runLogPath, artifactText, runLogText } =
      await writeCliPostAcceptFixture({
        acceptReport: {
          status: "not_mergeable",
          lifecycleEvidenceSummary: null,
        },
      });

    const result = await runCliCapturingStdout([
      "continuation:update-status-after-accept",
      `--artifact=${artifactPath}`,
      `--accept-report=${acceptReportPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("accept report status must be accepted: not_mergeable");
    expect(report.violations).toContain("accept report lifecycleEvidenceSummary must be present");
    expect(report.artifactUpdated).toBe(false);
    expect(report.sideEffects).toMatchObject({
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
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await readFile(runLogPath, "utf8")).toBe(runLogText);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation update-status-after-accept rejects unrelated accept reports without artifact mutation", async () => {
    const { root, artifactPath, acceptReportPath, artifactText } = await writeCliPostAcceptFixture({
      acceptReport: {
        artifactPath: join("references", "operations", "other-slice.json"),
      },
    });

    const result = await runCliCapturingStdout([
      "continuation:update-status-after-accept",
      `--artifact=${artifactPath}`,
      `--accept-report=${acceptReportPath}`,
      `--repo-root=${root}`,
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain(
      "accept report artifactPath must match artifact being updated: references/operations/s22.json",
    );
    expect(report.artifactUpdated).toBe(false);
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
    expect(await pathExists(join(root, "runs", "run-lifecycle.jsonl"))).toBe(false);
  });

  test("continuation step runs one readiness_check and updates only the artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-step-"));
    tmpRoots.push(root);
    const initiativePath = join(root, "initiative.md");
    const artifactPath = join(root, "continuation.json");
    const markerPath = join(root, "marker.txt");
    const initiativeText = `# Initiative: CLI single-step fixture

Status: active
Source: CLI test fixture

## Goal

Check the current initiative readiness once.

## Accepted Decisions

- Use readiness only.

## Non-Goals

- No worker dispatch.

## Invariants

- Push remains disabled.

## Slice Queue

| Slice | Status | Objective | Dependency | Verification | Next Prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | ready | Check readiness. | S0 | cli. | prompt |
| S2 | pending | Next slice. | S1 | cli. | prompt |

## Current Next Slice

S1 is ready.

## End-of-Session Update Rule

Update the brief before stopping.

## Completion Rule

The fixture is complete when readiness is clear.
`;
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-s1",
        initiativePath,
        currentSlice: {
          id: "S1",
          status: "ready",
          actionType: "readiness_check",
          dependencyStatus: "met",
          prerequisites: ["S0 completed"],
        },
        evidenceReferences: [
          {
            path: initiativePath,
            summary: "S1 requests a deterministic readiness check.",
          },
        ],
        nextStep: {
          kind: "samantha_command",
          value: "sam c: run one readiness step for S1",
        },
      }),
      null,
      2,
    )}\n`;
    await writeFile(initiativePath, initiativeText, "utf8");
    await writeFile(artifactPath, artifactText, "utf8");
    await writeFile(markerPath, "leave me alone\n", "utf8");

    const result = await runCliCapturingStdout(["continuation:step", `--artifact=${artifactPath}`]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      artifactPath,
      status: "accepted",
      violations: [],
      selectedActionType: "readiness_check",
      actionExecuted: true,
      actionAttemptCount: 1,
      generatedEvidencePath: null,
      inlineEvidenceSummary: "Readiness check returned clear: start S1: Check readiness.",
      continued: false,
      multiStepLoopStarted: false,
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
    expect(report.statusUpdateReport).toMatchObject({
      artifactPath,
      status: "accepted",
      requestedOutcome: "completed",
      acceptedOutcome: "completed",
      currentSlice: {
        id: "S1",
        previousStatus: "ready",
        updatedStatus: "completed",
        actionType: "readiness_check",
        dependencyStatus: "met",
      },
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
    expect(report.statusUpdateReport.evidenceReferences).toEqual([
      {
        kind: "readiness_report",
        path: `inline:readiness:${initiativePath}`,
        summary: "Readiness check returned clear: start S1: Check readiness.",
        result: "clear",
      },
    ]);
    const updatedArtifact = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(updatedArtifact.currentSlice.status).toBe("completed");
    expect(updatedArtifact.evidenceReferences).toEqual(report.statusUpdateReport.evidenceReferences);
    expect(await readFile(initiativePath, "utf8")).toBe(initiativeText);
    expect(await readFile(markerPath, "utf8")).toBe("leave me alone\n");
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation step blocks unsafe actions non-zero without side effects", async () => {
    for (const actionType of ["manual_decision", "run_task", "batch_plan"] as const) {
      const root = await mkdtemp(join(tmpdir(), `samantha-cli-continuation-step-${actionType}-`));
      tmpRoots.push(root);
      const artifactPath = join(root, "continuation.json");
      const currentSlice =
        actionType === "manual_decision"
          ? {
              ...cliSequentialContinuationArtifact().currentSlice,
              actionType,
            }
          : {
              ...cliSequentialContinuationArtifact().currentSlice,
              actionType,
              targetFiles: ["src/cli.ts"],
              forbiddenChanges: ["runs/**", "worktrees/**"],
              verifyCommands: ["bun test tests/cli.test.ts"],
            };
      const artifactText = `${JSON.stringify(
        cliSequentialContinuationArtifact({
          currentSlice,
          nextStep: {
            kind: actionType === "manual_decision" ? "blocked_report" : "samantha_command",
            value:
              actionType === "manual_decision"
                ? "Blocked until BK chooses the next action."
                : "sam c: reviewed writer action required",
          },
        }),
        null,
        2,
      )}\n`;
      await writeFile(artifactPath, artifactText, "utf8");

      const result = await runCliCapturingStdout(["continuation:step", `--artifact=${artifactPath}`]);
      const report = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(report.status).toBe("blocked");
      expect(report.selectedActionType).toBe(actionType);
      expect(report.actionExecuted).toBe(false);
      expect(report.actionAttemptCount).toBe(0);
      expect(report.statusUpdateReport).toBeNull();
      expect(report.continued).toBe(false);
      expect(report.multiStepLoopStarted).toBe(false);
      expect(report.pushPerformed).toBe(false);
      expect(report.sideEffects).toEqual({
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
        pushPerformed: false,
      });
      expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
      expect(await pathExists(join(root, "runs"))).toBe(false);
      expect(await pathExists(join(root, "worktrees"))).toBe(false);
    }
  });

  test("continuation step rejects invalid artifacts without updating or executing", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-step-invalid-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          actionType: "readiness_check",
        },
        autonomyEnvelope: {
          ...cliSequentialContinuationArtifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
      null,
      2,
    )}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout(["continuation:step", `--artifact=${artifactPath}`]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.actionExecuted).toBe(false);
    expect(report.actionAttemptCount).toBe(0);
    expect(report.statusUpdateReport).toBeNull();
    expect(report.sideEffects.workersDispatched).toBe(false);
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation loop runs readiness_check once and stops without deterministic next artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-loop-"));
    tmpRoots.push(root);
    const initiativePath = join(root, "initiative.md");
    const artifactPath = join(root, "continuation.json");
    const markerPath = join(root, "marker.txt");
    const initiativeText = `# Initiative: CLI loop fixture

Status: active
Source: CLI test fixture

## Goal

Check the current initiative readiness through the loop command.

## Accepted Decisions

- Use readiness only.

## Non-Goals

- No worker dispatch.

## Invariants

- Push remains disabled.

## Slice Queue

| Slice | Status | Objective | Dependency | Verification | Next Prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | ready | Check readiness. | S0 | cli. | prompt |
| S2 | pending | Next slice. | S1 | cli. | prompt |

## Current Next Slice

S1 is ready.

## End-of-Session Update Rule

Update the brief before stopping.

## Completion Rule

The fixture is complete when readiness is clear.
`;
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        artifactId: "cli-continuation-loop-s1",
        initiativePath,
        currentSlice: {
          id: "S1",
          status: "ready",
          actionType: "readiness_check",
          dependencyStatus: "met",
          prerequisites: ["S0 completed"],
        },
        evidenceReferences: [
          {
            path: initiativePath,
            summary: "S1 requests a deterministic readiness check.",
          },
        ],
        nextStep: {
          kind: "samantha_command",
          value: "sam c: run loop readiness step for S1",
        },
      }),
      null,
      2,
    )}\n`;
    await writeFile(initiativePath, initiativeText, "utf8");
    await writeFile(artifactPath, artifactText, "utf8");
    await writeFile(markerPath, "leave me alone\n", "utf8");

    const result = await runCliCapturingStdout([
      "continuation:loop",
      `--artifact=${artifactPath}`,
      "--max-steps=3",
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      artifactPath,
      status: "accepted",
      violations: [],
      stepCount: 1,
      maxSteps: 3,
      stopReason: "no_deterministic_next_artifact",
      failedEvidenceReworkCyclesUsed: 0,
      failedEvidenceReworkCyclesRemaining: 1,
      continued: false,
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
    expect(report.singleStepReports).toHaveLength(1);
    expect(report.singleStepReports[0]).toMatchObject({
      status: "accepted",
      selectedActionType: "readiness_check",
      actionExecuted: true,
      actionAttemptCount: 1,
      inlineEvidenceSummary: "Readiness check returned clear: start S1: Check readiness.",
      continued: false,
      multiStepLoopStarted: false,
      pushPerformed: false,
    });
    const updatedArtifact = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(updatedArtifact.currentSlice.status).toBe("completed");
    expect(updatedArtifact.evidenceReferences).toEqual(report.singleStepReports[0].statusUpdateReport.evidenceReferences);
    expect(await readFile(initiativePath, "utf8")).toBe(initiativeText);
    expect(await readFile(markerPath, "utf8")).toBe("leave me alone\n");
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation loop blocks active stop conditions non-zero without side effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-loop-blocked-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        currentSlice: {
          id: "S1",
          status: "ready",
          actionType: "readiness_check",
          dependencyStatus: "met",
          prerequisites: ["S0 completed"],
        },
        stopConditionChecklist: cliSequentialContinuationArtifact().stopConditionChecklist.map((check) =>
          check.id === "decision_required"
            ? {
                ...check,
                active: true,
                evidence: "BK must choose the next product boundary.",
              }
            : check,
        ),
        nextStep: {
          kind: "blocked_report",
          value: "Blocked until BK chooses the next product boundary.",
        },
      }),
      null,
      2,
    )}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:loop",
      `--artifact=${artifactPath}`,
      "--max-steps=2",
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("blocked");
    expect(report.stepCount).toBe(1);
    expect(report.stopReason).toBe(
      "step_blocked: stop condition active: decision_required: BK must choose the next product boundary.",
    );
    expect(report.singleStepReports[0]).toMatchObject({
      status: "blocked",
      actionExecuted: false,
      actionAttemptCount: 0,
    });
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      pushPerformed: false,
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("continuation loop rejects invalid artifacts non-zero without updating", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-continuation-loop-invalid-"));
    tmpRoots.push(root);
    const artifactPath = join(root, "continuation.json");
    const artifactText = `${JSON.stringify(
      cliSequentialContinuationArtifact({
        currentSlice: {
          ...cliSequentialContinuationArtifact().currentSlice,
          actionType: "readiness_check",
        },
        autonomyEnvelope: {
          ...cliSequentialContinuationArtifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
      null,
      2,
    )}\n`;
    await writeFile(artifactPath, artifactText, "utf8");

    const result = await runCliCapturingStdout([
      "continuation:loop",
      `--artifact=${artifactPath}`,
      "--max-steps=2",
    ]);
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("rejected");
    expect(report.stepCount).toBe(1);
    expect(report.stopReason).toBe("artifact_invalid");
    expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.singleStepReports[0]).toMatchObject({
      status: "rejected",
      actionExecuted: false,
      actionAttemptCount: 0,
    });
    expect(await readFile(artifactPath, "utf8")).toBe(artifactText);
    expect(await pathExists(join(root, "runs"))).toBe(false);
    expect(await pathExists(join(root, "worktrees"))).toBe(false);
  });

  test("parses run-task arguments", () => {
    expect(
      parseCliArgs([
        "run-task",
        "references/tasks/fixture-single-writer.json",
        "--repo-root=.",
        "--agent=references/agent-profiles/codex-worker.json",
        "--worktrees-dir=worktrees",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
        "--runtime=codex-sdk",
      ]),
    ).toEqual({
      command: "run-task",
      taskPath: "references/tasks/fixture-single-writer.json",
      repoRoot: ".",
      agentPath: "references/agent-profiles/codex-worker.json",
      worktreesDir: "worktrees",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
      runtimeKind: "codex-sdk",
    });
    expect(
      parseCliArgs([
        "run-task",
        "references/tasks/fixture-single-writer.json",
        "--repo-root=.",
      ]),
    ).toEqual({
      command: "run-task",
      taskPath: "references/tasks/fixture-single-writer.json",
      repoRoot: ".",
    });
    expect(() =>
      parseCliArgs([
        "run-task",
        "references/tasks/fixture-single-writer.json",
        "--repo-root=.",
        "--runtime=unknown",
      ]),
    ).toThrow("runtime must be exec-json or codex-sdk");
  });

  test("parses run inspection and merge check arguments", () => {
    expect(parseCliArgs(["runs:list", "--runs-dir=runs"])).toEqual({
      command: "runs:list",
      runsDir: "runs",
    });
    expect(parseCliArgs(["runs:show", "run-1", "--runs-dir=runs"])).toEqual({
      command: "runs:show",
      runId: "run-1",
      runsDir: "runs",
    });
    expect(
      parseCliArgs([
        "merge:check",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
      ]),
    ).toEqual({
      command: "merge:check",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
    });
  });

  test("parses lifecycle and cleanup arguments", () => {
    expect(
      parseCliArgs([
        "runs:mark-lifecycle",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--event=merged",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:mark-lifecycle",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      event: "merged",
      stateDir: "state",
    });
    expect(
      parseCliArgs([
        "runs:accept",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:accept",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
    expect(parseCliArgs(["runs:diagnose", "--run-log=runs/run-1.json"])).toEqual({
      command: "runs:diagnose",
      runLogPath: "runs/run-1.json",
    });
    expect(
      parseCliArgs([
        "reports:summarize",
        "--run-log=runs/review-a.json",
        "--run-log=runs/review-b.json",
      ]),
    ).toEqual({
      command: "reports:summarize",
      runLogPaths: ["runs/review-a.json", "runs/review-b.json"],
    });
    expect(
      parseCliArgs([
        "reports:orchestrate",
        "--repo-root=.",
        "--task=references/tasks/fixture-report-reviewer.json",
        "--task=references/tasks/dogfood-report-reviewer.json",
        "--agent=references/agent-profiles/codex-reviewer.json",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
      ]),
    ).toEqual({
      command: "reports:orchestrate",
      repoRoot: ".",
      taskPaths: [
        "references/tasks/fixture-report-reviewer.json",
        "references/tasks/dogfood-report-reviewer.json",
      ],
      agentPath: "references/agent-profiles/codex-reviewer.json",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
    });
    expect(
      parseCliArgs([
        "worktree:cleanup",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "worktree:cleanup",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
  });

  test("parses lesson draft arguments", () => {
    expect(parseCliArgs(["lessons:draft", "--run-log=runs/run-1.json"])).toEqual({
      command: "lessons:draft",
      runLogPath: "runs/run-1.json",
    });
  });

  test("parses lesson review and promotion arguments", () => {
    expect(parseCliArgs(["lessons:review", "references/lessons/inbox/run-1.md"])).toEqual({
      command: "lessons:review",
      candidatePath: "references/lessons/inbox/run-1.md",
    });
    expect(parseCliArgs(["lessons:review-inbox", "--repo-root=/tmp/samantha-repo"])).toEqual({
      command: "lessons:review-inbox",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(parseCliArgs(["lessons:promotion-queue", "--repo-root=/tmp/samantha-repo"])).toEqual({
      command: "lessons:promotion-queue",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(
      parseCliArgs([
        "lessons:promote",
        "references/lessons/inbox/run-1.md",
        "--playbook-id=cli-command-addition",
      ]),
    ).toEqual({
      command: "lessons:promote",
      candidatePath: "references/lessons/inbox/run-1.md",
      playbookId: "cli-command-addition",
    });
    expect(
      parseCliArgs([
        "lessons:record-evidence",
        "references/playbooks/cli-command-addition.md",
        "--run-log=runs/run-2.json",
        "--assessment=helped",
        "--note=Passed again with the same task shape.",
      ]),
    ).toEqual({
      command: "lessons:record-evidence",
      playbookPath: "references/playbooks/cli-command-addition.md",
      runLogPath: "runs/run-2.json",
      assessment: "helped",
      note: "Passed again with the same task shape.",
    });
  });

  test("lesson review command writes a review artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    const candidatePath = join(candidateDir, "run-1.md");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      candidatePath,
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: run-2

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review", candidatePath])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const artifactPath = join(root, "references", "lessons", "reviews", "run-1.json");
    expect(result.path).toBe(artifactPath);
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toMatchObject({
      candidatePath: "references/lessons/inbox/run-1.md",
      runId: "run-1",
      taskId: "inspect-only",
      observedOutcome: "stale evidence",
      suggestedArtifactType: "run summary / no promotion",
      superseded: {
        stale: true,
        status: "superseded by accepted and cleaned run",
        supersedingRunId: "run-2",
      },
      recommendedAction: "reject",
      classification: "auto_rejected",
      reason: "superseded: superseded by accepted and cleaned run; suggested artifact type marks no promotion",
    });
  });

  test("lesson inbox review command writes review index", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      join(candidateDir, "run-1.md"),
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: not detected

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review-inbox", `--repo-root=${root}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const indexPath = join(root, "references", "lessons", "reviews", "index.json");
    expect(result.indexPath).toBe(indexPath);
    expect(JSON.parse(await readFile(indexPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      inboxPath: "references/lessons/inbox",
      reviewsPath: "references/lessons/reviews",
      summary: {
        total: 1,
        autoRejected: 1,
        needsMoreEvidence: 0,
        promotionCandidates: 0,
        manualReview: 0,
      },
      candidates: [
        {
          candidatePath: "references/lessons/inbox/run-1.md",
          reviewPath: "references/lessons/reviews/run-1.json",
          runId: "run-1",
          classification: "auto_rejected",
        },
      ],
    });
  });

  test("lesson promotion queue command prints a review queue without promoting", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      join(candidateDir, "run-1.md"),
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: cli-pattern-v2
- Task title: CLI pattern again
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: cli-pattern
- Recurrence outcome: pass
- Recurrence count: 2
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep CLI parser and command tests paired.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promotion still requires manual review.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:promotion-queue", `--repo-root=${root}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      summary: {
        total: 1,
        promotionCandidates: 1,
      },
      queue: [
        {
          candidatePath: "references/lessons/inbox/run-1.md",
          reviewPath: "references/lessons/reviews/run-1.json",
          runId: "run-1",
          taskId: "cli-pattern-v2",
          action: "promote_candidate",
          reason: "playbook candidate is ready for manual promotion",
        },
      ],
    });
  });

  test("parses task creation from template arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-template",
        "core-module-with-tests",
        "--task-id=add-task-template-command",
        "--title=Add task template command",
        "--set=module:task-from-template",
        "--set=command:tasks:from-template",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-template",
      templateId: "core-module-with-tests",
      taskId: "add-task-template-command",
      title: "Add task template command",
      replacements: {
        command: "tasks:from-template",
        module: "task-from-template",
      },
      repoRoot: "/tmp/samantha-repo",
    });
  });

  test("parses task creation from run arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-run",
        "--run-log=runs/run-1.json",
        "--task-id=follow-up-task",
        "--title=Follow up task",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-run",
      runLogPath: "runs/run-1.json",
      taskId: "follow-up-task",
      title: "Follow up task",
      repoRoot: "/tmp/samantha-repo",
    });
  });

  test("parses readiness check arguments", () => {
    expect(
      parseCliArgs([
        "readiness:check",
        "--initiative=references/initiatives/one.md",
        "--task=references/tasks/one.json",
        "--run-log=runs/one.json",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "readiness:check",
      initiativePath: "references/initiatives/one.md",
      taskPath: "references/tasks/one.json",
      runLogPath: "runs/one.json",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(parseCliArgs(["readiness:check", "--repo-root=/tmp/samantha-repo"])).toEqual({
      command: "readiness:check",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(() => parseCliArgs(["readiness:check"])).toThrow(
      "usage: bun run samantha readiness:check [--initiative=<path>] [--task=<task.json>] [--run-log=<path>] [--repo-root=<repo>]",
    );
  });

  test("readiness check command prints the current initiative slice", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-readiness-"));
    tmpRoots.push(root);
    await mkdir(join(root, "references", "initiatives"), { recursive: true });
    const initiativePath = join(root, "references", "initiatives", "one.md");
    await writeFile(
      initiativePath,
      `# Initiative: CLI readiness fixture

Status: active
Source: test fixture

## Goal

Keep context.

## Accepted Decisions

- Use an initiative brief.

## Non-Goals

- No daemon.

## Invariants

- Preserve gates.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Seed. | none | docs. | n/a |
| S2 | ready | Check readiness. | S1 | cli. | prompt |

## Current Next Slice

Start S2.

## End-of-Session Update Rule

Update the next slice.

## Completion Rule

All slices complete.
`,
      "utf8",
    );
    let stdout = "";
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["readiness:check", `--initiative=${initiativePath}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.overallStatus).toBe("clear");
    expect(result.initiative.currentSlice.slice).toBe("S2");
    expect(result.recommendation).toContain("start S2");
  });

  test("parses batch preflight arguments", () => {
    expect(parseCliArgs(["batches:preflight", "--batch=references/batches/batch-1.json"])).toEqual({
      command: "batches:preflight",
      batchPath: "references/batches/batch-1.json",
    });
    expect(
      parseCliArgs([
        "batches:preflight",
        "--batch-id=cli-preflight",
        "--batches-dir=references/batch-specs",
      ]),
    ).toEqual({
      command: "batches:preflight",
      batchId: "cli-preflight",
      batchesDir: "references/batch-specs",
    });
    expect(() => parseCliArgs(["batches:preflight"])).toThrow(
      "usage: bun run samantha batches:preflight --batch=<path> OR --batch-id=<id> [--batches-dir=<dir>]",
    );
  });

  test("parses batch execution arguments", () => {
    expect(
      parseCliArgs([
        "batches:execute",
        "--batch-id=cli-preflight",
        "--batches-dir=references/batch-specs",
        "--agent=references/agent-profiles/codex-worker.json",
        "--worktrees-dir=.worktrees",
        "--runs-dir=runs",
        "--state-dir=runs",
        "--target-branch=main",
        "--codex-bin=/tmp/fake-codex",
        "--runtime=codex-sdk",
      ]),
    ).toEqual({
      command: "batches:execute",
      batchId: "cli-preflight",
      batchesDir: "references/batch-specs",
      agentPath: "references/agent-profiles/codex-worker.json",
      worktreesDir: ".worktrees",
      runsDir: "runs",
      stateDir: "runs",
      targetBranch: "main",
      codexBin: "/tmp/fake-codex",
      runtimeKind: "codex-sdk",
    });
    expect(() => parseCliArgs(["batches:execute", "--batch-id=cli-preflight", "--runtime=unknown"])).toThrow(
      "runtime must be exec-json or codex-sdk",
    );
    expect(() => parseCliArgs(["batches:execute"])).toThrow(
      "usage: bun run samantha batches:execute --batch=<path> OR --batch-id=<id> [--batches-dir=<dir>] [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--state-dir=<dir>] [--target-branch=<branch>] [--codex-bin=<path>] [--runtime=exec-json|codex-sdk]",
    );
  });

  test("parses batch rejection arguments", () => {
    expect(
      parseCliArgs([
        "batches:reject",
        "--batch-id=cli-preflight",
        "--batches-dir=references/batch-specs",
        "--state-dir=runs",
        "--reason=stale base closure",
      ]),
    ).toEqual({
      command: "batches:reject",
      batchId: "cli-preflight",
      batchesDir: "references/batch-specs",
      stateDir: "runs",
      reason: "stale base closure",
    });
    expect(() => parseCliArgs(["batches:reject", "--batch=references/batch-specs/one.json"])).toThrow(
      "usage: bun run samantha batches:reject --batch=<path> OR --batch-id=<id> --reason=<reason> [--batches-dir=<dir>] [--state-dir=<dir>]",
    );
  });

  test("parses batch replacement arguments", () => {
    expect(
      parseCliArgs([
        "batches:replace",
        "--batch-id=cli-preflight",
        "--batches-dir=references/batch-specs",
        "--replacement-batch-id=cli-replacement",
        "--replacement=references/batch-specs/cli-replacement.json",
        "--replan-evidence=runs/batch-replan-evidence.jsonl",
        "--state-dir=runs",
      ]),
    ).toEqual({
      command: "batches:replace",
      batchId: "cli-preflight",
      batchesDir: "references/batch-specs",
      replacementBatchId: "cli-replacement",
      replacementPath: "references/batch-specs/cli-replacement.json",
      replanEvidencePath: "runs/batch-replan-evidence.jsonl",
      stateDir: "runs",
    });
    expect(() => parseCliArgs(["batches:replace", "--batch=references/batch-specs/one.json"])).toThrow(
      "usage: bun run samantha batches:replace --batch=<path> OR --batch-id=<id> --replacement-batch-id=<id> --replacement=<path> --replan-evidence=<path> [--batches-dir=<dir>] [--state-dir=<dir>]",
    );
  });

  test("parses batch list and show arguments", () => {
    expect(parseCliArgs(["batches:list", "--batches-dir=references/batch-specs"])).toEqual({
      command: "batches:list",
      batchesDir: "references/batch-specs",
    });
    expect(parseCliArgs(["batches:show", "--batch-id=cli-preflight"])).toEqual({
      command: "batches:show",
      batchId: "cli-preflight",
    });
  });

  test("parses BatchPlan list, show, review, draft, and prepare arguments", () => {
    expect(parseCliArgs(["batch-plans:list", "--drafts-dir=references/batch-plans"])).toEqual({
      command: "batch-plans:list",
      draftsDir: "references/batch-plans",
    });
    expect(
      parseCliArgs([
        "batch-plans:show",
        "--draft-id=cli-batch-plan-draft",
        "--drafts-dir=references/batch-plans",
      ]),
    ).toEqual({
      command: "batch-plans:show",
      draftId: "cli-batch-plan-draft",
      draftsDir: "references/batch-plans",
    });
    expect(
      parseCliArgs([
        "batch-plans:review",
        "--draft-id=cli-batch-plan-draft",
        "--drafts-dir=references/batch-plans",
      ]),
    ).toEqual({
      command: "batch-plans:review",
      draftId: "cli-batch-plan-draft",
      draftsDir: "references/batch-plans",
    });
    expect(
      parseCliArgs([
        "batch-plans:draft",
        "--input=references/batch-plans/input.json",
        "--drafts-dir=references/batch-plans",
        "--execution-batches-dir=/tmp/execution-batches",
      ]),
    ).toEqual({
      command: "batch-plans:draft",
      inputPath: "references/batch-plans/input.json",
      draftsDir: "references/batch-plans",
      executionBatchesDir: "/tmp/execution-batches",
    });
    expect(
      parseCliArgs([
        "batch-plans:prepare",
        "--draft-id=cli-batch-plan-draft",
        "--execution-batches-dir=/tmp/execution-batches",
        "--drafts-dir=references/batch-plans",
        "--repo-root=/tmp/samantha-repo",
        "--task-spec-dir=references/tasks",
        "--batch-id=cli-execution-batch",
      ]),
    ).toEqual({
      command: "batch-plans:prepare",
      draftId: "cli-batch-plan-draft",
      executionBatchesDir: "/tmp/execution-batches",
      draftsDir: "references/batch-plans",
      repoRoot: "/tmp/samantha-repo",
      taskSpecDir: "references/tasks",
      batchId: "cli-execution-batch",
    });
    expect(() => parseCliArgs(["batch-plans:show"])).toThrow(
      "usage: bun run samantha batch-plans:show --draft-id=<id> [--drafts-dir=<dir>]",
    );
    expect(() => parseCliArgs(["batch-plans:review"])).toThrow(
      "usage: bun run samantha batch-plans:review --draft-id=<id> [--drafts-dir=<dir>]",
    );
    expect(() => parseCliArgs(["batch-plans:draft"])).toThrow(
      "usage: bun run samantha batch-plans:draft --input=<json> [--drafts-dir=<dir>] [--execution-batches-dir=<dir>]",
    );
    expect(() => parseCliArgs(["batch-plans:prepare", "--draft-id=cli-batch-plan-draft"])).toThrow(
      "usage: bun run samantha batch-plans:prepare --draft-id=<id> --execution-batches-dir=<dir> [--drafts-dir=<dir>] [--repo-root=<repo>] [--task-spec-dir=<dir>] [--batch-id=<id>]",
    );
  });

  test("batch preflight command prints passing preflight result", async () => {
    const batchPath = await writeCliBatchPreflightFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      mayDispatch: true,
      violations: [],
      tasks: [
        {
          taskId: "task-a",
          taskSpecPath: "references/tasks/task-a.json",
          normalizedTargetFiles: ["tests/task-a.test.ts"],
          normalizedForbiddenChanges: ["runs/**"],
          serialOnlyMatches: [],
        },
      ],
    });
    expect(result.writeSetProofs).toContainEqual({
      dispatchGroup: "group-1",
      taskIds: ["task-a"],
      normalizedTargetFilesByTaskId: {
        "task-a": ["tests/task-a.test.ts"],
      },
    });
  });

  test("batch preflight command returns non-zero when preflight rejects dispatch", async () => {
    const batchPath = await writeCliBatchPreflightFixture({ targetFiles: ["src/different.ts"] });

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: task-a",
    );
  });

  test("batch preflight command applies verification and lifecycle policy contract from path", async () => {
    const { batchPath } = await writeCliBatchStoreFixture(
      {},
      {
        verification: cliVerification({ afterFinalAcceptedMerge: [] }),
        lifecyclePolicy: cliLifecyclePolicy({
          staleBase: "auto_rebase" as BatchSpec["lifecyclePolicy"]["staleBase"],
        }),
      },
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.violations).toContain("verification.afterFinalAcceptedMerge must be a non-empty string array");
    expect(result.violations).toContain("lifecyclePolicy.staleBase must be block_and_replan");
  });

  test("batch preflight command returns non-zero when BatchSpec baseCommit is stale", async () => {
    const { batchPath, root, baseCommit } = await writeCliBatchStoreFixture();
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance cli fixture"], root);
    const head = await gitHead(root);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      `repoRoot HEAD must match baseCommit before dispatch: HEAD ${head} != baseCommit ${baseCommit}`,
    );
  });

  test("batch list command prints store summaries in stable order", async () => {
    const { batchesDir, root } = await writeCliBatchStoreFixture();
    const secondBatch = {
      schemaVersion: 1,
      batchId: "alpha-batch",
      repoRoot: root,
      baseCommit: "0123456789abcdef0123456789abcdef01234567",
      status: "planned",
      serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
      tasks: [cliBatchTask("task-a")],
      dependencies: [],
      integrationQueue: [
        {
          order: 1,
          taskId: "task-a",
          requiresAccepted: [],
          focusedVerifyCommands: ["bun test task-a"],
          status: "pending",
        },
      ],
      verification: cliVerification(),
      lifecyclePolicy: cliLifecyclePolicy(),
    } satisfies BatchSpec;
    await writeFile(join(batchesDir, "alpha-batch.json"), `${JSON.stringify(secondBatch, null, 2)}\n`, "utf8");

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:list", `--batches-dir=${batchesDir}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout).map((item: { batchId: string }) => item.batchId)).toEqual([
      "alpha-batch",
      "cli-preflight",
    ]);
  });

  test("batch show command prints BatchSpec JSON by id", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:show", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      batchId: "cli-preflight",
      status: "planned",
      tasks: [{ taskId: "task-a" }],
    });
  });

  test("BatchPlan list command prints draft summaries from the requested drafts directory", async () => {
    const { draftsDir } = await writeCliBatchPlanStoreFixture([
      cliBatchPlanDraft({ draftId: "z-cli-plan" }),
      cliBatchPlanDraft({ draftId: "a-cli-plan" }),
    ]);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batch-plans:list", `--drafts-dir=${draftsDir}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toEqual([
      expect.objectContaining({
        draftId: "a-cli-plan",
        classification: "routine_writer_batch",
        proposedTaskCount: 1,
      }),
      expect.objectContaining({
        draftId: "z-cli-plan",
        classification: "routine_writer_batch",
        proposedTaskCount: 1,
      }),
    ]);
  });

  test("BatchPlan show command prints draft JSON by id from the requested drafts directory", async () => {
    const { draftsDir } = await writeCliBatchPlanStoreFixture([
      cliBatchPlanDraft({ draftId: "shown-cli-plan", sourceGoal: "Show this stored BatchPlan draft." }),
    ]);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batch-plans:show", "--draft-id=shown-cli-plan", `--drafts-dir=${draftsDir}`]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      draftId: "shown-cli-plan",
      sourceGoal: "Show this stored BatchPlan draft.",
      proposedTasks: [{ id: "cli-batch-plan-task" }],
    });
  });

  test("BatchPlan review command prints prepare eligibility without writing execution artifacts", async () => {
    const { draftsDir, root } = await writeCliBatchPlanStoreFixture([
      cliBatchPlanDraft({ draftId: "reviewed-cli-plan" }),
    ]);

    const { exitCode, stdout } = await runCliCapturingStdout([
      "batch-plans:review",
      "--draft-id=reviewed-cli-plan",
      `--drafts-dir=${draftsDir}`,
    ]);

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      reviewed: true,
      draftId: "reviewed-cli-plan",
      draftPath: join(draftsDir, "reviewed-cli-plan.json"),
      classification: "routine_writer_batch",
      promotionReadiness: { status: "ready" },
      prepareEligible: true,
      trustedForDispatch: false,
      pushPerformed: false,
      violations: [],
    });
    expect(result.nextAction).toContain("batch-plans:prepare");
    expect(result.nextAction).toContain("prepare remains the deterministic gate");
    await expect(pathExists(join(root, "execution-batches"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "batch-specs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "runs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "worktrees"))).resolves.toBe(false);
  });

  test("BatchPlan draft command authors a draft from JSON input without preparing or dispatching", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-author-batch-plan-"));
    tmpRoots.push(root);
    const draftsDir = join(root, "references", "batch-plans");
    const executionBatchesDir = join(root, "execution-batches");
    const inputPath = join(root, "batch-plan-input.json");
    await writeFile(inputPath, `${JSON.stringify(cliBatchPlanDraftInput(), null, 2)}\n`, "utf8");

    const { exitCode, stdout } = await runCliCapturingStdout([
      "batch-plans:draft",
      `--input=${inputPath}`,
      `--drafts-dir=${draftsDir}`,
      `--execution-batches-dir=${executionBatchesDir}`,
    ]);

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      pass: true,
      written: true,
      draftId: "cli-authored-batch-plan",
      draftPath: join(draftsDir, "cli-authored-batch-plan.json"),
      sourceGoal:
        "Create a local CLI command that turns the CEO's natural-language source goal into BatchPlanDraft evidence.",
      classification: "routine_writer_batch",
      repoInspectionSummary: "BatchPlanDraft authoring core exists; local CLI authoring command is missing.",
      proposedTaskCount: 1,
      blockedPlaceholderCount: 0,
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
      violations: [],
      nextAction: `run batch-plans:prepare --draft-id=cli-authored-batch-plan --execution-batches-dir=${executionBatchesDir}`,
    });
    expect(result).not.toHaveProperty("batchPreflight");
    expect(result).not.toHaveProperty("executionBatchSpecRecord");

    const stored = JSON.parse(await readFile(join(draftsDir, "cli-authored-batch-plan.json"), "utf8"));
    expect(stored.sourceGoal).toContain("natural-language source goal");
    expect(stored.proposedTasks[0]).toMatchObject({
      id: "cli-authoring-command",
      targetFileHints: ["src/cli.ts", "tests/cli.test.ts"],
    });
    await expect(pathExists(executionBatchesDir)).resolves.toBe(false);
    await expect(pathExists(join(root, "runs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "worktrees"))).resolves.toBe(false);
  });

  test("BatchPlan draft command returns non-zero for duplicate draftId without overwriting", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-duplicate-batch-plan-"));
    tmpRoots.push(root);
    const draftsDir = join(root, "references", "batch-plans");
    const inputPath = join(root, "batch-plan-input.json");
    const secondInputPath = join(root, "batch-plan-input-second.json");
    await writeFile(inputPath, `${JSON.stringify(cliBatchPlanDraftInput({ draftId: "duplicate-cli-plan" }), null, 2)}\n`, "utf8");
    await writeFile(
      secondInputPath,
      `${JSON.stringify(
        cliBatchPlanDraftInput({
          draftId: "duplicate-cli-plan",
          sourceGoal: "Second CLI authoring attempt must not replace the original draft.",
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(
      runCliCapturingStdout(["batch-plans:draft", `--input=${inputPath}`, `--drafts-dir=${draftsDir}`]),
    ).resolves.toMatchObject({ exitCode: 0 });
    const draftPath = join(draftsDir, "duplicate-cli-plan.json");
    const before = await readFile(draftPath, "utf8");

    const { exitCode, stdout } = await runCliCapturingStdout([
      "batch-plans:draft",
      `--input=${secondInputPath}`,
      `--drafts-dir=${draftsDir}`,
    ]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({
      pass: false,
      written: false,
      draftId: "duplicate-cli-plan",
      violations: ["batch plan draft already exists: duplicate-cli-plan"],
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
    });
    await expect(readFile(draftPath, "utf8")).resolves.toBe(before);
  });

  test("BatchPlan draft command returns validator rejection for unstructured placeholders", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-invalid-batch-plan-"));
    tmpRoots.push(root);
    const draftsDir = join(root, "references", "batch-plans");
    const inputPath = join(root, "batch-plan-input.json");
    await writeFile(
      inputPath,
      `${JSON.stringify(
        cliBatchPlanDraftInput({
          draftId: "invalid-placeholder-cli-plan",
          proposedTasks: [
            {
              ...cliBatchPlanDraftInput().proposedTasks[0],
              verifyCommandHints: ["TODO choose focused verification"],
            },
          ],
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { exitCode, stdout } = await runCliCapturingStdout([
      "batch-plans:draft",
      `--input=${inputPath}`,
      `--drafts-dir=${draftsDir}`,
    ]);

    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      pass: false,
      written: false,
      draftId: "invalid-placeholder-cli-plan",
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
    });
    expect(result.violations[0]).toContain(
      "proposedTasks[].verifyCommandHints must not contain unresolved placeholder text: cli-authoring-command has TODO choose focused verification",
    );
    await expect(pathExists(join(draftsDir, "invalid-placeholder-cli-plan.json"))).resolves.toBe(false);
  });

  test("BatchPlan draft command stores non-routine route reports without recommending prepare", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-route-batch-plan-"));
    tmpRoots.push(root);
    const draftsDir = join(root, "references", "batch-plans");
    const inputPath = join(root, "batch-plan-input.json");
    await writeFile(
      inputPath,
      `${JSON.stringify(
        cliBatchPlanDraftInput({
          draftId: "architecture-cli-plan",
          classification: "architecture",
          proposedTasks: [],
          parallelizationHints: [],
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { exitCode, stdout } = await runCliCapturingStdout([
      "batch-plans:draft",
      `--input=${inputPath}`,
      `--drafts-dir=${draftsDir}`,
    ]);

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      pass: true,
      written: true,
      draftId: "architecture-cli-plan",
      classification: "architecture",
      repoInspectionSummary: "BatchPlanDraft authoring core exists; local CLI authoring command is missing.",
      promotionReadiness: {
        status: "blocked",
        reasons: ["architecture requests must route before routine writer batch promotion."],
      },
      proposedTaskCount: 0,
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
      nextAction: "route to architecture path before routine writer dispatch",
    });
    expect(result.nextAction).not.toContain("batch-plans:prepare");
  });

  test("BatchPlan prepare command returns non-zero when the operator blocks preparation", async () => {
    const { draftsDir } = await writeCliBatchPlanStoreFixture([
      cliBatchPlanDraft({
        draftId: "blocked-cli-plan",
        classification: "architecture",
        proposedTasks: [],
        parallelizationHints: [],
        promotionReadiness: {
          status: "blocked",
          reasons: ["Architecture work must stay in CEO planning mode."],
        },
      }),
    ]);
    const executionRoot = await mkdtemp(join(tmpdir(), "samantha-cli-batch-plan-blocked-execution-"));
    tmpRoots.push(executionRoot);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batch-plans:prepare",
          "--draft-id=blocked-cli-plan",
          `--drafts-dir=${draftsDir}`,
          `--execution-batches-dir=${join(executionRoot, "execution-batches")}`,
        ]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      pass: false,
      prepared: false,
      draftId: "blocked-cli-plan",
      sourceGoal: "Expose Phase 5.5 BatchPlan through local CLI commands.",
      repoInspectionSummary: "BatchPlan operator and draft store exist; CLI wiring is missing.",
      proposedTaskCount: 0,
      taskSpecWrites: [],
      planningCommit: null,
      executionBatchSpecRecord: null,
      prepareOutcome: "blocked",
      preflightOutcome: "not_run",
      nextAction: "route to architecture path before routine writer dispatch",
    });
    expect(result.violations).toContain("classification must be routine_writer_batch to promote");
  });

  test("BatchPlan prepare command reports a ready execution batch without dispatching it", async () => {
    const { draftsDir, executionBatchesDir, root } = await writeCliBatchPlanRepoFixture(
      cliBatchPlanDraft({ draftId: "ready-cli-plan" }),
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batch-plans:prepare",
          "--draft-id=ready-cli-plan",
          `--drafts-dir=${draftsDir}`,
          `--execution-batches-dir=${executionBatchesDir}`,
          `--repo-root=${root}`,
          "--task-spec-dir=references/tasks",
          "--batch-id=ready-cli-execution",
        ]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      pass: true,
      prepared: true,
      draftId: "ready-cli-plan",
      batchId: "ready-cli-execution",
      sourceGoal: "Expose Phase 5.5 BatchPlan through local CLI commands.",
      repoInspectionSummary: "BatchPlan operator and draft store exist; CLI wiring is missing.",
      proposedTaskCount: 1,
      prepareOutcome: "passed",
      preflightOutcome: "passed",
      pushPerformed: false,
      executionBatchSpecRecord: {
        batchId: "ready-cli-execution",
      },
      batchPreflight: {
        mayDispatch: true,
      },
    });
    expect(result.taskSpecWrites.map((record: { path: string }) => record.path)).toEqual([
      "references/tasks/cli-batch-plan-task.json",
    ]);
    expect(result.nextAction).toContain("batches:execute");
    expect(result.nextAction).toContain("--batch-id=ready-cli-execution");
    await expect(readFile(join(executionBatchesDir, "ready-cli-execution.json"), "utf8")).resolves.toContain(
      '"batchId": "ready-cli-execution"',
    );
    await expect(pathExists(join(root, "runs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "worktrees"))).resolves.toBe(false);
  });

  test("batch show command fails clearly when id is missing from the store", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    await expect(main(["batches:show", "--batch-id=missing-batch", `--batches-dir=${batchesDir}`])).rejects.toThrow(
      "batch not found: missing-batch",
    );
  });

  test("batch preflight command can read BatchSpec by id", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      mayDispatch: true,
      violations: [],
    });
  });

  test("batch preflight by id returns non-zero when preflight rejects dispatch", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture({ targetFiles: ["src/different.ts"] });

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout).violations).toContain(
      "tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: task-a",
    );
  });

  test("batch preflight by id applies the same verification and lifecycle policy contract", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture(
      {},
      {
        verification: cliVerification({ afterEachAcceptedMerge: [] }),
        lifecyclePolicy: cliLifecyclePolicy({
          cleanup: "auto_cleanup_after_failure" as BatchSpec["lifecyclePolicy"]["cleanup"],
        }),
      },
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.violations).toContain("verification.afterEachAcceptedMerge must be a non-empty string array");
    expect(result.violations).toContain(
      "lifecyclePolicy.cleanup must be explicit_per_worker_lifecycle_after_resolution",
    );
  });

  test("batch preflight by id applies the same stale base gate", async () => {
    const { batchesDir, root, baseCommit } = await writeCliBatchStoreFixture();
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance cli fixture"], root);
    const head = await gitHead(root);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      `repoRoot HEAD must match baseCommit before dispatch: HEAD ${head} != baseCommit ${baseCommit}`,
    );
  });

  test("batch execute records stale replan evidence without mutating the source BatchSpec", async () => {
    const { batchPath, batchesDir, root, baseCommit } = await writeCliBatchStoreFixture();
    const beforeBatchJson = await readFile(batchPath, "utf8");
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance cli fixture"], root);
    const head = await gitHead(root);

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:execute",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          `--runs-dir=${join(root, "runs")}`,
          "--target-branch=main",
          "--codex-bin=/bin/false",
        ]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.status).toBe("preflight_failed");
    expect(result.staleBaseReplan).toMatchObject({
      batchId: "cli-preflight",
      policy: "block_and_replan",
      decision: "blocked_for_replan",
      trigger: "preflight",
      sourceBaseCommit: baseCommit,
      observedHead: head,
      sourceBatchSpecMutation: "not_performed",
      replanArtifactPath: null,
    });
    expect(await readFile(batchPath, "utf8")).toBe(beforeBatchJson);
    const evidence = JSON.parse(await readFile(join(root, "runs", "batch-replan-evidence.jsonl"), "utf8"));
    expect(evidence).toEqual(result.staleBaseReplan);
  });

  test("batch reject command mutates only source BatchSpec status and writes lifecycle audit", async () => {
    const { batchPath, batchesDir, root } = await writeCliBatchStoreFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:reject",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          `--state-dir=${join(root, "runs")}`,
          "--reason=stale base closure",
        ]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.evidence).toMatchObject({
      batchId: "cli-preflight",
      operation: "mark_rejected",
      authority: "samantha_cli",
      sourceBatchSpecMutation: "performed",
      reason: "stale base closure",
      before: { status: "planned" },
      after: { status: "rejected" },
    });
    const mutated = JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec;
    expect(mutated.status).toBe("rejected");
    expect(mutated.tasks).toEqual([
      expect.objectContaining({ taskId: "task-a", status: "planned" }),
    ]);
    expect(mutated.integrationQueue).toEqual([
      expect.objectContaining({ taskId: "task-a", status: "pending" }),
    ]);
    const audit = JSON.parse(await readFile(join(root, "runs", "batch-lifecycle-audit.jsonl"), "utf8"));
    expect(audit).toEqual(result.evidence);
  });

  test("batch replace command creates planned replacement from stale replan evidence without mutating source", async () => {
    const { batchPath, batchesDir, root, baseCommit } = await writeCliBatchStoreFixture();
    const sourceBefore = await readFile(batchPath, "utf8");
    const observedHead = "1111111111111111111111111111111111111111";
    const replanEvidencePath = join(root, "runs", "batch-replan-evidence.jsonl");
    const replacementPath = join(batchesDir, "cli-replacement.json");
    await mkdir(join(root, "runs"), { recursive: true });
    await writeFile(
      replanEvidencePath,
      `${JSON.stringify({
        schemaVersion: 1,
        batchId: "cli-preflight",
        policy: "block_and_replan",
        decision: "blocked_for_replan",
        trigger: "preflight",
        sourceBaseCommit: baseCommit,
        observedHead,
        targetBranch: "main",
        sourceBatchSpecMutation: "not_performed",
        replanArtifactPath: null,
        reason: "stale base",
        violations: ["repoRoot HEAD must match baseCommit before dispatch"],
        createdAt: "2026-05-14T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:replace",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          "--replacement-batch-id=cli-replacement",
          `--replacement=${replacementPath}`,
          `--replan-evidence=${replanEvidencePath}`,
          `--state-dir=${join(root, "runs")}`,
        ]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(await readFile(batchPath, "utf8")).toBe(sourceBefore);
    expect(result.spec).toMatchObject({
      batchId: "cli-replacement",
      baseCommit: observedHead,
      status: "planned",
    });
    expect(result.spec.tasks).toEqual([
      expect.objectContaining({ taskId: "task-a", status: "planned" }),
    ]);
    expect(result.spec.integrationQueue).toEqual([
      expect.objectContaining({ taskId: "task-a", status: "pending" }),
    ]);
    expect(JSON.parse(await readFile(replacementPath, "utf8"))).toEqual(result.spec);
    expect(result.evidence).toMatchObject({
      operation: "create_replacement",
      authority: "samantha_cli",
      sourceBatchSpecMutation: "not_performed",
      sourceBatchId: "cli-preflight",
      sourceBaseCommit: baseCommit,
      observedHead,
      replanEvidencePath,
      replacementBatchId: "cli-replacement",
      replacementPath,
    });
    const audit = JSON.parse(await readFile(join(root, "runs", "batch-replacement-audit.jsonl"), "utf8"));
    expect(audit).toEqual(result.evidence);
  });

  test("batch replacement dogfoods stale-base evidence through replacement preflight", async () => {
    const { batchPath, batchesDir, root, baseCommit } = await writeCliBatchStoreFixture();
    const sourceBefore = await readFile(batchPath, "utf8");
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance cli replacement fixture"], root);
    const head = await gitHead(root);
    const replanEvidencePath = join(root, "runs", "batch-replan-evidence.jsonl");
    const replacementPath = join(batchesDir, "cli-replacement-dogfood.json");

    let stdout = "";
    const originalLog = console.log;
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:execute",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          `--runs-dir=${join(root, "runs")}`,
          "--target-branch=main",
          "--codex-bin=/bin/false",
        ]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const executeResult = JSON.parse(stdout);
    expect(executeResult.status).toBe("preflight_failed");
    expect(executeResult.staleBaseReplan).toMatchObject({
      batchId: "cli-preflight",
      policy: "block_and_replan",
      decision: "blocked_for_replan",
      trigger: "preflight",
      sourceBaseCommit: baseCommit,
      observedHead: head,
      sourceBatchSpecMutation: "not_performed",
      replanArtifactPath: null,
    });
    expect(JSON.parse(await readFile(replanEvidencePath, "utf8"))).toEqual(executeResult.staleBaseReplan);
    expect(await readFile(batchPath, "utf8")).toBe(sourceBefore);

    stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:replace",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          "--replacement-batch-id=cli-replacement-dogfood",
          `--replacement=${replacementPath}`,
          `--replan-evidence=${replanEvidencePath}`,
          `--state-dir=${join(root, "runs")}`,
        ]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const replaceResult = JSON.parse(stdout);
    expect(await readFile(batchPath, "utf8")).toBe(sourceBefore);
    expect(replaceResult.spec).toMatchObject({
      batchId: "cli-replacement-dogfood",
      baseCommit: head,
      status: "planned",
    });
    expect(replaceResult.evidence).toMatchObject({
      operation: "create_replacement",
      sourceBatchSpecMutation: "not_performed",
      sourceBatchId: "cli-preflight",
      sourceBaseCommit: baseCommit,
      observedHead: head,
      replanEvidencePath,
      replacementBatchId: "cli-replacement-dogfood",
      replacementPath,
    });
    expect(JSON.parse(await readFile(replacementPath, "utf8"))).toEqual(replaceResult.spec);

    stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${replacementPath}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      mayDispatch: true,
      violations: [],
    });
    expect(await readFile(batchPath, "utf8")).toBe(sourceBefore);

    stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main([
          "batches:reject",
          "--batch-id=cli-preflight",
          `--batches-dir=${batchesDir}`,
          `--state-dir=${join(root, "runs")}`,
          "--reason=replacement dogfood closed source separately",
        ]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const rejectResult = JSON.parse(stdout);
    expect(rejectResult.evidence).toMatchObject({
      operation: "mark_rejected",
      sourceBatchSpecMutation: "performed",
      before: { status: "planned" },
      after: { status: "rejected" },
    });
    expect((JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec).status).toBe("rejected");
  });
});
