import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { validateDispatch } from "../src/core/policy";
import { createTaskFromTemplate } from "../src/core/task-from-template";

let tmpRoots: string[] = [];

const template = {
  schemaVersion: 1,
  id: "core-module-with-tests",
  title: "Core module with focused tests",
  purpose: "Fixture.",
  useWhen: ["Fixture."],
  task: {
    id: "replace-with-task-id",
    title: "Implement <module> core behavior",
    targetAgent: "codex-worker",
    targetFiles: ["src/core/<module>.ts", "tests/<module>.test.ts"],
    forbiddenChanges: ["src/cli.ts", "runs/**", "worktrees/**"],
    setupCommands: [],
    verifyCommands: ["bun run typecheck", "bun test tests/<module>.test.ts", "bun test"],
    instructions: "Fixture instructions.",
    expectedCommitSubject: "feat: add <module> core behavior",
    status: "pending",
  } satisfies TaskSpec,
};

async function writeTemplate(root: string): Promise<void> {
  const dir = join(root, "references", "task-templates");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "core-module-with-tests.json"),
    `${JSON.stringify(template, null, 2)}\n`,
    "utf8",
  );
}

async function copyRepoTemplate(root: string, templateId: string): Promise<void> {
  const repoRoot = join(import.meta.dir, "..");
  const dir = join(root, "references", "task-templates");
  const raw = await readFile(
    join(repoRoot, "references", "task-templates", `${templateId}.json`),
    "utf8",
  );

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${templateId}.json`), raw, "utf8");
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("task creation from templates", () => {
  test("writes a task spec from a task template", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-task-template-"));
    tmpRoots.push(root);
    await writeTemplate(root);

    const result = await createTaskFromTemplate({
      repoRoot: root,
      templateId: "core-module-with-tests",
      taskId: "add-task-template-command",
      title: "Add task template command",
    });
    const raw = await readFile(result.path, "utf8");
    const task = JSON.parse(raw) as TaskSpec;

    expect(result).toEqual({
      path: join(root, "references", "tasks", "add-task-template-command.json"),
      taskId: "add-task-template-command",
      templateId: "core-module-with-tests",
    });
    expect(raw.endsWith("\n")).toBe(true);
    expect(task).toEqual({
      ...template.task,
      id: "add-task-template-command",
      title: "Add task template command",
    });
  });

  test("does not overwrite an existing task spec", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-task-template-"));
    tmpRoots.push(root);
    await writeTemplate(root);
    await mkdir(join(root, "references", "tasks"), { recursive: true });
    await writeFile(join(root, "references", "tasks", "existing-task.json"), "{}\n", "utf8");

    await expect(
      createTaskFromTemplate({
        repoRoot: root,
        templateId: "core-module-with-tests",
        taskId: "existing-task",
        title: "Existing task",
      }),
    ).rejects.toThrow("task already exists: existing-task");
  });

  test("repo task templates generate dispatch-safe task specs", async () => {
    const repoRoot = join(import.meta.dir, "..");
    const cases = [
      "cli-command-with-tests",
      "core-module-with-tests",
      "docs-only",
      "report-only-review",
    ];

    for (const templateId of cases) {
      const root = await mkdtemp(join(tmpdir(), "samantha-task-template-"));
      tmpRoots.push(root);
      await copyRepoTemplate(root, templateId);
      const agentPath =
        templateId === "report-only-review"
          ? join(repoRoot, "references", "agent-profiles", "codex-reviewer.json")
          : join(repoRoot, "references", "agent-profiles", "codex-worker.json");
      const agent = JSON.parse(await readFile(agentPath, "utf8")) as AgentProfile;

      const result = await createTaskFromTemplate({
        repoRoot: root,
        templateId,
        taskId: `${templateId}-fixture`,
        title: `${templateId} fixture`,
      });
      const task = JSON.parse(await readFile(result.path, "utf8")) as TaskSpec;

      expect(validateDispatch(task, agent).violations).toEqual([]);
    }
  });

  test("keeps non-id placeholders for manual narrowing", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-task-template-"));
    tmpRoots.push(root);
    await copyRepoTemplate(root, "core-module-with-tests");

    const result = await createTaskFromTemplate({
      repoRoot: root,
      templateId: "core-module-with-tests",
      taskId: "manual-narrowing-fixture",
      title: "Manual narrowing fixture",
    });
    const task = JSON.parse(await readFile(result.path, "utf8")) as TaskSpec;

    expect(task.targetFiles).toContain("src/core/<module>.ts");
    expect(task.verifyCommands).toContain("bun test tests/<module>.test.ts");
    expect(task.expectedCommitSubject).toBe("feat: add <module> core behavior");
  });
});
