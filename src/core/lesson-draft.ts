import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { summarizeWorkerRun, type RunOutcome } from "./ledger";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";
import type { WorkerRunLog } from "./run-log";

export interface LessonDraftInput {
  runLogPath: string;
  repoRoot?: string;
}

export interface LessonDraftWrite {
  path: string;
  runId: string;
}

interface LessonClassification {
  proposedLesson: string;
  affectedLayer: string;
  suggestedArtifactType: string;
  riskIfAdopted: string;
}

async function readRunLog(path: string): Promise<WorkerRunLog> {
  return JSON.parse(await readFile(path, "utf8")) as WorkerRunLog;
}

function lifecycleStorePath(runLogPath: string): string {
  return join(dirname(runLogPath), "run-lifecycle.jsonl");
}

function markdownCode(value: string): string {
  return `\`${value.replace(/`/g, "\\`")}\``;
}

function renderList(items: string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${markdownCode(item)}`).join("\n");
}

function renderVerification(log: WorkerRunLog): string {
  const results = log.result.evaluation?.verifyResults;
  if (!results) return "- not recorded";
  if (results.length === 0) {
    return log.task.verifyCommands.length === 0 ? "- no verify commands declared" : "- not run";
  }

  const passed = results.filter((result) => result.exitCode === 0).length;
  const failed = results.length - passed;
  return [
    `- ${passed} passed, ${failed} failed`,
    ...results.map((result) => {
      const status = result.exitCode === 0 ? "pass" : "fail";
      return `- ${markdownCode(result.command)} -> ${status} (${result.exitCode})`;
    }),
  ].join("\n");
}

function lifecycleState(record: RunLifecycleRecord | undefined): string {
  if (!record) return "not recorded";
  if (record.mergedAt && record.cleanedAt) return "merged and cleaned";
  if (record.cleanedAt) return "cleaned";
  if (record.mergedAt) return "merged";
  return "recorded";
}

function renderLifecycle(record: RunLifecycleRecord | undefined): string {
  const lines = [`- Lifecycle state: ${lifecycleState(record)}`];
  if (record?.mergedAt) lines.push(`- Merged at: ${record.mergedAt}`);
  if (record?.cleanedAt) lines.push(`- Cleaned at: ${record.cleanedAt}`);
  if (record?.updatedAt) lines.push(`- Lifecycle updated at: ${record.updatedAt}`);
  return lines.join("\n");
}

function classifyLesson(outcome: RunOutcome): LessonClassification {
  switch (outcome) {
    case "pass":
      return {
        proposedLesson: "Preserve this task shape as a candidate repeatable pattern only if it recurs.",
        affectedLayer: "playbook",
        suggestedArtifactType: "playbook",
        riskIfAdopted: "Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.",
      };
    case "setup_failed":
      return {
        proposedLesson: "Capture setup prerequisites in the task spec or playbook before dispatch.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Overfitting setup guidance can make simple tasks carry irrelevant prerequisites.",
      };
    case "scope_failed":
      return {
        proposedLesson: "Tighten task scope or policy coverage before dispatching similar work.",
        affectedLayer: "policy",
        suggestedArtifactType: "policy/test change",
        riskIfAdopted: "Over-tight policy can block valid future work unless the pattern is recurring.",
      };
    case "verify_failed":
      return {
        proposedLesson: "Add or adjust focused verification before dispatching similar tasks.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Overfitting to one verification failure can make future tasks slower without reducing real risk.",
      };
    case "missing_harness_result":
      return {
        proposedLesson: "Make HARNESS_RESULT requirements harder for workers to miss.",
        affectedLayer: "agent profile",
        suggestedArtifactType: "agent profile revision",
        riskIfAdopted: "Too much prompt ceremony can distract workers from the actual task contract.",
      };
    case "commit_failed":
      return {
        proposedLesson: "Keep worker output commit-ready before Samantha attempts the owned commit.",
        affectedLayer: "dispatch",
        suggestedArtifactType: "playbook",
        riskIfAdopted: "Adding broad commit handling can hide real repository hygiene problems.",
      };
    case "worker_failed":
      return {
        proposedLesson: "Narrow similar tasks so worker command failures leave actionable evidence.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Treating one worker failure as a template issue can obscure transient execution failures.",
      };
    case "rework":
    case "blocked":
      return {
        proposedLesson: "Clarify the task contract before dispatching similar work.",
        affectedLayer: "contract",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Premature contract changes can add process without removing ambiguity.",
      };
    case "failed":
      return {
        proposedLesson: "Review the run evidence before changing durable Samantha behavior.",
        affectedLayer: "evidence",
        suggestedArtifactType: "run summary",
        riskIfAdopted: "A generic failure can produce vague guidance that future tasks cannot enforce.",
      };
  }
}

function buildLessonMarkdown(input: {
  log: WorkerRunLog;
  runLogPath: string;
  lifecycle: RunLifecycleRecord | undefined;
}): string {
  const summary = summarizeWorkerRun({
    task: input.log.task,
    agent: input.log.agent,
    repoRoot: input.log.input.repoRoot,
    worktreesDir: input.log.input.worktreesDir,
    startedAt: input.log.startedAt,
    finishedAt: input.log.finishedAt,
    execution: input.log.result,
    runId: input.log.runId,
    logPath: input.runLogPath,
  });
  const classification = classifyLesson(summary.outcome);
  const changedFiles = [...(input.log.result.evaluation?.changedFiles ?? input.log.result.commit?.files ?? [])].sort();

  return `# Lesson Candidate: ${input.log.runId}

## Source
- Source run id: ${input.log.runId}
- Task id: ${input.log.task.id}
- Task title: ${input.log.task.title}
- Run log: ${input.runLogPath}

## Evidence
- Observed outcome: ${summary.outcome}
${summary.failureReason ? `- Failure reason: ${summary.failureReason}\n` : ""}
### Changed Files
${renderList(changedFiles)}

### Verification Summary
${renderVerification(input.log)}

### Lifecycle
${renderLifecycle(input.lifecycle)}

## Proposed Lesson
- Proposed lesson: ${classification.proposedLesson}
- Affected layer: ${classification.affectedLayer}
- Suggested artifact type: ${classification.suggestedArtifactType}
- Risk if adopted: ${classification.riskIfAdopted}
- Review note: Review manually before promotion. This candidate must not modify promoted artifacts by itself.
`;
}

export async function draftLessonFromRunLog(input: LessonDraftInput): Promise<LessonDraftWrite> {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot ?? ".");
  const log = await readRunLog(runLogPath);
  const lifecycle = await new RunLifecycleStore(lifecycleStorePath(runLogPath)).find(log.runId);
  const inboxDir = join(repoRoot, "references", "lessons", "inbox");
  const path = join(inboxDir, `${log.runId}.md`);

  await mkdir(inboxDir, { recursive: true });
  await writeFile(path, buildLessonMarkdown({ log, runLogPath, lifecycle }), "utf8");

  return { path, runId: log.runId };
}
