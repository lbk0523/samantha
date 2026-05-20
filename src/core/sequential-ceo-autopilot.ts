import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve } from "node:path";
import type { HarnessResult, TaskSpec, WorktreeAllocation } from "./contracts";
import { git, gitRaw } from "./git";
import { actionableCommitForRunLog } from "./run-commit";
import type { RunAcceptResult } from "./run-accept";
import type { WorkerRunLog, WorkerRunTrajectoryEntry } from "./run-log";

export const SEQUENTIAL_CONTINUATION_ACTION_TYPES = [
  "manual_decision",
  "report_only",
  "readiness_check",
  "run_task",
  "batch_plan",
] as const;
export type SequentialContinuationActionType = (typeof SEQUENTIAL_CONTINUATION_ACTION_TYPES)[number];

export const SEQUENTIAL_CONTINUATION_SLICE_STATUSES = [
  "completed",
  "active",
  "ready",
  "pending",
  "blocked",
  "dropped",
] as const;
export type SequentialContinuationSliceStatus = (typeof SEQUENTIAL_CONTINUATION_SLICE_STATUSES)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS = [
  "run_log",
  "readiness_report",
  "continuation_report",
  "report_review",
] as const;
export type SequentialContinuationStatusEvidenceKind =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS = [
  "passed",
  "clear",
  "completed",
  "blocked",
  "failed",
  "recommendation_only",
] as const;
export type SequentialContinuationStatusEvidenceResult =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES = ["completed", "blocked", "failed"] as const;
export type SequentialContinuationStatusUpdateOutcome =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES)[number];

export const SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS = [
  "decision_required",
  "authority_boundary_without_review",
  "scope_or_repo_evidence_missing",
  "dirty_or_stale_repo",
  "missing_harness_result",
  "scope_check_failed",
  "verification_rework_spent",
  "forbidden_capability_required",
  "ambiguous_evidence_update",
] as const;
export type SequentialContinuationStopConditionId = (typeof SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS)[number];

export interface SequentialContinuationCurrentSlice {
  id: string;
  status: SequentialContinuationSliceStatus;
  actionType: SequentialContinuationActionType;
  dependencyStatus: "met" | "blocked";
  prerequisites: string[];
  targetFiles?: string[];
  forbiddenChanges?: string[];
  verifyCommands?: string[];
}

export interface SequentialContinuationAutonomyEnvelope {
  canSelectNextReadySlice: true;
  canRunReadinessChecks: true;
  canRunReportOnlyActions: true;
  canRunExplicitTaskSpecs: true;
  canRunRoutineBatchActions: true;
  canUpdateContinuationStatus: true;
  canLocallyCommitThroughExistingGates: true;
  pushAllowed: false;
  maxFailedEvidenceReworkCycles: 1;
}

export interface SequentialContinuationStopConditionCheck {
  id: SequentialContinuationStopConditionId;
  active: boolean;
  evidence: string;
}

export interface SequentialContinuationEvidenceReference {
  path: string;
  summary: string;
  kind?: SequentialContinuationStatusEvidenceKind;
  result?: SequentialContinuationStatusEvidenceResult;
}

export interface SequentialContinuationNextStep {
  kind: "samantha_command" | "blocked_report";
  value: string;
}

export interface SequentialContinuationRunTaskCandidate {
  taskSpecPath: string;
  requiredRuntime: string;
  executionMode: string;
  worktreePolicy: string;
  lifecycleOwner: string;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  evidence: {
    taskSpecCommit: string;
    taskSpecStatus: string;
    freshnessEvidencePath: string;
  };
  expectedSideEffects: {
    runTaskCalled: boolean;
    workersDispatched: boolean;
    worktreesCreated: boolean;
    lifecycleMutated: boolean;
    mergePerformed: boolean;
    cleanupPerformed: boolean;
    commitPerformed: boolean;
    pushPerformed: boolean;
  };
}

export interface SequentialContinuationRunTaskExecution {
  taskSpecPath: string;
  requiredRuntime: string;
  executionMode: string;
  worktreePolicy: string;
  lifecycleOwner: string;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  pushAllowed: false;
  expectedSideEffects: {
    runTaskCalled: boolean;
    workersDispatched: boolean;
    worktreesCreated: boolean;
    runsCreated: boolean;
    deterministicVerification: boolean;
    batchesExecuteCalled: boolean;
    acceptPerformed: boolean;
    lifecycleMutated: boolean;
    mergePerformed: boolean;
    cleanupPerformed: boolean;
    commitPerformed: boolean;
    pushPerformed: boolean;
    multiStepLoopStarted: boolean;
    successorExecuted: boolean;
  };
}

export interface SequentialContinuationRunAcceptCandidate {
  runLogPath: string;
  expectedRunId: string;
  expectedTaskId: string;
  expectedCommit: string;
  expectedBaseCommit: string;
  targetBranch?: string;
  requiredRuntime: string;
  executionMode: string;
  lifecycleOwner: string;
  pushAllowed: false;
  expectedSideEffects: {
    runsAcceptCalled: boolean;
    mergeGateRecorded: boolean;
    mergePerformed: boolean;
    lifecycleMutated: boolean;
    cleanupPerformed: boolean;
    commitPerformed: boolean;
    pushPerformed: boolean;
    runTaskCalled: boolean;
    workersDispatched: boolean;
    batchesExecuteCalled: boolean;
    multiStepLoopStarted: boolean;
    successorExecuted: boolean;
  };
}

export interface SequentialContinuationRunAcceptExecution {
  runLogPath: string;
  expectedRunId: string;
  expectedTaskId: string;
  expectedCommit: string;
  expectedBaseCommit: string;
  targetBranch?: string;
  requiredRuntime: string;
  executionMode: string;
  lifecycleOwner: string;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  pushAllowed: false;
  expectedSideEffects: {
    runsAcceptCalled: boolean;
    mergeGateRecorded: boolean;
    mergePerformed: boolean;
    lifecycleMutated: boolean;
    cleanupPerformed: boolean;
    commitPerformed: boolean;
    pushPerformed: boolean;
    runTaskCalled: boolean;
    workersDispatched: boolean;
    batchesExecuteCalled: boolean;
    multiStepLoopStarted: boolean;
    successorExecuted: boolean;
  };
}

export interface SequentialContinuationArtifact {
  schemaVersion: 1;
  artifactId: string;
  initiativePath: string;
  createdAt: string;
  updatedAt: string;
  currentSlice: SequentialContinuationCurrentSlice;
  autonomyEnvelope: SequentialContinuationAutonomyEnvelope;
  stopConditionChecklist: SequentialContinuationStopConditionCheck[];
  evidenceReferences: SequentialContinuationEvidenceReference[];
  nextStep: SequentialContinuationNextStep;
  nextArtifactPath?: string | null;
  nextArtifactExpectedSliceId?: string | null;
  runTaskCandidate?: SequentialContinuationRunTaskCandidate | null;
  runTaskExecution?: SequentialContinuationRunTaskExecution | null;
  runAcceptCandidate?: SequentialContinuationRunAcceptCandidate | null;
  runAcceptExecution?: SequentialContinuationRunAcceptExecution | null;
}

export interface SequentialContinuationNextArtifactReport {
  previousArtifactPath: string;
  repoRoot: string;
  nextArtifactPath: string | null;
  nextArtifactExpectedSliceId: string | null;
  normalizedNextArtifactPath: string | null;
  resolvedNextArtifactPath: string | null;
  status: "absent" | "accepted" | "blocked";
  successor: {
    artifactPath: string;
    currentSliceId: string | null;
    initiativePath: string | null;
    actionType: string | null;
  } | null;
  inspectedArtifactPaths: string[];
  inspectedSliceIds: string[];
  blockingReasons: string[];
  trustedStateChanges: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationRunTaskPreflightReport {
  artifactPath: string;
  repoRoot: string;
  taskSpecPath: string | null;
  normalizedTaskSpecPath: string | null;
  resolvedTaskSpecPath: string | null;
  status: "absent" | "accepted" | "blocked";
  task: {
    id: string;
    title: string;
  } | null;
  requiredRuntime: string | null;
  executionMode: string | null;
  worktreePolicy: string | null;
  lifecycleOwner: string | null;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  blockingReasons: string[];
  trustedStateChanges: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    lifecycleMutated: false;
    mergePerformed: false;
    cleanupPerformed: false;
    commitPerformed: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationRunAcceptPreflightReport {
  artifactPath: string;
  repoRoot: string;
  runLogPath: string | null;
  normalizedRunLogPath: string | null;
  resolvedRunLogPath: string | null;
  status: "absent" | "accepted" | "blocked";
  run: {
    id: string;
    taskId: string;
  } | null;
  expectedRunId: string | null;
  expectedTaskId: string | null;
  expectedCommit: string | null;
  expectedBaseCommit: string | null;
  targetBranch: string | null;
  requiredRuntime: string | null;
  executionMode: string | null;
  lifecycleOwner: string | null;
  pushAllowed: false | null;
  cleanupReadiness: {
    worktreePath: string;
    branch: string;
    classification: "ready" | "blocked";
    violations: string[];
  } | null;
  blockingReasons: string[];
  trustedStateChanges: false;
  pushPerformed: false;
  sideEffects: {
    runsAcceptCalled: false;
    mergeGateRecorded: false;
    mergePerformed: false;
    lifecycleMutated: false;
    cleanupPerformed: false;
    commitPerformed: false;
    pushPerformed: false;
    runTaskCalled: false;
    workersDispatched: false;
    batchesExecuteCalled: false;
    multiStepLoopStarted: false;
    successorExecuted: false;
  };
}

export interface SequentialContinuationRunTaskExecutionExecutorInput {
  repoRoot: string;
  artifactPath: string;
  taskPath: string;
  normalizedTaskSpecPath: string;
  resolvedTaskSpecPath: string;
  runtimeKind: "codex-sdk";
}

export interface SequentialContinuationRunTaskExecutionEvidence {
  runLogPath?: string;
  executorEvidencePath?: string;
  pass: boolean;
  harnessResult?: HarnessResult | null;
}

export type SequentialContinuationRunTaskExecutionExecutor = (
  input: SequentialContinuationRunTaskExecutionExecutorInput,
) =>
  | Promise<SequentialContinuationRunTaskExecutionEvidence>
  | SequentialContinuationRunTaskExecutionEvidence;

export interface SequentialContinuationRunTaskExecutionReport {
  artifactPath: string;
  repoRoot: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  blockingReasons: string[];
  selectedActionType: string | null;
  normalizedTaskSpecPath: string | null;
  resolvedTaskSpecPath: string | null;
  runTaskPreflight: SequentialContinuationRunTaskPreflightReport | null;
  runLogPath: string | null;
  executorEvidencePath: string | null;
  harnessResult: HarnessResult | null;
  executionPass: boolean | null;
  actionAttemptCount: number;
  actionExecuted: boolean;
  continued: false;
  stopReason: string;
  trustedStateChanges: string[];
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: boolean;
    batchesExecuteCalled: false;
    workersDispatched: boolean;
    runsCreated: boolean;
    worktreesCreated: boolean;
    deterministicVerification: boolean;
    acceptPerformed: false;
    lifecycleMutated: false;
    mergePerformed: false;
    cleanupPerformed: false;
    commitPerformed: false;
    pushPerformed: false;
    multiStepLoopStarted: false;
    successorExecuted: false;
  };
}

export interface SequentialContinuationRunAcceptExecutionExecutorInput {
  repoRoot: string;
  artifactPath: string;
  runLogPath: string;
  normalizedRunLogPath: string;
  resolvedRunLogPath: string;
  targetBranch: string;
  requiredRuntime: "codex-sdk";
  stateDir?: string;
}

export type SequentialContinuationRunAcceptExecutionExecutor = (
  input: SequentialContinuationRunAcceptExecutionExecutorInput,
) => Promise<RunAcceptResult> | RunAcceptResult;

export interface SequentialContinuationRunAcceptExecutionReport {
  artifactPath: string;
  repoRoot: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  blockingReasons: string[];
  selectedActionType: string | null;
  runLogPath: string | null;
  normalizedRunLogPath: string | null;
  resolvedRunLogPath: string | null;
  run: {
    id: string;
    taskId: string;
  } | null;
  expectedRunId: string | null;
  expectedTaskId: string | null;
  expectedCommit: string | null;
  expectedBaseCommit: string | null;
  targetBranch: string | null;
  requiredRuntime: string | null;
  lifecycleOwner: string | null;
  runAcceptPreflight: SequentialContinuationRunAcceptPreflightReport | null;
  acceptResultSummary: {
    accepted: boolean;
    status: string;
    gateStatus: string | null;
    mergeExitCode: number | null;
    lessonDraftStatus: string | null;
    lessonDraftPath: string | null;
  } | null;
  lifecycleEvidenceSummary: {
    merged: boolean;
    cleaned: boolean;
    runId: string | null;
    taskId: string | null;
    commit: string | null;
  } | null;
  cleanupEvidenceSummary: {
    cleaned: boolean;
    classification: string | null;
    worktreePath: string | null;
    branch: string | null;
    violations: string[];
  } | null;
  actionAttemptCount: number;
  actionExecuted: boolean;
  continued: false;
  stopReason: string;
  trustedStateChanges: string[];
  pushPerformed: false;
  sideEffects: {
    runsAcceptCalled: boolean;
    mergeGateRecorded: boolean;
    mergePerformed: boolean;
    lifecycleMutated: boolean;
    cleanupPerformed: boolean;
    commitPerformed: false;
    pushPerformed: false;
    runTaskCalled: false;
    workersDispatched: false;
    batchesExecuteCalled: false;
    multiStepLoopStarted: false;
    successorExecuted: false;
  };
}

export interface SequentialContinuationPostAcceptStatusUpdateReport {
  artifactPath: string;
  acceptReportPath: string;
  repoRoot: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  blockingReasons: string[];
  currentSliceId: string | null;
  runLogPath: string | null;
  normalizedRunLogPath: string | null;
  resolvedRunLogPath: string | null;
  statusEvidence: SequentialContinuationStatusEvidenceDocument | null;
  statusUpdateReport: SequentialContinuationStatusUpdateReport | null;
  nextArtifactLinkage: SequentialContinuationNextArtifactReport | null;
  nextStep: SequentialContinuationNextStep | null;
  stopReason: string;
  artifactUpdated: boolean;
  trustedStateChanges: string[];
  pushPerformed: false;
  sideEffects: {
    runsAcceptCalled: false;
    mergeGateRecorded: false;
    mergePerformed: false;
    lifecycleMutated: false;
    cleanupPerformed: false;
    commitPerformed: false;
    pushPerformed: false;
    runTaskCalled: false;
    workersDispatched: false;
    batchesExecuteCalled: false;
    multiStepLoopStarted: false;
    successorExecuted: false;
  };
}

export interface SequentialContinuationPostAcceptStatusUpdateResult {
  report: SequentialContinuationPostAcceptStatusUpdateReport;
  updatedArtifact: SequentialContinuationArtifact | null;
}

export interface SequentialContinuationReport {
  artifactPath: string;
  status: "accepted" | "rejected";
  violations: string[];
  currentSlice: {
    id: string | null;
    status: string | null;
    actionType: string | null;
    dependencyStatus: string | null;
  };
  activeStopConditions: Array<{
    id: string;
    evidence: string;
  }>;
  blockingReasons: string[];
  allowedActionType: SequentialContinuationActionType | null;
  exactNextSamanthaCommand: string | null;
  blockedReportText: string | null;
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
  runAcceptPreflight?: SequentialContinuationRunAcceptPreflightReport;
  trustedStateChanges: false;
  pushPerformed: false;
}

export interface SequentialContinuationStatusEvidenceReference {
  kind: SequentialContinuationStatusEvidenceKind;
  path: string;
  summary: string;
  result: SequentialContinuationStatusEvidenceResult;
}

export interface SequentialContinuationStatusEvidenceDocument {
  schemaVersion: 1;
  currentSliceId: string;
  outcome: SequentialContinuationStatusUpdateOutcome;
  updatedAt: string;
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  nextStep: SequentialContinuationNextStep;
}

export interface SequentialContinuationStatusUpdateReport {
  artifactPath: string;
  evidencePath: string;
  status: "accepted" | "rejected";
  violations: string[];
  requestedOutcome: string | null;
  acceptedOutcome: "completed" | "blocked" | null;
  currentSlice: {
    id: string | null;
    previousStatus: string | null;
    updatedStatus: string | null;
    actionType: string | null;
    dependencyStatus: string | null;
  };
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  exactNextSamanthaCommand: string | null;
  blockedReportText: string | null;
  artifactUpdated: boolean;
  trustedStateChanges: boolean;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
  };
}

export interface SequentialContinuationStatusUpdateResult {
  report: SequentialContinuationStatusUpdateReport;
  updatedArtifact: SequentialContinuationArtifact | null;
}

export interface SequentialContinuationSingleStepExecutorInput {
  artifactPath: string;
  artifact: SequentialContinuationArtifact;
  actionType: "readiness_check";
}

export interface SequentialContinuationSingleStepExecution {
  evidence: SequentialContinuationStatusEvidenceDocument;
  evidencePath?: string;
  inlineEvidenceSummary?: string;
}

export type SequentialContinuationSingleStepActionExecutor = (
  input: SequentialContinuationSingleStepExecutorInput,
) => Promise<SequentialContinuationSingleStepExecution> | SequentialContinuationSingleStepExecution;

export interface SequentialContinuationSingleStepReport {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  selectedActionType: string | null;
  actionExecuted: boolean;
  actionAttemptCount: number;
  generatedEvidencePath: string | null;
  inlineEvidenceSummary: string | null;
  statusUpdateReport: SequentialContinuationStatusUpdateReport | null;
  nextStep: SequentialContinuationNextStep | null;
  continued: false;
  multiStepLoopStarted: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationSingleStepResult {
  report: SequentialContinuationSingleStepReport;
  updatedArtifact: SequentialContinuationArtifact | null;
}

export interface SequentialContinuationLoopNextArtifactInput {
  previousArtifactPath: string;
  previousArtifact: SequentialContinuationArtifact;
  updatedArtifact: SequentialContinuationArtifact;
  previousStepReport: SequentialContinuationSingleStepReport;
  stepCount: number;
  failedEvidenceReworkCyclesUsed: number;
}

export interface SequentialContinuationLoopNextArtifact {
  artifactPath: string;
  artifact: SequentialContinuationArtifact;
}

export type SequentialContinuationLoopNextArtifactSelector = (
  input: SequentialContinuationLoopNextArtifactInput,
) => Promise<SequentialContinuationLoopNextArtifact | null> | SequentialContinuationLoopNextArtifact | null;

export interface SequentialContinuationLoopReport {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  stepCount: number;
  maxSteps: number;
  stopReason: string;
  failedEvidenceReworkCyclesUsed: number;
  failedEvidenceReworkCyclesRemaining: number;
  singleStepReports: SequentialContinuationSingleStepReport[];
  nextStep: SequentialContinuationNextStep | null;
  continued: boolean;
  multiStepLoopStarted: boolean;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationLoopResult {
  report: SequentialContinuationLoopReport;
  updatedArtifacts: Array<{
    artifactPath: string;
    artifact: SequentialContinuationArtifact;
  }>;
}

const ACTION_TYPE_SET = new Set<SequentialContinuationActionType>(SEQUENTIAL_CONTINUATION_ACTION_TYPES);
const SLICE_STATUS_SET = new Set<SequentialContinuationSliceStatus>(SEQUENTIAL_CONTINUATION_SLICE_STATUSES);
const STOP_CONDITION_ID_SET = new Set<SequentialContinuationStopConditionId>(
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
);
const STATUS_EVIDENCE_KIND_SET = new Set<SequentialContinuationStatusEvidenceKind>(
  SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS,
);
const STATUS_EVIDENCE_RESULT_SET = new Set<SequentialContinuationStatusEvidenceResult>(
  SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS,
);
const STATUS_UPDATE_OUTCOME_SET = new Set<SequentialContinuationStatusUpdateOutcome>(
  SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES,
);
const WRITE_CAPABLE_ACTION_TYPES = new Set<SequentialContinuationActionType>(["run_task", "batch_plan"]);
const SINGLE_STEP_EXECUTABLE_ACTION_TYPE = "readiness_check";
const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "artifactId",
  "initiativePath",
  "createdAt",
  "updatedAt",
  "currentSlice",
  "autonomyEnvelope",
  "stopConditionChecklist",
  "evidenceReferences",
  "nextStep",
  "nextArtifactPath",
  "nextArtifactExpectedSliceId",
  "runTaskCandidate",
  "runTaskExecution",
  "runAcceptCandidate",
  "runAcceptExecution",
]);
const CURRENT_SLICE_FIELDS = new Set([
  "id",
  "status",
  "actionType",
  "dependencyStatus",
  "prerequisites",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
]);
const AUTONOMY_ENVELOPE_FIELDS = new Set([
  "canSelectNextReadySlice",
  "canRunReadinessChecks",
  "canRunReportOnlyActions",
  "canRunExplicitTaskSpecs",
  "canRunRoutineBatchActions",
  "canUpdateContinuationStatus",
  "canLocallyCommitThroughExistingGates",
  "pushAllowed",
  "maxFailedEvidenceReworkCycles",
]);
const STOP_CONDITION_FIELDS = new Set(["id", "active", "evidence"]);
const EVIDENCE_REFERENCE_FIELDS = new Set(["path", "summary", "kind", "result"]);
const NEXT_STEP_FIELDS = new Set(["kind", "value"]);
const RUN_TASK_CANDIDATE_FIELDS = new Set([
  "taskSpecPath",
  "requiredRuntime",
  "executionMode",
  "worktreePolicy",
  "lifecycleOwner",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
  "evidence",
  "expectedSideEffects",
]);
const RUN_TASK_CANDIDATE_EVIDENCE_FIELDS = new Set([
  "taskSpecCommit",
  "taskSpecStatus",
  "freshnessEvidencePath",
]);
const RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES = [
  "runTaskCalled",
  "workersDispatched",
  "worktreesCreated",
  "lifecycleMutated",
  "mergePerformed",
  "cleanupPerformed",
  "commitPerformed",
  "pushPerformed",
] as const;
const RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS = new Set<string>(
  RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES,
);
const RUN_TASK_EXECUTION_FIELDS = new Set([
  "taskSpecPath",
  "requiredRuntime",
  "executionMode",
  "worktreePolicy",
  "lifecycleOwner",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
  "pushAllowed",
  "expectedSideEffects",
]);
const RUN_TASK_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES = [
  "runTaskCalled",
  "workersDispatched",
  "worktreesCreated",
  "runsCreated",
  "deterministicVerification",
  "batchesExecuteCalled",
  "acceptPerformed",
  "lifecycleMutated",
  "mergePerformed",
  "cleanupPerformed",
  "commitPerformed",
  "pushPerformed",
  "multiStepLoopStarted",
  "successorExecuted",
] as const;
const RUN_TASK_EXECUTION_EXPECTED_SIDE_EFFECT_FIELDS = new Set<string>(
  RUN_TASK_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES,
);
const RUN_ACCEPT_CANDIDATE_FIELDS = new Set([
  "runLogPath",
  "expectedRunId",
  "expectedTaskId",
  "expectedCommit",
  "expectedBaseCommit",
  "targetBranch",
  "requiredRuntime",
  "executionMode",
  "lifecycleOwner",
  "pushAllowed",
  "expectedSideEffects",
]);
const RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES = [
  "runsAcceptCalled",
  "mergeGateRecorded",
  "mergePerformed",
  "lifecycleMutated",
  "cleanupPerformed",
  "commitPerformed",
  "pushPerformed",
  "runTaskCalled",
  "workersDispatched",
  "batchesExecuteCalled",
  "multiStepLoopStarted",
  "successorExecuted",
] as const;
const RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS = new Set<string>(
  RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES,
);
const RUN_ACCEPT_EXECUTION_FIELDS = new Set([
  "runLogPath",
  "expectedRunId",
  "expectedTaskId",
  "expectedCommit",
  "expectedBaseCommit",
  "targetBranch",
  "requiredRuntime",
  "executionMode",
  "lifecycleOwner",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
  "pushAllowed",
  "expectedSideEffects",
]);
const RUN_ACCEPT_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES =
  RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES;
