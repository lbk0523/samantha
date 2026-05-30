import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { draftLessonFromAcceptedRun, type AcceptedRunLessonDraftStatus } from "./lesson-draft";
import { reviewLessonInbox, type LessonInboxReviewIndex, type LessonPromotionQueueEntry } from "./lesson-inbox-review";
import {
  autoPromoteLessonPlaybooks,
  isGitWorkTreeDirty,
  type LessonAutoPromotionReport,
} from "./lesson-promote";
import { RunIndex, type RunSummary } from "./ledger";

export interface DailyLessonReviewInput {
  repoRoot: string;
  date?: string;
  now?: Date;
}

export interface DailyLessonDraftResult {
  runId: string;
  status: AcceptedRunLessonDraftStatus;
  reason: string;
  path: string | null;
}

export interface DailyLessonReviewReport {
  schemaVersion: 1;
  targetDate: string;
  kstWindow: {
    start: string;
    end: string;
  };
  selectedRunCount: number;
  draftResults: DailyLessonDraftResult[];
  reviewIndexPath: string;
  summary: LessonInboxReviewIndex["summary"];
  promotionQueue: LessonPromotionQueueEntry[];
  autoPromotion: LessonAutoPromotionReport;
  reportPath: string;
}

interface KstDateWindow {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateParts(input: { year: number; month: number; day: number }): string {
  return `${input.year}-${pad2(input.month)}-${pad2(input.day)}`;
}

function parseTargetDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error("date must use YYYY-MM-DD");
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("date must be a valid YYYY-MM-DD calendar date");
  }
  return { year, month, day };
}

function dateFromUtcMs(ms: number): string {
  const date = new Date(ms);
  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function defaultPreviousKstDate(now: Date = new Date()): string {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const currentKstDayMs = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
  );
  return dateFromUtcMs(currentKstDayMs - DAY_MS);
}

export function kstDateWindow(targetDate: string): KstDateWindow {
  const parsed = parseTargetDate(targetDate);
  const startKstDayMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const endKstDayMs = startKstDayMs + DAY_MS;
  return {
    start: `${targetDate}T00:00:00+09:00`,
    end: `${dateFromUtcMs(endKstDayMs)}T00:00:00+09:00`,
    startMs: startKstDayMs - KST_OFFSET_MS,
    endMs: endKstDayMs - KST_OFFSET_MS,
  };
}

function runLogPath(repoRoot: string, summary: RunSummary): string {
  return isAbsolute(summary.logPath) ? summary.logPath : join(repoRoot, summary.logPath);
}

function selectedRuns(input: { summaries: RunSummary[]; window: KstDateWindow }): RunSummary[] {
  return input.summaries
    .filter((summary) => {
      const finishedAtMs = Date.parse(summary.finishedAt);
      return finishedAtMs >= input.window.startMs && finishedAtMs < input.window.endMs;
    })
    .sort(
      (left, right) =>
        Date.parse(left.finishedAt) - Date.parse(right.finishedAt) ||
        left.runId.localeCompare(right.runId),
    );
}

export async function runDailyLessonReview(
  input: DailyLessonReviewInput,
): Promise<DailyLessonReviewReport> {
  const repoRoot = resolve(input.repoRoot);
  const targetDate = input.date ?? defaultPreviousKstDate(input.now);
  const window = kstDateWindow(targetDate);
  const dirtyTreeBlocked = await isGitWorkTreeDirty(repoRoot);
  const summaries = await new RunIndex(join(repoRoot, "runs", "index.jsonl")).list();
  const runs = selectedRuns({ summaries, window });
  const draftResults: DailyLessonDraftResult[] = [];

  for (const summary of runs) {
    const draft = await draftLessonFromAcceptedRun({
      runLogPath: runLogPath(repoRoot, summary),
      repoRoot,
    });
    draftResults.push({
      runId: draft.runId ?? summary.runId,
      status: draft.status,
      reason: draft.reason,
      path: draft.path ?? null,
    });
  }

  const review = await reviewLessonInbox({ repoRoot });
  const autoPromotion = await autoPromoteLessonPlaybooks({
    repoRoot,
    candidates: review.index.candidates,
    dirtyTreeBlocked,
    targetDate,
  });
  const reportPath = join(repoRoot, "references", "lessons", "daily", `${targetDate}.json`);
  const report: DailyLessonReviewReport = {
    schemaVersion: 1,
    targetDate,
    kstWindow: {
      start: window.start,
      end: window.end,
    },
    selectedRunCount: runs.length,
    draftResults,
    reviewIndexPath: review.indexPath,
    summary: review.index.summary,
    promotionQueue: review.index.queue,
    autoPromotion,
    reportPath,
  };

  await mkdir(join(repoRoot, "references", "lessons", "daily"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}
