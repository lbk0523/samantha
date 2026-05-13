import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promoteLessonCandidate } from "../src/core/lesson-promote";

let tmpRoots: string[] = [];

async function writeCandidate(root: string, markdown: string): Promise<string> {
  const path = join(root, "references", "lessons", "inbox", "candidate.md");
  await mkdir(join(root, "references", "lessons", "inbox"), { recursive: true });
  await writeFile(path, markdown, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("lesson promotion", () => {
  test("rejects stale no-promotion candidates without creating a playbook", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-promote-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: stale-run

## Source
- Source run id: stale-run
- Task id: expose-runs-show-lifecycle
- Task title: Expose lifecycle evidence in runs show
- Run log: /repo/runs/stale-run.json

## Evidence
- Observed outcome: blocked

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: fresh-run

### Recurrence
- Task family: expose-runs-show-lifecycle
- Recurrence outcome: blocked
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Treat this candidate as stale unless the same failure recurs after the superseding run.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Promoting superseded evidence can add process for a problem that was already resolved.
`,
    );

    const result = await promoteLessonCandidate({
      candidatePath,
      repoRoot: root,
      playbookId: "must-not-exist",
    });

    expect(result).toEqual({
      promoted: false,
      reason: "candidate is stale or marked no promotion",
      sourcePath: candidatePath,
      artifactPath: undefined,
    });
    await expect(readdir(join(root, "references", "playbooks"))).rejects.toThrow();
  });

  test("does not promote playbook candidates that still need more evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-promote-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: pass-run

## Source
- Source run id: pass-run
- Task id: add-cli-command
- Task title: Add CLI command
- Run log: /repo/runs/pass-run.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: add-cli-command
- Recurrence outcome: pass
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep CLI additions paired with parser tests and focused core tests.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.
`,
    );

    const result = await promoteLessonCandidate({
      candidatePath,
      repoRoot: root,
      playbookId: "cli-command-addition",
    });

    expect(result).toEqual({
      promoted: false,
      reason: "candidate needs more evidence before playbook promotion",
      sourcePath: candidatePath,
      artifactPath: undefined,
    });
    await expect(readdir(join(root, "references", "playbooks"))).rejects.toThrow();
  });

  test("does not promote playbook candidates below the recurrence threshold", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-promote-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: pass-run

## Source
- Source run id: pass-run
- Task id: add-cli-command
- Task title: Add CLI command
- Run log: /repo/runs/pass-run.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: add-cli-command
- Recurrence outcome: pass
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep CLI additions paired with parser tests and focused core tests.
- Affected layer: playbook
- Suggested artifact type: playbook promotion candidate
- Risk if adopted: Promotion still requires manual review.
`,
    );

    const result = await promoteLessonCandidate({
      candidatePath,
      repoRoot: root,
      playbookId: "cli-command-addition",
    });

    expect(result).toEqual({
      promoted: false,
      reason: "candidate needs more evidence before playbook promotion",
      sourcePath: candidatePath,
      artifactPath: undefined,
    });
    await expect(readdir(join(root, "references", "playbooks"))).rejects.toThrow();
  });

  test("promotes playbook promotion candidates while preserving source evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-promote-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: pass-run

## Source
- Source run id: pass-run
- Task id: add-cli-command
- Task title: Add CLI command
- Run log: /repo/runs/pass-run.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: add-cli-command
- Recurrence outcome: pass
- Recurrence count: 2
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep CLI additions paired with parser tests and focused core tests.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.
`,
    );

    const result = await promoteLessonCandidate({
      candidatePath,
      repoRoot: root,
      playbookId: "cli-command-addition",
    });

    const artifactPath = join(root, "references", "playbooks", "cli-command-addition.md");
    const markdown = await readFile(artifactPath, "utf8");
    expect(result).toEqual({
      promoted: true,
      reason: "promoted playbook",
      sourcePath: candidatePath,
      artifactPath,
    });
    expect(markdown).toContain("# Playbook: cli-command-addition");
    expect(markdown).toContain(`- Promoted from: ${candidatePath}`);
    expect(markdown).toContain("- Source run id: pass-run");
    expect(markdown).toContain("- Task id: add-cli-command");
    expect(markdown).toContain("- Run log: /repo/runs/pass-run.json");
    expect(markdown).toContain("- Observed outcome: pass");
    expect(markdown).toContain("- Superseded status: not detected");
    expect(markdown).toContain("- Task family: add-cli-command");
    expect(markdown).toContain("- Recurrence outcome: pass");
    expect(markdown).toContain("- Recurrence count: 2");
    expect(markdown).toContain("- Promotion threshold: 2");
    expect(markdown).toContain("- Proposed lesson: Keep CLI additions paired with parser tests and focused core tests.");
    expect(markdown).toContain("## Later Evidence\n- none recorded");
  });

  test("does not overwrite an existing playbook", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-promote-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: pass-run

## Source
- Source run id: pass-run
- Task id: add-cli-command
- Task title: Add CLI command
- Run log: /repo/runs/pass-run.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: add-cli-command
- Recurrence outcome: pass
- Recurrence count: 2
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep CLI additions paired with parser tests and focused core tests.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.
`,
    );
    const artifactPath = join(root, "references", "playbooks", "cli-command-addition.md");
    await mkdir(join(root, "references", "playbooks"), { recursive: true });
    await writeFile(artifactPath, "existing\n", "utf8");

    const result = await promoteLessonCandidate({
      candidatePath,
      repoRoot: root,
      playbookId: "cli-command-addition",
    });

    expect(result).toEqual({
      promoted: false,
      reason: "playbook already exists",
      sourcePath: candidatePath,
      artifactPath,
    });
    await expect(readFile(artifactPath, "utf8")).resolves.toBe("existing\n");
  });
});