const RUN_ACCEPT_EXECUTION_EXPECTED_SIDE_EFFECT_FIELDS = new Set<string>(
  RUN_ACCEPT_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES,
);
const TASK_SPEC_FIELDS = new Set([
  "id",
  "title",
  "targetAgent",
  "targetFiles",
  "forbiddenChanges",
  "setupCommands",
  "verifyCommands",
  "instructions",
  "resultMode",
  "expectedCommitSubject",
  "status",
]);
const STATUS_EVIDENCE_FIELDS = new Set([
  "schemaVersion",
  "currentSliceId",
  "outcome",
  "updatedAt",
  "evidenceReferences",
  "nextStep",
]);
const STATUS_EVIDENCE_REFERENCE_FIELDS = new Set(["kind", "path", "summary", "result"]);
const DEPENDENCY_STATUSES = new Set(["met", "blocked"]);
const NEXT_STEP_KINDS = new Set(["samantha_command", "blocked_report"]);
const NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN = /^(?:sam\s+c:|sam\s+p:|sam\s+command:|bun\s+|npm\s+|pnpm\s+|yarn\s+|git\s+)/i;
const RUN_ACCEPT_PATH_COMMAND_PREFIX_PATTERN = /^(?:sam\s+c:|sam\s+p:|sam\s+command:|bun\s+|npm\s+|pnpm\s+|yarn\s+|git\s+|runs:accept\b|merge:check\b|worktree:cleanup\b|run-task\b)/i;
const NEXT_ARTIFACT_URL_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const NEXT_ARTIFACT_GLOB_PATTERN = /[*?[\]{}]/;
const NEXT_ARTIFACT_ENV_PATTERN = /(?:\$[A-Za-z_{]|%[A-Za-z_][A-Za-z0-9_]*%)/;
const TASK_SPEC_STATUSES = new Set(["pending", "in_progress", "completed", "failed", "blocked"]);
const TASK_RESULT_MODES = new Set(["write", "report"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "hiddenmemory",
  "hiddenstate",
  "ceoofficememory",
  "memory",
  "secret",
  "secrets",
  "token",
  "apikey",
  "credential",
  "credentials",
  "daemon",
  "watch",
  "watcher",
  "remote",
  "remoteadapter",
  "dashboard",
  "routine",
  "routines",
  "routinetrigger",
]);
const FORBIDDEN_LIFECYCLE_WORDING_PATTERNS: RegExp[] = [
  /\baccept(?:s|ed|ing)?\s+(?:the\s+|this\s+|a\s+)?runs?\b/i,
  /\bmerge(?:s|d|ing)?\b/i,
  /\bclean\s+up\b/i,
  /\bcleanup\b/i,
  /\bcommit(?:s|ted|ting)?\b/i,
  /\bpush(?:es|ed|ing)?\b/i,
  /\bmutate(?:s|d|ing)?\s+lifecycle\b/i,
  /\blifecycle\s+(?:transition|transitions|mutation|mutations|state\s+change|state\s+changes|update|updates)\b/i,
  /\bcreate(?:s|d|ing)?\s+(?:a\s+|the\s+|follow-up\s+)?tasks?\b/i,
  /\bdispatch(?:es|ed|ing)?\s+(?:a\s+|the\s+)?workers?\b/i,
  /\bautomatic\s+continuation\b/i,
];

export function validateSequentialContinuationArtifact(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["sequential continuation artifact must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateForbiddenFieldNames(input));
  violations.push(...validateForbiddenLifecycleWording(input));
  violations.push(
    ...validateAllowedFields(input, TOP_LEVEL_FIELDS, (key) => `unknown top-level field: ${key}`),
  );

  if (input.schemaVersion !== 1) {
    violations.push("schemaVersion must be exactly 1");
  }
  for (const field of ["artifactId", "initiativePath", "createdAt", "updatedAt"] as const) {
    if (!isNonEmptyString(input[field])) {
      violations.push(`${field} must be a non-empty string`);
    }
  }

  violations.push(...validateCurrentSlice(input.currentSlice));
  violations.push(...validateAutonomyEnvelope(input.autonomyEnvelope));
  violations.push(...validateStopConditionChecklist(input.stopConditionChecklist));
  violations.push(...validateEvidenceReferences(input.evidenceReferences));
  violations.push(...validateNextStep(input.nextStep));
  violations.push(...validateNextArtifactFields(input));
  violations.push(...validateRunTaskCandidateFields(input));
  violations.push(...validateRunTaskExecutionFields(input));
  violations.push(...validateRunAcceptCandidateFields(input));
  violations.push(...validateRunAcceptExecutionFields(input));

  return violations;
}

export function buildSequentialContinuationReport(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
  runAcceptPreflight?: SequentialContinuationRunAcceptPreflightReport;
}): SequentialContinuationReport {
  const violations = input.violations ?? validateSequentialContinuationArtifact(input.artifact);
  const currentSlice = readReportCurrentSlice(input.artifact);
  const activeStopConditions = readReportActiveStopConditions(input.artifact);
  const nextStep = readReportNextStep(input.artifact);
  const status = violations.length === 0 ? "accepted" : "rejected";
  const allowedActionType =
    status === "accepted" && currentSlice.actionType && ACTION_TYPE_SET.has(currentSlice.actionType as SequentialContinuationActionType)
      ? (currentSlice.actionType as SequentialContinuationActionType)
      : null;

  return {
    artifactPath: input.artifactPath,
    status,
    violations,
    currentSlice,
    activeStopConditions,
    blockingReasons: buildReportBlockingReasons({
      violations,
      currentSlice,
      activeStopConditions,
      nextStep,
      nextArtifactLinkage: input.nextArtifactLinkage,
      runTaskPreflight: input.runTaskPreflight,
      runAcceptPreflight: input.runAcceptPreflight,
    }),
    allowedActionType,
    exactNextSamanthaCommand: nextStep.kind === "samantha_command" ? nextStep.value : null,
    blockedReportText: nextStep.kind === "blocked_report" ? nextStep.value : null,
    ...(input.nextArtifactLinkage ? { nextArtifactLinkage: input.nextArtifactLinkage } : {}),
    ...(input.runTaskPreflight ? { runTaskPreflight: input.runTaskPreflight } : {}),
    ...(input.runAcceptPreflight ? { runAcceptPreflight: input.runAcceptPreflight } : {}),
    trustedStateChanges: false,
    pushPerformed: false,
  };
}

export async function buildSequentialContinuationNextArtifactReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
  visitedArtifactPaths?: string[];
  visitedSliceIds?: string[];
}): Promise<SequentialContinuationNextArtifactReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const previousArtifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const inspectedArtifactPaths = uniqueStrings([
    ...(input.visitedArtifactPaths ?? []).map((path) => normalizePathForReport(path, repoRoot)),
    previousArtifactPath,
  ]);
  const currentSliceId = readReportCurrentSlice(input.artifact).id;
  const inspectedSliceIds = uniqueStrings([
    ...(input.visitedSliceIds ?? []),
    ...(currentSliceId ? [currentSliceId] : []),
  ]);

  const currentArtifactViolations = validateSequentialContinuationArtifact(input.artifact);
  if (currentArtifactViolations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath: null,
      nextArtifactExpectedSliceId: null,
      normalizedNextArtifactPath: null,
      resolvedNextArtifactPath: null,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [
        "current artifact must validate before successor linkage is inspected",
        ...currentArtifactViolations,
      ],
    });
  }

  const nextArtifactPath = readOptionalStringField(input.artifact, "nextArtifactPath");
  const nextArtifactExpectedSliceId = readOptionalStringField(input.artifact, "nextArtifactExpectedSliceId");

  if (nextArtifactPath === null) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath: null,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath: null,
      resolvedNextArtifactPath: null,
      status: "absent",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [],
    });
  }

  const pathViolations: string[] = [];
  const normalizedNextArtifactPath = normalizeNextArtifactPath(nextArtifactPath, pathViolations);
  if (!normalizedNextArtifactPath || pathViolations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath: null,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: pathViolations,
    });
  }

  const resolvedNextArtifactPath = resolve(repoRoot, normalizedNextArtifactPath);
  const resolvedRepoRelativePath = relative(repoRoot, resolvedNextArtifactPath).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [`nextArtifactPath must stay inside repoRoot: ${nextArtifactPath}`],
    });
  }
  if (inspectedArtifactPaths.includes(normalizedNextArtifactPath)) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [`nextArtifactPath creates artifact path cycle: ${normalizedNextArtifactPath}`],
    });
  }

  const successorRead = await readNextArtifactFile(resolvedNextArtifactPath);
  if (successorRead.violations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: successorRead.violations,
    });
  }

  const successor = successorRead.artifact;
  const successorSlice = readReportCurrentSlice(successor);
  const successorArtifactPath = normalizePathForReport(resolvedNextArtifactPath, repoRoot);
  const nextInspectedArtifactPaths = uniqueStrings([...inspectedArtifactPaths, successorArtifactPath]);
  const nextInspectedSliceIds = uniqueStrings([
    ...inspectedSliceIds,
    ...(successorSlice.id ? [successorSlice.id] : []),
  ]);
  const blockingReasons: string[] = [];

  for (const violation of validateSequentialContinuationArtifact(successor)) {
    blockingReasons.push(`successor artifact invalid: ${violation}`);
  }
  if (isRecord(input.artifact) && isRecord(successor) && successor.initiativePath !== input.artifact.initiativePath) {
    blockingReasons.push(
      `successor initiativePath must match predecessor initiativePath: ${String(successor.initiativePath)}`,
    );
  }
  if (nextArtifactExpectedSliceId && successorSlice.id !== nextArtifactExpectedSliceId) {
    blockingReasons.push(
      `successor currentSlice.id must match nextArtifactExpectedSliceId ${nextArtifactExpectedSliceId}: ${String(successorSlice.id)}`,
    );
  }
  if (successorSlice.id && inspectedSliceIds.includes(successorSlice.id)) {
    blockingReasons.push(`successor currentSlice.id creates slice cycle: ${successorSlice.id}`);
  }
  for (const stopCondition of readReportActiveStopConditions(successor)) {
    blockingReasons.push(`successor stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
  }
  if (isRecord(successor) && isRecord(successor.autonomyEnvelope) && successor.autonomyEnvelope.pushAllowed === true) {
    blockingReasons.push("successor autonomyEnvelope.pushAllowed must be false");
  }
  blockingReasons.push(
    ...(await validateSuccessorEvidenceFreshness({
      repoRoot,
      predecessorArtifactPath: input.artifactPath,
      predecessorArtifact: input.artifact,
      successorArtifact: successor,
    })),
  );

  return buildNextArtifactReport({
    previousArtifactPath,
    repoRoot,
    nextArtifactPath,
    nextArtifactExpectedSliceId,
    normalizedNextArtifactPath,
    resolvedNextArtifactPath,
    status: blockingReasons.length === 0 ? "accepted" : "blocked",
    successor: {
      artifactPath: successorArtifactPath,
      currentSliceId: successorSlice.id,
      initiativePath: isRecord(successor) ? stringOrNull(successor.initiativePath) : null,
      actionType: successorSlice.actionType,
    },
    inspectedArtifactPaths: nextInspectedArtifactPaths,
    inspectedSliceIds: nextInspectedSliceIds,
    blockingReasons,
  });
}

export async function buildSequentialContinuationRunTaskPreflightReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
}): Promise<SequentialContinuationRunTaskPreflightReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const currentArtifactViolations = validateSequentialContinuationArtifact(input.artifact);
  if (currentArtifactViolations.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      blockingReasons: [
        "current artifact must validate before runTaskCandidate is inspected",
        ...currentArtifactViolations,
      ],
    });
  }

  if (!isRecord(input.artifact) || !hasOwn(input.artifact, "runTaskCandidate") || input.artifact.runTaskCandidate === null) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "absent",
      blockingReasons: [],
    });
  }

  const artifact = input.artifact as unknown as SequentialContinuationArtifact;
  const candidate = artifact.runTaskCandidate as SequentialContinuationRunTaskCandidate;

  const activeStopConditions = artifact.stopConditionChecklist.flatMap((stopCondition) => {
    return stopCondition.active ? [`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`] : [];
  });
  if (activeStopConditions.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: activeStopConditions,
    });
  }

  const gateReasons: string[] = [];
  if (artifact.currentSlice.status !== "ready") {
    gateReasons.push(`currentSlice.status must be ready for run_task preflight: ${artifact.currentSlice.status}`);
  }
  if (artifact.currentSlice.actionType !== "run_task") {
    gateReasons.push(`currentSlice.actionType must be run_task for run_task preflight: ${artifact.currentSlice.actionType}`);
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    gateReasons.push(`currentSlice.dependencyStatus must be met for run_task preflight: ${artifact.currentSlice.dependencyStatus}`);
  }
  if (gateReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: gateReasons,
    });
  }

  const candidateReasons = validateRunTaskCandidatePreflightRequirements(candidate);
  if (candidateReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: candidateReasons,
    });
  }

  const pathReasons: string[] = [];
  const normalizedTaskSpecPath = normalizeRunTaskTaskSpecPath(candidate.taskSpecPath, pathReasons);
  if (!normalizedTaskSpecPath || pathReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: pathReasons,
    });
  }

  const resolvedTaskSpecPath = resolve(repoRoot, normalizedTaskSpecPath);
  const resolvedRepoRelativePath = relative(repoRoot, resolvedTaskSpecPath).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: [`runTaskCandidate.taskSpecPath must stay inside repoRoot: ${candidate.taskSpecPath}`],
    });
  }

  const taskSpecRead = await readRunTaskTaskSpecFile({
    repoRoot,
    normalizedTaskSpecPath,
    resolvedTaskSpecPath,
  });
  if (taskSpecRead.violations.length > 0 || !taskSpecRead.taskSpec) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: taskSpecRead.violations,
    });
  }

  const taskSpecValue = taskSpecRead.taskSpec;
  const taskSpecReasons = validateRunTaskTaskSpec(taskSpecValue);
  if (taskSpecReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      task: taskSpecTitleForReport(taskSpecValue),
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: taskSpecReasons,
    });
  }

  const taskSpec = taskSpecValue as TaskSpec;
  const gitReasons = await validateCommittedCleanTaskSpec({
    repoRoot,
    normalizedTaskSpecPath,
    taskSpecCommit: candidate.evidence.taskSpecCommit,
  });
  if (gitReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      task: taskSpecTitleForReport(taskSpec),
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: gitReasons,
    });
  }

  const handoffReasons = validateRunTaskHandoff({
    candidate,
    taskSpec,
    currentSlice: artifact.currentSlice,
  });
  return buildRunTaskPreflightReport({
    artifactPath,
    repoRoot,
    status: handoffReasons.length === 0 ? "accepted" : "blocked",
    taskSpecPath: candidate.taskSpecPath,
    normalizedTaskSpecPath,
    resolvedTaskSpecPath,
    task: taskSpecTitleForReport(taskSpec),
    requiredRuntime: candidate.requiredRuntime,
    executionMode: candidate.executionMode,
    worktreePolicy: candidate.worktreePolicy,
    lifecycleOwner: candidate.lifecycleOwner,
    targetFiles: candidate.targetFiles,
    forbiddenChanges: candidate.forbiddenChanges,
    verifyCommands: candidate.verifyCommands,
    blockingReasons: handoffReasons,
  });
}

export async function buildSequentialContinuationRunAcceptPreflightReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
}): Promise<SequentialContinuationRunAcceptPreflightReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const currentArtifactViolations = validateSequentialContinuationArtifact(input.artifact).filter(
    (violation) => !isRunAcceptCandidateViolation(violation),
  );
  if (currentArtifactViolations.length > 0) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      blockingReasons: [
        "current artifact must validate before runAcceptCandidate is inspected",
        ...currentArtifactViolations,
      ],
    });
  }

  if (!isRecord(input.artifact) || !hasOwn(input.artifact, "runAcceptCandidate") || input.artifact.runAcceptCandidate === null) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "absent",
      blockingReasons: [],
    });
  }

  const artifact = input.artifact as unknown as SequentialContinuationArtifact;
  const activeStopConditions = artifact.stopConditionChecklist.flatMap((stopCondition) => {
    return stopCondition.active ? [`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`] : [];
  });
  if (activeStopConditions.length > 0) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      blockingReasons: activeStopConditions,
    });
  }

  const candidateValue = artifact.runAcceptCandidate;
  const candidateReasons = validateRunAcceptCandidateClosed(candidateValue);
  if (candidateReasons.length > 0 || !isRecord(candidateValue)) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidateValue),
      blockingReasons: candidateReasons,
    });
  }

  const candidate = candidateValue as SequentialContinuationRunAcceptCandidate;
  const targetBranch = candidate.targetBranch ?? "main";
  const gateReasons: string[] = [];
  if (artifact.currentSlice.status !== "ready") {
    gateReasons.push(`currentSlice.status must be ready for runs:accept preflight: ${artifact.currentSlice.status}`);
  }
  if (artifact.currentSlice.actionType !== "report_only") {
    gateReasons.push(`currentSlice.actionType must be report_only for runs:accept preflight: ${artifact.currentSlice.actionType}`);
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    gateReasons.push(`currentSlice.dependencyStatus must be met for runs:accept preflight: ${artifact.currentSlice.dependencyStatus}`);
  }
  const requirementReasons = validateRunAcceptCandidatePreflightRequirements(candidate);
  if (gateReasons.length > 0 || requirementReasons.length > 0) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidate),
      targetBranch,
      blockingReasons: [...gateReasons, ...requirementReasons],
    });
  }

  const pathReasons: string[] = [];
  const normalizedRunLogPath = normalizeRunAcceptRunLogPath(candidate.runLogPath, pathReasons);
  if (!normalizedRunLogPath || pathReasons.length > 0) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidate),
      targetBranch,
      blockingReasons: pathReasons,
    });
  }

  const resolvedRunLogPath = resolve(repoRoot, normalizedRunLogPath);
  const resolvedRepoRelativePath = relative(repoRoot, resolvedRunLogPath).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidate),
      targetBranch,
      normalizedRunLogPath,
      resolvedRunLogPath,
      blockingReasons: [`runAcceptCandidate.runLogPath must stay inside repoRoot: ${candidate.runLogPath}`],
    });
  }

  const runLogRead = await readRunAcceptRunLogFile({
    repoRoot,
    normalizedRunLogPath,
    resolvedRunLogPath,
  });
  if (runLogRead.violations.length > 0 || !runLogRead.runLog) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidate),
      targetBranch,
      normalizedRunLogPath,
      resolvedRunLogPath,
      blockingReasons: runLogRead.violations,
    });
  }

  const runLogShapeReasons = validateRunAcceptRunLogShape(runLogRead.runLog);
  if (runLogShapeReasons.length > 0) {
    return buildRunAcceptPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      ...runAcceptCandidateReportFields(candidate),
      targetBranch,
      normalizedRunLogPath,
      resolvedRunLogPath,
      blockingReasons: runLogShapeReasons,
    });
  }

  const runLog = runLogRead.runLog as WorkerRunLog;
  const evidence = await validateRunAcceptRunLogEvidence({
    repoRoot,
    artifactPath: input.artifactPath,
    normalizedRunLogPath,
    candidate,
    targetBranch,
    currentSlice: artifact.currentSlice,
    runLog,
  });
  return buildRunAcceptPreflightReport({
    artifactPath,
    repoRoot,
    status: evidence.blockingReasons.length === 0 ? "accepted" : "blocked",
    ...runAcceptCandidateReportFields(candidate),
    targetBranch,
    normalizedRunLogPath,
    resolvedRunLogPath,
    run: runAcceptRunTitleForReport(runLog),
    cleanupReadiness: evidence.cleanupReadiness,
    blockingReasons: evidence.blockingReasons,
  });
}

export async function buildSequentialContinuationRunTaskExecutionReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  executeRunTask: SequentialContinuationRunTaskExecutionExecutor;
}): Promise<SequentialContinuationRunTaskExecutionReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const selectedActionType = readReportCurrentSlice(input.artifact).actionType;
  const artifactViolations = [
    ...(input.violations ?? []),
    ...validateSequentialContinuationArtifact(input.artifact),
  ];

  if (artifactViolations.length > 0 || !isSequentialContinuationArtifact(input.artifact)) {
    return buildRunTaskExecutionReport({
      artifactPath,
      repoRoot,
      status: "rejected",
      violations: artifactViolations,
      blockingReasons: artifactViolations,
      selectedActionType,
      normalizedTaskSpecPath: null,
      resolvedTaskSpecPath: null,
      runTaskPreflight: null,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "artifact_invalid",
    });
  }

  const artifact = input.artifact;
  const runTaskPreflight = await buildSequentialContinuationRunTaskPreflightReport({
    repoRoot,
    artifactPath,
    artifact,
  });
  const guardReasons = buildRunTaskExecutionGuardReasons({ artifact, runTaskPreflight });
  if (guardReasons.length > 0) {
    return buildRunTaskExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: guardReasons,
      blockingReasons: guardReasons,
      selectedActionType,
      normalizedTaskSpecPath: runTaskPreflight.normalizedTaskSpecPath,
      resolvedTaskSpecPath: runTaskPreflight.resolvedTaskSpecPath,
      runTaskPreflight,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "guard_blocked",
    });
  }

  const normalizedTaskSpecPath = runTaskPreflight.normalizedTaskSpecPath;
  const resolvedTaskSpecPath = runTaskPreflight.resolvedTaskSpecPath;
  if (!normalizedTaskSpecPath || !resolvedTaskSpecPath) {
    return buildRunTaskExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: ["accepted runTaskPreflight must include normalized and resolved taskSpecPath"],
      blockingReasons: ["accepted runTaskPreflight must include normalized and resolved taskSpecPath"],
      selectedActionType,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      runTaskPreflight,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "preflight_evidence_incomplete",
    });
  }

  let executionEvidence: SequentialContinuationRunTaskExecutionEvidence;
  try {
    executionEvidence = await input.executeRunTask({
      repoRoot,
      artifactPath,
      taskPath: resolvedTaskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      runtimeKind: "codex-sdk",
    });
  } catch (err) {
    const reason = `run_task executor failed: ${err instanceof Error ? err.message : String(err)}`;
    return buildRunTaskExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: [reason],
      blockingReasons: [reason],
      selectedActionType,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      runTaskPreflight,
      actionAttemptCount: 1,
      actionExecuted: false,
      stopReason: "executor_failed",
    });
  }

  const evidencePath = executionEvidence.executorEvidencePath ?? executionEvidence.runLogPath ?? null;
  const evidenceReasons: string[] = [];
  if (!evidencePath) {
    evidenceReasons.push("run_task executor must return a run log path or equivalent evidence path");
  }
  if (!executionEvidence.harnessResult && executionEvidence.pass !== true) {
    evidenceReasons.push("run_task executor must return HARNESS_RESULT or pass evidence");
  }
  if (evidenceReasons.length > 0) {
    return buildRunTaskExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: evidenceReasons,
      blockingReasons: evidenceReasons,
      selectedActionType,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      runTaskPreflight,
      runLogPath: executionEvidence.runLogPath ?? null,
      executorEvidencePath: evidencePath,
      harnessResult: executionEvidence.harnessResult ?? null,
      executionPass: executionEvidence.pass,
      actionAttemptCount: 1,
      actionExecuted: false,
      stopReason: "executor_evidence_invalid",
    });
  }

  return buildRunTaskExecutionReport({
    artifactPath,
    repoRoot,
    status: "accepted",
    violations: [],
    blockingReasons: [],
    selectedActionType,
    normalizedTaskSpecPath,
    resolvedTaskSpecPath,
    runTaskPreflight,
    runLogPath: executionEvidence.runLogPath ?? null,
    executorEvidencePath: evidencePath,
    harnessResult: executionEvidence.harnessResult ?? null,
    executionPass: executionEvidence.pass,
    actionAttemptCount: 1,
    actionExecuted: true,
    stopReason: "run_task_evidence_recorded",
  });
}

export async function buildSequentialContinuationRunAcceptExecutionReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  stateDir?: string;
  executeAcceptRun: SequentialContinuationRunAcceptExecutionExecutor;
}): Promise<SequentialContinuationRunAcceptExecutionReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const allArtifactViolations = [
    ...(input.violations ?? []),
    ...validateSequentialContinuationArtifact(input.artifact),
  ];
  const artifactViolations = allArtifactViolations.filter((violation) => !isRunAcceptExecutionViolation(violation));
  const selectedActionType =
    isRecord(input.artifact) && hasOwn(input.artifact, "runAcceptExecution") && input.artifact.runAcceptExecution !== null
      ? "runs_accept"
      : null;

  if (artifactViolations.length > 0 || !isRecord(input.artifact)) {
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "rejected",
      violations: artifactViolations,
      blockingReasons: artifactViolations,
      selectedActionType,
      runAcceptPreflight: null,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "artifact_invalid",
    });
  }

  const artifact = input.artifact as unknown as SequentialContinuationArtifact;
  const activeStopReasons = artifact.stopConditionChecklist.flatMap((stopCondition) => {
    return stopCondition.active ? [`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`] : [];
  });
  if (activeStopReasons.length > 0) {
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: activeStopReasons,
      blockingReasons: activeStopReasons,
      selectedActionType,
      runAcceptPreflight: null,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "guard_blocked",
    });
  }

  const executionViolations = allArtifactViolations.filter(isRunAcceptExecutionViolation);
  if (executionViolations.length > 0) {
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "rejected",
      violations: executionViolations,
      blockingReasons: executionViolations,
      selectedActionType,
      runAcceptPreflight: null,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "execution_trigger_invalid",
    });
  }

  const runAcceptPreflight = await buildSequentialContinuationRunAcceptPreflightReport({
    repoRoot,
    artifactPath,
    artifact,
  });
  const guardReasons = buildRunAcceptExecutionGuardReasons({ artifact, runAcceptPreflight });
  if (guardReasons.length > 0) {
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: guardReasons,
      blockingReasons: guardReasons,
      selectedActionType,
      runAcceptPreflight,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "guard_blocked",
    });
  }

  const normalizedRunLogPath = runAcceptPreflight.normalizedRunLogPath;
  const resolvedRunLogPath = runAcceptPreflight.resolvedRunLogPath;
  const targetBranch = runAcceptPreflight.targetBranch;
  if (!normalizedRunLogPath || !resolvedRunLogPath || !targetBranch) {
    const reasons = ["accepted runAcceptPreflight must include normalized runLogPath, resolved runLogPath, and targetBranch"];
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: reasons,
      blockingReasons: reasons,
      selectedActionType,
      runAcceptPreflight,
      actionAttemptCount: 0,
      actionExecuted: false,
      stopReason: "preflight_evidence_incomplete",
    });
  }

  let acceptResult: RunAcceptResult;
  try {
    acceptResult = await input.executeAcceptRun({
      repoRoot,
      artifactPath,
      runLogPath: normalizedRunLogPath,
      normalizedRunLogPath,
      resolvedRunLogPath,
      targetBranch,
      requiredRuntime: "codex-sdk",
      ...(input.stateDir ? { stateDir: input.stateDir } : {}),
    });
  } catch (err) {
    const reason = `runs:accept executor failed: ${err instanceof Error ? err.message : String(err)}`;
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: [reason],
      blockingReasons: [reason],
      selectedActionType,
      runAcceptPreflight,
      actionAttemptCount: 1,
      actionExecuted: false,
      stopReason: "executor_failed",
    });
  }

  const resultReasons = validateRunAcceptExecutionResult(acceptResult);
  if (resultReasons.length > 0) {
    return buildRunAcceptExecutionReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      violations: resultReasons,
      blockingReasons: resultReasons,
      selectedActionType,
      runAcceptPreflight,
      acceptResult,
      actionAttemptCount: 1,
      actionExecuted: false,
      stopReason: "executor_result_not_accepted",
    });
  }

  return buildRunAcceptExecutionReport({
    artifactPath,
    repoRoot,
    status: "accepted",
    violations: [],
    blockingReasons: [],
    selectedActionType,
    runAcceptPreflight,
    acceptResult,
    actionAttemptCount: 1,
    actionExecuted: true,
    stopReason: "run_accept_lifecycle_recorded",
  });
}

export async function buildSequentialContinuationPostAcceptStatusUpdate(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
  acceptReportPath: string;
  acceptReport: unknown;
  violations?: string[];
  acceptReportViolations?: string[];
}): Promise<SequentialContinuationPostAcceptStatusUpdateResult> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const acceptReportPath = normalizePathForReport(input.acceptReportPath, repoRoot);
  const artifactViolations = [
    ...(input.violations ?? []),
    ...validateSequentialContinuationArtifact(input.artifact),
  ];
  const currentSlice = readReportCurrentSlice(input.artifact);

  if (artifactViolations.length > 0 || !isSequentialContinuationArtifact(input.artifact)) {
    return buildPostAcceptStatusUpdateResult({
      artifactPath,
      acceptReportPath,
      repoRoot,
      status: "rejected",
      violations: artifactViolations,
      blockingReasons: artifactViolations,
      currentSliceId: currentSlice.id,
      stopReason: "artifact_invalid",
    });
  }

  const guardReasons = postAcceptArtifactGuardReasons(input.artifact);
  if (guardReasons.length > 0) {
    return buildPostAcceptStatusUpdateResult({
      artifactPath,
      acceptReportPath,
      repoRoot,
      status: "blocked",
      violations: guardReasons,
      blockingReasons: guardReasons,
      currentSliceId: input.artifact.currentSlice.id,
      stopReason: "guard_blocked",
    });
  }

  const acceptReportReasons = [
    ...(input.acceptReportViolations ?? []),
    ...validatePostAcceptRunAcceptReport(input.acceptReport, artifactPath, repoRoot),
  ];
  if (acceptReportReasons.length > 0 || !isRecord(input.acceptReport)) {
    return buildPostAcceptStatusUpdateResult({
      artifactPath,
      acceptReportPath,
      repoRoot,
      status: "rejected",
      violations: acceptReportReasons,
      blockingReasons: acceptReportReasons,
      currentSliceId: input.artifact.currentSlice.id,
      ...postAcceptRunLogFields(input.acceptReport),
      stopReason: "accept_report_invalid",
    });
  }

  const runLogEvidence = await readPostAcceptRunLogEvidence({
    repoRoot,
    acceptReport: input.acceptReport,
  });
  if (runLogEvidence.violations.length > 0) {
    return buildPostAcceptStatusUpdateResult({
      artifactPath,
      acceptReportPath,
      repoRoot,
      status: "blocked",
      violations: runLogEvidence.violations,
      blockingReasons: runLogEvidence.violations,
      currentSliceId: input.artifact.currentSlice.id,
      ...postAcceptRunLogFields(input.acceptReport),
      stopReason: "run_log_trajectory_missing",
    });
  }

  const nextArtifactLinkage = await buildSequentialContinuationNextArtifactReport({
    repoRoot,
    artifactPath: input.artifactPath,
    artifact: input.artifact,
  });
  const nextStep = postAcceptNextStep(nextArtifactLinkage, input.artifact.currentSlice.id);
  const statusEvidence: SequentialContinuationStatusEvidenceDocument = {
    schemaVersion: 1,
    currentSliceId: input.artifact.currentSlice.id,
    outcome: "completed",
    updatedAt: runLogEvidence.updatedAt,
    evidenceReferences: [
      {
        kind: "continuation_report",
        path: acceptReportPath,
        summary: "Structured continuation report satisfied post-run completion checks.",
        result: "completed",
      },
      {
        kind: "run_log",
        path: postAcceptRunLogFields(input.acceptReport).normalizedRunLogPath ?? "",
        summary: "Run log contains the required post-run trajectory events.",
        result: "passed",
      },
    ],
    nextStep,
  };
  const statusUpdate = buildSequentialContinuationStatusUpdate({
    artifactPath,
    evidencePath: acceptReportPath,
    artifact: input.artifact,
    evidence: statusEvidence,
    allowCompletedBlockedReport: nextStep.kind === "blocked_report",
  });
  if (!statusUpdate.updatedArtifact) {
    return buildPostAcceptStatusUpdateResult({
      artifactPath,
      acceptReportPath,
      repoRoot,
      status: "rejected",
      violations: statusUpdate.report.violations,
      blockingReasons: statusUpdate.report.violations,
      currentSliceId: input.artifact.currentSlice.id,
      ...postAcceptRunLogFields(input.acceptReport),
      statusEvidence,
      statusUpdateReport: statusUpdate.report,
      nextArtifactLinkage,
      nextStep,
      stopReason: "status_update_rejected",
    });
  }

  const nextArtifactBlocked = nextArtifactLinkage.status === "blocked";
  return buildPostAcceptStatusUpdateResult({
    artifactPath,
    acceptReportPath,
    repoRoot,
    status: "accepted",
    violations: [],
    blockingReasons: nextArtifactBlocked ? nextArtifactLinkage.blockingReasons : [],
    currentSliceId: input.artifact.currentSlice.id,
    ...postAcceptRunLogFields(input.acceptReport),
    statusEvidence,
    statusUpdateReport: statusUpdate.report,
    nextArtifactLinkage,
    nextStep,
    stopReason: postAcceptStopReason(nextArtifactLinkage),
    updatedArtifact: statusUpdate.updatedArtifact,
  });
}

interface StatusEvidenceValidationOptions {
  allowCompletedBlockedReport?: boolean;
}

export function validateSequentialContinuationStatusEvidence(input: unknown): string[] {
  return validateSequentialContinuationStatusEvidenceWithOptions(input);
}

function validateSequentialContinuationStatusEvidenceWithOptions(
  input: unknown,
  options: StatusEvidenceValidationOptions = {},
): string[] {
  if (!isRecord(input)) {
    return ["sequential continuation status evidence must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateForbiddenFieldNames(input));
  violations.push(...validateForbiddenLifecycleWording(input));
  violations.push(
    ...validateAllowedFields(input, STATUS_EVIDENCE_FIELDS, (key) => `unknown status evidence field: ${key}`),
  );

  if (input.schemaVersion !== 1) {
    violations.push("status evidence schemaVersion must be exactly 1");
  }
  if (!isNonEmptyString(input.currentSliceId)) {
    violations.push("status evidence currentSliceId must be a non-empty string");
  }
  if (!STATUS_UPDATE_OUTCOME_SET.has(input.outcome as SequentialContinuationStatusUpdateOutcome)) {
    violations.push(
      `status evidence outcome must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES)}: ${String(input.outcome)}`,
    );
  }
  if (!isNonEmptyString(input.updatedAt)) {
    violations.push("status evidence updatedAt must be a non-empty string");
  }
  violations.push(...validateStatusEvidenceReferences(input.evidenceReferences));
  violations.push(...validateNextStep(input.nextStep));

  if (
    (input.outcome === "blocked" || input.outcome === "failed") &&
    (!isRecord(input.nextStep) || input.nextStep.kind !== "blocked_report")
  ) {
    violations.push("blocked or failed status updates require nextStep.kind to be blocked_report");
  }
  if (
    input.outcome === "completed" &&
    !options.allowCompletedBlockedReport &&
    (!isRecord(input.nextStep) || input.nextStep.kind !== "samantha_command")
  ) {
    violations.push("completed status updates require nextStep.kind to be samantha_command");
  }
  if (
    input.outcome === "completed" &&
    options.allowCompletedBlockedReport &&
    isRecord(input.nextStep) &&
    input.nextStep.kind !== "samantha_command" &&
    input.nextStep.kind !== "blocked_report"
  ) {
    violations.push("completed post-accept status updates require nextStep.kind to be samantha_command or blocked_report");
  }

  return violations;
}

export function buildSequentialContinuationStatusUpdate(input: {
  artifactPath: string;
  evidencePath: string;
  artifact: unknown;
  evidence: unknown;
  violations?: string[];
  allowCompletedBlockedReport?: boolean;
}): SequentialContinuationStatusUpdateResult {
  const readViolations = input.violations ?? [];
  const artifactViolations = validateSequentialContinuationArtifact(input.artifact);
  const evidenceViolations = validateSequentialContinuationStatusEvidenceWithOptions(input.evidence, {
    allowCompletedBlockedReport: input.allowCompletedBlockedReport,
  });
  const currentSlice = readStatusUpdateCurrentSlice(input.artifact);
  const requestedOutcome = readStatusUpdateOutcome(input.evidence);
  const evidenceReferences = readStatusEvidenceReferences(input.evidence);
  const nextStep = readReportNextStep(input.evidence);
  const violations = [...readViolations, ...artifactViolations, ...evidenceViolations];

  if (
    isRecord(input.artifact) &&
    isRecord(input.artifact.currentSlice) &&
    isRecord(input.evidence) &&
    isNonEmptyString(input.evidence.currentSliceId) &&
    input.artifact.currentSlice.id !== input.evidence.currentSliceId
  ) {
    violations.push(
      `status evidence currentSliceId must match artifact currentSlice.id: ${String(input.artifact.currentSlice.id)}`,
    );
  }

  const actionType = currentSlice.actionType;
  if (
    requestedOutcome === "completed" &&
    actionType &&
    ACTION_TYPE_SET.has(actionType as SequentialContinuationActionType)
  ) {
    if (evidenceReferences.some((reference) => reference.result === "recommendation_only")) {
      violations.push("report-only recommendation-only evidence cannot complete a slice");
    }
    if (!hasTrustedCompletionEvidence(actionType as SequentialContinuationActionType, evidenceReferences)) {
      violations.push(`completed update requires trusted structured evidence for ${actionType}`);
    }
  }

  if (
    violations.length > 0 ||
    !isSequentialContinuationArtifact(input.artifact) ||
    !isStatusEvidenceDocumentWithOptions(input.evidence, {
      allowCompletedBlockedReport: input.allowCompletedBlockedReport,
    })
  ) {
    return {
      report: buildStatusUpdateReport({
        artifactPath: input.artifactPath,
        evidencePath: input.evidencePath,
        status: "rejected",
        violations,
        currentSlice,
        requestedOutcome,
        acceptedOutcome: null,
        evidenceReferences,
        nextStep,
        artifactUpdated: false,
      }),
      updatedArtifact: null,
    };
  }

  const acceptedOutcome: "completed" | "blocked" = input.evidence.outcome === "completed" ? "completed" : "blocked";
  const updatedArtifact: SequentialContinuationArtifact = {
    ...input.artifact,
    updatedAt: input.evidence.updatedAt,
    currentSlice: {
      ...input.artifact.currentSlice,
      status: acceptedOutcome,
      dependencyStatus: acceptedOutcome === "completed" ? "met" : "blocked",
    },
    evidenceReferences: input.evidence.evidenceReferences.map((reference) => ({
      kind: reference.kind,
      path: reference.path,
      summary: reference.summary,
      result: reference.result,
    })),
    nextStep: {
      kind: input.evidence.nextStep.kind,
      value: input.evidence.nextStep.value,
    },
  };
  const updatedViolations = validateSequentialContinuationArtifact(updatedArtifact);
  if (updatedViolations.length > 0) {
    return {
      report: buildStatusUpdateReport({
        artifactPath: input.artifactPath,
        evidencePath: input.evidencePath,
        status: "rejected",
        violations: updatedViolations,
        currentSlice,
        requestedOutcome,
        acceptedOutcome: null,
        evidenceReferences,
        nextStep,
        artifactUpdated: false,
      }),
      updatedArtifact: null,
    };
  }

  return {
    report: buildStatusUpdateReport({
      artifactPath: input.artifactPath,
      evidencePath: input.evidencePath,
      status: "accepted",
      violations: [],
      currentSlice: {
        ...currentSlice,
        updatedStatus: updatedArtifact.currentSlice.status,
        dependencyStatus: updatedArtifact.currentSlice.dependencyStatus,
      },
      requestedOutcome,
      acceptedOutcome,
      evidenceReferences,
      nextStep,
      artifactUpdated: true,
    }),
    updatedArtifact,
  };
}

export async function buildSequentialContinuationSingleStep(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  executeAction: SequentialContinuationSingleStepActionExecutor;
}): Promise<SequentialContinuationSingleStepResult> {
  const artifactViolations = [
    ...(input.violations ?? []),
    ...validateSequentialContinuationArtifact(input.artifact),
  ];
  const artifactReport = buildSequentialContinuationReport({
    artifactPath: input.artifactPath,
    artifact: input.artifact,
    violations: artifactViolations,
  });
  const selectedActionType = artifactReport.currentSlice.actionType;
  const nextStep = nextStepFromContinuationReport(artifactReport);

  if (artifactReport.status === "rejected" || !isSequentialContinuationArtifact(input.artifact)) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "rejected",
      violations: artifactReport.violations,
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 0,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  const guardViolations = singleStepGuardViolations(input.artifact);
  if (guardViolations.length > 0) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "blocked",
      violations: guardViolations,
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 0,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  let execution: SequentialContinuationSingleStepExecution;
  try {
    execution = await input.executeAction({
      artifactPath: input.artifactPath,
      artifact: input.artifact,
      actionType: SINGLE_STEP_EXECUTABLE_ACTION_TYPE,
    });
  } catch (err) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "blocked",
      violations: [`single-step action executor failed: ${err instanceof Error ? err.message : String(err)}`],
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 1,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  const evidencePath =
    execution.evidencePath ??
    `inline:sequential-continuation:${input.artifact.artifactId}:${input.artifact.currentSlice.id}:${input.artifact.currentSlice.actionType}`;
  const statusUpdate = buildSequentialContinuationStatusUpdate({
    artifactPath: input.artifactPath,
    evidencePath,
    artifact: input.artifact,
    evidence: execution.evidence,
  });

  return buildSingleStepResult({
    artifactPath: input.artifactPath,
    status: statusUpdate.report.status === "accepted" ? "accepted" : "rejected",
    violations: statusUpdate.report.violations,
    selectedActionType,
    nextStep: nextStepFromStatusUpdateReport(statusUpdate.report),
    actionExecuted: true,
    actionAttemptCount: 1,
    generatedEvidencePath: execution.evidencePath ?? null,
    inlineEvidenceSummary: execution.inlineEvidenceSummary ?? null,
    statusUpdateReport: statusUpdate.report,
    updatedArtifact: statusUpdate.updatedArtifact,
  });
}

export async function buildSequentialContinuationLoop(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  maxSteps: number;
  executeAction: SequentialContinuationSingleStepActionExecutor;
  selectNextArtifact?: SequentialContinuationLoopNextArtifactSelector;
}): Promise<SequentialContinuationLoopResult> {
  const maxFailedEvidenceReworkCycles = 1;
  if (!Number.isInteger(input.maxSteps) || input.maxSteps < 1) {
    return buildLoopResult({
      artifactPath: input.artifactPath,
      status: "rejected",
      violations: ["maxSteps must be a positive integer"],
      stepCount: 0,
      maxSteps: input.maxSteps,
      stopReason: "invalid_max_steps",
      failedEvidenceReworkCyclesUsed: 0,
      maxFailedEvidenceReworkCycles,
      singleStepReports: [],
      nextStep: null,
      updatedArtifacts: [],
    });
  }

  let currentArtifactPath = input.artifactPath;
  let currentArtifact: unknown = input.artifact;
  let currentViolations = input.violations ?? [];
  let failedEvidenceReworkCyclesUsed = 0;
  const singleStepReports: SequentialContinuationSingleStepReport[] = [];
  const updatedArtifacts: SequentialContinuationLoopResult["updatedArtifacts"] = [];

  for (let index = 0; index < input.maxSteps; index += 1) {
    const step = await buildSequentialContinuationSingleStep({
      artifactPath: currentArtifactPath,
      artifact: currentArtifact,
      violations: currentViolations,
      executeAction: input.executeAction,
    });
    singleStepReports.push(step.report);
    currentViolations = [];

    if (step.updatedArtifact) {
      updatedArtifacts.push({
        artifactPath: currentArtifactPath,
        artifact: step.updatedArtifact,
      });
    }

    if (step.report.status === "rejected") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "rejected",
        violations: step.report.violations,
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: step.report.actionExecuted ? "status_evidence_rejected" : "artifact_invalid",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    if (step.report.status === "blocked") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "blocked",
        violations: step.report.violations,
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: step.report.violations[0] ? `step_blocked: ${step.report.violations[0]}` : "step_blocked",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const updatedArtifact = step.updatedArtifact;
    if (!updatedArtifact) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "rejected",
        violations: ["accepted single-step continuation did not produce an updated artifact"],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "status_evidence_rejected",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const requestedOutcome = step.report.statusUpdateReport?.requestedOutcome;
    const failedEvidence = requestedOutcome === "failed";
    if (requestedOutcome === "blocked") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "blocked",
        violations: ["status_evidence_blocked: accepted evidence blocked the current slice"],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "status_evidence_blocked: accepted evidence blocked the current slice",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    if (failedEvidence) {
      if (failedEvidenceReworkCyclesUsed >= maxFailedEvidenceReworkCycles) {
        return buildLoopResult({
          artifactPath: input.artifactPath,
          status: "blocked",
          violations: ["verification_rework_spent: failed evidence rework budget is already spent"],
          stepCount: singleStepReports.length,
          maxSteps: input.maxSteps,
          stopReason: "verification_rework_spent: failed evidence rework budget is already spent",
          failedEvidenceReworkCyclesUsed,
          maxFailedEvidenceReworkCycles,
          singleStepReports,
          nextStep: {
            kind: "blocked_report",
            value: "Blocked: verification_rework_spent; failed evidence rework budget is already spent.",
          },
          updatedArtifacts,
        });
      }
      failedEvidenceReworkCyclesUsed += 1;
    }

    if (singleStepReports.length >= input.maxSteps) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: failedEvidence ? "blocked" : "accepted",
        violations: [],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "max_steps_reached",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const nextArtifact = input.selectNextArtifact
      ? await input.selectNextArtifact({
          previousArtifactPath: currentArtifactPath,
          previousArtifact: isSequentialContinuationArtifact(currentArtifact) ? currentArtifact : updatedArtifact,
          updatedArtifact,
          previousStepReport: step.report,
          stepCount: singleStepReports.length,
          failedEvidenceReworkCyclesUsed,
        })
      : null;

    if (!nextArtifact) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: failedEvidence ? "blocked" : "accepted",
        violations: [],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "no_deterministic_next_artifact",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    currentArtifactPath = nextArtifact.artifactPath;
    currentArtifact = nextArtifact.artifact;
  }

  return buildLoopResult({
    artifactPath: input.artifactPath,
    status: "accepted",
    violations: [],
    stepCount: singleStepReports.length,
    maxSteps: input.maxSteps,
    stopReason: "max_steps_reached",
    failedEvidenceReworkCyclesUsed,
    maxFailedEvidenceReworkCycles,
    singleStepReports,
    nextStep: singleStepReports[singleStepReports.length - 1]?.nextStep ?? null,
    updatedArtifacts,
  });
}

function validateCurrentSlice(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["currentSlice must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, CURRENT_SLICE_FIELDS, (key) => `unknown currentSlice field: ${key}`),
  );

  if (!isNonEmptyString(value.id)) {
    violations.push("currentSlice.id must be a non-empty string");
  }
  if (!SLICE_STATUS_SET.has(value.status as SequentialContinuationSliceStatus)) {
    violations.push(
      `currentSlice.status must be ${joinOptions(SEQUENTIAL_CONTINUATION_SLICE_STATUSES)}: ${String(value.status)}`,
    );
  }
  if (!ACTION_TYPE_SET.has(value.actionType as SequentialContinuationActionType)) {
    violations.push(
      `currentSlice.actionType must be ${joinOptions(SEQUENTIAL_CONTINUATION_ACTION_TYPES)}: ${String(value.actionType)}`,
    );
  }
  if (!DEPENDENCY_STATUSES.has(value.dependencyStatus as string)) {
    violations.push(`currentSlice.dependencyStatus must be met or blocked: ${String(value.dependencyStatus)}`);
  }
  if (!hasOnlyNonEmptyStrings(value.prerequisites, { allowEmpty: true })) {
    violations.push("currentSlice.prerequisites must be a string array");
  }

  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (hasOwn(value, field) && !hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
      violations.push(`currentSlice.${field} must be a non-empty string array when present`);
    }
  }

  if (
    ACTION_TYPE_SET.has(value.actionType as SequentialContinuationActionType) &&
    WRITE_CAPABLE_ACTION_TYPES.has(value.actionType as SequentialContinuationActionType)
  ) {
    for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
      if (!hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
        violations.push(`currentSlice.${field} must be a non-empty string array for ${value.actionType}`);
      }
    }
  }

  return violations;
}

function validateAutonomyEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["autonomyEnvelope must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, AUTONOMY_ENVELOPE_FIELDS, (key) => `unknown autonomyEnvelope field: ${key}`),
  );

  for (const field of [
    "canSelectNextReadySlice",
    "canRunReadinessChecks",
    "canRunReportOnlyActions",
    "canRunExplicitTaskSpecs",
    "canRunRoutineBatchActions",
    "canUpdateContinuationStatus",
    "canLocallyCommitThroughExistingGates",
  ] as const) {
    if (value[field] !== true) {
      violations.push(`autonomyEnvelope.${field} must be true`);
    }
  }
  if (value.pushAllowed !== false) {
    violations.push("autonomyEnvelope.pushAllowed must be false");
  }
  if (value.maxFailedEvidenceReworkCycles !== 1) {
    violations.push("autonomyEnvelope.maxFailedEvidenceReworkCycles must be 1");
  }

  return violations;
}

function validateStopConditionChecklist(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["stopConditionChecklist must be a non-empty array"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`stopConditionChecklist[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(item, STOP_CONDITION_FIELDS, (key) => {
        return `unknown stopConditionChecklist[${index}] field: ${key}`;
      }),
    );
    const id = item.id;
    if (!isStopConditionId(id)) {
      violations.push(`stopConditionChecklist[${index}].id must be a known stop condition id: ${String(id)}`);
    } else if (seen.has(id)) {
      violations.push(`stopConditionChecklist[].id must be unique: ${id}`);
    } else {
      seen.add(id);
    }
    if (typeof item.active !== "boolean") {
      violations.push(`stopConditionChecklist[${index}].active must be a boolean`);
    }
    if (!isNonEmptyString(item.evidence)) {
      violations.push(`stopConditionChecklist[${index}].evidence must be a non-empty string`);
    }
  });

  for (const id of SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS) {
    if (!seen.has(id)) {
      violations.push(`stopConditionChecklist must include ${id}`);
    }
  }

  return violations;
}

