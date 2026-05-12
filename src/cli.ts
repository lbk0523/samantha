import { join, resolve } from "node:path";
import { runTaskCommand, type RunTaskCommandInput } from "./commands/run-task";
import { RunIndex } from "./core/ledger";
import { evaluateMergeGate, readWorkerRunLog } from "./core/merge-gate";

export interface RunTaskCliArgs extends RunTaskCommandInput {
  command: "run-task";
}

export interface RunsListCliArgs {
  command: "runs:list";
  runsDir?: string;
}

export interface RunsShowCliArgs {
  command: "runs:show";
  runId: string;
  runsDir?: string;
}

export interface MergeCheckCliArgs {
  command: "merge:check";
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
}

export type SamanthaCliArgs = RunTaskCliArgs | RunsListCliArgs | RunsShowCliArgs | MergeCheckCliArgs;

function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      throw new Error(`flag requires --name=value form: ${arg}`);
    }
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return flags;
}

export function parseCliArgs(argv: string[]): SamanthaCliArgs {
  const [command, first, ...rest] = argv;

  if (command === "run-task") {
    if (!first) {
      throw new Error("usage: bun run samantha run-task <task.json> --repo-root=<repo> [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--codex-bin=<path>]");
    }
    const flags = parseFlags(rest);
    const repoRoot = flags.get("repo-root");
    if (!repoRoot) {
      throw new Error("usage: run-task requires --repo-root=<repo>");
    }

    return {
      command: "run-task",
      taskPath: first,
      repoRoot,
      ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
      ...(flags.get("worktrees-dir") ? { worktreesDir: flags.get("worktrees-dir") } : {}),
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
      ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
    };
  }

  if (command === "runs:list") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "runs:list",
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "runs:show") {
    if (!first) {
      throw new Error("usage: bun run samantha runs:show <run-id> [--runs-dir=<dir>]");
    }
    const flags = parseFlags(rest);
    return {
      command: "runs:show",
      runId: first,
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "merge:check") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha merge:check --run-log=<path> --repo-root=<repo> [--target-branch=<branch>]");
    }
    return {
      command: "merge:check",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
    };
  }

  throw new Error("usage: bun run samantha run-task|runs:list|runs:show|merge:check");
}

function runIndexPath(runsDir?: string): string {
  return join(resolve(runsDir ?? "runs"), "index.jsonl");
}

async function main(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.command === "run-task") {
    const result = await runTaskCommand(args);
    console.log(
      JSON.stringify(
        {
          pass: result.execution.pass,
          runLog: result.runLog.path,
          runSummary: result.runSummary,
          commit: result.execution.commit?.commitHash ?? "",
        },
        null,
        2,
      ),
    );
    return result.execution.pass ? 0 : 1;
  }

  if (args.command === "runs:list") {
    console.log(JSON.stringify(await new RunIndex(runIndexPath(args.runsDir)).list(), null, 2));
    return 0;
  }

  if (args.command === "runs:show") {
    const summary = await new RunIndex(runIndexPath(args.runsDir)).find(args.runId);
    if (!summary) throw new Error(`run not found: ${args.runId}`);
    const log = await readWorkerRunLog(summary.logPath);
    console.log(JSON.stringify({ summary, log }, null, 2));
    return 0;
  }

  const result = await evaluateMergeGate({
    runLogPath: resolve(args.runLogPath),
    repoRoot: resolve(args.repoRoot),
    targetBranch: args.targetBranch,
  });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
