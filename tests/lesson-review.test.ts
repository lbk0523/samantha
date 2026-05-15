import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordLessonReview, reviewLessonCandidate } from "../src/core/lesson-review";

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

describe("lesson review", () => {
  test("summarizes candidate fields and recommends rejecting stale evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-review-"));
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
- Failure reason: typecheck blocked by missing @types/bun

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

    await expect(reviewLessonCandidate({ candidatePath })).resolves.toEqual({
      runId: "stale-run",
      sourcePath: candidatePath,
      taskId: "expose-runs-show-lifecycle",
      taskTitle: "Expose lifecycle evidence in runs show",
      runLogPath: "/repo/runs/stale-run.json",
      observedOutcome: "blocked",
      failureReason: "typecheck blocked by missing @types/bun",
      suggestedArtifactType: "run summary / no promotion",
      superseded: {
        stale: true,
        status: "superseded by accepted and cleaned run",
        supersedingRunId: "fresh-run",
      },
      recurrence: {
        taskFamily: "expose-runs-show-lifecycle",
        outcome: "blocked",
        count: 1,
        threshold: 2,
        thresholdMet: false,
      },
      recommendedAction: "reject",
      proposedLesson: "Treat this candidate as stale unless the same failure recurs after the superseding run.",
      affectedLayer: "evidence",
      riskIfAdopted: "Promoting superseded evidence can add process for a problem that was already resolved.",
    });
  });

  test("records reject reviews as durable JSON artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-review-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: no-promotion-run

## Source
- Source run id: no-promotion-run
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/no-promotion-run.json

## Evidence
- Observed outcome: no code change needed

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: inspect-only
- Recurrence outcome: no code change needed
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
    );

    const result = await recordLessonReview({ candidatePath });
    const expectedPath = join(root, "references", "lessons", "reviews", "no-promotion-run.json");

    expect(result.path).toBe(expectedPath);
    expect(JSON.parse(await readFile(expectedPath, "utf8"))).toEqual({
      schemaVersion: 1,
      candidatePath: "references/lessons/inbox/candidate.md",
      reviewedAt: result.review.reviewedAt,
      runId: "no-promotion-run",
      taskId: "inspect-only",
      observedOutcome: "no code change needed",
      suggestedArtifactType: "run summary / no promotion",
      superseded: {
        stale: true,
        status: "not detected",
      },
      recurrence: {
        taskFamily: "inspect-only",
        outcome: "no code change needed",
        count: 1,
        threshold: 2,
        thresholdMet: false,
      },
      recommendedAction: "reject",
      classification: "auto_rejected",
      reason: "suggested artifact type marks no promotion",
    });
  });

  test("keeps one-off playbook candidates as needs_more_evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-review-"));
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
- Risk if adopted: Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.
`,
    );

    const result = await recordLessonReview({ candidatePath });

    expect(result.review).toMatchObject({
      runId: "pass-run",
      recurrence: {
        taskFamily: "add-cli-command",
        outcome: "pass",
        count: 1,
        threshold: 2,
        thresholdMet: false,
      },
      recommendedAction: "manual_review",
      classification: "needs_more_evidence",
      reason: "playbook candidate needs more evidence before promotion (1/2)",
    });
  });

  test("classifies recurring playbook evidence as a manual promotion candidate", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-review-"));
    tmpRoots.push(root);
    const candidatePath = await writeCandidate(
      root,
      `# Lesson Candidate: recurring-pass-run

## Source
- Source run id: recurring-pass-run
- Task id: add-cli-command-v2
- Task title: Add CLI command again
- Run log: /repo/runs/recurring-pass-run.json

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
- Risk if adopted: Promotion still requires manual review.
`,
    );

    const result = await recordLessonReview({ candidatePath });

    expect(result.review).toMatchObject({
      runId: "recurring-pass-run",
      recurrence: {
        taskFamily: "add-cli-command",
        outcome: "pass",
        count: 2,
        threshold: 2,
        thresholdMet: true,
      },
      recommendedAction: "promote_playbook",
      classification: "promotion_candidate",
      reason: "playbook candidate is ready for manual promotion",
    });
  });
});
