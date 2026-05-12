import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { TaskSpec } from "./contracts";

export interface TaskTemplate {
  schemaVersion: 1;
  id: string;
  title: string;
  purpose: string;
  useWhen: string[];
  task: TaskSpec;
}

export interface CreateTaskFromTemplateInput {
  templateId: string;
  taskId: string;
  title: string;
  repoRoot?: string;
}

export interface CreateTaskFromTemplateWrite {
  path: string;
  taskId: string;
  templateId: string;
}

function assertFileStem(label: string, value: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, dots, underscores, or dashes`);
  }
}

async function readTaskTemplate(path: string): Promise<TaskTemplate> {
  return JSON.parse(await readFile(path, "utf8")) as TaskTemplate;
}

export async function createTaskFromTemplate(
  input: CreateTaskFromTemplateInput,
): Promise<CreateTaskFromTemplateWrite> {
  assertFileStem("template id", input.templateId);
  assertFileStem("task id", input.taskId);

  const repoRoot = resolve(input.repoRoot ?? ".");
  const templatePath = join(repoRoot, "references", "task-templates", `${input.templateId}.json`);
  const template = await readTaskTemplate(templatePath);
  const task: TaskSpec = {
    ...template.task,
    id: input.taskId,
    title: input.title,
  };
  const tasksDir = join(repoRoot, "references", "tasks");
  const path = join(tasksDir, `${input.taskId}.json`);

  await mkdir(tasksDir, { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(task, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`task already exists: ${input.taskId}`);
    }
    throw err;
  }

  return {
    path,
    taskId: input.taskId,
    templateId: input.templateId,
  };
}
