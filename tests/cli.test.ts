import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseCliArgs } from "../src/cli";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("samantha cli", () => {
  test("parses run-task arguments", () => {
    expect(
      parseCliArgs([
        "run-task",
        "references/tasks/fixture-single-writer.json",
        "--repo-root=.",
        "--agent=references/agent-profiles/codex-worker.json",
        "--worktrees-dir=worktrees",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
      ]),
    ).toEqual({
      command: "run-task",
      taskPath: "references/tasks/fixture-single-writer.json",
      repoRoot: ".",
      agentPath: "references/agent-profiles/codex-worker.json",
      worktreesDir: "worktrees",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
    });
  });

  test("parses run inspection and merge check arguments", () => {
    expect(parseCliArgs(["runs:list", "--runs-dir=runs"])).toEqual({
      command: "runs:list",
      runsDir: "runs",
    });
    expect(parseCliArgs(["runs:show", "run-1", "--runs-dir=runs"])).toEqual({
      command: "runs:show",
      runId: "run-1",
      runsDir: "runs",
    });
    expect(
      parseCliArgs([
        "merge:check",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
      ]),
    ).toEqual({
      command: "merge:check",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
    });
  });

  test("parses lifecycle and cleanup arguments", () => {
    expect(
      parseCliArgs([
        "runs:mark-lifecycle",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--event=merged",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:mark-lifecycle",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      event: "merged",
      stateDir: "state",
    });
    expect(
      parseCliArgs([
        "runs:accept",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:accept",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
    expect(parseCliArgs(["runs:diagnose", "--run-log=runs/run-1.json"])).toEqual({
      command: "runs:diagnose",
      runLogPath: "runs/run-1.json",
    });
    expect(
      parseCliArgs([
        "worktree:cleanup",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "worktree:cleanup",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
  });

  test("parses lesson draft arguments", () => {
    expect(parseCliArgs(["lessons:draft", "--run-log=runs/run-1.json"])).toEqual({
      command: "lessons:draft",
      runLogPath: "runs/run-1.json",
    });
  });

  test("parses lesson review and promotion arguments", () => {
    expect(parseCliArgs(["lessons:review", "references/lessons/inbox/run-1.md"])).toEqual({
      command: "lessons:review",
      candidatePath: "references/lessons/inbox/run-1.md",
    });
    expect(parseCliArgs(["lessons:review-inbox", "--repo-root=/tmp/samantha-repo"])).toEqual({
      command: "lessons:review-inbox",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(
      parseCliArgs([
        "lessons:promote",
        "references/lessons/inbox/run-1.md",
        "--playbook-id=cli-command-addition",
      ]),
    ).toEqual({
      command: "lessons:promote",
      candidatePath: "references/lessons/inbox/run-1.md",
      playbookId: "cli-command-addition",
    });
    expect(
      parseCliArgs([
        "lessons:record-evidence",
        "references/playbooks/cli-command-addition.md",
        "--run-log=runs/run-2.json",
        "--assessment=helped",
        "--note=Passed again with the same task shape.",
      ]),
    ).toEqual({
      command: "lessons:record-evidence",
      playbookPath: "references/playbooks/cli-command-addition.md",
      runLogPath: "runs/run-2.json",
      assessment: "helped",
      note: "Passed again with the same task shape.",
    });
  });

  test("lesson review command writes a review artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    const candidatePath = join(candidateDir, "run-1.md");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      candidatePath,
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: run-2

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review", candidatePath])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const artifactPath = join(root, "references", "lessons", "reviews", "run-1.json");
    expect(result.path).toBe(artifactPath);
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toMatchObject({
      candidatePath,
      runId: "run-1",
      taskId: "inspect-only",
      observedOutcome: "stale evidence",
      suggestedArtifactType: "run summary / no promotion",
      superseded: {
        stale: true,
        status: "superseded by accepted and cleaned run",
        supersedingRunId: "run-2",
      },
      recommendedAction: "reject",
      classification: "auto_rejected",
      reason: "superseded: superseded by accepted and cleaned run; suggested artifact type marks no promotion",
    });
  });

  test("lesson inbox review command writes review index", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      join(candidateDir, "run-1.md"),
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: not detected

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review-inbox", `--repo-root=${root}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const indexPath = join(root, "references", "lessons", "reviews", "index.json");
    expect(result.indexPath).toBe(indexPath);
    expect(JSON.parse(await readFile(indexPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      summary: {
        total: 1,
        autoRejected: 1,
        needsMoreEvidence: 0,
        promotionCandidates: 0,
        manualReview: 0,
      },
      candidates: [
        {
          runId: "run-1",
          classification: "auto_rejected",
        },
      ],
    });
  });

  test("parses task creation from template arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-template",
        "core-module-with-tests",
        "--task-id=add-task-template-command",
        "--title=Add task template command",
        "--set=module:task-from-template",
        "--set=command:tasks:from-template",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-template",
      templateId: "core-module-with-tests",
      taskId: "add-task-template-command",
      title: "Add task template command",
      replacements: {
        command: "tasks:from-template",
        module: "task-from-template",
      },
      repoRoot: "/tmp/samantha-repo",
    });
  });

  test("parses task creation from run arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-run",
        "--run-log=runs/run-1.json",
        "--task-id=follow-up-task",
        "--title=Follow up task",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-run",
      runLogPath: "runs/run-1.json",
      taskId: "follow-up-task",
      title: "Follow up task",
      repoRoot: "/tmp/samantha-repo",
    });
  });
});