function validateEvidenceReferences(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["evidenceReferences must be an array"];
  }

  const violations: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`evidenceReferences[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(item, EVIDENCE_REFERENCE_FIELDS, (key) => `unknown evidenceReferences[${index}] field: ${key}`),
    );
    if (!isNonEmptyString(item.path)) {
      violations.push(`evidenceReferences[${index}].path must be a non-empty string`);
    }
    if (!isNonEmptyString(item.summary)) {
      violations.push(`evidenceReferences[${index}].summary must be a non-empty string`);
    }
    if (hasOwn(item, "kind") && !STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind)) {
      violations.push(
        `evidenceReferences[${index}].kind must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)}: ${String(item.kind)}`,
      );
    }
    if (
      hasOwn(item, "result") &&
      !STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)
    ) {
      violations.push(
        `evidenceReferences[${index}].result must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)}: ${String(item.result)}`,
      );
    }
  });

  return violations;
}

function validateStatusEvidenceReferences(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["status evidence evidenceReferences must be a non-empty array"];
  }

  const violations: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`status evidence evidenceReferences[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(
        item,
        STATUS_EVIDENCE_REFERENCE_FIELDS,
        (key) => `unknown status evidence evidenceReferences[${index}] field: ${key}`,
      ),
    );
    if (!STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind)) {
      violations.push(
        `status evidence evidenceReferences[${index}].kind must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)}: ${String(item.kind)}`,
      );
    }
    if (!isNonEmptyString(item.path)) {
      violations.push(`status evidence evidenceReferences[${index}].path must be a non-empty string`);
    }
    if (!isNonEmptyString(item.summary)) {
      violations.push(`status evidence evidenceReferences[${index}].summary must be a non-empty string`);
    }
    if (!STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)) {
      violations.push(
        `status evidence evidenceReferences[${index}].result must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)}: ${String(item.result)}`,
      );
    }
  });

  return violations;
}

