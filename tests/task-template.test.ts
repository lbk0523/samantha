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
    expect(template.task.instructions).toContain("references/playbooks/cli-core-command-with-tests.md");
    expect(template.task.instructions).toContain("references/playbooks/verification-duplication.md");
    expect(template.task.instructions).toContain("harness verifyCommands remain the acceptance gate");
    expect(template.task.instructions).toContain("WORKER_VERIFY_EVIDENCE");
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
    expect(template.task.instructions).toContain("references/playbooks/verification-duplication.md");
    expect(template.task.instructions).toContain("harness verifyCommands remain the acceptance gate");
    expect(template.task.instructions).toContain("WORKER_VERIFY_EVIDENCE");
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
    expect(template.task.verifyCommands).toEqual([
      "git diff --check HEAD -- '*.md' 'references/**/*.md'",
    ]);
    expect(template.task.instructions).toContain("references/playbooks/verification-duplication.md");
    expect(template.task.instructions).toContain("harness verifyCommands remain the acceptance gate");
    expect(template.task.instructions).toContain("WORKER_VERIFY_EVIDENCE");
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });

  test("report-only review template is a dispatch-safe non-writer task shape", async () => {
    const root = join(import.meta.dir, "..");
    const [template, agent] = await Promise.all([
      readJson<TaskTemplate>(join(root, "references", "task-templates", "report-only-review.json")),
      readJson<AgentProfile>(join(root, "references", "agent-profiles", "codex-reviewer.json")),
    ]);

    expect(template).toMatchObject({
      schemaVersion: 1,
      id: "report-only-review",
      title: "Report-only evidence review",
    });
    expect(template.task.targetAgent).toBe("codex-reviewer");
    expect(template.task.resultMode).toBe("report");
    expect(template.task.targetFiles).toEqual([]);
    expect(template.task.forbiddenChanges).toContain("**/*");
    expect(template.task.setupCommands).toEqual([]);
    expect(template.task.verifyCommands).toEqual([]);
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });

  test("drift review template is dispatch-safe advice-only report shape", async () => {
    const root = join(import.meta.dir, "..");
    const [template, agent] = await Promise.all([
      readJson<TaskTemplate>(join(root, "references", "task-templates", "drift-review.json")),
      readJson<AgentProfile>(join(root, "references", "agent-profiles", "codex-reviewer.json")),
    ]);

    expect(template).toMatchObject({
      schemaVersion: 1,
      id: "drift-review",
      title: "Drift Review",
    });
    expect(template.task.targetAgent).toBe("codex-reviewer");
    expect(template.task.resultMode).toBe("report");
    expect(template.task.targetFiles).toEqual([]);
    expect(template.task.forbiddenChanges).toEqual(["**/*"]);
    expect(template.task.setupCommands).toEqual([]);
    expect(template.task.verifyCommands).toEqual([]);
    expect(template.task.instructions).toContain("references/playbooks/drift-review.md");
    expect(template.task.instructions).toContain("whitelisted evidence");
    expect(template.task.instructions).toContain("advice-only output");
    expect(template.task.instructions).toContain("exactly one Next action");
    expect(validateDispatch(template.task, agent).violations).toEqual([]);
  });
});
