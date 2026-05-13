import type { AgentProfile, TaskSpec } from "./contracts";

export interface PreparedCodexDispatch {
  prompt: string;
  command: string[];
}

function bulletList(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function buildCodexWorkerPrompt(task: TaskSpec, agent: AgentProfile): string {
  const reportOnly = task.resultMode === "report" || agent.writerClass === "non-writer";
  const boundary = reportOnly
    ? "This is a report-only task. Do not edit, create, delete, format, commit, push, or move files."
    : "Do not create worktrees. Do not dispatch subagents. Do not commit or push. Samantha creates the commit after deterministic gates pass. Do not modify files outside targetFiles.";

  return [
    `You are ${agent.id}, a Codex worker inside the Samantha development harness.`,
    "Samantha owns orchestration, worktree allocation, verification, commit, and report evidence.",
    "Do not implement Telegram, remote adapters, daemon/watch services, dashboards, CEO-office memory, routines, budget governance, or multi-project orchestration for this MVP.",
    boundary,
    ...(reportOnly
      ? [
          "Produce an evidence-based report only. Do not propose that you changed files, and do not claim merge, cleanup, policy, or commit authority.",
        ]
      : []),
    "",
    `Task: ${task.id}`,
    `Title: ${task.title}`,
    "",
    "Instructions:",
    task.instructions,
    "",
    "Target files:",
    ...bulletList(task.targetFiles, "(none; read-only task)"),
    "",
    "Forbidden changes:",
    ...bulletList(task.forbiddenChanges, "(none declared)"),
    "",
    "Setup commands already run by Samantha before Codex starts:",
    ...bulletList(task.setupCommands ?? [], "(none)"),
    "",
    "Verify commands:",
    ...bulletList(task.verifyCommands, "(none)"),
    "",
    task.expectedCommitSubject
      ? `Samantha commit subject after gates pass: ${task.expectedCommitSubject}`
      : "Samantha chooses the commit subject after gates pass.",
    "",
    "Before final response, run the verify commands if you changed files.",
    "Final response must include exactly one HARNESS_RESULT line.",
    'HARNESS_RESULT: {"status":"pass|rework|blocked","note":"short","commit":"<hash-or-empty>"}',
  ].join("\n");
}

export function buildCodexExecCommand(input: {
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

export function prepareCodexDispatch(
  task: TaskSpec,
  agent: AgentProfile,
  worktreePath: string,
  codexBin?: string,
): PreparedCodexDispatch {
  const prompt = buildCodexWorkerPrompt(task, agent);
  return {
    prompt,
    command: buildCodexExecCommand({ agent, worktreePath, prompt, codexBin }),
  };
}
