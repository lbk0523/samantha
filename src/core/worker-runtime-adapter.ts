import { runCommand, type CommandRunResult } from "./command-runner";
import type { AgentProfile, TaskSpec } from "./contracts";
import { buildCodexWorkerPrompt, type PreparedCodexDispatch } from "./codex-dispatch";

export interface WorkerRuntimeAdapter {
  kind: "exec-json";
  prepare(input: {
    task: TaskSpec;
    agent: AgentProfile;
    worktreePath: string;
    codexBin?: string;
  }): PreparedCodexDispatch;
  execute(dispatch: PreparedCodexDispatch): Promise<CommandRunResult>;
}

export function buildExecJsonCommand(input: {
  agent: AgentProfile;
  worktreePath: string;
  prompt: string;
  codexBin?: string;
}): string[] {
  const command = [
    input.codexBin ?? "codex",
    "exec",
    "--cd",
    input.worktreePath,
    "--sandbox",
    input.agent.writerClass === "non-writer" ? "read-only" : "workspace-write",
    "--json",
  ];

  if (input.agent.model) {
    command.push("--model", input.agent.model);
  }
  if (input.agent.codexProfile) {
    command.push("--profile", input.agent.codexProfile);
  }

  command.push(input.prompt);
  return command;
}

export const execJsonWorkerRuntimeAdapter: WorkerRuntimeAdapter = {
  kind: "exec-json",
  prepare(input) {
    const prompt = buildCodexWorkerPrompt(input.task, input.agent);
    return {
      prompt,
      command: buildExecJsonCommand({
        agent: input.agent,
        worktreePath: input.worktreePath,
        prompt,
        codexBin: input.codexBin,
      }),
    };
  },
  execute(dispatch) {
    return runCommand(dispatch.command);
  },
};
