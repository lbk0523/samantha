import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import { collectChangedFileSnapshots, evaluateWorkerResult } from "../src/core/worker-result";

let tmpRoots: string[] = [];

async function makeRepo(): Promise<{ root: string; baseCommit: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-result-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "allowed.txt"), "base\n", "utf8");
  await git(["add", "allowed.txt"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return { root, baseCommit: await gitHead(root) };
}

const task: TaskSpec = {
  id: "worker-result-fixture",
  title: "Evaluate worker result",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["allowed.txt"],
  forbiddenChanges: ["state/**", "worktrees/**"],
  verifyCommands: ["test -f allowed.txt"],
  instructions: "Only change allowed.txt.",
  status: "pending",
};

function expectTiming(result: {
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}): void {
  expect(result.startedAt).toBeTruthy();
  expect(result.finishedAt).toBeTruthy();
  expect(Number.isNaN(Date.parse(result.startedAt!))).toBe(false);
  expect(Number.isNaN(Date.parse(result.finishedAt!))).toBe(false);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("evaluateWorkerResult", () => {
  test("passes when harness result, scope, and verify commands pass", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");
    await git(["add", "allowed.txt"], root);
    await git(["commit", "-m", "feat: change allowed file"], root);

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(true);
    expect(result.changedFiles).toEqual(["allowed.txt"]);
    expect(result.scopeViolations).toEqual([]);
    expect(result.verifyResults[0]?.exitCode).toBe(0);
    expect(result.workerVerifyEvidence).toBeUndefined();
    expectTiming(result.harnessTiming!);
    expectTiming(result.verificationTiming!);
    expectTiming(result.verifyResults[0]!);
  });

  test("includes uncommitted working tree changes", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed but not committed\n", "utf8");

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(true);
    expect(result.changedFiles).toEqual(["allowed.txt"]);
  });

  test("fails writer write pass results with no changed files unless no-op is allowed", async () => {
    const { root, baseCommit } = await makeRepo();

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.changedFiles).toEqual([]);
    expect(result.scopeViolations).toEqual([]);
    expect(result.verifyResults[0]?.exitCode).toBe(0);
  });

  test("allows explicit writer no-op pass results with a rationale", async () => {
    const { root, baseCommit } = await makeRepo();

    const result = await evaluateWorkerResult({
      task: {
        ...task,
        allowNoop: true,
        noopRationale: "The requested invariant was already present.",
      },
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"already done","commit":""}',
    });

    expect(result.pass).toBe(true);
    expect(result.changedFiles).toEqual([]);
    expect(result.scopeViolations).toEqual([]);
    expect(result.verifyResults[0]?.exitCode).toBe(0);
  });

  test("can ignore baseline changes for report-only evaluation", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed before report\n", "utf8");
    const baselineChangedFiles = await collectChangedFileSnapshots({ baseCommit, cwd: root });

    const result = await evaluateWorkerResult({
      task: {
        ...task,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        resultMode: "report",
      },
      cwd: root,
      baseCommit,
      baselineChangedFiles,
      output: 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}',
    });

    expect(result.pass).toBe(true);
    expect(result.changedFiles).toEqual([]);
    expect(result.scopeViolations).toEqual([]);
  });

  test("does not ignore baseline files changed during report-only evaluation", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed before report\n", "utf8");
    const baselineChangedFiles = await collectChangedFileSnapshots({ baseCommit, cwd: root });
    await writeFile(join(root, "allowed.txt"), "changed during report\n", "utf8");

    const result = await evaluateWorkerResult({
      task: {
        ...task,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        resultMode: "report",
      },
      cwd: root,
      baseCommit,
      baselineChangedFiles,
      output: 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.changedFiles).toEqual(["allowed.txt"]);
    expect(result.scopeViolations).toContainEqual({
      file: "allowed.txt",
      reason: "forbidden",
      matchedPattern: "**/*",
    });
  });

  test("catches files created by verify commands", async () => {
    const { root, baseCommit } = await makeRepo();

    const result = await evaluateWorkerResult({
      task: {
        ...task,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: ["touch verify-created.txt"],
        resultMode: "report",
      },
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.changedFiles).toEqual(["verify-created.txt"]);
    expect(result.scopeViolations).toContainEqual({
      file: "verify-created.txt",
      reason: "forbidden",
      matchedPattern: "**/*",
    });
    expect(result.verifyResults[0]).toMatchObject({
      command: "touch verify-created.txt",
      exitCode: 0,
    });
    expectTiming(result.verifyResults[0]!);
    expectTiming(result.verificationTiming!);
  });

  test("rejects forbidden changed files", async () => {
    const { root, baseCommit } = await makeRepo();
    await mkdir(join(root, "state"), { recursive: true });
    await writeFile(join(root, "state/leak.json"), "{}\n", "utf8");
    await git(["add", "state/leak.json"], root);
    await git(["commit", "-m", "feat: leak state"], root);

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.scopeViolations).toContainEqual({
      file: "state/leak.json",
      reason: "forbidden",
      matchedPattern: "state/**",
    });
  });

  test("rejects changed files outside targetFiles", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "other.txt"), "changed\n", "utf8");
    await git(["add", "other.txt"], root);
    await git(["commit", "-m", "feat: change other file"], root);

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.scopeViolations).toContainEqual({
      file: "other.txt",
      reason: "outside-target",
    });
  });

  test("runs every verify command and fails when any command fails", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");

    const result = await evaluateWorkerResult({
      task: { ...task, verifyCommands: ["test -f allowed.txt", "test -f missing.txt"] },
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.verifyResults.map((item) => item.command)).toEqual([
      "test -f allowed.txt",
      "test -f missing.txt",
    ]);
    expect(result.verifyResults[0]?.exitCode).toBe(0);
    expect(result.verifyResults[1]?.exitCode).not.toBe(0);
    for (const verifyResult of result.verifyResults) expectTiming(verifyResult);
    expectTiming(result.verificationTiming!);
  });

  test("fails when HARNESS_RESULT is missing", async () => {
    const { root, baseCommit } = await makeRepo();

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: "done",
    });

    expect(result.pass).toBe(false);
    expect(result.parseError).toContain("missing HARNESS_RESULT");
    expect(result.verifyResults).toEqual([]);
    expectTiming(result.harnessTiming!);
    expect(result.verificationTiming).toBeUndefined();
  });

  test("keeps advisory verification evidence out of pass/fail semantics", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: [
        'WORKER_VERIFY_EVIDENCE: {"ran":["manual check"],"skipped":[],"failed":["optional lint"],"note":"worker-reported failure stays advisory"}',
        'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
      ].join("\n"),
    });

    expect(result.pass).toBe(true);
    expect(result.workerVerifyEvidence).toEqual({
      status: "parsed",
      raw: '{"ran":["manual check"],"skipped":[],"failed":["optional lint"],"note":"worker-reported failure stays advisory"}',
      evidence: {
        ran: ["manual check"],
        skipped: [],
        failed: ["optional lint"],
        note: "worker-reported failure stays advisory",
      },
    });
  });

  test("records malformed advisory verification evidence without failing evaluation", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: [
        'WORKER_VERIFY_EVIDENCE: {"ran":"bun test","skipped":[],"failed":[],"note":"bad shape"}',
        'HARNESS_RESULT: {"status":"pass","note":"done","commit":""}',
      ].join("\n"),
    });

    expect(result.pass).toBe(true);
    expect(result.workerVerifyEvidence).toEqual({
      status: "unparseable",
      raw: '{"ran":"bun test","skipped":[],"failed":[],"note":"bad shape"}',
      parseError: "WORKER_VERIFY_EVIDENCE.ran must be a string array",
    });
  });

  test("fails when harness status is not pass", async () => {
    const { root, baseCommit } = await makeRepo();
    await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");

    const result = await evaluateWorkerResult({
      task,
      cwd: root,
      baseCommit,
      output: 'HARNESS_RESULT: {"status":"blocked","note":"needs decision","commit":""}',
    });

    expect(result.pass).toBe(false);
    expect(result.harness?.status).toBe("blocked");
    expect(result.verifyResults).toEqual([]);
  });
});
