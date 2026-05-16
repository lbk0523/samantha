import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { TaskSpec } from "./contracts";
import type {
  PreflightStoredBatchPlanTaskSpecWritesInput,
  TaskSpecWritePreflightResult,
} from "./batch-plan-task-spec-preflight";
import { preflightStoredBatchPlanTaskSpecWrites } from "./batch-plan-task-spec-preflight";

export interface TaskSpecWriteRecord {
  path: string;
  absolutePath: string;
  taskSpec: TaskSpec;
}

export interface WriteBatchPlanTaskSpecsInput {
  preflight: TaskSpecWritePreflightResult;
  repoRoot?: string;
}

export type WriteStoredBatchPlanTaskSpecsInput = PreflightStoredBatchPlanTaskSpecWritesInput & {
  repoRoot?: string;
};

export async function writeBatchPlanTaskSpecs(input: WriteBatchPlanTaskSpecsInput): Promise<TaskSpecWriteRecord[]> {
  assertMayWrite(input.preflight);

  const repoRoot = resolve(input.repoRoot ?? ".");
  const targets = input.preflight.taskSpecWritePlans.map((plan) => ({
    ...resolveTaskSpecPath(repoRoot, plan.path),
    taskSpec: plan.taskSpec,
  }));

  for (const target of targets) {
    await mkdir(dirname(target.absolutePath), { recursive: true });
    try {
      await writeFile(target.absolutePath, `${JSON.stringify(target.taskSpec, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`TaskSpec already exists: ${target.path}`);
      }
      throw err;
    }
  }

  return targets;
}

export async function writeStoredBatchPlanTaskSpecs(
  input: WriteStoredBatchPlanTaskSpecsInput,
): Promise<TaskSpecWriteRecord[]> {
  const { repoRoot, ...preflightInput } = input;
  return writeBatchPlanTaskSpecs({
    repoRoot,
    preflight: await preflightStoredBatchPlanTaskSpecWrites(preflightInput),
  });
}

function assertMayWrite(preflight: TaskSpecWritePreflightResult): void {
  if (preflight.mayWrite) return;

  const detail = preflight.violations.length > 0 ? preflight.violations.join("; ") : "mayWrite was false";
  throw new Error(`TaskSpec write preflight failed: ${detail}`);
}

function resolveTaskSpecPath(repoRoot: string, path: string): { path: string; absolutePath: string } {
  const absolutePath = resolve(repoRoot, path);
  const repoRelativePath = relative(repoRoot, absolutePath);

  if (repoRelativePath === "" || repoRelativePath.startsWith("..") || isAbsolute(repoRelativePath)) {
    throw new Error(`TaskSpec write path escapes repoRoot: ${path}`);
  }

  return {
    path: repoRelativePath.replaceAll("\\", "/"),
    absolutePath,
  };
}