function validateNextStep(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["nextStep must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, NEXT_STEP_FIELDS, (key) => `unknown nextStep field: ${key}`),
  );
  if (!NEXT_STEP_KINDS.has(value.kind as string)) {
    violations.push(`nextStep.kind must be samantha_command or blocked_report: ${String(value.kind)}`);
  }
  if (!isNonEmptyString(value.value)) {
    violations.push("nextStep.value must be a non-empty string");
  }

  return violations;
}

function validateNextArtifactFields(value: Record<string, unknown>): string[] {
  const violations: string[] = [];
  if (hasOwn(value, "nextArtifactPath") && value.nextArtifactPath !== null) {
    normalizeNextArtifactPath(value.nextArtifactPath, violations);
  }
  if (
    hasOwn(value, "nextArtifactExpectedSliceId") &&
    value.nextArtifactExpectedSliceId !== null &&
    !isNonEmptyString(value.nextArtifactExpectedSliceId)
  ) {
    violations.push("nextArtifactExpectedSliceId must be a non-empty string or null when present");
  }
  return violations;
}

function validateRunTaskCandidateFields(value: Record<string, unknown>): string[] {
  if (!hasOwn(value, "runTaskCandidate") || value.runTaskCandidate === null) {
    return [];
  }
  if (!isRecord(value.runTaskCandidate)) {
    return ["runTaskCandidate must be an object or null when present"];
  }

  const candidate = value.runTaskCandidate;
  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(candidate, RUN_TASK_CANDIDATE_FIELDS, (key) => `unknown runTaskCandidate field: ${key}`),
  );

  for (const field of ["taskSpecPath", "requiredRuntime", "executionMode", "worktreePolicy", "lifecycleOwner"] as const) {
    if (!isNonEmptyString(candidate[field])) {
      violations.push(`runTaskCandidate.${field} must be a non-empty string`);
    }
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(candidate[field], { allowEmpty: false })) {
      violations.push(`runTaskCandidate.${field} must be a non-empty string array`);
    }
  }

  if (!isRecord(candidate.evidence)) {
    violations.push("runTaskCandidate.evidence must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        candidate.evidence,
        RUN_TASK_CANDIDATE_EVIDENCE_FIELDS,
        (key) => `unknown runTaskCandidate.evidence field: ${key}`,
      ),
    );
    for (const field of ["taskSpecCommit", "taskSpecStatus", "freshnessEvidencePath"] as const) {
      if (!isNonEmptyString(candidate.evidence[field])) {
        violations.push(`runTaskCandidate.evidence.${field} must be a non-empty string`);
      }
    }
  }

  if (!isRecord(candidate.expectedSideEffects)) {
    violations.push("runTaskCandidate.expectedSideEffects must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        candidate.expectedSideEffects,
        RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS,
        (key) => `unknown runTaskCandidate.expectedSideEffects field: ${key}`,
      ),
    );
    for (const field of RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
      if (typeof candidate.expectedSideEffects[field] !== "boolean") {
        violations.push(`runTaskCandidate.expectedSideEffects.${field} must be a boolean`);
      }
    }
  }

  return violations;
}

function validateRunTaskExecutionFields(value: Record<string, unknown>): string[] {
  if (!hasOwn(value, "runTaskExecution") || value.runTaskExecution === null) {
    return [];
  }
  if (Array.isArray(value.runTaskExecution)) {
    return ["runTaskExecution must be a single object or null when present"];
  }
  if (!isRecord(value.runTaskExecution)) {
    return ["runTaskExecution must be an object or null when present"];
  }

  const execution = value.runTaskExecution;
  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(execution, RUN_TASK_EXECUTION_FIELDS, (key) => `unknown runTaskExecution field: ${key}`),
  );

  for (const field of ["taskSpecPath", "requiredRuntime", "executionMode", "worktreePolicy", "lifecycleOwner"] as const) {
    if (!isNonEmptyString(execution[field])) {
      violations.push(`runTaskExecution.${field} must be a non-empty string`);
    }
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(execution[field], { allowEmpty: false })) {
      violations.push(`runTaskExecution.${field} must be a non-empty string array`);
    }
  }
  if (execution.pushAllowed !== false) {
    violations.push("runTaskExecution.pushAllowed must be false");
  }

  if (!isRecord(execution.expectedSideEffects)) {
    violations.push("runTaskExecution.expectedSideEffects must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        execution.expectedSideEffects,
        RUN_TASK_EXECUTION_EXPECTED_SIDE_EFFECT_FIELDS,
        (key) => `unknown runTaskExecution.expectedSideEffects field: ${key}`,
      ),
    );
    for (const field of RUN_TASK_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
      if (typeof execution.expectedSideEffects[field] !== "boolean") {
        violations.push(`runTaskExecution.expectedSideEffects.${field} must be a boolean`);
      }
    }
  }

  return violations;
}

function validateRunAcceptCandidateFields(value: Record<string, unknown>): string[] {
  if (!hasOwn(value, "runAcceptCandidate") || value.runAcceptCandidate === null) {
    return [];
  }
  if (!isRecord(value.runAcceptCandidate)) {
    return ["runAcceptCandidate must be an object or null when present"];
  }
  return validateRunAcceptCandidateClosed(value.runAcceptCandidate);
}

function validateRunAcceptExecutionFields(value: Record<string, unknown>): string[] {
  if (!hasOwn(value, "runAcceptExecution") || value.runAcceptExecution === null) {
    return [];
  }
  if (Array.isArray(value.runAcceptExecution)) {
    return ["runAcceptExecution must be a single object or null when present"];
  }
  if (!isRecord(value.runAcceptExecution)) {
    return ["runAcceptExecution must be an object or null when present"];
  }

  const execution = value.runAcceptExecution;
  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(execution, RUN_ACCEPT_EXECUTION_FIELDS, (key) => `unknown runAcceptExecution field: ${key}`),
  );

  for (const field of [
    "runLogPath",
    "expectedRunId",
    "expectedTaskId",
    "expectedCommit",
    "expectedBaseCommit",
    "requiredRuntime",
    "executionMode",
    "lifecycleOwner",
  ] as const) {
    if (!isNonEmptyString(execution[field])) {
      violations.push(`runAcceptExecution.${field} must be a non-empty string`);
    }
  }
  if (hasOwn(execution, "targetBranch") && !isNonEmptyString(execution.targetBranch)) {
    violations.push("runAcceptExecution.targetBranch must be a non-empty string when present");
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(execution[field], { allowEmpty: false })) {
      violations.push(`runAcceptExecution.${field} must be a non-empty string array`);
    }
  }
  if (execution.pushAllowed !== false) {
    violations.push("runAcceptExecution.pushAllowed must be false");
  }

  if (!isRecord(execution.expectedSideEffects)) {
    violations.push("runAcceptExecution.expectedSideEffects must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        execution.expectedSideEffects,
        RUN_ACCEPT_EXECUTION_EXPECTED_SIDE_EFFECT_FIELDS,
        (key) => `unknown runAcceptExecution.expectedSideEffects field: ${key}`,
      ),
    );
    for (const field of RUN_ACCEPT_EXECUTION_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
      if (typeof execution.expectedSideEffects[field] !== "boolean") {
        violations.push(`runAcceptExecution.expectedSideEffects.${field} must be a boolean`);
      }
    }
  }

  return violations;
}

function isRunAcceptCandidateViolation(violation: string): boolean {
  return violation === "runAcceptCandidate must be an object or null when present" ||
    violation.startsWith("runAcceptCandidate.") ||
    violation.startsWith("unknown runAcceptCandidate ");
}

