import {
  RISK_CLASSES,
  TASK_FAMILIES,
  WORK_MODES,
  type AgentProfile,
  type AgentRole,
  type DispatchPlan,
  type SafetyPolicy,
  type TaskSpec,
} from "./contracts";

export const DEFAULT_SAFETY_POLICY: SafetyPolicy = {
  writerCap: 1,
  requiredForbiddenChanges: true,
  requiredTargetFilesForWriters: true,
  requiredVerifyCommandsForWriters: true,
  blockedSkillNames: [
    "using-git-worktrees",
    "dispatching-parallel-agents",
    "subagent-driven-development",
  ],
};

const KNOWN_AGENT_ROLES: AgentRole[] = ["writer", "reviewer", "evaluator", "spec", "researcher"];

function validateWriterVerifyCommands(task: TaskSpec): string[] {
  const violations: string[] = [];
  let reportedEmptyCommand = false;

  for (const command of task.verifyCommands) {
    const trimmed = command.trim();
    if (trimmed.length === 0) {
      if (!reportedEmptyCommand) {
        violations.push("writer verifyCommands must not include empty or whitespace-only commands");
        reportedEmptyCommand = true;
      }
      continue;
    }

    if (isNoopOrSimpleOutputCommand(trimmed)) {
      violations.push(`writer verifyCommands must not use no-op/simple output commands: ${trimmed}`);
    }
    if (isLongRunningVerifyCommand(trimmed)) {
      violations.push(
        `writer verifyCommands must not use long-running/watch/dev/server commands: ${trimmed}`,
      );
    }
  }

  if (requiresTestOrTypecheckVerification(task) && !task.verifyCommands.some(isTestOrTypecheckCommand)) {
    violations.push(
      "core-module or tdd-first writer tasks must include a real test runner or typecheck verify command",
    );
  }

  if (task.riskClass === "lifecycle-sensitive" && !task.verifyCommands.some(isBroadVerificationCommand)) {
    violations.push("lifecycle-sensitive writer tasks must include broad verification");
  }

  return violations;
}

function isNoopOrSimpleOutputCommand(command: string): boolean {
  const normalized = normalizeVerifyCommand(command);

  return (
    /^(true|false|pwd|ls)(\s|$)/.test(normalized) ||
    /^git\s+status(\s|$)/.test(normalized) ||
    /^echo(\s|$)/.test(normalized)
  );
}

function isLongRunningVerifyCommand(command: string): boolean {
  const normalized = normalizeVerifyCommand(command);

  return (
    /^sleep(\s|$)/.test(normalized) ||
    (/^tail(\s|$)/.test(normalized) && /\s-[^\s]*f[^\s]*(\s|$)/.test(normalized)) ||
    /^watch(\s|$)/.test(normalized) ||
    /(^|\s)--watch(=|\s|$)/.test(normalized) ||
    /^npm\s+run\s+dev(\s|$)/.test(normalized) ||
    /^bun\s+run\s+dev(\s|$)/.test(normalized) ||
    /^pnpm\s+(run\s+)?dev(\s|$)/.test(normalized) ||
    /^yarn\s+(run\s+)?dev(\s|$)/.test(normalized) ||
    /^vite\s+dev(\s|$)/.test(normalized) ||
    /^next\s+dev(\s|$)/.test(normalized)
  );
}

function requiresTestOrTypecheckVerification(task: TaskSpec): boolean {
  return task.taskFamily === "core-module" || task.workMode === "tdd-first";
}

function isTestOrTypecheckCommand(command: string): boolean {
  const normalized = normalizeVerifyCommand(command);

  return /^bun\s+test(\s|$)/.test(normalized) || normalized === "bun run typecheck";
}

function isBroadVerificationCommand(command: string): boolean {
  const normalized = normalizeVerifyCommand(command);

  return normalized === "bun test" || normalized === "bun run typecheck";
}

function normalizeVerifyCommand(command: string): string {
  return unwrapSimpleShellCommand(command).toLowerCase().replace(/\s+/g, " ").trim();
}

function unwrapSimpleShellCommand(command: string): string {
  const trimmed = command.trim();
  const shellWrapped = /^(?:bash|sh|zsh)\s+-(?:c|lc)\s+(.+)$/.exec(trimmed);
  if (!shellWrapped) return trimmed;

  const inner = shellWrapped[1].trim();
  const quote = inner[0];
  if ((quote === '"' || quote === "'") && inner.endsWith(quote)) {
    return inner.slice(1, -1).trim();
  }

  return inner;
}

