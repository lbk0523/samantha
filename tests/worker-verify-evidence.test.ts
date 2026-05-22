import { describe, expect, test } from "bun:test";
import { parseWorkerVerifyEvidence } from "../src/core/worker-verify-evidence";

describe("worker verify evidence", () => {
  test("parses advisory verification evidence from plain worker output", () => {
    const result = parseWorkerVerifyEvidence(
      [
        "ran focused checks",
        'WORKER_VERIFY_EVIDENCE: {"ran":["bun test tests/worker-verify-evidence.test.ts"],"skipped":["full suite not needed for parser unit"],"failed":[],"note":"focused parser check"}',
        'HARNESS_RESULT: {"status":"pass","note":"ok"}',
      ].join("\n"),
    );

    expect(result).toEqual({
      status: "parsed",
      raw: '{"ran":["bun test tests/worker-verify-evidence.test.ts"],"skipped":["full suite not needed for parser unit"],"failed":[],"note":"focused parser check"}',
      evidence: {
        ran: ["bun test tests/worker-verify-evidence.test.ts"],
        skipped: ["full suite not needed for parser unit"],
        failed: [],
        note: "focused parser check",
      },
    });
  });

  test("parses advisory verification evidence from Codex JSONL agent messages", () => {
    const result = parseWorkerVerifyEvidence(
      JSON.stringify({
        item: {
          type: "agent_message",
          text: [
            "Done",
            'WORKER_VERIFY_EVIDENCE: {"ran":["bun test"],"skipped":[],"failed":[],"note":"jsonl"}',
            'HARNESS_RESULT: {"status":"pass","note":"ok"}',
          ].join("\n"),
        },
      }),
    );

    expect(result).toEqual({
      status: "parsed",
      raw: '{"ran":["bun test"],"skipped":[],"failed":[],"note":"jsonl"}',
      evidence: {
        ran: ["bun test"],
        skipped: [],
        failed: [],
        note: "jsonl",
      },
    });
  });

  test("returns undefined when advisory verification evidence is missing", () => {
    expect(parseWorkerVerifyEvidence('HARNESS_RESULT: {"status":"pass","note":"ok"}')).toBeUndefined();
  });

  test("records malformed advisory verification evidence as unparseable", () => {
    const result = parseWorkerVerifyEvidence(
      [
        'WORKER_VERIFY_EVIDENCE: {"ran":"bun test","skipped":[],"failed":[],"note":"bad shape"}',
        'HARNESS_RESULT: {"status":"pass","note":"ok"}',
      ].join("\n"),
    );

    expect(result).toEqual({
      status: "unparseable",
      raw: '{"ran":"bun test","skipped":[],"failed":[],"note":"bad shape"}',
      parseError: "WORKER_VERIFY_EVIDENCE.ran must be a string array",
    });
  });
});
