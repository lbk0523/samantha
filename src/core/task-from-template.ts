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
  replacements?: Record<string, string>;
  repoRoot?: string;
}

export interface CreateTaskFromTemplateWrite {
  path: string;
  taskId: string;
  templateId: string;
  unresolvedPlaceholders: string[];
}

function assertFileStem(label: string, value: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, dots, underscores, or dashes`);
  }
}

async function readTaskTemplate(path: string): Promise<TaskTemplate> {
  return JSON.parse(await readFile(path, "utf8")) as TaskTemplate;
}

function replaceText(value: string, replacements: Record<string, string>): string {
  let replaced = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    replaced = replaced.replaceAll(`<${key}>`, replacement);
  }
  return replaced;
}

function replaceTaskPlaceholders(task: TaskSpec, replacements: Record<string, string>): TaskSpec {
  return {
    ...task,
    targetFiles: task.targetFiles.map((value) => replaceText(value, replacements)),
    forbiddenChanges: task.forbiddenChanges.map((value) => replaceText(value, replacements)),
    setupCommands: task.setupCommands?.map((value) => replaceText(value, replacements)),
    verifyCommands: task.verifyCommands.map((value) => replaceText(value, replacements)),
    instructions: replaceText(task.instructions, replacements),
    expectedCommitSubject: task.expectedCommitSubject
      ? replaceText(task.expectedCommitSubject, replacements)
      : undefined,
  };
}

function collectPlaceholders(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(/<([A-Za-z0-9][A-Za-z0-9_-]*)>/g)) {
      found.add(match[1]);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectPlaceholders(item, found);
  }
}

function unresolvedTaskPlaceholders(task: TaskSpec): string[] {
  const found = new Set<string>();
  collectPlaceholders(task.targetFiles, found);
  collectPlaceholders(task.forbiddenChanges, found);
  collectPlaceholders(task.setupCommands, found);
  collectPlaceholders(task.verifyCommands, found);
  collectPlaceholders(task.instructions, found);
  collectPlaceholders(task.expectedCommitSubject, found);
  return Array.from(found).sort();
}

export async function createTaskFromTemplate(
  input: CreateTaskFromTemplateInput,
): Promise<CreateTaskFromTemplateWrite> {
  assertFileStem("template id", input.templateId);
  assertFileStem("task id", input.taskId);

  const repoRoot = resolve(input.repoRoot ?? ".");
  const templatePath = join(repoRoot, "references", "task-templates", `${input.templateId}.json`);
  const template = await readTaskTemplate(templatePath);
  const task = replaceTaskPlaceholders(
    {
      ...template.task,
      id: input.taskId,
      title: input.title,
    },
    input.replacements ?? {},
  );
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
    unresolvedPlaceholders: unresolvedTaskPlaceholders(task),
  };
}
