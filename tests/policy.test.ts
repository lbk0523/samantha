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

  test("allows a writer task with target files, forbidden changes, and verify commands", () => {
    const result = validateDispatch(validTask, worker);

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
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

  test("allows non-writer report-only tasks without target files", () => {
    const result = validateDispatch(
      {
        ...validTask,
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
      },
      reviewer,
    );

    expect(result.mayDispatch).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("blocks non-writer tasks that request write behavior", () => {
    const result = validateDispatch(
      {
        ...validTask,
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

  test("blocks profiles that can use orchestration-conflicting skills", () => {
    const result = validateDispatch(validTask, {
      ...worker,
      skillPolicy: { requiredBundles: [], blockedSkills: [] },
    });

    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain("agent profile must block skill: using-git-worktrees");
  });
});
