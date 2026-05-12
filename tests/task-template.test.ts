import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { validateDispatch } from "../src/core/policy";

interface TaskTemplate {
  schemaVersion: 1;
  id: string;
  title: string;
  purpose: string;
  useWhen: string[];
  task: TaskSpec;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("task templates", () => {
  test("cli command template is a dispatch-safe writer task shape", async () => {
    const root = join(import.meta.dir, "..");
    const [template, agent] = await Promise.all([
      readJson<TaskTemplate>(join(root, "references", "task-templates", "cli-command-with-tests.json")),
      readJson<AgentProfile>(join(root, "references", "agent-profiles", "codex-worker.json")),
    ]);

    expect(template).toMatchObject({
      schemaVersion: 1,
      id: "cli-command-with-tests",
      title: "CLI command with focused tests",
    });
    expect(template.task.targetAgent).toBe("codex-worker");
    expect(template.task.targetFiles).toContain("src/cli.ts");
    expect(template.task.targetFiles).toContain("tests/cli.test.ts");
    expect(template.task.forbiddenChanges).toContain("runs/**");
    expect(template.task.forbiddenChanges).toContain("worktrees/**");
    expect(template.task.verifyCommands).toContain("bun run typecheck");
    expect(template.task.verifyCommands).toContain("bun test");
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });

  test("core module template is a dispatch-safe writer task shape", async () => {
    const root = join(import.meta.dir, "..");
    const [template, agent] = await Promise.all([
      readJson<TaskTemplate>(join(root, "references", "task-templates", "core-module-with-tests.json")),
      readJson<AgentProfile>(join(root, "references", "agent-profiles", "codex-worker.json")),
    ]);

    expect(template).toMatchObject({
      schemaVersion: 1,
      id: "core-module-with-tests",
      title: "Core module with focused tests",
    });
    expect(template.task.targetAgent).toBe("codex-worker");
    expect(template.task.targetFiles).toContain("src/core/<module>.ts");
    expect(template.task.targetFiles).toContain("tests/<module>.test.ts");
    expect(template.task.targetFiles).not.toContain("src/cli.ts");
    expect(template.task.forbiddenChanges).toContain("src/cli.ts");
    expect(template.task.forbiddenChanges).toContain("runs/**");
    expect(template.task.forbiddenChanges).toContain("worktrees/**");
    expect(template.task.verifyCommands).toContain("bun run typecheck");
    expect(template.task.verifyCommands).toContain("bun test tests/<module>.test.ts");
    expect(template.task.verifyCommands).toContain("bun test");
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });

  test("docs-only template is a dispatch-safe writer task shape", async () => {
    const root = join(import.meta.dir, "..");
    const [template, agent] = await Promise.all([
      readJson<TaskTemplate>(join(root, "references", "task-templates", "docs-only.json")),
      readJson<AgentProfile>(join(root, "references", "agent-profiles", "codex-worker.json")),
    ]);

    expect(template).toMatchObject({
      schemaVersion: 1,
      id: "docs-only",
      title: "Docs-only direction update",
    });
    expect(template.task.targetAgent).toBe("codex-worker");
    expect(template.task.targetFiles).toContain("*.md");
    expect(template.task.targetFiles).toContain("references/**/*.md");
    expect(template.task.targetFiles).not.toContain("src/cli.ts");
    expect(template.task.forbiddenChanges).toContain("src/**");
    expect(template.task.forbiddenChanges).toContain("tests/**");
    expect(template.task.forbiddenChanges).toContain("runs/**");
    expect(template.task.forbiddenChanges).toContain("worktrees/**");
    expect(template.task.verifyCommands).toContain("bun run typecheck");
    expect(template.task.verifyCommands).toContain("bun test");
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });
});