export function validateWriterCap(
  agents: AgentProfile[],
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
): string[] {
  const writerCount = agents.filter((agent) => agent.writerClass === "writer").length;
  if (writerCount <= policy.writerCap) return [];
  return [`writer profile count ${writerCount} exceeds cap ${policy.writerCap}`];
}

export function validateAgentProfile(
  agent: AgentProfile,
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
): string[] {
  const violations: string[] = [];
  const role = String((agent as { role?: unknown }).role ?? "");
  const writerClass = String((agent as { writerClass?: unknown }).writerClass ?? "");
  const blockedSkills = Array.isArray(agent.skillPolicy?.blockedSkills)
    ? agent.skillPolicy.blockedSkills
    : [];

  if (!KNOWN_AGENT_ROLES.includes(role as AgentRole)) {
    violations.push(`agent profile role is unknown: ${role || "(empty)"}`);
  }
  if (writerClass !== "writer" && writerClass !== "non-writer") {
    violations.push(`agent profile writerClass is unknown: ${writerClass || "(empty)"}`);
  }

  if (writerClass === "writer") {
    if (role !== "writer") {
      violations.push("writer profiles must use writer role");
    }
    if (agent.worktreePolicy !== "per-task") {
      violations.push("writer agents must use per-task worktrees");
    }
    if (agent.mergePolicy !== "samantha-controlled") {
      violations.push("writer agents must use Samantha-controlled merge");
    }
  }

  if (writerClass === "non-writer") {
    if (role === "writer") {
      violations.push("non-writer profiles must not use writer role");
    }
    if (agent.worktreePolicy !== "none") {
      violations.push("non-writer agents must not allocate worktrees");
    }
    if (agent.mergePolicy !== "none") {
      violations.push("non-writer agents must not use merge policy");
    }
  }

  for (const skillName of policy.blockedSkillNames) {
    if (!blockedSkills.includes(skillName)) {
      violations.push(`agent profile must block skill: ${skillName}`);
    }
  }

  return violations;
}

export function validateDispatch(
  task: TaskSpec,
  agent: AgentProfile,
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
): DispatchPlan {
  const violations = validateAgentProfile(agent, policy);
  const taskFamily = String((task as { taskFamily?: unknown }).taskFamily ?? "");
  const workMode = String((task as { workMode?: unknown }).workMode ?? "");
  const riskClass = String((task as { riskClass?: unknown }).riskClass ?? "");

  if (task.targetAgent !== agent.id) {
    violations.push(`task targets ${task.targetAgent}, but profile is ${agent.id}`);
  }

  if (!TASK_FAMILIES.includes(taskFamily as TaskSpec["taskFamily"])) {
    violations.push(`task taskFamily is unknown: ${taskFamily || "(empty)"}`);
  }
  if (!WORK_MODES.includes(workMode as TaskSpec["workMode"])) {
    violations.push(`task workMode is unknown: ${workMode || "(empty)"}`);
  }
  if (!RISK_CLASSES.includes(riskClass as TaskSpec["riskClass"])) {
    violations.push(`task riskClass is unknown: ${riskClass || "(empty)"}`);
  }

  if (task.resultMode === "report" && agent.writerClass === "writer") {
    violations.push("report tasks must use non-writer agents");
  }

  if (task.allowNoop === true) {
    const noopRationale = (task as { noopRationale?: unknown }).noopRationale;
    if (typeof noopRationale !== "string" || noopRationale.trim().length === 0) {
      violations.push("allowNoop tasks must declare noopRationale");
    }
  }

  if (agent.writerClass === "writer" && task.resultMode !== "report") {
    if (policy.requiredTargetFilesForWriters && task.targetFiles.length === 0) {
      violations.push("writer tasks must declare targetFiles");
    }
    if (policy.requiredForbiddenChanges && task.forbiddenChanges.length === 0) {
      violations.push("writer tasks must declare forbiddenChanges");
    }
    if (policy.requiredVerifyCommandsForWriters && task.verifyCommands.length === 0) {
      violations.push("writer tasks must declare verifyCommands");
    }
    violations.push(...validateWriterVerifyCommands(task));
  }

  if (agent.writerClass === "non-writer") {
    if (task.resultMode !== "report") {
      violations.push("non-writer tasks must use report resultMode");
    }
    if (task.targetFiles.length > 0) {
      violations.push("non-writer report tasks must not declare targetFiles");
    }
    if ((task.setupCommands ?? []).length > 0) {
      violations.push("non-writer report tasks must not declare setupCommands");
    }
    if (task.verifyCommands.length > 0) {
      violations.push("non-writer report tasks must not declare verifyCommands");
    }
  }

  return {
    task,
    agent,
    mayDispatch: violations.length === 0,
    violations,
  };
}
