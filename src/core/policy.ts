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
