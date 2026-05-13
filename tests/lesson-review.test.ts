import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewLessonCandidate } from "../src/core/lesson-review";

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
      recommendedAction: "reject",
      proposedLesson: "Treat this candidate as stale unless the same failure recurs after the superseding run.",
      affectedLayer: "evidence",
      riskIfAdopted: "Promoting superseded evidence can add process for a problem that was already resolved.",
    });
  });
});
