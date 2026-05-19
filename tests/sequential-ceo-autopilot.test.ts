import { describe, expect, test } from "bun:test";
import type {
  SequentialContinuationActionType,
  SequentialContinuationArtifact,
} from "../src/core/sequential-ceo-autopilot";
import {
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
  validateSequentialContinuationArtifact,
} from "../src/core/sequential-ceo-autopilot";

function artifact(overrides: Partial<SequentialContinuationArtifact> = {}): SequentialContinuationArtifact {
  return {
    schemaVersion: 1,
    artifactId: "sequential-ceo-autopilot-s2",
    initiativePath: "references/initiatives/sequential-ceo-autopilot.md",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    currentSlice: {
      id: "S2",
      status: "ready",
      actionType: "run_task",
      dependencyStatus: "met",
      prerequisites: ["S1 completed"],
      targetFiles: ["src/core/sequential-ceo-autopilot.ts", "tests/sequential-ceo-autopilot.test.ts"],
      forbiddenChanges: ["src/cli.ts", "src/core/policy.ts", "references/playbooks/**"],
      verifyCommands: ["bun test tests/sequential-ceo-autopilot.test.ts", "bun run typecheck"],
    },
    autonomyEnvelope: {
      canSelectNextReadySlice: true,
      canRunReadinessChecks: true,
      canRunReportOnlyActions: true,
      canRunExplicitTaskSpecs: true,
      canRunRoutineBatchActions: true,
      canUpdateContinuationStatus: true,
      canLocallyCommitThroughExistingGates: true,
      pushAllowed: false,
      maxFailedEvidenceReworkCycles: 1,
    },
    stopConditionChecklist: SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS.map((id) => ({
      id,
      active: false,
      evidence: `${id} checked`,
    })),
    evidenceReferences: [
      {
        path: "references/playbooks/sequential-ceo-autopilot.md",
        summary: "Defines the continuation artifact contract and conservative action vocabulary.",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S2",
    },
    ...overrides,
  };
}

describe("Sequential CEO Autopilot continuation artifact validation", () => {
  test("accepts a valid current-slice continuation artifact", () => {
    expect(validateSequentialContinuationArtifact(artifact())).toEqual([]);
  });

  test("rejects raw prose instead of inferring continuation authority", () => {
    expect(validateSequentialContinuationArtifact("S2 is ready; continue automatically")).toEqual([
      "sequential continuation artifact must be an object",
    ]);
  });

  test("rejects unsafe action types outside the conservative vocabulary", () => {
    const violations = validateSequentialContinuationArtifact(
      artifact({
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "auto_continue" as SequentialContinuationActionType,
        },
      }),
    );

    expect(violations).toContain(
      "currentSlice.actionType must be manual_decision, report_only, readiness_check, run_task, or batch_plan: auto_continue",
    );
  });

  test("requires a non-empty stop-condition checklist", () => {
    expect(validateSequentialContinuationArtifact(artifact({ stopConditionChecklist: [] }))).toContain(
      "stopConditionChecklist must be a non-empty array",
    );

    const missingChecklist = artifact() as unknown as Record<string, unknown>;
    delete missingChecklist.stopConditionChecklist;

    expect(validateSequentialContinuationArtifact(missingChecklist)).toContain(
      "stopConditionChecklist must be a non-empty array",
    );
  });

  test("requires the closed stop-condition checklist ids", () => {
    const missingDecision = artifact().stopConditionChecklist.filter((check) => check.id !== "decision_required");

    expect(validateSequentialContinuationArtifact(artifact({ stopConditionChecklist: missingDecision }))).toContain(
      "stopConditionChecklist must include decision_required",
    );
  });

  test("rejects push authority and changed failed-evidence rework cycles", () => {
    const violations = validateSequentialContinuationArtifact(
      artifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
          maxFailedEvidenceReworkCycles: 2 as 1,
        },
      }),
    );

    expect(violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(violations).toContain("autonomyEnvelope.maxFailedEvidenceReworkCycles must be 1");
  });

  test("rejects hidden-memory and secret-like fields", () => {
    for (const field of ["hiddenMemory", "secretToken", "apiKey", "credentials"]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          [field]: "not allowed",
        }),
      ).toContain(`${field} field is not allowed in a sequential continuation artifact`);
    }
  });

  test("rejects daemon, watch, remote, dashboard, and routine trigger fields", () => {
    for (const field of ["daemon", "watchMode", "remoteAdapter", "dashboard", "routineTrigger"]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          nextStep: {
            ...artifact().nextStep,
            [field]: "not allowed",
          },
        }),
      ).toContain(`nextStep.${field} field is not allowed in a sequential continuation artifact`);
    }
  });

  test("rejects unknown top-level and nested fields", () => {
    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        lifecycle: {},
      }),
    ).toContain("unknown top-level field: lifecycle");

    expect(
      validateSequentialContinuationArtifact({
        ...artifact(),
        currentSlice: {
          ...artifact().currentSlice,
          dispatchWorker: true,
        },
      }),
    ).toContain("unknown currentSlice field: dispatchWorker");
  });

  test("rejects lifecycle-authorizing wording in artifact strings", () => {
    for (const value of [
      "accept run after verification",
      "merge the branch",
      "cleanup worktree",
      "commit the result",
      "push upstream",
      "mutate lifecycle state",
      "create task for S3",
      "dispatch worker now",
      "automatic continuation may proceed",
    ]) {
      expect(
        validateSequentialContinuationArtifact({
          ...artifact(),
          nextStep: {
            kind: "samantha_command",
            value,
          },
        }),
      ).toContain(`nextStep.value must not authorize lifecycle action: ${value}`);
    }
  });

  test("requires write-capable actions to declare target files, forbidden changes, and verify commands", () => {
    for (const actionType of ["run_task", "batch_plan"] as const) {
      const currentSlice = artifact().currentSlice as unknown as Record<string, unknown>;
      currentSlice.actionType = actionType;
      delete currentSlice.targetFiles;
      delete currentSlice.forbiddenChanges;
      delete currentSlice.verifyCommands;

      const violations = validateSequentialContinuationArtifact(
        artifact({
          currentSlice: currentSlice as unknown as SequentialContinuationArtifact["currentSlice"],
        }),
      );

      expect(violations).toContain(`currentSlice.targetFiles must be a non-empty string array for ${actionType}`);
      expect(violations).toContain(`currentSlice.forbiddenChanges must be a non-empty string array for ${actionType}`);
      expect(violations).toContain(`currentSlice.verifyCommands must be a non-empty string array for ${actionType}`);
    }
  });

  test("allows non-write action types without write-scope fields", () => {
    for (const actionType of ["manual_decision", "report_only", "readiness_check"] as const) {
      const currentSlice = artifact().currentSlice as unknown as Record<string, unknown>;
      currentSlice.actionType = actionType;
      delete currentSlice.targetFiles;
      delete currentSlice.forbiddenChanges;
      delete currentSlice.verifyCommands;

      expect(
        validateSequentialContinuationArtifact(
          artifact({
            currentSlice: currentSlice as unknown as SequentialContinuationArtifact["currentSlice"],
          }),
        ),
      ).toEqual([]);
    }
  });
});