function isRunAcceptExecutionViolation(violation: string): boolean {
  return violation === "runAcceptExecution must be a single object or null when present" ||
    violation === "runAcceptExecution must be an object or null when present" ||
    violation.startsWith("runAcceptExecution.") ||
    violation.startsWith("unknown runAcceptExecution ");
}

function normalizeNextArtifactPath(value: unknown, violations: string[]): string | null {
  if (!isNonEmptyString(value)) {
    violations.push("nextArtifactPath must be a non-empty repo-relative .json path or null");
    return null;
  }

  const beforeCount = violations.length;
  const trimmed = value.trim();
  const candidate = trimmed.replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (trimmed !== value || candidate !== trimmed || candidate.includes(":") || /\s/.test(candidate)) {
    violations.push(`nextArtifactPath must be a normalized repo-relative local .json path: ${value}`);
  }
  if (NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN.test(trimmed)) {
    violations.push(`nextArtifactPath must not be a command string: ${value}`);
  }
  if (NEXT_ARTIFACT_URL_PATTERN.test(candidate) || /^file:/i.test(candidate)) {
    violations.push(`nextArtifactPath must not be a URL: ${value}`);
  }
  if (candidate.startsWith("~") || NEXT_ARTIFACT_ENV_PATTERN.test(candidate)) {
    violations.push(`nextArtifactPath must not use environment expansion: ${value}`);
  }
  if (NEXT_ARTIFACT_GLOB_PATTERN.test(candidate)) {
    violations.push(`nextArtifactPath must not be glob-like: ${value}`);
  }
  if (isAbsolute(value) || candidate.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || rawSegments.includes("..")) {
    violations.push(`nextArtifactPath must be repo-relative and stay inside repoRoot: ${value}`);
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized !== candidate) {
    violations.push(`nextArtifactPath must be normalized and stay inside repoRoot: ${value}`);
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`nextArtifactPath must end with .json: ${value}`);
  }

  return violations.length === beforeCount ? normalized : null;
}

function buildNextArtifactReport(input: {
  previousArtifactPath: string;
  repoRoot: string;
  nextArtifactPath: string | null;
  nextArtifactExpectedSliceId: string | null;
  normalizedNextArtifactPath: string | null;
  resolvedNextArtifactPath: string | null;
  status: SequentialContinuationNextArtifactReport["status"];
  successor: SequentialContinuationNextArtifactReport["successor"];
  inspectedArtifactPaths: string[];
  inspectedSliceIds: string[];
  blockingReasons: string[];
}): SequentialContinuationNextArtifactReport {
  return {
    previousArtifactPath: input.previousArtifactPath,
    repoRoot: input.repoRoot,
    nextArtifactPath: input.nextArtifactPath,
    nextArtifactExpectedSliceId: input.nextArtifactExpectedSliceId,
    normalizedNextArtifactPath: input.normalizedNextArtifactPath,
    resolvedNextArtifactPath: input.resolvedNextArtifactPath,
    status: input.status,
    successor: input.successor,
    inspectedArtifactPaths: input.inspectedArtifactPaths,
    inspectedSliceIds: input.inspectedSliceIds,
    blockingReasons: input.blockingReasons,
    trustedStateChanges: false,
    pushPerformed: false,
    sideEffects: singleStepSideEffects(),
  };
}

