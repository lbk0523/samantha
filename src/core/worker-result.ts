import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessResult, TaskSpec } from "./contracts";
import { gitChangedFilesSince, gitWorkingTreeFiles } from "./git";
import { matchesAnyGlob } from "./glob";
import { HarnessResultParseError, parseHarnessResult } from "./harness-result";
import {
  finishOperationTiming,
  startOperationTiming,
  type OperationTiming,
} from "./command-runner";
import {
  parseWorkerVerifyEvidence,
  type WorkerVerifyEvidenceParseResult,
} from "./worker-verify-evidence";

export interface VerifyCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
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
  workerVerifyEvidence?: WorkerVerifyEvidenceParseResult;
  harnessTiming?: OperationTiming;
  verificationTiming?: OperationTiming;
}

export interface ChangedFileSnapshot {
  file: string;
  contentHash: string | null;
}

export async function collectChangedFiles(input: {
  baseCommit: string;
  cwd: string;
}): Promise<string[]> {
  const committedFiles = await gitChangedFilesSince(input.baseCommit, input.cwd);
  const workingTreeFiles = await gitWorkingTreeFiles(input.cwd);
  return Array.from(new Set([...committedFiles, ...workingTreeFiles])).sort();
}

export async function collectChangedFileSnapshots(input: {
  baseCommit: string;
  cwd: string;
}): Promise<ChangedFileSnapshot[]> {
  const files = await collectChangedFiles(input);
  return Promise.all(
    files.map(async (file) => ({
      file,
      contentHash: await fileContentHash(input.cwd, file),
    })),
  );
}

async function fileContentHash(cwd: string, file: string): Promise<string | null> {
  try {
    return createHash("sha256").update(await readFile(join(cwd, file))).digest("hex");
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function runVerifyCommand(command: string, cwd: string): Promise<VerifyCommandResult> {
  const timing = startOperationTiming();
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

  return { command, exitCode, stdout, stderr, ...finishOperationTiming(timing) };
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

async function collectChangedFilesAfterBaseline(input: {
  baseCommit: string;
  cwd: string;
  baselineChangedFiles?: ChangedFileSnapshot[];
}): Promise<string[]> {
  const baselineByFile = new Map(
    (input.baselineChangedFiles ?? []).map((snapshot) => [snapshot.file, snapshot.contentHash]),
  );
  const files = new Set(await collectChangedFiles(input));
  for (const file of baselineByFile.keys()) {
    files.add(file);
  }

  const changedFiles: string[] = [];
  for (const file of Array.from(files).sort()) {
    if (!baselineByFile.has(file)) {
      changedFiles.push(file);
      continue;
    }
    if ((await fileContentHash(input.cwd, file)) !== baselineByFile.get(file)) {
      changedFiles.push(file);
    }
  }
  return changedFiles;
}

export async function evaluateWorkerResult(input: {
  task: TaskSpec;
  cwd: string;
  baseCommit: string;
  output: string;
  baselineChangedFiles?: ChangedFileSnapshot[];
}): Promise<WorkerResultEvaluation> {
  const harnessTimingStart = startOperationTiming();
  let harness: HarnessResult | undefined;
  let parseError: string | undefined;

  try {
    harness = parseHarnessResult(input.output);
  } catch (err) {
    parseError =
      err instanceof HarnessResultParseError || err instanceof Error ? err.message : String(err);
  }
  const workerVerifyEvidence = parseWorkerVerifyEvidence(input.output);

  const initialChangedFiles = await collectChangedFilesAfterBaseline(input);
  const initialScopeViolations = findScopeViolations(input.task, initialChangedFiles);
  const harnessTiming = finishOperationTiming(harnessTimingStart);

  const shouldRunVerify =
    harness?.status === "pass" &&
    initialScopeViolations.length === 0 &&
    input.task.verifyCommands.length > 0;
  const verificationTimingStart = shouldRunVerify ? startOperationTiming() : undefined;
  const verifyResults = shouldRunVerify
    ? await Promise.all(
        input.task.verifyCommands.map((command) => runVerifyCommand(command, input.cwd)),
      )
    : [];
  const changedFiles =
    verifyResults.length > 0 ? await collectChangedFilesAfterBaseline(input) : initialChangedFiles;
  const scopeViolations =
    verifyResults.length > 0 ? findScopeViolations(input.task, changedFiles) : initialScopeViolations;
  const verificationTiming = verificationTimingStart
    ? finishOperationTiming(verificationTimingStart)
    : undefined;
  const verifyPassed = verifyResults.every((result) => result.exitCode === 0);

  return {
    pass: harness?.status === "pass" && scopeViolations.length === 0 && verifyPassed,
    harness,
    parseError,
    changedFiles,
    scopeViolations,
    verifyResults,
    ...(workerVerifyEvidence ? { workerVerifyEvidence } : {}),
    harnessTiming,
    ...(verificationTiming ? { verificationTiming } : {}),
  };
}
