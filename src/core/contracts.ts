export type AgentRole = "writer" | "reviewer" | "evaluator" | "spec" | "researcher";
export type WriterClass = "writer" | "non-writer";
export type WorktreePolicy = "per-task" | "none";
export type MergePolicy = "samantha-controlled" | "none";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";
export type HarnessStatus = "pass" | "rework" | "blocked";
export type TaskResultMode = "write" | "report";
export const TASK_FAMILIES = [
  "cli-command",
  "core-module",
  "docs-only",
  "report-review",
  "recovery",
] as const;
export const WORK_MODES = ["minimal-change", "tdd-first", "diagnosis-first"] as const;
export const RISK_CLASSES = [
  "routine",
  "authority-sensitive",
  "doctrine-sensitive",
  "lifecycle-sensitive",
] as const;
export type TaskFamily = (typeof TASK_FAMILIES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type RiskClass = (typeof RISK_CLASSES)[number];

export interface SkillBundleRef {
  id: string;
  source: string;
  ref: string;
}

export interface SkillPolicy {
  requiredBundles: SkillBundleRef[];
  blockedSkills: string[];
}

export interface AgentProfile {
  id: string;
  role: AgentRole;
  model: string;
  codexProfile?: string;
  writerClass: WriterClass;
  worktreePolicy: WorktreePolicy;
  mergePolicy: MergePolicy;
  skillPolicy: SkillPolicy;
}

export interface TaskSpec {
  id: string;
  title: string;
  taskFamily: TaskFamily;
  workMode: WorkMode;
  riskClass: RiskClass;
  targetAgent: string;
  targetFiles: string[];
  forbiddenChanges: string[];
  setupCommands?: string[];
  setupTimeoutMs?: number;
  verifyCommands: string[];
  verifyTimeoutMs?: number;
  workerTimeoutMs?: number;
  instructions: string;
  resultMode?: TaskResultMode;
  allowNoop?: boolean;
  noopRationale?: string;
  expectedCommitSubject?: string;
  status: TaskStatus;
}

export interface SafetyPolicy {
  writerCap: number;
  requiredForbiddenChanges: boolean;
  requiredTargetFilesForWriters: boolean;
  requiredVerifyCommandsForWriters: boolean;
  blockedSkillNames: string[];
}

export interface DispatchPlan {
  task: TaskSpec;
  agent: AgentProfile;
  mayDispatch: boolean;
  violations: string[];
}

export interface WorktreeAllocation {
  taskId: string;
  repoRoot: string;
  worktreePath: string;
  branch: string;
  baseCommit: string;
}

export interface HarnessResult {
  status: HarnessStatus;
  note: string;
  commit: string;
}
