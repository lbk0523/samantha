export interface WorkerVerifyEvidence {
  ran: string[];
  skipped: string[];
  failed: string[];
  note: string;
}

export type WorkerVerifyEvidenceParseResult =
  | {
      status: "parsed";
      raw: string;
      evidence: WorkerVerifyEvidence;
    }
  | {
      status: "unparseable";
      raw: string;
      parseError: string;
    };

const EVIDENCE_PREFIX = "WORKER_VERIFY_EVIDENCE:";

export function parseWorkerVerifyEvidence(
  output: string,
): WorkerVerifyEvidenceParseResult | undefined {
  const searchable = [output, extractCodexJsonlAgentText(output)].filter(Boolean).join("\n");
  const raw = findWorkerVerifyEvidencePayload(searchable);
  if (raw === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "unparseable",
      raw,
      parseError: `invalid WORKER_VERIFY_EVIDENCE json: ${message}`,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      status: "unparseable",
      raw,
      parseError: "WORKER_VERIFY_EVIDENCE must be a JSON object",
    };
  }

  const result = parsed as Record<string, unknown>;
  const ran = stringArrayField(result.ran, "ran");
  if (typeof ran === "string") return { status: "unparseable", raw, parseError: ran };
  const skipped = stringArrayField(result.skipped, "skipped");
  if (typeof skipped === "string") return { status: "unparseable", raw, parseError: skipped };
  const failed = stringArrayField(result.failed, "failed");
  if (typeof failed === "string") return { status: "unparseable", raw, parseError: failed };
  if (result.note !== undefined && typeof result.note !== "string") {
    return {
      status: "unparseable",
      raw,
      parseError: "WORKER_VERIFY_EVIDENCE.note must be a string",
    };
  }

  return {
    status: "parsed",
    raw,
    evidence: {
      ran,
      skipped,
      failed,
      note: result.note ?? "",
    },
  };
}

function stringArrayField(value: unknown, name: string): string[] | string {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return `WORKER_VERIFY_EVIDENCE.${name} must be a string array`;
  }
  return value;
}

function findWorkerVerifyEvidencePayload(output: string): string | undefined {
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(EVIDENCE_PREFIX)) {
      return trimmed.slice(EVIDENCE_PREFIX.length).trim();
    }
  }
  return undefined;
}

function extractCodexJsonlAgentText(output: string): string {
  const texts: string[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line) as { item?: { type?: unknown; text?: unknown } };
      if (event.item?.type === "agent_message" && typeof event.item.text === "string") {
        texts.push(event.item.text);
      }
    } catch {
      // Codex output can include non-JSON diagnostics mixed with JSONL events.
    }
  }
  return texts.join("\n");
}
