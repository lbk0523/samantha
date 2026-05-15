import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewLessonInbox } from "../src/core/lesson-inbox-review";

let tmpRoots: string[] = [];

async function writeCandidate(root: string, name: string, markdown: string): Promise<string> {
  const inboxPath = join(root, "references", "lessons", "inbox");
  const path = join(inboxPath, name);
  await mkdir(inboxPath, { recursive: true });
  await writeFile(path, markdown, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("lesson inbox review", () => {
  test("records review artifacts and writes an inbox index without promotion", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-inbox-review-"));
    tmpRoots.push(root);
    const stalePath = await writeCandidate(
      root,
      "stale-run.md",
      `# Lesson Candidate: stale-run

## Source
- Source run id: stale-run
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/stale-run.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: fresh-run

### Recurrence
- Task family: inspect-only
- Recurrence outcome: stale evidence
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
    );
    const playbookPath = await writeCandidate(
      root,
      "playbook-run.md",
      `# Lesson Candidate: playbook-run

## Source
- Source run id: playbook-run
- Task id: add-cli-command
- Task title: Add CLI command
- Run log: /repo/runs/playbook-run.json

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
    const promotionCandidatePath = await writeCandidate(
      root,
      "promotion-candidate-run.md",
      `# Lesson Candidate: promotion-candidate-run

## Source
- Source run id: promotion-candidate-run
- Task id: repeated-cli-command
- Task title: Repeated CLI command
- Run log: /repo/runs/promotion-candidate-run.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: repeated-cli-command
- Recurrence outcome: pass
- Recurrence count: 2
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Promote the repeated CLI command pattern.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promotion still requires manual review.
`,
    );

    const result = await reviewLessonInbox({ repoRoot: root });
    const indexPath = join(root, "references", "lessons", "reviews", "index.json");
    const staleReviewPath = join(root, "references", "lessons", "reviews", "stale-run.json");
    const playbookReviewPath = join(root, "references", "lessons", "reviews", "playbook-run.json");
    const promotionCandidateReviewPath = join(
      root,
      "references",
      "lessons",
      "reviews",
      "promotion-candidate-run.json",
    );
    const staleCandidate = "references/lessons/inbox/stale-run.md";
    const playbookCandidate = "references/lessons/inbox/playbook-run.md";
    const promotionCandidate = "references/lessons/inbox/promotion-candidate-run.md";
    const staleReview = "references/lessons/reviews/stale-run.json";
    const playbookReview = "references/lessons/reviews/playbook-run.json";
    const promotionCandidateReview = "references/lessons/reviews/promotion-candidate-run.json";

    expect(result.indexPath).toBe(indexPath);
    expect(result.index.schemaVersion).toBe(1);
    expect(result.index.inboxPath).toBe("references/lessons/inbox");
    expect(result.index.reviewsPath).toBe("references/lessons/reviews");
    expect(result.index.summary).toEqual({
      total: 3,
      autoRejected: 1,
      needsMoreEvidence: 1,
      promotionCandidates: 1,
      manualReview: 0,
    });
    expect(result.index.candidates).toEqual([
      {
        candidatePath: playbookCandidate,
        reviewPath: playbookReview,
        runId: "playbook-run",
        taskId: "add-cli-command",
        suggestedArtifactType: "playbook",
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
      },
      {
        candidatePath: promotionCandidate,
        reviewPath: promotionCandidateReview,
        runId: "promotion-candidate-run",
        taskId: "repeated-cli-command",
        suggestedArtifactType: "playbook",
        recurrence: {
          taskFamily: "repeated-cli-command",
          outcome: "pass",
          count: 2,
          threshold: 2,
          thresholdMet: true,
        },
        recommendedAction: "promote_playbook",
        classification: "promotion_candidate",
        reason: "playbook candidate is ready for manual promotion",
      },
      {
        candidatePath: staleCandidate,
        reviewPath: staleReview,
        runId: "stale-run",
        taskId: "inspect-only",
        suggestedArtifactType: "run summary / no promotion",
        recurrence: {
          taskFamily: "inspect-only",
          outcome: "stale evidence",
          count: 1,
          threshold: 2,
          thresholdMet: false,
        },
        recommendedAction: "reject",
        classification: "auto_rejected",
        reason: "superseded: superseded by accepted and cleaned run; suggested artifact type marks no promotion",
      },
    ]);
    expect(JSON.parse(await readFile(indexPath, "utf8"))).toEqual(result.index);
    expect(JSON.parse(await readFile(staleReviewPath, "utf8"))).toMatchObject({
      candidatePath: staleCandidate,
      classification: "auto_rejected",
      recommendedAction: "reject",
    });
    expect(JSON.parse(await readFile(playbookReviewPath, "utf8"))).toMatchObject({
      candidatePath: playbookCandidate,
      classification: "needs_more_evidence",
      recommendedAction: "manual_review",
    });
    expect(JSON.parse(await readFile(promotionCandidateReviewPath, "utf8"))).toMatchObject({
      candidatePath: promotionCandidate,
      classification: "promotion_candidate",
      recommendedAction: "promote_playbook",
    });
  });
});
