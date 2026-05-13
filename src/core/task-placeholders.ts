import type { TaskSpec } from "./contracts";

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

export function unresolvedTaskPlaceholders(task: TaskSpec): string[] {
  const found = new Set<string>();
  collectPlaceholders(task.targetFiles, found);
  collectPlaceholders(task.forbiddenChanges, found);
  collectPlaceholders(task.setupCommands, found);
  collectPlaceholders(task.verifyCommands, found);
  collectPlaceholders(task.instructions, found);
  collectPlaceholders(task.expectedCommitSubject, found);
  return Array.from(found).sort();
}

export function unresolvedDispatchPlaceholders(task: TaskSpec): string[] {
  const found = new Set<string>();
  collectPlaceholders(task.targetFiles, found);
  collectPlaceholders(task.forbiddenChanges, found);
  collectPlaceholders(task.setupCommands, found);
  collectPlaceholders(task.verifyCommands, found);
  collectPlaceholders(task.expectedCommitSubject, found);
  return Array.from(found).sort();
}
