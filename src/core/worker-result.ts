import type { HarnessResult, TaskSpec } from "./contracts";
import { gitChangedFilesSince, gitWorkingTreeFiles } from "./git";
import { matchesAnyGlob } from "./glob";
import { HarnessResultParseError, parseHarnessResult } from "./harness-result";

export interface VerifyCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ScopeViolation {
  file: string;
  reason: "forbidden" | "outside-target";
  matchedPattern?: string;
}

export interface WorkerResultEvaluation {
  pass: boolean;
  harness?: HarnessResult;
  parseError?: string;
  changedFiles: string[];
  scopeViolations: ScopeViolation[];
  verifyResults: VerifyCommandResult[];
}

async function runVerifyCommand(command: string, cwd: string): Promise<VerifyCommandResult> {
  const child = Bun.spawn(["bash", "-lc", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { command, exitCode, stdout, stderr };
}

function findScopeViolations(task: TaskSpec, changedFiles: string[]): ScopeViolation[] {
  const violations: ScopeViolation[] = [];

  for (const file of changedFiles) {
    const forbidden = task.forbiddenChanges.find((pattern) => matchesAnyGlob(file, [pattern]));
    if (forbidden) {
      violations.push({ file, reason: "forbidden", matchedPattern: forbidden });
      continue;
    }

    if (!matchesAnyGlob(file, task.targetFiles)) {
      violations.push({ file, reason: "outside-target" });
    }
  }

  return violations;
}

export async function evaluateWorkerResult(input: {
  task: TaskSpec;
  cwd: string;
  baseCommit: string;
  output: string;
}): Promise<WorkerResultEvaluation> {
  let harness: HarnessResult | undefined;
  let parseError: string | undefined;

  try {
    harness = parseHarnessResult(input.output);
  } catch (err) {
    parseError =
      err instanceof HarnessResultParseError || err instanceof Error ? err.message : String(err);
  }

  const committedFiles = await gitChangedFilesSince(input.baseCommit, input.cwd);
  const workingTreeFiles = await gitWorkingTreeFiles(input.cwd);
  const changedFiles = Array.from(new Set([...committedFiles, ...workingTreeFiles])).sort();
  const scopeViolations = findScopeViolations(input.task, changedFiles);

  const shouldRunVerify = harness?.status === "pass" && scopeViolations.length === 0;
  const verifyResults = shouldRunVerify
    ? await Promise.all(input.task.verifyCommands.map((command) => runVerifyCommand(command, input.cwd)))
    : [];
  const verifyPassed = verifyResults.every((result) => result.exitCode === 0);

  return {
    pass: harness?.status === "pass" && scopeViolations.length === 0 && verifyPassed,
    harness,
    parseError,
    changedFiles,
    scopeViolations,
    verifyResults,
  };
}