async function readNextArtifactFile(path: string): Promise<{ artifact: unknown; violations: string[] }> {
  try {
    const pathStat = await stat(path);
    if (!pathStat.isFile()) {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath must point to a JSON file: ${path}`],
      };
    }
    return {
      artifact: JSON.parse(await readFile(path, "utf8")) as unknown,
      violations: [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath file not found: ${path}`],
      };
    }
    if (err instanceof SyntaxError) {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath JSON could not be parsed: ${err.message}`],
      };
    }
    return {
      artifact: undefined,
      violations: [`nextArtifactPath could not be read: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

function buildRunTaskPreflightReport(input: {
  artifactPath: string;
  repoRoot: string;
  status: SequentialContinuationRunTaskPreflightReport["status"];
  taskSpecPath?: string | null;
  normalizedTaskSpecPath?: string | null;
  resolvedTaskSpecPath?: string | null;
  task?: SequentialContinuationRunTaskPreflightReport["task"];
  requiredRuntime?: string | null;
  executionMode?: string | null;
  worktreePolicy?: string | null;
  lifecycleOwner?: string | null;
  targetFiles?: string[];
  forbiddenChanges?: string[];
  verifyCommands?: string[];
  blockingReasons: string[];
}): SequentialContinuationRunTaskPreflightReport {
  return {
    artifactPath: input.artifactPath,
    repoRoot: input.repoRoot,
    taskSpecPath: input.taskSpecPath ?? null,
    normalizedTaskSpecPath: input.normalizedTaskSpecPath ?? null,
    resolvedTaskSpecPath: input.resolvedTaskSpecPath ?? null,
    status: input.status,
    task: input.task ?? null,
    requiredRuntime: input.requiredRuntime ?? null,
    executionMode: input.executionMode ?? null,
    worktreePolicy: input.worktreePolicy ?? null,
    lifecycleOwner: input.lifecycleOwner ?? null,
    targetFiles: input.targetFiles ?? [],
    forbiddenChanges: input.forbiddenChanges ?? [],
    verifyCommands: input.verifyCommands ?? [],
    blockingReasons: input.blockingReasons,
    trustedStateChanges: false,
    pushPerformed: false,
    sideEffects: runTaskPreflightSideEffects(),
  };
}

function validateRunTaskCandidatePreflightRequirements(
  candidate: SequentialContinuationRunTaskCandidate,
): string[] {
  const reasons: string[] = [];
  if (candidate.requiredRuntime !== "codex-sdk") {
    reasons.push(`runTaskCandidate.requiredRuntime must be codex-sdk: ${candidate.requiredRuntime}`);
  }
  if (candidate.executionMode !== "preflight_only") {
    reasons.push(`runTaskCandidate.executionMode must be preflight_only: ${candidate.executionMode}`);
  }
  if (candidate.worktreePolicy !== "samantha_allocated_isolated") {
    reasons.push(`runTaskCandidate.worktreePolicy must be samantha_allocated_isolated: ${candidate.worktreePolicy}`);
  }
  if (candidate.lifecycleOwner !== "samantha") {
    reasons.push(`runTaskCandidate.lifecycleOwner must be samantha: ${candidate.lifecycleOwner}`);
  }
  if (candidate.evidence.taskSpecStatus !== "committed_clean") {
    reasons.push(`runTaskCandidate.evidence.taskSpecStatus must be committed_clean: ${candidate.evidence.taskSpecStatus}`);
  }
  for (const field of RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
    if (candidate.expectedSideEffects[field] !== false) {
      reasons.push(`runTaskCandidate.expectedSideEffects.${field} must be false`);
    }
  }
  return reasons;
}

function normalizeRunTaskTaskSpecPath(value: unknown, violations: string[]): string | null {
  if (!isNonEmptyString(value)) {
    violations.push("runTaskCandidate.taskSpecPath must be a non-empty repo-relative references/tasks/*.json path");
    return null;
  }

  const beforeCount = violations.length;
  const trimmed = value.trim();
  const candidate = trimmed.replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (trimmed !== value || candidate !== trimmed || candidate.includes(":") || /\s/.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must be a normalized repo-relative local references/tasks/*.json path: ${value}`);
  }
  if (NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN.test(trimmed)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be a command string: ${value}`);
  }
  if (NEXT_ARTIFACT_URL_PATTERN.test(candidate) || /^file:/i.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be a URL: ${value}`);
  }
  if (candidate.startsWith("~") || NEXT_ARTIFACT_ENV_PATTERN.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not use environment expansion: ${value}`);
  }
  if (NEXT_ARTIFACT_GLOB_PATTERN.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be glob-like: ${value}`);
  }
  if (isAbsolute(value) || candidate.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || rawSegments.includes("..")) {
    violations.push(`runTaskCandidate.taskSpecPath must be repo-relative and stay inside repoRoot: ${value}`);
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized !== candidate) {
    violations.push(`runTaskCandidate.taskSpecPath must be normalized and stay inside repoRoot: ${value}`);
  }
  if (!normalized.startsWith("references/tasks/")) {
    violations.push(`runTaskCandidate.taskSpecPath must be under references/tasks/: ${value}`);
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`runTaskCandidate.taskSpecPath must end with .json: ${value}`);
  }

  return violations.length === beforeCount ? normalized : null;
}

async function readRunTaskTaskSpecFile(input: {
  repoRoot: string;
  normalizedTaskSpecPath: string;
  resolvedTaskSpecPath: string;
}): Promise<{ taskSpec: unknown; violations: string[] }> {
  try {
    const pathStat = await stat(input.resolvedTaskSpecPath);
    if (!pathStat.isFile()) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath must point to a JSON file: ${input.resolvedTaskSpecPath}`],
      };
    }
    const [repoRealPath, taskSpecRealPath] = await Promise.all([
      realpath(input.repoRoot),
      realpath(input.resolvedTaskSpecPath),
    ]);
    const realRepoRelativePath = relative(repoRealPath, taskSpecRealPath).replaceAll("\\", "/");
    if (
      realRepoRelativePath === "" ||
      realRepoRelativePath.startsWith("../") ||
      realRepoRelativePath === ".." ||
      isAbsolute(realRepoRelativePath)
    ) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath must stay inside repoRoot after resolving symlinks: ${input.normalizedTaskSpecPath}`],
      };
    }
    return {
      taskSpec: JSON.parse(await readFile(input.resolvedTaskSpecPath, "utf8")) as unknown,
      violations: [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath file not found: ${input.resolvedTaskSpecPath}`],
      };
    }
    if (err instanceof SyntaxError) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath JSON could not be parsed: ${err.message}`],
      };
    }
    return {
      taskSpec: undefined,
      violations: [`runTaskCandidate.taskSpecPath could not be read: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

function validateRunTaskTaskSpec(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["TaskSpec must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateAllowedFields(value, TASK_SPEC_FIELDS, (key) => `unknown TaskSpec field: ${key}`));
  for (const field of ["id", "title", "targetAgent", "instructions"] as const) {
    if (!isNonEmptyString(value[field])) {
      violations.push(`TaskSpec.${field} must be a non-empty string`);
    }
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
      violations.push(`TaskSpec.${field} must be a non-empty string array`);
    }
  }
  if (hasOwn(value, "setupCommands") && !hasOnlyNonEmptyStrings(value.setupCommands, { allowEmpty: true })) {
    violations.push("TaskSpec.setupCommands must be a string array when present");
  }
  if (hasOwn(value, "resultMode") && !TASK_RESULT_MODES.has(value.resultMode as string)) {
    violations.push(`TaskSpec.resultMode must be write or report when present: ${String(value.resultMode)}`);
  }
  if (hasOwn(value, "expectedCommitSubject") && !isNonEmptyString(value.expectedCommitSubject)) {
    violations.push("TaskSpec.expectedCommitSubject must be a non-empty string when present");
  }
  if (!TASK_SPEC_STATUSES.has(value.status as string)) {
    violations.push(`TaskSpec.status must be pending, in_progress, completed, failed, or blocked: ${String(value.status)}`);
  }

  return violations;
}

async function validateCommittedCleanTaskSpec(input: {
  repoRoot: string;
  normalizedTaskSpecPath: string;
  taskSpecCommit: string;
}): Promise<string[]> {
  const reasons: string[] = [];
  try {
    await git(["cat-file", "-e", `${input.taskSpecCommit}^{commit}`], input.repoRoot);
  } catch {
    return [`runTaskCandidate.evidence.taskSpecCommit must name a local commit: ${input.taskSpecCommit}`];
  }

  const trackedAtCommit = await git(["ls-tree", "--name-only", input.taskSpecCommit, "--", input.normalizedTaskSpecPath], input.repoRoot);
  if (!trackedAtCommit.split("\n").includes(input.normalizedTaskSpecPath)) {
    reasons.push(`runTaskCandidate.evidence.taskSpecCommit does not contain taskSpecPath: ${input.taskSpecCommit} ${input.normalizedTaskSpecPath}`);
  }

  const workingTreeStatus = await gitRaw(
    ["status", "--porcelain=v1", "--untracked-files=all", "-z", "--", input.normalizedTaskSpecPath],
    input.repoRoot,
  );
  if (workingTreeStatus) {
    reasons.push(`runTaskCandidate.taskSpecPath must be tracked and committed_clean: ${input.normalizedTaskSpecPath}`);
    return reasons;
  }

  if (reasons.length > 0) {
    return reasons;
  }

  try {
    await gitRaw(["diff", "--quiet", input.taskSpecCommit, "--", input.normalizedTaskSpecPath], input.repoRoot);
  } catch {
    reasons.push(`runTaskCandidate.evidence.taskSpecCommit is stale for taskSpecPath: ${input.taskSpecCommit} ${input.normalizedTaskSpecPath}`);
  }
  return reasons;
}

function validateRunTaskHandoff(input: {
  candidate: SequentialContinuationRunTaskCandidate;
  taskSpec: TaskSpec;
  currentSlice: SequentialContinuationCurrentSlice;
}): string[] {
  const reasons: string[] = [];
  if (!sameStringArray(input.candidate.targetFiles, input.taskSpec.targetFiles)) {
    reasons.push("runTaskCandidate.targetFiles must match TaskSpec targetFiles");
  }
  if (!sameStringArray(input.candidate.forbiddenChanges, input.taskSpec.forbiddenChanges)) {
    reasons.push("runTaskCandidate.forbiddenChanges must match TaskSpec forbiddenChanges");
  }
  if (!sameStringArray(input.candidate.verifyCommands, input.taskSpec.verifyCommands)) {
    reasons.push("runTaskCandidate.verifyCommands must match TaskSpec verifyCommands");
  }
  if (!sameStringArray(input.candidate.targetFiles, input.currentSlice.targetFiles ?? [])) {
    reasons.push("runTaskCandidate.targetFiles must match currentSlice targetFiles");
  }
  if (!sameStringArray(input.candidate.forbiddenChanges, input.currentSlice.forbiddenChanges ?? [])) {
    reasons.push("runTaskCandidate.forbiddenChanges must match currentSlice forbiddenChanges");
  }
  if (!sameStringArray(input.candidate.verifyCommands, input.currentSlice.verifyCommands ?? [])) {
    reasons.push("runTaskCandidate.verifyCommands must match currentSlice verifyCommands");
  }
  return reasons;
}

function taskSpecTitleForReport(taskSpec: unknown): SequentialContinuationRunTaskPreflightReport["task"] {
  if (!isRecord(taskSpec) || !isNonEmptyString(taskSpec.id) || !isNonEmptyString(taskSpec.title)) {
    return null;
  }
  return {
    id: taskSpec.id,
    title: taskSpec.title,
  };
}

function buildRunAcceptPreflightReport(input: {
  artifactPath: string;
  repoRoot: string;
  status: SequentialContinuationRunAcceptPreflightReport["status"];
  runLogPath?: string | null;
  normalizedRunLogPath?: string | null;
  resolvedRunLogPath?: string | null;
  run?: SequentialContinuationRunAcceptPreflightReport["run"];
  expectedRunId?: string | null;
  expectedTaskId?: string | null;
  expectedCommit?: string | null;
  expectedBaseCommit?: string | null;
  targetBranch?: string | null;
  requiredRuntime?: string | null;
  executionMode?: string | null;
  lifecycleOwner?: string | null;
  pushAllowed?: false | null;
  cleanupReadiness?: SequentialContinuationRunAcceptPreflightReport["cleanupReadiness"];
  blockingReasons: string[];
}): SequentialContinuationRunAcceptPreflightReport {
  return {
    artifactPath: input.artifactPath,
    repoRoot: input.repoRoot,
    runLogPath: input.runLogPath ?? null,
    normalizedRunLogPath: input.normalizedRunLogPath ?? null,
    resolvedRunLogPath: input.resolvedRunLogPath ?? null,
    status: input.status,
    run: input.run ?? null,
    expectedRunId: input.expectedRunId ?? null,
    expectedTaskId: input.expectedTaskId ?? null,
    expectedCommit: input.expectedCommit ?? null,
    expectedBaseCommit: input.expectedBaseCommit ?? null,
    targetBranch: input.targetBranch ?? null,
    requiredRuntime: input.requiredRuntime ?? null,
    executionMode: input.executionMode ?? null,
    lifecycleOwner: input.lifecycleOwner ?? null,
    pushAllowed: input.pushAllowed ?? null,
    cleanupReadiness: input.cleanupReadiness ?? null,
    blockingReasons: input.blockingReasons,
    trustedStateChanges: false,
    pushPerformed: false,
    sideEffects: runAcceptPreflightSideEffects(),
  };
}

function runAcceptCandidateReportFields(value: unknown): Pick<
  SequentialContinuationRunAcceptPreflightReport,
  | "runLogPath"
  | "expectedRunId"
  | "expectedTaskId"
  | "expectedCommit"
  | "expectedBaseCommit"
  | "targetBranch"
  | "requiredRuntime"
  | "executionMode"
  | "lifecycleOwner"
  | "pushAllowed"
> {
  if (!isRecord(value)) {
    return {
      runLogPath: null,
      expectedRunId: null,
      expectedTaskId: null,
      expectedCommit: null,
      expectedBaseCommit: null,
      targetBranch: null,
      requiredRuntime: null,
      executionMode: null,
      lifecycleOwner: null,
      pushAllowed: null,
    };
  }
  return {
    runLogPath: stringOrNull(value.runLogPath),
    expectedRunId: stringOrNull(value.expectedRunId),
    expectedTaskId: stringOrNull(value.expectedTaskId),
    expectedCommit: stringOrNull(value.expectedCommit),
    expectedBaseCommit: stringOrNull(value.expectedBaseCommit),
    targetBranch: stringOrNull(value.targetBranch),
    requiredRuntime: stringOrNull(value.requiredRuntime),
    executionMode: stringOrNull(value.executionMode),
    lifecycleOwner: stringOrNull(value.lifecycleOwner),
    pushAllowed: value.pushAllowed === false ? false : null,
  };
}

function validateRunAcceptCandidateClosed(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["runAcceptCandidate must be an object or null when present"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, RUN_ACCEPT_CANDIDATE_FIELDS, (key) => `unknown runAcceptCandidate field: ${key}`),
  );

  for (const field of [
    "runLogPath",
    "expectedRunId",
    "expectedTaskId",
    "expectedCommit",
    "expectedBaseCommit",
    "requiredRuntime",
    "executionMode",
    "lifecycleOwner",
  ] as const) {
    if (!isNonEmptyString(value[field])) {
      violations.push(`runAcceptCandidate.${field} must be a non-empty string`);
    }
  }
  if (hasOwn(value, "targetBranch") && !isNonEmptyString(value.targetBranch)) {
    violations.push("runAcceptCandidate.targetBranch must be a non-empty string when present");
  }
  if (value.pushAllowed !== false) {
    violations.push("runAcceptCandidate.pushAllowed must be false");
  }

  if (!isRecord(value.expectedSideEffects)) {
    violations.push("runAcceptCandidate.expectedSideEffects must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        value.expectedSideEffects,
        RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS,
        (key) => `unknown runAcceptCandidate.expectedSideEffects field: ${key}`,
      ),
    );
    for (const field of RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
      if (typeof value.expectedSideEffects[field] !== "boolean") {
        violations.push(`runAcceptCandidate.expectedSideEffects.${field} must be a boolean`);
      } else if (value.expectedSideEffects[field] !== false) {
        violations.push(`runAcceptCandidate.expectedSideEffects.${field} must be false`);
      }
    }
  }

  return violations;
}

function validateRunAcceptCandidatePreflightRequirements(
  candidate: SequentialContinuationRunAcceptCandidate,
): string[] {
  const reasons: string[] = [];
  if (candidate.requiredRuntime !== "codex-sdk") {
    reasons.push(`runAcceptCandidate.requiredRuntime must be codex-sdk: ${candidate.requiredRuntime}`);
  }
  if (candidate.executionMode !== "accept_preflight_only") {
    reasons.push(`runAcceptCandidate.executionMode must be accept_preflight_only: ${candidate.executionMode}`);
  }
  if (candidate.lifecycleOwner !== "samantha") {
    reasons.push(`runAcceptCandidate.lifecycleOwner must be samantha: ${candidate.lifecycleOwner}`);
  }
  if (candidate.pushAllowed !== false) {
    reasons.push("runAcceptCandidate.pushAllowed must be false");
  }
  for (const field of RUN_ACCEPT_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
    if (candidate.expectedSideEffects[field] !== false) {
      reasons.push(`runAcceptCandidate.expectedSideEffects.${field} must be false`);
    }
  }
  return reasons;
}

function normalizeRunAcceptRunLogPath(value: unknown, violations: string[]): string | null {
  if (!isNonEmptyString(value)) {
    violations.push("runAcceptCandidate.runLogPath must be a non-empty repo-relative runs/*.json path");
    return null;
  }

  const beforeCount = violations.length;
  const trimmed = value.trim();
  const candidate = trimmed.replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (trimmed !== value || candidate !== trimmed || candidate.includes(":") || /\s/.test(candidate)) {
    violations.push(`runAcceptCandidate.runLogPath must be a normalized repo-relative local runs/*.json path: ${value}`);
  }
  if (RUN_ACCEPT_PATH_COMMAND_PREFIX_PATTERN.test(trimmed)) {
    violations.push(`runAcceptCandidate.runLogPath must not be a command string: ${value}`);
  }
  if (NEXT_ARTIFACT_URL_PATTERN.test(candidate) || /^file:/i.test(candidate)) {
    violations.push(`runAcceptCandidate.runLogPath must not be a URL: ${value}`);
  }
  if (candidate.startsWith("~") || NEXT_ARTIFACT_ENV_PATTERN.test(candidate)) {
    violations.push(`runAcceptCandidate.runLogPath must not use environment expansion: ${value}`);
  }
  if (NEXT_ARTIFACT_GLOB_PATTERN.test(candidate)) {
    violations.push(`runAcceptCandidate.runLogPath must not be glob-like: ${value}`);
  }
  if (isAbsolute(value) || candidate.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || rawSegments.includes("..")) {
    violations.push(`runAcceptCandidate.runLogPath must be repo-relative and stay inside repoRoot: ${value}`);
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized !== candidate) {
    violations.push(`runAcceptCandidate.runLogPath must be normalized and stay inside repoRoot: ${value}`);
  }
  if (!normalized.startsWith("runs/") || normalized.split("/").length !== 2) {
    violations.push(`runAcceptCandidate.runLogPath must match runs/*.json: ${value}`);
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`runAcceptCandidate.runLogPath must end with .json: ${value}`);
  }

  return violations.length === beforeCount ? normalized : null;
}

async function readRunAcceptRunLogFile(input: {
  repoRoot: string;
  normalizedRunLogPath: string;
  resolvedRunLogPath: string;
}): Promise<{ runLog: unknown; violations: string[] }> {
  try {
    const pathStat = await stat(input.resolvedRunLogPath);
    if (!pathStat.isFile()) {
      return {
        runLog: undefined,
        violations: [`runAcceptCandidate.runLogPath must point to a JSON file: ${input.resolvedRunLogPath}`],
      };
    }
    const [repoRealPath, runLogRealPath] = await Promise.all([
      realpath(input.repoRoot),
      realpath(input.resolvedRunLogPath),
    ]);
    const realRepoRelativePath = relative(repoRealPath, runLogRealPath).replaceAll("\\", "/");
    if (
      realRepoRelativePath === "" ||
      realRepoRelativePath.startsWith("../") ||
      realRepoRelativePath === ".." ||
      isAbsolute(realRepoRelativePath)
    ) {
      return {
        runLog: undefined,
        violations: [`runAcceptCandidate.runLogPath must stay inside repoRoot after resolving symlinks: ${input.normalizedRunLogPath}`],
      };
    }
    return {
      runLog: JSON.parse(await readFile(input.resolvedRunLogPath, "utf8")) as unknown,
      violations: [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        runLog: undefined,
        violations: [`runAcceptCandidate.runLogPath file not found: ${input.resolvedRunLogPath}`],
      };
    }
    if (err instanceof SyntaxError) {
      return {
        runLog: undefined,
        violations: [`runAcceptCandidate.runLogPath JSON could not be parsed: ${err.message}`],
      };
    }
    return {
      runLog: undefined,
      violations: [`runAcceptCandidate.runLogPath could not be read: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

function validateRunAcceptRunLogShape(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["run log must be an object"];
  }
  const reasons: string[] = [];
  if (!isRecord(value.task)) {
    reasons.push("run log task must be an object");
  }
  if (!isRecord(value.agent)) {
    reasons.push("run log agent must be an object");
  }
  if (!isRecord(value.result)) {
    reasons.push("run log result must be an object");
  } else if (!isRecord(value.result.preparation)) {
    reasons.push("run log result.preparation must be an object");
  }
  return reasons;
}

async function validateRunAcceptRunLogEvidence(input: {
  repoRoot: string;
  artifactPath: string;
  normalizedRunLogPath: string;
  candidate: SequentialContinuationRunAcceptCandidate;
  targetBranch: string;
  currentSlice: SequentialContinuationCurrentSlice;
  runLog: WorkerRunLog;
}): Promise<{
  blockingReasons: string[];
  cleanupReadiness: SequentialContinuationRunAcceptPreflightReport["cleanupReadiness"];
}> {
  const reasons: string[] = [];
  const runLog = input.runLog;
  const actionableCommit = actionableCommitForRunLog(runLog);
  const baseCommit = runLog.result.preparation.allocation?.baseCommit ?? "";
  const runtimeKind = runLog.result.runtime?.kind ?? null;

  if (!isRecord(runLog)) {
    return {
      blockingReasons: ["run log must be an object"],
      cleanupReadiness: null,
    };
  }
  if (runLog.schemaVersion !== 1) {
    reasons.push(`run log schemaVersion must be exactly 1: ${String(runLog.schemaVersion)}`);
  }
  if (runLog.runId !== input.candidate.expectedRunId) {
    reasons.push(`runAcceptCandidate.expectedRunId must match run log runId: ${input.candidate.expectedRunId} !== ${String(runLog.runId)}`);
  }
  if (runLog.task.id !== input.candidate.expectedTaskId) {
    reasons.push(`runAcceptCandidate.expectedTaskId must match run log task.id: ${input.candidate.expectedTaskId} !== ${String(runLog.task.id)}`);
  }
  if (actionableCommit !== input.candidate.expectedCommit) {
    reasons.push(`runAcceptCandidate.expectedCommit must match run log candidate commit: ${input.candidate.expectedCommit} !== ${actionableCommit}`);
  }
  if (baseCommit !== input.candidate.expectedBaseCommit) {
    reasons.push(`runAcceptCandidate.expectedBaseCommit must match run log worker base commit: ${input.candidate.expectedBaseCommit} !== ${baseCommit}`);
  }
  if (runtimeKind !== input.candidate.requiredRuntime) {
    reasons.push(`run log runtime.kind must match runAcceptCandidate.requiredRuntime ${input.candidate.requiredRuntime}: ${runtimeKind ?? "null"}`);
  }
  if (runLog.result.pass !== true || runLog.result.evaluation?.pass !== true) {
    reasons.push("run did not pass Samantha evaluation");
  }
  if (!runLog.result.evaluation?.harness) {
    reasons.push("run log has no parsed HARNESS_RESULT");
  } else if (runLog.result.evaluation.harness.status !== "pass") {
    reasons.push(`run log HARNESS_RESULT.status must be pass: ${runLog.result.evaluation.harness.status}`);
  }

  for (const violation of runLog.result.evaluation?.scopeViolations ?? []) {
    reasons.push(`run log scope violation: ${violation.file} ${violation.reason}`);
  }
  reasons.push(...validateRunAcceptVerificationEvidence(runLog));
  reasons.push(...validateRunAcceptScopeHandoff({ runLog, currentSlice: input.currentSlice }));
  reasons.push(
    ...(await validateRunAcceptGitState({
      repoRoot: input.repoRoot,
      expectedCommit: input.candidate.expectedCommit,
      expectedBaseCommit: input.candidate.expectedBaseCommit,
      targetBranch: input.targetBranch,
      ignoredDirtyPaths: [
        normalizePathForReport(input.artifactPath, input.repoRoot),
        input.normalizedRunLogPath,
      ],
    })),
  );
  const cleanupReadiness = await inspectRunAcceptCleanupReadiness({
    repoRoot: input.repoRoot,
    runLog,
  });
  for (const violation of cleanupReadiness?.violations ?? []) {
    reasons.push(`cleanup readiness risk: ${violation}`);
  }

  return {
    blockingReasons: uniqueStrings(reasons),
    cleanupReadiness,
  };
}

function validateRunAcceptVerificationEvidence(runLog: WorkerRunLog): string[] {
  const reasons: string[] = [];
  if (!hasOnlyNonEmptyStrings(runLog.task.verifyCommands, { allowEmpty: false })) {
    reasons.push("run log task.verifyCommands must be a non-empty string array");
    return reasons;
  }

  const verifyResults = runLog.result.evaluation?.verifyResults;
  if (!Array.isArray(verifyResults) || verifyResults.length === 0) {
    return [
      ...reasons,
      ...runLog.task.verifyCommands.map((command) => `run log is missing declared verify command result: ${command}`),
    ];
  }
  for (const command of runLog.task.verifyCommands) {
    const result = verifyResults.find((item) => item.command === command);
    if (!result) {
      reasons.push(`run log is missing declared verify command result: ${command}`);
    } else if (result.exitCode !== 0) {
      reasons.push(`run log verify command failed: ${command}`);
    }
  }
  for (const result of verifyResults) {
    if (result.exitCode !== 0 && !reasons.includes(`run log verify command failed: ${result.command}`)) {
      reasons.push(`run log verify command failed: ${result.command}`);
    }
  }
  return reasons;
}

function validateRunAcceptScopeHandoff(input: {
  runLog: WorkerRunLog;
  currentSlice: SequentialContinuationCurrentSlice;
}): string[] {
  const reasons: string[] = [];
  if (!sameStringArray(input.currentSlice.targetFiles ?? [], input.runLog.task.targetFiles)) {
    reasons.push("currentSlice.targetFiles must match run log TaskSpec targetFiles");
  }
  if (!sameStringArray(input.currentSlice.forbiddenChanges ?? [], input.runLog.task.forbiddenChanges)) {
    reasons.push("currentSlice.forbiddenChanges must match run log TaskSpec forbiddenChanges");
  }
  if (!sameStringArray(input.currentSlice.verifyCommands ?? [], input.runLog.task.verifyCommands)) {
    reasons.push("currentSlice.verifyCommands must match run log TaskSpec verifyCommands");
  }
  return reasons;
}

async function validateRunAcceptGitState(input: {
  repoRoot: string;
  expectedCommit: string;
  expectedBaseCommit: string;
  targetBranch: string;
  ignoredDirtyPaths: string[];
}): Promise<string[]> {
  const reasons: string[] = [];
  const commitExists = await gitCommandSucceeds(["cat-file", "-e", `${input.expectedCommit}^{commit}`], input.repoRoot);
  const baseCommitExists = await gitCommandSucceeds(["cat-file", "-e", `${input.expectedBaseCommit}^{commit}`], input.repoRoot);
  if (!commitExists) {
    reasons.push(`runAcceptCandidate.expectedCommit must name a local commit: ${input.expectedCommit}`);
  }
  if (!baseCommitExists) {
    reasons.push(`runAcceptCandidate.expectedBaseCommit must name a local commit: ${input.expectedBaseCommit}`);
  }
  if (
    commitExists &&
    baseCommitExists &&
    !(await gitCommandSucceeds(["merge-base", "--is-ancestor", input.expectedBaseCommit, input.expectedCommit], input.repoRoot))
  ) {
    reasons.push("candidate commit is not descended from the worker base commit");
  }

  const branch = await git(["branch", "--show-current"], input.repoRoot);
  if (branch !== input.targetBranch) {
    reasons.push(`target repo is on ${branch || "(detached)"}, expected ${input.targetBranch}`);
  }
  const status = await gitRaw(["status", "--porcelain=v1", "--untracked-files=all", "-z"], input.repoRoot);
  const dirtyPaths = parseGitStatusPaths(status).filter((path) => !input.ignoredDirtyPaths.includes(path));
  if (dirtyPaths.length > 0) {
    reasons.push("target repo has uncommitted changes");
  }
  if (commitExists && baseCommitExists) {
    const head = await git(["rev-parse", "HEAD"], input.repoRoot);
    const alreadyIntegrated = await gitCommandSucceeds(["merge-base", "--is-ancestor", input.expectedCommit, head], input.repoRoot);
    if (head !== input.expectedBaseCommit && !alreadyIntegrated) {
      reasons.push("target repo HEAD no longer matches the worker base commit");
    }
  }
  return reasons;
}

async function inspectRunAcceptCleanupReadiness(input: {
  repoRoot: string;
  runLog: WorkerRunLog;
}): Promise<SequentialContinuationRunAcceptPreflightReport["cleanupReadiness"]> {
  const allocation = input.runLog.result.preparation.allocation;
  if (!allocation) {
    return {
      worktreePath: "",
      branch: "",
      classification: "blocked",
      violations: ["run log has no allocated worktree"],
    };
  }

  const violations: string[] = [];
  const repoRoot = await safeRealpath(input.repoRoot);
  const allocationRepoRoot = await safeRealpath(allocation.repoRoot);
  const allocationWorktreePath = await safeRealpath(allocation.worktreePath);
  if (allocationRepoRoot !== repoRoot) {
    violations.push("run log repoRoot does not match target repo");
  }
  if (allocationWorktreePath === repoRoot) {
    violations.push("refusing to clean target repo main worktree");
  }
  if (!(await gitCommandSucceeds(["rev-parse", "--show-toplevel"], allocation.worktreePath))) {
    violations.push("allocated worktree path is missing or invalid");
  } else {
    const worktreeStatus = await gitRaw(["status", "--porcelain"], allocation.worktreePath);
    if (worktreeStatus.trim().length > 0) {
      violations.push("worker worktree has uncommitted changes");
    }
  }
  if (!(await gitCommandSucceeds(["rev-parse", "--verify", allocation.branch], input.repoRoot))) {
    violations.push("worker branch is missing before cleanup");
  }

  return {
    worktreePath: allocation.worktreePath,
    branch: allocation.branch,
    classification: violations.length === 0 ? "ready" : "blocked",
    violations,
  };
}

async function gitCommandSucceeds(args: string[], cwd: string): Promise<boolean> {
  try {
    await git(args, cwd);
    return true;
  } catch {
    return false;
  }
}

function parseGitStatusPaths(status: string): string[] {
  if (!status) return [];
  return status
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .map((path) => path.replaceAll("\\", "/"))
    .filter(Boolean);
}

async function safeRealpath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

function runAcceptRunTitleForReport(runLog: WorkerRunLog): SequentialContinuationRunAcceptPreflightReport["run"] {
  if (!isNonEmptyString(runLog.runId) || !isNonEmptyString(runLog.task.id)) {
    return null;
  }
  return {
    id: runLog.runId,
    taskId: runLog.task.id,
  };
}

async function validateSuccessorEvidenceFreshness(input: {
  repoRoot: string;
  predecessorArtifactPath: string;
  predecessorArtifact: unknown;
  successorArtifact: unknown;
}): Promise<string[]> {
  if (!isRecord(input.successorArtifact) || !Array.isArray(input.successorArtifact.evidenceReferences)) {
    return [];
  }

  const violations: string[] = [];
  const successorEvidencePaths = input.successorArtifact.evidenceReferences.flatMap((reference) => {
    return isRecord(reference) && isNonEmptyString(reference.path) ? [reference.path] : [];
  });
  const predecessorEvidencePaths =
    isRecord(input.predecessorArtifact) && Array.isArray(input.predecessorArtifact.evidenceReferences)
      ? input.predecessorArtifact.evidenceReferences.flatMap((reference) => {
          return isRecord(reference) && isNonEmptyString(reference.path) ? [reference.path] : [];
        })
      : [];
  const requiredCitations = new Set(
    [input.predecessorArtifactPath, ...predecessorEvidencePaths].map((path) =>
      normalizePathForReport(path, input.repoRoot),
    ),
  );
  const successorCitations = new Set(
    successorEvidencePaths.map((path) => normalizePathForReport(path, input.repoRoot)),
  );

  for (const evidencePath of successorEvidencePaths) {
    if (!(await localEvidenceReferenceExists(input.repoRoot, evidencePath))) {
      violations.push(`successor evidence reference file is missing: ${evidencePath}`);
    }
  }
  if (![...successorCitations].some((path) => requiredCitations.has(path))) {
    violations.push("successor evidenceReferences must cite predecessor artifact or evidence reference");
  }

  return violations;
}

async function localEvidenceReferenceExists(repoRoot: string, path: string): Promise<boolean> {
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  const repoRelativePath = relative(repoRoot, resolvedPath).replaceAll("\\", "/");
  if (repoRelativePath === "" || repoRelativePath.startsWith("../") || repoRelativePath === ".." || isAbsolute(repoRelativePath)) {
    return false;
  }
  try {
    return (await stat(resolvedPath)).isFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

function readOptionalStringField(value: unknown, field: string): string | null {
  if (!isRecord(value) || !hasOwn(value, field) || value[field] === null) {
    return null;
  }
  return typeof value[field] === "string" ? value[field] : null;
}

function normalizePathForReport(path: string, repoRoot: string): string {
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  const repoRelativePath = relative(repoRoot, resolvedPath).replaceAll("\\", "/");
  if (repoRelativePath !== "" && !repoRelativePath.startsWith("../") && repoRelativePath !== ".." && !isAbsolute(repoRelativePath)) {
    return repoRelativePath;
  }
  return path.replaceAll("\\", "/");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function validateForbiddenFieldNames(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => validateForbiddenFieldNames(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) {
    return [];
  }

  const violations: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (isForbiddenFieldName(key)) {
      violations.push(`${fieldPath} field is not allowed in a sequential continuation artifact`);
    }
    violations.push(...validateForbiddenFieldNames(nestedValue, fieldPath));
  }

  return violations;
}

function validateForbiddenLifecycleWording(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    if (FORBIDDEN_LIFECYCLE_WORDING_PATTERNS.some((pattern) => pattern.test(value))) {
      return [`${path || "artifact"} must not authorize lifecycle action: ${value}`];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => validateForbiddenLifecycleWording(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    return validateForbiddenLifecycleWording(nestedValue, path ? `${path}.${key}` : key);
  });
}

function isForbiddenFieldName(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    FORBIDDEN_FIELD_NAMES.has(normalized) ||
    normalized.includes("hiddenmemory") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.includes("apikey") ||
    normalized.includes("token") ||
    normalized.includes("daemon") ||
    normalized.includes("watch") ||
    normalized.includes("dashboard") ||
    normalized.includes("remoteadapter") ||
    normalized.includes("routinetrigger")
  );
}

function isStopConditionId(value: unknown): value is SequentialContinuationStopConditionId {
  return typeof value === "string" && STOP_CONDITION_ID_SET.has(value as SequentialContinuationStopConditionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isSequentialContinuationArtifact(value: unknown): value is SequentialContinuationArtifact {
  return validateSequentialContinuationArtifact(value).length === 0;
}

function isStatusEvidenceDocument(value: unknown): value is SequentialContinuationStatusEvidenceDocument {
  return validateSequentialContinuationStatusEvidence(value).length === 0;
}

function isStatusEvidenceDocumentWithOptions(
  value: unknown,
  options: StatusEvidenceValidationOptions,
): value is SequentialContinuationStatusEvidenceDocument {
  return validateSequentialContinuationStatusEvidenceWithOptions(value, options).length === 0;
}

function readReportCurrentSlice(value: unknown): SequentialContinuationReport["currentSlice"] {
  const fallback = {
    id: null,
    status: null,
    actionType: null,
    dependencyStatus: null,
  };
  if (!isRecord(value) || !isRecord(value.currentSlice)) {
    return fallback;
  }

  return {
    id: stringOrNull(value.currentSlice.id),
    status: stringOrNull(value.currentSlice.status),
    actionType: stringOrNull(value.currentSlice.actionType),
    dependencyStatus: stringOrNull(value.currentSlice.dependencyStatus),
  };
}

function readStatusUpdateCurrentSlice(value: unknown): SequentialContinuationStatusUpdateReport["currentSlice"] {
  const fallback = {
    id: null,
    previousStatus: null,
    updatedStatus: null,
    actionType: null,
    dependencyStatus: null,
  };
  if (!isRecord(value) || !isRecord(value.currentSlice)) {
    return fallback;
  }

  return {
    id: stringOrNull(value.currentSlice.id),
    previousStatus: stringOrNull(value.currentSlice.status),
    updatedStatus: stringOrNull(value.currentSlice.status),
    actionType: stringOrNull(value.currentSlice.actionType),
    dependencyStatus: stringOrNull(value.currentSlice.dependencyStatus),
  };
}

function readReportActiveStopConditions(value: unknown): SequentialContinuationReport["activeStopConditions"] {
  if (!isRecord(value) || !Array.isArray(value.stopConditionChecklist)) {
    return [];
  }

  return value.stopConditionChecklist.flatMap((item) => {
    if (!isRecord(item) || item.active !== true || !isNonEmptyString(item.id) || !isNonEmptyString(item.evidence)) {
      return [];
    }
    return [{ id: item.id, evidence: item.evidence }];
  });
}

function readReportNextStep(value: unknown): { kind: string | null; value: string | null } {
  if (!isRecord(value) || !isRecord(value.nextStep)) {
    return {
      kind: null,
      value: null,
    };
  }

  return {
    kind: stringOrNull(value.nextStep.kind),
    value: stringOrNull(value.nextStep.value),
  };
}

function readStatusUpdateOutcome(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return stringOrNull(value.outcome);
}

function readStatusEvidenceReferences(value: unknown): SequentialContinuationStatusEvidenceReference[] {
  if (!isRecord(value) || !Array.isArray(value.evidenceReferences)) {
    return [];
  }

  return value.evidenceReferences.flatMap((item) => {
    if (
      !isRecord(item) ||
      !STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind) ||
      !isNonEmptyString(item.path) ||
      !isNonEmptyString(item.summary) ||
      !STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)
    ) {
      return [];
    }
    return [
      {
        kind: item.kind as SequentialContinuationStatusEvidenceKind,
        path: item.path,
        summary: item.summary,
        result: item.result as SequentialContinuationStatusEvidenceResult,
      },
    ];
  });
}

function hasTrustedCompletionEvidence(
  actionType: SequentialContinuationActionType,
  references: SequentialContinuationStatusEvidenceReference[],
): boolean {
  if (actionType === "run_task" || actionType === "batch_plan") {
    return references.some((reference) => reference.kind === "run_log" && reference.result === "passed");
  }
  if (actionType === "readiness_check") {
    return references.some(
      (reference) =>
        reference.kind === "readiness_report" &&
        (reference.result === "passed" || reference.result === "clear" || reference.result === "completed"),
    );
  }
  if (actionType === "report_only") {
    return references.some(
      (reference) =>
        (reference.kind === "continuation_report" || reference.kind === "report_review") &&
        (reference.result === "passed" || reference.result === "clear" || reference.result === "completed"),
    );
  }
  if (actionType === "manual_decision") {
    return references.some((reference) => reference.result !== "recommendation_only");
  }
  return false;
}

function buildStatusUpdateReport(input: {
  artifactPath: string;
  evidencePath: string;
  status: "accepted" | "rejected";
  violations: string[];
  requestedOutcome: string | null;
  acceptedOutcome: "completed" | "blocked" | null;
  currentSlice: SequentialContinuationStatusUpdateReport["currentSlice"];
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  nextStep: { kind: string | null; value: string | null };
  artifactUpdated: boolean;
}): SequentialContinuationStatusUpdateReport {
  return {
    artifactPath: input.artifactPath,
    evidencePath: input.evidencePath,
    status: input.status,
    violations: input.violations,
    requestedOutcome: input.requestedOutcome,
    acceptedOutcome: input.acceptedOutcome,
    currentSlice: input.currentSlice,
    evidenceReferences: input.evidenceReferences,
    exactNextSamanthaCommand: input.nextStep.kind === "samantha_command" ? input.nextStep.value : null,
    blockedReportText: input.nextStep.kind === "blocked_report" ? input.nextStep.value : null,
    artifactUpdated: input.artifactUpdated,
    trustedStateChanges: input.artifactUpdated,
    pushPerformed: false,
    sideEffects: {
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
    },
  };
}

function buildSingleStepResult(input: {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  selectedActionType: string | null;
  actionExecuted: boolean;
  actionAttemptCount: number;
  generatedEvidencePath: string | null;
  inlineEvidenceSummary: string | null;
  statusUpdateReport: SequentialContinuationStatusUpdateReport | null;
  nextStep: SequentialContinuationNextStep | null;
  updatedArtifact: SequentialContinuationArtifact | null;
}): SequentialContinuationSingleStepResult {
  return {
    report: {
      artifactPath: input.artifactPath,
      status: input.status,
      violations: input.violations,
      selectedActionType: input.selectedActionType,
      actionExecuted: input.actionExecuted,
      actionAttemptCount: input.actionAttemptCount,
      generatedEvidencePath: input.generatedEvidencePath,
      inlineEvidenceSummary: input.inlineEvidenceSummary,
      statusUpdateReport: input.statusUpdateReport,
      nextStep: input.nextStep,
      continued: false,
      multiStepLoopStarted: false,
      pushPerformed: false,
      sideEffects: singleStepSideEffects(),
    },
    updatedArtifact: input.updatedArtifact,
  };
}

function buildLoopResult(input: {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  stepCount: number;
  maxSteps: number;
  stopReason: string;
  failedEvidenceReworkCyclesUsed: number;
  maxFailedEvidenceReworkCycles: number;
  singleStepReports: SequentialContinuationSingleStepReport[];
  nextStep: SequentialContinuationNextStep | null;
  updatedArtifacts: SequentialContinuationLoopResult["updatedArtifacts"];
}): SequentialContinuationLoopResult {
  return {
    report: {
      artifactPath: input.artifactPath,
      status: input.status,
      violations: input.violations,
      stepCount: input.stepCount,
      maxSteps: input.maxSteps,
      stopReason: input.stopReason,
      failedEvidenceReworkCyclesUsed: input.failedEvidenceReworkCyclesUsed,
      failedEvidenceReworkCyclesRemaining:
        input.maxFailedEvidenceReworkCycles - input.failedEvidenceReworkCyclesUsed,
      singleStepReports: input.singleStepReports,
      nextStep: input.nextStep,
      continued: input.singleStepReports.length > 1,
      multiStepLoopStarted: input.maxSteps > 1,
      pushPerformed: false,
      sideEffects: singleStepSideEffects(),
    },
    updatedArtifacts: input.updatedArtifacts,
  };
}

function singleStepSideEffects(): SequentialContinuationSingleStepReport["sideEffects"] {
  return {
    runTaskCalled: false,
    batchesExecuteCalled: false,
    workersDispatched: false,
    runsCreated: false,
    worktreesCreated: false,
    pushPerformed: false,
  };
}

function runTaskPreflightSideEffects(): SequentialContinuationRunTaskPreflightReport["sideEffects"] {
  return {
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
  };
}

function runAcceptPreflightSideEffects(): SequentialContinuationRunAcceptPreflightReport["sideEffects"] {
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
  };
}

function runTaskExecutionSideEffects(
  executed: boolean,
): SequentialContinuationRunTaskExecutionReport["sideEffects"] {
  return {
    runTaskCalled: executed,
    batchesExecuteCalled: false,
    workersDispatched: executed,
    runsCreated: executed,
    worktreesCreated: executed,
    deterministicVerification: executed,
    acceptPerformed: false,
    lifecycleMutated: false,
    mergePerformed: false,
    cleanupPerformed: false,
    commitPerformed: false,
    pushPerformed: false,
    multiStepLoopStarted: false,
    successorExecuted: false,
  };
}

function runAcceptExecutionSideEffects(
  executed: boolean,
): SequentialContinuationRunAcceptExecutionReport["sideEffects"] {
  return {
    runsAcceptCalled: executed,
    mergeGateRecorded: executed,
    mergePerformed: executed,
    lifecycleMutated: executed,
    cleanupPerformed: executed,
    commitPerformed: false,
    pushPerformed: false,
    runTaskCalled: false,
    workersDispatched: false,
    batchesExecuteCalled: false,
    multiStepLoopStarted: false,
    successorExecuted: false,
  };
}

function buildRunTaskExecutionReport(input: {
  artifactPath: string;
  repoRoot: string;
  status: SequentialContinuationRunTaskExecutionReport["status"];
  violations: string[];
  blockingReasons: string[];
  selectedActionType: string | null;
  normalizedTaskSpecPath: string | null;
  resolvedTaskSpecPath: string | null;
  runTaskPreflight: SequentialContinuationRunTaskPreflightReport | null;
  runLogPath?: string | null;
  executorEvidencePath?: string | null;
  harnessResult?: HarnessResult | null;
  executionPass?: boolean | null;
  actionAttemptCount: number;
  actionExecuted: boolean;
  stopReason: string;
}): SequentialContinuationRunTaskExecutionReport {
  const trustedStateChanges =
    input.status === "accepted"
      ? uniqueStrings([
          ...(input.runLogPath ? ["run_log"] : []),
          ...(input.executorEvidencePath && input.executorEvidencePath !== input.runLogPath ? ["executor_evidence"] : []),
          "execution_report",
        ])
      : [];
  return {
    artifactPath: input.artifactPath,
    repoRoot: input.repoRoot,
    status: input.status,
    violations: input.violations,
    blockingReasons: input.blockingReasons,
    selectedActionType: input.selectedActionType,
    normalizedTaskSpecPath: input.normalizedTaskSpecPath,
    resolvedTaskSpecPath: input.resolvedTaskSpecPath,
    runTaskPreflight: input.runTaskPreflight,
    runLogPath: input.runLogPath ?? null,
    executorEvidencePath: input.executorEvidencePath ?? null,
    harnessResult: input.harnessResult ?? null,
    executionPass: input.executionPass ?? null,
    actionAttemptCount: input.actionAttemptCount,
    actionExecuted: input.actionExecuted,
    continued: false,
    stopReason: input.stopReason,
    trustedStateChanges,
    pushPerformed: false,
    sideEffects: runTaskExecutionSideEffects(input.status === "accepted" && input.actionExecuted),
  };
}

function buildRunAcceptExecutionReport(input: {
  artifactPath: string;
  repoRoot: string;
  status: SequentialContinuationRunAcceptExecutionReport["status"];
  violations: string[];
  blockingReasons: string[];
  selectedActionType: string | null;
  runAcceptPreflight: SequentialContinuationRunAcceptPreflightReport | null;
  acceptResult?: RunAcceptResult | null;
  actionAttemptCount: number;
  actionExecuted: boolean;
  stopReason: string;
}): SequentialContinuationRunAcceptExecutionReport {
  const accepted = input.status === "accepted" && input.actionExecuted;
  const trustedStateChanges = accepted
    ? ["run_log_trajectory", "lifecycle_record", "merge_result", "cleanup_result"]
    : [];
  return {
    artifactPath: input.artifactPath,
    repoRoot: input.repoRoot,
    status: input.status,
    violations: input.violations,
    blockingReasons: input.blockingReasons,
    selectedActionType: input.selectedActionType,
    runLogPath: input.runAcceptPreflight?.runLogPath ?? null,
    normalizedRunLogPath: input.runAcceptPreflight?.normalizedRunLogPath ?? null,
    resolvedRunLogPath: input.runAcceptPreflight?.resolvedRunLogPath ?? null,
    run: input.runAcceptPreflight?.run ?? null,
    expectedRunId: input.runAcceptPreflight?.expectedRunId ?? null,
    expectedTaskId: input.runAcceptPreflight?.expectedTaskId ?? null,
    expectedCommit: input.runAcceptPreflight?.expectedCommit ?? null,
    expectedBaseCommit: input.runAcceptPreflight?.expectedBaseCommit ?? null,
    targetBranch: input.runAcceptPreflight?.targetBranch ?? null,
    requiredRuntime: input.runAcceptPreflight?.requiredRuntime ?? null,
    lifecycleOwner: input.runAcceptPreflight?.lifecycleOwner ?? null,
    runAcceptPreflight: input.runAcceptPreflight,
    acceptResultSummary: summarizeRunAcceptResult(input.acceptResult ?? null),
    lifecycleEvidenceSummary: summarizeRunAcceptLifecycle(input.acceptResult ?? null),
    cleanupEvidenceSummary: summarizeRunAcceptCleanup(input.acceptResult ?? null),
    actionAttemptCount: input.actionAttemptCount,
    actionExecuted: input.actionExecuted,
    continued: false,
    stopReason: input.stopReason,
    trustedStateChanges,
    pushPerformed: false,
    sideEffects: runAcceptExecutionSideEffects(accepted),
  };
}

function summarizeRunAcceptResult(result: RunAcceptResult | null): SequentialContinuationRunAcceptExecutionReport["acceptResultSummary"] {
  if (!result) return null;
  return {
    accepted: result.accepted,
    status: result.status,
    gateStatus: result.gate?.status ?? null,
    mergeExitCode: result.merge?.exitCode ?? null,
    lessonDraftStatus: result.lessonDraft?.status ?? null,
    lessonDraftPath: result.lessonDraft?.path ?? null,
  };
}

function summarizeRunAcceptLifecycle(result: RunAcceptResult | null): SequentialContinuationRunAcceptExecutionReport["lifecycleEvidenceSummary"] {
  if (!result?.lifecycle) return null;
  const merged = result.lifecycle.merged;
  return {
    merged: Boolean(merged?.mergedAt),
    cleaned: Boolean(result.lifecycle.cleaned?.cleanedAt),
    runId: merged?.runId ?? null,
    taskId: merged?.taskId ?? null,
    commit: merged?.commit ?? null,
  };
}

function summarizeRunAcceptCleanup(result: RunAcceptResult | null): SequentialContinuationRunAcceptExecutionReport["cleanupEvidenceSummary"] {
  if (!result?.cleanup) return null;
  return {
    cleaned: result.cleanup.cleaned,
    classification: result.cleanup.classification,
    worktreePath: result.cleanup.worktreePath,
    branch: result.cleanup.branch,
    violations: result.cleanup.violations,
  };
}

function validateRunAcceptExecutionResult(result: RunAcceptResult): string[] {
  const reasons: string[] = [];
  if (result.accepted !== true || result.status !== "accepted") {
    reasons.push(`runs:accept result must be accepted: ${result.status}`);
  }
  if (!result.gate) {
    reasons.push("runs:accept result must include merge gate evidence");
  }
  if (!result.merge || result.merge.exitCode !== 0) {
    reasons.push("runs:accept result must include a successful merge result");
  }
  if (!result.lifecycle?.merged?.mergedAt) {
    reasons.push("runs:accept result must include merged lifecycle evidence");
  }
  if (!result.lifecycle?.cleaned?.cleanedAt) {
    reasons.push("runs:accept result must include cleaned lifecycle evidence");
  }
  if (!result.cleanup || result.cleanup.cleaned !== true) {
    reasons.push("runs:accept result must include completed cleanup evidence");
  }
  return reasons;
}

function postAcceptArtifactGuardReasons(artifact: SequentialContinuationArtifact): string[] {
  const reasons: string[] = [];
  for (const stopCondition of artifact.stopConditionChecklist) {
    if (stopCondition.active) {
      reasons.push(`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
    }
  }
  if (artifact.autonomyEnvelope.pushAllowed !== false) {
    reasons.push("autonomyEnvelope.pushAllowed must be false for post-accept status update");
  }
  return reasons;
}

function validatePostAcceptRunAcceptReport(input: unknown, expectedArtifactPath: string, repoRoot: string): string[] {
  if (!isRecord(input)) {
    return ["accept report must be a structured continuation:accept-run-once JSON object"];
  }

  const reasons: string[] = [];
  if (!isNonEmptyString(input.artifactPath)) {
    reasons.push("accept report artifactPath must be a non-empty string");
  } else {
    const normalizedArtifactPath = normalizePathForReport(input.artifactPath, repoRoot);
    if (normalizedArtifactPath !== expectedArtifactPath) {
      reasons.push(`accept report artifactPath must match artifact being updated: ${expectedArtifactPath}`);
    }
  }
  if (input.status !== "accepted") {
    reasons.push(`accept report status must be accepted: ${String(input.status)}`);
  }
  if (input.selectedActionType !== "runs_accept") {
    reasons.push(`accept report selectedActionType must be runs_accept: ${String(input.selectedActionType)}`);
  }
  if (input.actionExecuted !== true) {
    reasons.push("accept report actionExecuted must be true");
  }
  if (input.actionAttemptCount !== 1) {
    reasons.push(`accept report actionAttemptCount must be 1: ${String(input.actionAttemptCount)}`);
  }
  if (input.continued !== false) {
    reasons.push("accept report continued must be false");
  }
  if (input.stopReason !== "run_accept_lifecycle_recorded") {
    reasons.push(`accept report stopReason must be run_accept_lifecycle_recorded: ${String(input.stopReason)}`);
  }
  if (input.pushPerformed !== false) {
    reasons.push("accept report pushPerformed must be false");
  }

  if (!isRecord(input.acceptResultSummary)) {
    reasons.push("accept report acceptResultSummary must be present");
  } else {
    if (input.acceptResultSummary.accepted !== true) {
      reasons.push("accept report acceptResultSummary.accepted must be true");
    }
    if (input.acceptResultSummary.status !== "accepted") {
      reasons.push(`accept report acceptResultSummary.status must be accepted: ${String(input.acceptResultSummary.status)}`);
    }
  }
  if (!isRecord(input.lifecycleEvidenceSummary)) {
    reasons.push("accept report lifecycleEvidenceSummary must be present");
  } else {
    if (input.lifecycleEvidenceSummary.merged !== true) {
      reasons.push("accept report lifecycleEvidenceSummary.merged must be true");
    }
    if (input.lifecycleEvidenceSummary.cleaned !== true) {
      reasons.push("accept report lifecycleEvidenceSummary.cleaned must be true");
    }
  }
  if (!isRecord(input.cleanupEvidenceSummary)) {
    reasons.push("accept report cleanupEvidenceSummary must be present");
  } else if (input.cleanupEvidenceSummary.cleaned !== true) {
    reasons.push("accept report cleanupEvidenceSummary.cleaned must be true");
  }
  if (!isRecord(input.runAcceptPreflight) || input.runAcceptPreflight.status !== "accepted") {
    reasons.push(
      `accept report runAcceptPreflight.status must be accepted: ${
        isRecord(input.runAcceptPreflight) ? String(input.runAcceptPreflight.status) : String(input.runAcceptPreflight)
      }`,
    );
  }

  const trustedStateChanges = input.trustedStateChanges;
  const allowedTrustedStateChanges = [
    "run_log_trajectory",
    "lifecycle_record",
    "merge_result",
    "cleanup_result",
  ];
  if (!Array.isArray(trustedStateChanges)) {
    reasons.push("accept report trustedStateChanges must be an array");
  } else {
    const trustedStrings = trustedStateChanges.filter((value): value is string => typeof value === "string");
    if (trustedStrings.length !== trustedStateChanges.length) {
      reasons.push("accept report trustedStateChanges must contain only strings");
    }
    for (const value of trustedStrings) {
      if (!allowedTrustedStateChanges.includes(value)) {
        reasons.push(`accept report trustedStateChanges contains unsupported state change: ${value}`);
      }
    }
    for (const value of allowedTrustedStateChanges) {
      if (!trustedStrings.includes(value)) {
        reasons.push(`accept report trustedStateChanges must include ${value}`);
      }
    }
  }

  if (!isRecord(input.sideEffects)) {
    reasons.push("accept report sideEffects must be present");
  } else {
    for (const field of [
      "runsAcceptCalled",
      "mergeGateRecorded",
      "mergePerformed",
      "lifecycleMutated",
      "cleanupPerformed",
    ] as const) {
      if (input.sideEffects[field] !== true) {
        reasons.push(`accept report sideEffects.${field} must be true`);
      }
    }
    for (const field of [
      "commitPerformed",
      "pushPerformed",
      "runTaskCalled",
      "workersDispatched",
      "batchesExecuteCalled",
      "multiStepLoopStarted",
      "successorExecuted",
    ] as const) {
      if (input.sideEffects[field] !== false) {
        reasons.push(`accept report sideEffects.${field} must be false`);
      }
    }
  }

  if (!isNonEmptyString(input.normalizedRunLogPath)) {
    reasons.push("accept report normalizedRunLogPath must be a non-empty string");
  }
  if (!isNonEmptyString(input.resolvedRunLogPath)) {
    reasons.push("accept report resolvedRunLogPath must be a non-empty string");
  }

  return reasons;
}

function postAcceptRunLogFields(input: unknown): Pick<
  SequentialContinuationPostAcceptStatusUpdateReport,
  "runLogPath" | "normalizedRunLogPath" | "resolvedRunLogPath"
> {
  if (!isRecord(input)) {
    return {
      runLogPath: null,
      normalizedRunLogPath: null,
      resolvedRunLogPath: null,
    };
  }
  return {
    runLogPath: stringOrNull(input.runLogPath),
    normalizedRunLogPath: stringOrNull(input.normalizedRunLogPath),
    resolvedRunLogPath: stringOrNull(input.resolvedRunLogPath),
  };
}

async function readPostAcceptRunLogEvidence(input: {
  repoRoot: string;
  acceptReport: Record<string, unknown>;
}): Promise<{ violations: string[]; updatedAt: string }> {
  const normalizedRunLogPath = stringOrNull(input.acceptReport.normalizedRunLogPath);
  const resolvedRunLogPath = stringOrNull(input.acceptReport.resolvedRunLogPath);
  if (!normalizedRunLogPath || !resolvedRunLogPath) {
    return {
      violations: ["accept report must cite normalized and resolved run log paths"],
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  }
  const resolvedRepoRelativePath = relative(input.repoRoot, resolve(resolvedRunLogPath)).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return {
      violations: [`accept report resolvedRunLogPath must stay inside repoRoot: ${resolvedRunLogPath}`],
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  }

  let runLog: unknown;
  try {
    runLog = JSON.parse(await readFile(resolvedRunLogPath, "utf8")) as unknown;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        violations: [`accepted run log file not found: ${resolvedRunLogPath}`],
        updatedAt: "1970-01-01T00:00:00.000Z",
      };
    }
    return {
      violations: [`accepted run log could not be read: ${err instanceof Error ? err.message : String(err)}`],
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  }

  const violations: string[] = [];
  if (!isRecord(runLog)) {
    return {
      violations: ["accepted run log must be an object"],
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  }
  if (runLog.runId !== input.acceptReport.expectedRunId) {
    violations.push(`accepted run log runId must match accept report expectedRunId: ${String(runLog.runId)}`);
  }
  const trajectory = Array.isArray(runLog.trajectory) ? runLog.trajectory : [];
  if (!hasRunTrajectoryEntry(trajectory, "merge_checked", "completed")) {
    violations.push("accepted run log trajectory must contain merge_checked completed");
  }
  if (!hasLifecycleTrajectoryEntry(trajectory, "merged")) {
    violations.push("accepted run log trajectory must contain lifecycle_marked merged completed");
  }
  if (!hasRunTrajectoryEntry(trajectory, "cleanup_finished", "completed")) {
    violations.push("accepted run log trajectory must contain cleanup_finished completed");
  }
  const cleanedEntry = lifecycleTrajectoryEntry(trajectory, "cleaned");
  if (!cleanedEntry) {
    violations.push("accepted run log trajectory must contain lifecycle_marked cleaned completed");
  }
  return {
    violations,
    updatedAt: postAcceptRunLogUpdatedAt(cleanedEntry, runLog),
  };
}

function hasRunTrajectoryEntry(
  trajectory: unknown[],
  event: WorkerRunTrajectoryEntry["event"],
  status: WorkerRunTrajectoryEntry["status"],
): boolean {
  return trajectory.some((entry) => isRecord(entry) && entry.event === event && entry.status === status);
}

function hasLifecycleTrajectoryEntry(trajectory: unknown[], event: "merged" | "cleaned"): boolean {
  return Boolean(lifecycleTrajectoryEntry(trajectory, event));
}

function lifecycleTrajectoryEntry(trajectory: unknown[], event: "merged" | "cleaned"): Record<string, unknown> | null {
  for (const entry of trajectory) {
    if (!isRecord(entry) || entry.event !== "lifecycle_marked" || entry.status !== "completed") {
      continue;
    }
    if (isRecord(entry.details) && entry.details.event === event) {
      return entry;
    }
  }
  return null;
}

function postAcceptRunLogUpdatedAt(cleanedEntry: Record<string, unknown> | null, runLog: Record<string, unknown>): string {
  if (cleanedEntry && isRecord(cleanedEntry.details) && isNonEmptyString(cleanedEntry.details.updatedAt)) {
    return cleanedEntry.details.updatedAt;
  }
  if (isNonEmptyString(runLog.finishedAt)) {
    return runLog.finishedAt;
  }
  return "1970-01-01T00:00:00.000Z";
}

function postAcceptNextStep(
  nextArtifactLinkage: SequentialContinuationNextArtifactReport,
  currentSliceId: string,
): SequentialContinuationNextStep {
  if (nextArtifactLinkage.status === "accepted" && nextArtifactLinkage.normalizedNextArtifactPath) {
    return {
      kind: "samantha_command",
      value: `bun run samantha continuation:show --artifact=${nextArtifactLinkage.normalizedNextArtifactPath} --repo-root=${nextArtifactLinkage.repoRoot}`,
    };
  }
  if (nextArtifactLinkage.status === "blocked") {
    return {
      kind: "blocked_report",
      value: `next_artifact_blocked: ${nextArtifactLinkage.blockingReasons.join("; ")}`,
    };
  }
  return {
    kind: "blocked_report",
    value: `no_deterministic_next_artifact: ${currentSliceId} completed from structured post-run evidence; no nextArtifactPath is present.`,
  };
}

function postAcceptStopReason(nextArtifactLinkage: SequentialContinuationNextArtifactReport): string {
  if (nextArtifactLinkage.status === "accepted") {
    return "next_artifact_ready";
  }
  if (nextArtifactLinkage.status === "blocked") {
    return "next_artifact_blocked";
  }
  return "no_deterministic_next_artifact";
}

function buildPostAcceptStatusUpdateResult(input: {
  artifactPath: string;
  acceptReportPath: string;
  repoRoot: string;
  status: SequentialContinuationPostAcceptStatusUpdateReport["status"];
  violations: string[];
  blockingReasons: string[];
  currentSliceId: string | null;
  runLogPath?: string | null;
  normalizedRunLogPath?: string | null;
  resolvedRunLogPath?: string | null;
  statusEvidence?: SequentialContinuationStatusEvidenceDocument | null;
  statusUpdateReport?: SequentialContinuationStatusUpdateReport | null;
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport | null;
  nextStep?: SequentialContinuationNextStep | null;
  stopReason: string;
  updatedArtifact?: SequentialContinuationArtifact | null;
}): SequentialContinuationPostAcceptStatusUpdateResult {
  const updatedArtifact = input.updatedArtifact ?? null;
  return {
    report: {
      artifactPath: input.artifactPath,
      acceptReportPath: input.acceptReportPath,
      repoRoot: input.repoRoot,
      status: input.status,
      violations: input.violations,
      blockingReasons: input.blockingReasons,
      currentSliceId: input.currentSliceId,
      runLogPath: input.runLogPath ?? null,
      normalizedRunLogPath: input.normalizedRunLogPath ?? null,
      resolvedRunLogPath: input.resolvedRunLogPath ?? null,
      statusEvidence: input.statusEvidence ?? null,
      statusUpdateReport: input.statusUpdateReport ?? null,
      nextArtifactLinkage: input.nextArtifactLinkage ?? null,
      nextStep: input.nextStep ?? null,
      stopReason: input.stopReason,
      artifactUpdated: Boolean(updatedArtifact),
      trustedStateChanges: updatedArtifact ? ["continuation_artifact"] : [],
      pushPerformed: false,
      sideEffects: postAcceptStatusUpdateSideEffects(),
    },
    updatedArtifact,
  };
}

function postAcceptStatusUpdateSideEffects(): SequentialContinuationPostAcceptStatusUpdateReport["sideEffects"] {
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
  };
}

function buildRunTaskExecutionGuardReasons(input: {
  artifact: SequentialContinuationArtifact;
  runTaskPreflight: SequentialContinuationRunTaskPreflightReport;
}): string[] {
  const artifact = input.artifact;
  const reasons: string[] = [];

  for (const stopCondition of artifact.stopConditionChecklist) {
    if (stopCondition.active) {
      reasons.push(`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
    }
  }
  if (artifact.autonomyEnvelope.pushAllowed !== false) {
    reasons.push("autonomyEnvelope.pushAllowed must be false for single-run_task execution");
  }

  const execution = artifact.runTaskExecution;
  if (!execution) {
    reasons.push("runTaskExecution must be present for single-run_task execution");
    return reasons;
  }

  if (execution.pushAllowed !== false) {
    reasons.push("runTaskExecution.pushAllowed must be false");
  }
  if (execution.executionMode === "preflight_only") {
    reasons.push("runTaskExecution.executionMode must be single_run_task, not preflight_only");
  } else if (execution.executionMode !== "single_run_task") {
    reasons.push(`runTaskExecution.executionMode must be single_run_task: ${execution.executionMode}`);
  }
  if (artifact.currentSlice.status !== "ready") {
    reasons.push(`currentSlice.status must be ready for single-run_task execution: ${artifact.currentSlice.status}`);
  }
  if (artifact.currentSlice.actionType !== "run_task") {
    reasons.push(`currentSlice.actionType must be run_task for single-run_task execution: ${artifact.currentSlice.actionType}`);
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    reasons.push(`currentSlice.dependencyStatus must be met for single-run_task execution: ${artifact.currentSlice.dependencyStatus}`);
  }

  if (input.runTaskPreflight.status !== "accepted") {
    reasons.push(
      input.runTaskPreflight.status === "absent"
        ? "runTaskPreflight must be accepted before single-run_task execution"
        : "runTaskPreflight is blocked and cannot trigger single-run_task execution",
    );
    reasons.push(...input.runTaskPreflight.blockingReasons.map((reason) => `runTaskPreflight: ${reason}`));
    return reasons;
  }

  const pathReasons: string[] = [];
  const normalizedExecutionTaskSpecPath = normalizeRunTaskTaskSpecPath(execution.taskSpecPath, pathReasons);
  reasons.push(...pathReasons.map((reason) => reason.replaceAll("runTaskCandidate", "runTaskExecution")));
  if (
    normalizedExecutionTaskSpecPath &&
    normalizedExecutionTaskSpecPath !== input.runTaskPreflight.normalizedTaskSpecPath
  ) {
    reasons.push("runTaskExecution.taskSpecPath must match accepted runTaskPreflight taskSpecPath");
  }
  if (execution.requiredRuntime !== "codex-sdk") {
    reasons.push(`runTaskExecution.requiredRuntime must be codex-sdk: ${execution.requiredRuntime}`);
  }
  if (execution.requiredRuntime !== input.runTaskPreflight.requiredRuntime) {
    reasons.push("runTaskExecution.requiredRuntime must match accepted runTaskPreflight requiredRuntime");
  }
  if (execution.worktreePolicy !== "samantha_allocated_isolated") {
    reasons.push(`runTaskExecution.worktreePolicy must be samantha_allocated_isolated: ${execution.worktreePolicy}`);
  }
  if (execution.worktreePolicy !== input.runTaskPreflight.worktreePolicy) {
    reasons.push("runTaskExecution.worktreePolicy must match accepted runTaskPreflight worktreePolicy");
  }
  if (execution.lifecycleOwner !== "samantha") {
    reasons.push(`runTaskExecution.lifecycleOwner must be samantha: ${execution.lifecycleOwner}`);
  }
  if (execution.lifecycleOwner !== input.runTaskPreflight.lifecycleOwner) {
    reasons.push("runTaskExecution.lifecycleOwner must match accepted runTaskPreflight lifecycleOwner");
  }
  if (!sameStringArray(execution.targetFiles, input.runTaskPreflight.targetFiles)) {
    reasons.push("runTaskExecution.targetFiles must match accepted runTaskPreflight targetFiles");
  }
  if (!sameStringArray(execution.forbiddenChanges, input.runTaskPreflight.forbiddenChanges)) {
    reasons.push("runTaskExecution.forbiddenChanges must match accepted runTaskPreflight forbiddenChanges");
  }
  if (!sameStringArray(execution.verifyCommands, input.runTaskPreflight.verifyCommands)) {
    reasons.push("runTaskExecution.verifyCommands must match accepted runTaskPreflight verifyCommands");
  }

  const expectedSideEffects = execution.expectedSideEffects;
  for (const field of ["runTaskCalled", "workersDispatched", "worktreesCreated", "runsCreated", "deterministicVerification"] as const) {
    if (expectedSideEffects[field] !== true) {
      reasons.push(`runTaskExecution.expectedSideEffects.${field} must be true`);
    }
  }
  for (const field of [
    "batchesExecuteCalled",
    "acceptPerformed",
    "lifecycleMutated",
    "mergePerformed",
    "cleanupPerformed",
    "commitPerformed",
    "pushPerformed",
    "multiStepLoopStarted",
    "successorExecuted",
  ] as const) {
    if (expectedSideEffects[field] !== false) {
      reasons.push(`runTaskExecution.expectedSideEffects.${field} must be false`);
    }
  }

  return reasons;
}

function buildRunAcceptExecutionGuardReasons(input: {
  artifact: SequentialContinuationArtifact;
  runAcceptPreflight: SequentialContinuationRunAcceptPreflightReport;
}): string[] {
  const artifact = input.artifact;
  const reasons: string[] = [];

  for (const stopCondition of artifact.stopConditionChecklist) {
    if (stopCondition.active) {
      reasons.push(`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
    }
  }
  if (artifact.autonomyEnvelope.pushAllowed !== false) {
    reasons.push("autonomyEnvelope.pushAllowed must be false for single-runs_accept execution");
  }

  const execution = artifact.runAcceptExecution;
  if (!execution) {
    reasons.push("runAcceptExecution must be present for single-runs_accept execution");
    return reasons;
  }

  if (execution.pushAllowed !== false) {
    reasons.push("runAcceptExecution.pushAllowed must be false");
  }
  if (execution.executionMode === "accept_preflight_only") {
    reasons.push("runAcceptExecution.executionMode must be single_run_accept, not accept_preflight_only");
  } else if (execution.executionMode !== "single_run_accept") {
    reasons.push(`runAcceptExecution.executionMode must be single_run_accept: ${execution.executionMode}`);
  }
  if (artifact.currentSlice.status !== "ready") {
    reasons.push(`currentSlice.status must be ready for single-runs_accept execution: ${artifact.currentSlice.status}`);
  }
  if (artifact.currentSlice.actionType !== "report_only") {
    reasons.push(`currentSlice.actionType must be report_only for single-runs_accept execution: ${artifact.currentSlice.actionType}`);
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    reasons.push(`currentSlice.dependencyStatus must be met for single-runs_accept execution: ${artifact.currentSlice.dependencyStatus}`);
  }

  if (input.runAcceptPreflight.status !== "accepted") {
    reasons.push(
      input.runAcceptPreflight.status === "absent"
        ? "runAcceptPreflight must be accepted before single-runs_accept execution"
        : "runAcceptPreflight is blocked and cannot trigger single-runs_accept execution",
    );
    reasons.push(...input.runAcceptPreflight.blockingReasons.map((reason) => `runAcceptPreflight: ${reason}`));
    return reasons;
  }

  const pathReasons: string[] = [];
  const normalizedExecutionRunLogPath = normalizeRunAcceptRunLogPath(execution.runLogPath, pathReasons);
  reasons.push(...pathReasons.map((reason) => reason.replaceAll("runAcceptCandidate", "runAcceptExecution")));
  if (
    normalizedExecutionRunLogPath &&
    normalizedExecutionRunLogPath !== input.runAcceptPreflight.normalizedRunLogPath
  ) {
    reasons.push("runAcceptExecution.runLogPath must match accepted runAcceptPreflight runLogPath");
  }
  if (execution.expectedRunId !== input.runAcceptPreflight.expectedRunId) {
    reasons.push("runAcceptExecution.expectedRunId must match accepted runAcceptPreflight expectedRunId");
  }
  if (execution.expectedTaskId !== input.runAcceptPreflight.expectedTaskId) {
    reasons.push("runAcceptExecution.expectedTaskId must match accepted runAcceptPreflight expectedTaskId");
  }
  if (execution.expectedCommit !== input.runAcceptPreflight.expectedCommit) {
    reasons.push("runAcceptExecution.expectedCommit must match accepted runAcceptPreflight expectedCommit");
  }
  if (execution.expectedBaseCommit !== input.runAcceptPreflight.expectedBaseCommit) {
    reasons.push("runAcceptExecution.expectedBaseCommit must match accepted runAcceptPreflight expectedBaseCommit");
  }

  const executionTargetBranch = execution.targetBranch ?? "main";
  if (executionTargetBranch !== input.runAcceptPreflight.targetBranch) {
    reasons.push("runAcceptExecution.targetBranch must match accepted runAcceptPreflight targetBranch");
  }
  if (execution.requiredRuntime !== "codex-sdk") {
    reasons.push(`runAcceptExecution.requiredRuntime must be codex-sdk: ${execution.requiredRuntime}`);
  }
  if (execution.requiredRuntime !== input.runAcceptPreflight.requiredRuntime) {
    reasons.push("runAcceptExecution.requiredRuntime must match accepted runAcceptPreflight requiredRuntime");
  }
  if (execution.lifecycleOwner !== "samantha") {
    reasons.push(`runAcceptExecution.lifecycleOwner must be samantha: ${execution.lifecycleOwner}`);
  }
  if (execution.lifecycleOwner !== input.runAcceptPreflight.lifecycleOwner) {
    reasons.push("runAcceptExecution.lifecycleOwner must match accepted runAcceptPreflight lifecycleOwner");
  }
  if (!sameStringArray(execution.targetFiles, artifact.currentSlice.targetFiles ?? [])) {
    reasons.push("runAcceptExecution.targetFiles must match currentSlice targetFiles");
  }
  if (!sameStringArray(execution.forbiddenChanges, artifact.currentSlice.forbiddenChanges ?? [])) {
    reasons.push("runAcceptExecution.forbiddenChanges must match currentSlice forbiddenChanges");
  }
  if (!sameStringArray(execution.verifyCommands, artifact.currentSlice.verifyCommands ?? [])) {
    reasons.push("runAcceptExecution.verifyCommands must match currentSlice verifyCommands");
  }

  const expectedSideEffects = execution.expectedSideEffects;
  for (const field of [
    "runsAcceptCalled",
    "mergeGateRecorded",
    "mergePerformed",
    "lifecycleMutated",
    "cleanupPerformed",
  ] as const) {
    if (expectedSideEffects[field] !== true) {
      reasons.push(`runAcceptExecution.expectedSideEffects.${field} must be true`);
    }
  }
  for (const field of [
    "commitPerformed",
    "pushPerformed",
    "runTaskCalled",
    "workersDispatched",
    "batchesExecuteCalled",
    "multiStepLoopStarted",
    "successorExecuted",
  ] as const) {
    if (expectedSideEffects[field] !== false) {
      reasons.push(`runAcceptExecution.expectedSideEffects.${field} must be false`);
    }
  }

  return reasons;
}

function singleStepGuardViolations(artifact: SequentialContinuationArtifact): string[] {
  const violations: string[] = [];

  if (artifact.currentSlice.status !== "ready") {
    violations.push("currentSlice.status must be ready for single-step continuation");
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    violations.push("currentSlice.dependencyStatus must be met for single-step continuation");
  }
  if (artifact.autonomyEnvelope.pushAllowed !== false) {
    violations.push("autonomyEnvelope.pushAllowed must be false for single-step continuation");
  }

  for (const stopCondition of artifact.stopConditionChecklist) {
    if (stopCondition.active) {
      violations.push(`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
    }
  }

  const actionType = artifact.currentSlice.actionType;
  if (actionType === "manual_decision") {
    violations.push("manual_decision requires BK input and cannot be executed by single-step continuation");
  } else if (WRITE_CAPABLE_ACTION_TYPES.has(actionType)) {
    violations.push(`${actionType} is blocked until reviewed explicit taskSpecPath/batchSpecPath support exists`);
  } else if (actionType !== SINGLE_STEP_EXECUTABLE_ACTION_TYPE) {
    violations.push(`single-step continuation currently supports only readiness_check: ${actionType}`);
  }

  return violations;
}

function nextStepFromContinuationReport(report: SequentialContinuationReport): SequentialContinuationNextStep | null {
  if (report.exactNextSamanthaCommand) {
    return {
      kind: "samantha_command",
      value: report.exactNextSamanthaCommand,
    };
  }
  if (report.blockedReportText) {
    return {
      kind: "blocked_report",
      value: report.blockedReportText,
    };
  }
  return null;
}

function nextStepFromStatusUpdateReport(report: SequentialContinuationStatusUpdateReport): SequentialContinuationNextStep | null {
  if (report.exactNextSamanthaCommand) {
    return {
      kind: "samantha_command",
      value: report.exactNextSamanthaCommand,
    };
  }
  if (report.blockedReportText) {
    return {
      kind: "blocked_report",
      value: report.blockedReportText,
    };
  }
  return null;
}

function buildReportBlockingReasons(input: {
  violations: string[];
  currentSlice: SequentialContinuationReport["currentSlice"];
  activeStopConditions: SequentialContinuationReport["activeStopConditions"];
  nextStep: { kind: string | null; value: string | null };
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
  runAcceptPreflight?: SequentialContinuationRunAcceptPreflightReport;
}): string[] {
  const reasons: string[] = [];
  for (const stopCondition of input.activeStopConditions) {
    pushUnique(reasons, `${stopCondition.id}: ${stopCondition.evidence}`);
  }
  if (input.currentSlice.dependencyStatus === "blocked") {
    pushUnique(reasons, "currentSlice.dependencyStatus is blocked");
  }
  if (input.nextStep.kind === "blocked_report" && input.nextStep.value) {
    pushUnique(reasons, input.nextStep.value);
  }
  for (const violation of input.violations) {
    pushUnique(reasons, violation);
  }
  if (input.nextArtifactLinkage?.status === "blocked") {
    for (const reason of input.nextArtifactLinkage.blockingReasons) {
      pushUnique(reasons, `nextArtifactPath: ${reason}`);
    }
  }
  if (input.runTaskPreflight?.status === "blocked") {
    for (const reason of input.runTaskPreflight.blockingReasons) {
      pushUnique(reasons, `runTaskPreflight: ${reason}`);
    }
  }
  if (input.runAcceptPreflight?.status === "blocked") {
    for (const reason of input.runAcceptPreflight.blockingReasons) {
      pushUnique(reasons, `runAcceptPreflight: ${reason}`);
    }
  }
  return reasons;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateAllowedFields(
  value: Record<string, unknown>,
  allowedFields: Set<string>,
  formatViolation: (key: string) => string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowedFields.has(key))
    .map(formatViolation);
}

function hasOnlyNonEmptyStrings(value: unknown, options: { allowEmpty: boolean }): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (!options.allowEmpty && value.length === 0) {
    return false;
  }

  return value.every(isNonEmptyString);
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function joinOptions(values: readonly string[]): string {
  return values.join(", ").replace(/, ([^,]*)$/, ", or $1");
}
