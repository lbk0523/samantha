import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname } from "node:path";
import type { ProjectContext } from "./project-context";
import { projectPaths } from "./project-paths";

export interface ProjectWriterLockRecord {
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  runId: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
  token: string;
}

export interface ProjectWriterLockHandle {
  path: string;
  record: ProjectWriterLockRecord;
  release(): Promise<void>;
}

export interface AcquireProjectWriterLockInput {
  projectContext: ProjectContext;
  taskId: string;
  runId: string;
  now?: Date;
}

async function readExistingLock(path: string): Promise<ProjectWriterLockRecord | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ProjectWriterLockRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (err instanceof SyntaxError) return undefined;
    throw err;
  }
}

function lockBlockedMessage(input: {
  path: string;
  projectId: string;
  existing: ProjectWriterLockRecord | undefined;
}): string {
  const details = input.existing
    ? `held by task ${input.existing.taskId} run ${input.existing.runId} since ${input.existing.acquiredAt}`
    : "held by another writer run";
  return [
    "dispatch blocked:",
    `project writer lock is already held for ${input.projectId}: ${details}`,
    `lock path: ${input.path}`,
  ].join("\n");
}

export async function acquireProjectWriterLock(
  input: AcquireProjectWriterLockInput,
): Promise<ProjectWriterLockHandle> {
  const path = projectPaths.writerLockPath(input.projectContext);
  const record: ProjectWriterLockRecord = {
    schemaVersion: 1,
    projectId: input.projectContext.projectId,
    taskId: input.taskId,
    runId: input.runId,
    pid: process.pid,
    hostname: hostname(),
    acquiredAt: (input.now ?? new Date()).toISOString(),
    token: randomUUID(),
  };

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        lockBlockedMessage({
          path,
          projectId: input.projectContext.projectId,
          existing: await readExistingLock(path),
        }),
      );
    }
    throw err;
  }

  return {
    path,
    record,
    release: async () => {
      const existing = await readExistingLock(path);
      if (!existing || existing.token !== record.token) return;
      await unlink(path);
    },
  };
}
