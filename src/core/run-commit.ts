import type { AgentProfile, TaskSpec } from "./contracts";
import type { WorkerRunLog } from "./run-log";
import type { WorkerDispatchExecution } from "./worker-dispatch";

function isReportOnlyRun(input: { task: TaskSpec; agent: AgentProfile }): boolean {
  return input.task.resultMode === "report" || input.agent.writerClass === "non-writer";
}

export function actionableCommitForExecution(input: {
  task: TaskSpec;
  agent: AgentProfile;
  execution: WorkerDispatchExecution;
}): string {
  if (isReportOnlyRun(input)) return "";
  return input.execution.commit?.commitHash ?? input.execution.evaluation?.harness?.commit ?? "";
}

export function actionableCommitForRunLog(log: WorkerRunLog): string {
  return actionableCommitForExecution({
    task: log.task,
    agent: log.agent,
    execution: log.result,
  });
}
