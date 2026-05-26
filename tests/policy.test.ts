import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import {
  DEFAULT_SAFETY_POLICY,
  validateAgentProfile,
  validateDispatch,
  validateWriterCap,
} from "../src/core/policy";

const worker: AgentProfile = {
  id: "codex-worker",
  role: "writer",
  model: "gpt-5.5",
  writerClass: "writer",
  worktreePolicy: "per-task",
  mergePolicy: "samantha-controlled",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

const validTask: TaskSpec = {
  id: "task-1",
  title: "change a focused file",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "routine",
  targetAgent: "codex-worker",
  targetFiles: ["src/core/policy.ts"],
  forbiddenChanges: ["references/**", "worktrees/**"],
  verifyCommands: ["bun test tests/policy.test.ts"],
  instructions: "Keep the policy test fixture passing.",
  expectedCommitSubject: "test: update policy fixture",
  status: "pending",
};

const reviewer: AgentProfile = {
  ...worker,
  id: "codex-reviewer",
  role: "reviewer",
  writerClass: "non-writer",
  worktreePolicy: "none",
  mergePolicy: "none",
};

describe("dispatch policy", () => {
  test("keeps the default writer cap at one", () => {
    expect(DEFAULT_SAFETY_POLICY.writerCap).toBe(1);
    expect(validateWriterCap([worker, { ...worker, id: "second-writer" }])).toContain(
      "writer profile count 2 exceeds cap 1",
    );
  });

  test("accepts bundled worker profile contract", async () => {
    const profile = JSON.parse(
      await readFile(join(import.meta.dir, "..", "references", "agent-profiles", "codex-worker.json"), "utf8"),
    ) as AgentProfile;

    expect(profile.id).toBe("codex-worker");
    expect(validateAgentProfile(profile)).toEqual([]);
  });

  test("accepts bundled reviewer profile and reviewer task contracts", async () => {
    const root = join(import.meta.dir, "..");
    const [profile, fixtureTask, dogfoodTask] = await Promise.all([
      readFile(join(root, "references", "agent-profiles", "codex-reviewer.json"), "utf8"),
      readFile(join(root, "references", "tasks", "fixture-report-reviewer.json"), "utf8"),
      readFile(join(root, "references", "tasks", "dogfood-report-reviewer.json"), "utf8"),
    ]);
    const reviewerProfile = JSON.parse(profile) as AgentProfile;
    const reviewerTasks = [fixtureTask, dogfoodTask].map((raw) => JSON.parse(raw) as TaskSpec);

    expect(reviewerProfile).toMatchObject({
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    });
    expect(validateAgentProfile(reviewerProfile)).toEqual([]);
    for (const task of reviewerTasks) {
      const result = validateDispatch(task, reviewerProfile);

      expect(result.mayDispatch).toBe(true);
      expect(result.violations).toEqual([]);
    }
  });

  test("allows a writer task with target files, forbidden changes, and verify commands", () => {
    const result = validateDispatch(validTask, worker);

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("requires known worker assignment metadata without granting authority", () => {
    const missing = { ...validTask } as unknown as Record<string, unknown>;
    delete missing.taskFamily;
    delete missing.workMode;
    delete missing.riskClass;

    const missingResult = validateDispatch(missing as unknown as TaskSpec, worker);
    const unknownResult = validateDispatch(
      {
        ...validTask,
        taskFamily: "persona" as TaskSpec["taskFamily"],
        workMode: "roleplay" as TaskSpec["workMode"],
        riskClass: "admin" as TaskSpec["riskClass"],
      },
      worker,
    );

    expect(missingResult.mayDispatch).toBe(false);
    expect(missingResult.violations).toContain("task taskFamily is unknown: (empty)");
    expect(missingResult.violations).toContain("task workMode is unknown: (empty)");
    expect(missingResult.violations).toContain("task riskClass is unknown: (empty)");
    expect(unknownResult.mayDispatch).toBe(false);
    expect(unknownResult.violations).toContain("task taskFamily is unknown: persona");
    expect(unknownResult.violations).toContain("task workMode is unknown: roleplay");
    expect(unknownResult.violations).toContain("task riskClass is unknown: admin");
  });

  test("blocks writer tasks without target files", () => {
    const result = validateDispatch({ ...validTask, targetFiles: [] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("writer tasks must declare targetFiles");
  });

  test("blocks writer tasks without forbidden changes", () => {
    const result = validateDispatch({ ...validTask, forbiddenChanges: [] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("writer tasks must declare forbiddenChanges");
  });

  test("blocks writer tasks without verify commands", () => {
    const result = validateDispatch({ ...validTask, verifyCommands: [] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("writer tasks must declare verifyCommands");
  });

  test("blocks writer tasks with no-op verify commands", () => {
    const result = validateDispatch({ ...validTask, verifyCommands: ["true"] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "writer verifyCommands must not use no-op/simple output commands: true",
    );
  });

  test("blocks writer tasks with shell-wrapped no-op verify commands", () => {
    const commands = ["/bin/bash -lc true", "env bash -lc true", "bash -l -c true"];

    for (const command of commands) {
      const result = validateDispatch(
        {
          ...validTask,
          taskFamily: "docs-only",
          workMode: "minimal-change",
          targetFiles: ["README.md"],
          verifyCommands: [command],
        },
        worker,
      );

      expect(result.mayDispatch).toBe(false);
      expect(result.violations).toContain(
        `writer verifyCommands must not use no-op/simple output commands: ${command}`,
      );
    }
  });

  test("blocks writer tasks with long-running watch or dev verify commands", () => {
    const commands = [
      "sleep 1",
      "tail -f logs/app.log",
      "npm run dev",
      "bun --watch tests/policy.test.ts",
      "bun test --watch",
      "vite dev",
      "next dev",
    ];

    for (const command of commands) {
      const result = validateDispatch({ ...validTask, verifyCommands: [command] }, worker);

      expect(result.mayDispatch).toBe(false);
      expect(result.violations).toContain(
        `writer verifyCommands must not use long-running/watch/dev/server commands: ${command}`,
      );
    }
  });

  test("blocks writer tasks with shell-wrapped simple output or long-running dev verify commands", () => {
    const commands = ["sh -lc \"echo ok\"", "zsh -lc \"sleep 999\"", "bash -lc 'npm run dev'"];

    for (const command of commands) {
      const result = validateDispatch({ ...validTask, verifyCommands: [command] }, worker);

      expect(result.mayDispatch).toBe(false);
    }
  });

  test("blocks writer tasks with whitespace-only verify commands", () => {
    const result = validateDispatch({ ...validTask, verifyCommands: ["  \n\t"] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "writer verifyCommands must not include empty or whitespace-only commands",
    );
  });

  test("blocks core-module writer tasks with only grep for missing test or typecheck verification", () => {
    const result = validateDispatch({ ...validTask, verifyCommands: ["grep -q policy src/core/policy.ts"] }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "core-module or tdd-first writer tasks must include a real test runner or typecheck verify command",
    );
  });

  test("blocks tdd-first writer tasks with only file checks for missing test or typecheck verification", () => {
    const commands = ["test -f src/core/policy.ts", "git diff --check HEAD -- src/core/policy.ts"];

    for (const command of commands) {
      const result = validateDispatch(
        {
          ...validTask,
          taskFamily: "cli-command",
          workMode: "tdd-first",
          verifyCommands: [command],
        },
        worker,
      );

      expect(result.mayDispatch).toBe(false);
      expect(result.violations).toContain(
        "core-module or tdd-first writer tasks must include a real test runner or typecheck verify command",
      );
    }
  });

  test("blocks core-module writer tasks with unrelated focused test verification", () => {
    const result = validateDispatch(
      {
        ...validTask,
        targetFiles: ["src/core/worker-result.ts"],
        verifyCommands: ["bun test tests/unrelated.test.ts"],
      },
      worker,
    );

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "core-module or tdd-first writer tasks must include a real test runner or typecheck verify command",
    );
  });

  test("blocks lifecycle-sensitive writer tasks without broad verification", () => {
    const commands = [
      "grep -q policy src/core/policy.ts",
      "test -f src/core/policy.ts",
      "bun test tests/policy.test.ts",
    ];

    for (const command of commands) {
      const result = validateDispatch(
        {
          ...validTask,
          riskClass: "lifecycle-sensitive",
          verifyCommands: [command],
        },
        worker,
      );

      expect(result.mayDispatch).toBe(false);
      expect(result.violations).toContain("lifecycle-sensitive writer tasks must include broad verification");
    }
  });

  test("allows focused test verification for routine core-module and tdd-first writer tasks", () => {
    const result = validateDispatch(
      { ...validTask, verifyCommands: ["bun test tests/policy.test.ts"] },
      worker,
    );

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("allows broad verification for lifecycle-sensitive writer tasks", () => {
    const commands = [
      "bun test",
      "bun run typecheck",
    ];

    for (const command of commands) {
      const result = validateDispatch(
        { ...validTask, riskClass: "lifecycle-sensitive", verifyCommands: [command] },
        worker,
      );

      expect(result.mayDispatch).toBe(true);
      expect(result.violations).toEqual([]);
    }
  });

  test("allows docs-only minimal-change writer tasks to use git diff verification", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "docs-only",
        workMode: "minimal-change",
        targetFiles: ["README.md"],
        verifyCommands: ["git diff --check HEAD -- '*.md' 'references/**/*.md'"],
      },
      worker,
    );

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("blocks allowNoop tasks without a non-empty rationale", () => {
    const missing = validateDispatch({ ...validTask, allowNoop: true }, worker);
    const blank = validateDispatch(
      { ...validTask, allowNoop: true, noopRationale: "  \n\t" },
      worker,
    );

    expect(missing.mayDispatch).toBe(false);
    expect(missing.violations).toContain("allowNoop tasks must declare noopRationale");
    expect(blank.mayDispatch).toBe(false);
    expect(blank.violations).toContain("allowNoop tasks must declare noopRationale");
  });

  test("allows explicit writer no-op tasks with a rationale", () => {
    const result = validateDispatch(
      {
        ...validTask,
        allowNoop: true,
        noopRationale: "The requested change may already be present.",
      },
      worker,
    );

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("allows non-writer report-only tasks without target files", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: [],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("blocks report tasks that target writer agents", () => {
    const result = validateDispatch({ ...validTask, resultMode: "report" }, worker);

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("report tasks must use non-writer agents");
  });

  test("blocks non-writer tasks that request write behavior", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "write",
        targetFiles: ["src/core/policy.ts"],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("non-writer tasks must use report resultMode");
    expect(result.violations).toContain("non-writer report tasks must not declare targetFiles");
  });

  test("blocks non-writer report tasks with setup commands", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: [],
        setupCommands: ["touch should-not-run"],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("non-writer report tasks must not declare setupCommands");
  });

  test("blocks non-writer report tasks with verify commands", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: ["touch should-not-run"],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("non-writer report tasks must not declare verifyCommands");
  });

  test("keeps non-writer report task verify rules unchanged", () => {
    const result = validateDispatch(
      {
        ...validTask,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: ["true"],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toEqual(["non-writer report tasks must not declare verifyCommands"]);
  });

  test("blocks profiles that can use orchestration-conflicting skills", () => {
    const result = validateDispatch(validTask, {
      ...worker,
      skillPolicy: { requiredBundles: [], blockedSkills: [] },
    });

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("agent profile must block skill: using-git-worktrees");
  });
});
