import { runTaskCommand, type RunTaskCommandInput } from "./commands/run-task";

export interface RunTaskCliArgs extends RunTaskCommandInput {
  command: "run-task";
}

export function parseCliArgs(argv: string[]): RunTaskCliArgs {
  const [command, taskPath, ...rest] = argv;
  if (command !== "run-task" || !taskPath) {
    throw new Error("usage: bun run samantha run-task <task.json> --repo-root=<repo> [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--codex-bin=<path>]");
  }

  const flags = new Map<string, string>();
  for (const arg of rest) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      throw new Error(`flag requires --name=value form: ${arg}`);
    }
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }

  const repoRoot = flags.get("repo-root");
  if (!repoRoot) {
    throw new Error("usage: run-task requires --repo-root=<repo>");
  }

  return {
    command: "run-task",
    taskPath,
    repoRoot,
    ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
    ...(flags.get("worktrees-dir") ? { worktreesDir: flags.get("worktrees-dir") } : {}),
    ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
  };
}

async function main(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);
  const result = await runTaskCommand(args);
  console.log(
    JSON.stringify(
      {
        pass: result.execution.pass,
        runLog: result.runLog.path,
        commit: result.execution.commit?.commitHash ?? "",
      },
      null,
      2,
    ),
  );
  return result.execution.pass ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
