import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  SequentialContinuationActionType,
  SequentialContinuationArtifact,
  SequentialContinuationStatusEvidenceDocument,
} from "../src/core/sequential-ceo-autopilot";
import {
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
  SEQUENTIAL_CONTINUATION_SLICE_STATUSES,
  buildSequentialContinuationLoop,
  buildSequentialContinuationNextArtifactReport,
  buildSequentialContinuationSingleStep,
  buildSequentialContinuationStatusUpdate,
  buildSequentialContinuationReport,
  validateSequentialContinuationArtifact,
  validateSequentialContinuationStatusEvidence,
} from "../src/core/sequential-ceo-autopilot";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

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

async function writeNextArtifactFixture(
  overrides: {
    predecessor?: Partial<SequentialContinuationArtifact>;
    successor?: Partial<SequentialContinuationArtifact>;
    successorEvidencePath?: string;
  } = {},
): Promise<{
  root: string;
  predecessorPath: string;
  successorPath: string;
  predecessor: SequentialContinuationArtifact;
  successor: SequentialContinuationArtifact;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-"));
  tmpRoots.push(root);
  const operationsDir = join(root, "references", "operations");
  await mkdir(operationsDir, { recursive: true });
  const predecessorPath = join(operationsDir, "s9.json");
  const successorPath = join(operationsDir, "s10.json");
  const predecessor = artifact({
    artifactId: "sequential-ceo-autopilot-s9",
    currentSlice: {
      ...artifact().currentSlice,
      id: "S9",
      status: "completed",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S8 completed"],
    },
    nextArtifactPath: "references/operations/s10.json",
    nextArtifactExpectedSliceId: "S10",
    ...overrides.predecessor,
  });
  const successor = artifact({
    artifactId: "sequential-ceo-autopilot-s10",
    currentSlice: {
      ...artifact().currentSlice,
      id: "S10",
      status: "ready",
      actionType: "report_only",
      dependencyStatus: "met",
      prerequisites: ["S9 completed"],
    },
    evidenceReferences: [
      {
        path: overrides.successorEvidencePath ?? "references/operations/s9.json",
        summary: "S10 cites the predecessor continuation artifact.",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S10",
    },
    ...overrides.successor,
  });
  await writeFile(predecessorPath, `${JSON.stringify(predecessor, null, 2)}\n`, "utf8");
  await writeFile(successorPath, `${JSON.stringify(successor, null, 2)}\n`, "utf8");
  return { root, predecessorPath, successorPath, predecessor, successor };
}

function statusEvidence(
  overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
): SequentialContinuationStatusEvidenceDocument {
  return {
    schemaVersion: 1,
    currentSliceId: "S2",
    outcome: "completed",
    updatedAt: "2026-05-19T01:00:00.000Z",
    evidenceReferences: [
      {
        kind: "run_log",
        path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
        summary: "S2 worker run completed with passing deterministic verification.",
        result: "passed",
      },
    ],
    nextStep: {
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
    },
    ...overrides,
  };
}

describe("Sequential CEO Autopilot continuation artifact validation", () => {
  test("accepts a valid current-slice continuation artifact", () => {
    expect(validateSequentialContinuationArtifact(artifact())).toEqual([]);
  });

  test("accepts optional next artifact linkage fields in the closed schema", () => {
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          nextArtifactPath: "references/operations/sequential-ceo-autopilot-s10.json",
          nextArtifactExpectedSliceId: "S10",
        }),
      ),
    ).toEqual([]);
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          nextArtifactPath: null,
          nextArtifactExpectedSliceId: null,
        }),
      ),
    ).toEqual([]);
  });

  test("builds a deterministic accepted report for the current slice", () => {
    expect(
      buildSequentialContinuationReport({
        artifactPath: "/repo/references/continuation/s3.json",
        artifact: artifact({
          currentSlice: {
            ...artifact().currentSlice,
            id: "S3",
            status: "ready",
            actionType: "report_only",
          },
          nextStep: {
            kind: "samantha_command",
            value: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
          },
        }),
      }),
    ).toEqual({
      artifactPath: "/repo/references/continuation/s3.json",
      status: "accepted",
      violations: [],
      currentSlice: {
        id: "S3",
        status: "ready",
        actionType: "report_only",
        dependencyStatus: "met",
      },
      activeStopConditions: [],
      blockingReasons: [],
      allowedActionType: "report_only",
      exactNextSamanthaCommand: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
      blockedReportText: null,
      trustedStateChanges: false,
      pushPerformed: false,
    });
  });

  test("reports active stop conditions and blocked handoff text without rejecting valid structure", () => {
    const stopConditionChecklist = artifact().stopConditionChecklist.map((check) =>
      check.id === "decision_required"
        ? {
            ...check,
            active: true,
            evidence: "BK must choose the next product boundary.",
          }
        : check,
    );

    const report = buildSequentialContinuationReport({
      artifactPath: "/repo/references/continuation/blocked.json",
      artifact: artifact({
        currentSlice: {
          ...artifact().currentSlice,
          dependencyStatus: "blocked",
          actionType: "manual_decision",
        },
        stopConditionChecklist,
        nextStep: {
          kind: "blocked_report",
          value: "Blocked until BK chooses the next product boundary.",
        },
      }),
    });

    expect(report.status).toBe("accepted");
    expect(report.allowedActionType).toBe("manual_decision");
    expect(report.activeStopConditions).toEqual([
      {
        id: "decision_required",
        evidence: "BK must choose the next product boundary.",
      },
    ]);
    expect(report.blockedReportText).toBe("Blocked until BK chooses the next product boundary.");
    expect(report.blockingReasons).toEqual([
      "decision_required: BK must choose the next product boundary.",
      "currentSlice.dependencyStatus is blocked",
      "Blocked until BK chooses the next product boundary.",
    ]);
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
  });

  test("builds a rejected report without granting an allowed action type", () => {
    const report = buildSequentialContinuationReport({
      artifactPath: "/repo/references/continuation/unsafe.json",
      artifact: artifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
    });

    expect(report.status).toBe("rejected");
    expect(report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.allowedActionType).toBeNull();
    expect(report.blockingReasons).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(report.trustedStateChanges).toBe(false);
    expect(report.pushPerformed).toBe(false);
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

describe("Sequential CEO Autopilot next-artifact linkage report", () => {
  test("accepts a local repo-relative nextArtifactPath without executing the successor", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture();

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("accepted");
    expect(report.nextArtifactPath).toBe("references/operations/s10.json");
    expect(report.normalizedNextArtifactPath).toBe("references/operations/s10.json");
    expect(report.nextArtifactExpectedSliceId).toBe("S10");
    expect(report.successor).toMatchObject({
      artifactPath: "references/operations/s10.json",
      currentSliceId: "S10",
      initiativePath: "references/initiatives/sequential-ceo-autopilot.md",
      actionType: "report_only",
    });
    expect(report.blockingReasons).toEqual([]);
    expect(report.trustedStateChanges).toBe(false);
    expect(report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      pushPerformed: false,
    });
  });

  test("rejects prose, command strings, URLs, off-repo paths, traversal, env expansion, globs, and empty strings", () => {
    const cases: Array<{ value: string; reason: string }> = [
      {
        value: "Continue with S10 next",
        reason: "nextArtifactPath must be a normalized repo-relative local .json path: Continue with S10 next",
      },
      {
        value: "sam c: continue S10",
        reason: "nextArtifactPath must not be a command string: sam c: continue S10",
      },
      {
        value: "bun run samantha continuation:show",
        reason: "nextArtifactPath must not be a command string: bun run samantha continuation:show",
      },
      {
        value: "https://example.com/s10.json",
        reason: "nextArtifactPath must not be a URL: https://example.com/s10.json",
      },
      {
        value: "/tmp/s10.json",
        reason: "nextArtifactPath must be repo-relative and stay inside repoRoot: /tmp/s10.json",
      },
      {
        value: "../references/operations/s10.json",
        reason: "nextArtifactPath must be repo-relative and stay inside repoRoot: ../references/operations/s10.json",
      },
      {
        value: "$ROOT/references/operations/s10.json",
        reason: "nextArtifactPath must not use environment expansion: $ROOT/references/operations/s10.json",
      },
      {
        value: "references/operations/*.json",
        reason: "nextArtifactPath must not be glob-like: references/operations/*.json",
      },
      {
        value: "",
        reason: "nextArtifactPath must be a non-empty repo-relative .json path or null",
      },
    ];

    for (const { value, reason } of cases) {
      expect(validateSequentialContinuationArtifact(artifact({ nextArtifactPath: value }))).toContain(reason);
    }
  });

  test("blocks a present nextArtifactPath when the file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-missing-"));
    tmpRoots.push(root);
    const predecessor = artifact({
      nextArtifactPath: "references/operations/missing.json",
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: join(root, "references", "operations", "s9.json"),
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toEqual([
      `nextArtifactPath file not found: ${join(root, "references", "operations", "missing.json")}`,
    ]);
  });

  test("blocks non-string nextArtifactPath as an invalid predecessor before successor inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-malformed-"));
    tmpRoots.push(root);
    const predecessor = {
      ...artifact({
        nextArtifactExpectedSliceId: "S10",
      }),
      nextArtifactPath: ["references/operations/s10.json"],
    };

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: join(root, "references", "operations", "s9.json"),
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.nextArtifactPath).toBeNull();
    expect(report.nextArtifactExpectedSliceId).toBeNull();
    expect(report.successor).toBeNull();
    expect(report.blockingReasons).toEqual([
      "current artifact must validate before successor linkage is inspected",
      "nextArtifactPath must be a non-empty repo-relative .json path or null",
    ]);
  });

  test("blocks invalid predecessors with absent or null nextArtifactPath instead of reporting absent linkage", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-next-artifact-invalid-predecessor-"));
    tmpRoots.push(root);
    const invalidAutonomyEnvelope = {
      ...artifact().autonomyEnvelope,
      pushAllowed: true as false,
    };

    for (const predecessor of [
      artifact({
        autonomyEnvelope: invalidAutonomyEnvelope,
      }),
      artifact({
        autonomyEnvelope: invalidAutonomyEnvelope,
        nextArtifactPath: null,
      }),
    ]) {
      const report = await buildSequentialContinuationNextArtifactReport({
        repoRoot: root,
        artifactPath: join(root, "references", "operations", "s9.json"),
        artifact: predecessor,
      });

      expect(report.status).toBe("blocked");
      expect(report.nextArtifactPath).toBeNull();
      expect(report.successor).toBeNull();
      expect(report.blockingReasons).toContain("current artifact must validate before successor linkage is inspected");
      expect(report.blockingReasons).toContain("autonomyEnvelope.pushAllowed must be false");
    }
  });

  test("blocks successor initiative mismatches and expected slice id mismatches", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture({
      successor: {
        initiativePath: "references/initiatives/other.md",
        currentSlice: {
          ...artifact().currentSlice,
          id: "S11",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain(
      "successor initiativePath must match predecessor initiativePath: references/initiatives/other.md",
    );
    expect(report.blockingReasons).toContain(
      "successor currentSlice.id must match nextArtifactExpectedSliceId S10: S11",
    );
  });

  test("blocks artifact path and currentSlice.id cycles", async () => {
    const pathCycle = await writeNextArtifactFixture({
      predecessor: {
        nextArtifactPath: "references/operations/s9.json",
      },
    });
    const pathCycleReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: pathCycle.root,
      artifactPath: pathCycle.predecessorPath,
      artifact: pathCycle.predecessor,
    });

    expect(pathCycleReport.status).toBe("blocked");
    expect(pathCycleReport.blockingReasons).toContain(
      "nextArtifactPath creates artifact path cycle: references/operations/s9.json",
    );

    const sliceCycle = await writeNextArtifactFixture({
      successor: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S9",
          status: "ready",
          actionType: "report_only",
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });
    const sliceCycleReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: sliceCycle.root,
      artifactPath: sliceCycle.predecessorPath,
      artifact: sliceCycle.predecessor,
    });

    expect(sliceCycleReport.status).toBe("blocked");
    expect(sliceCycleReport.blockingReasons).toContain("successor currentSlice.id creates slice cycle: S9");
  });

  test("blocks stale successor evidence when references are missing or do not cite predecessor evidence", async () => {
    const missingEvidence = await writeNextArtifactFixture({
      successorEvidencePath: "references/reports/missing.json",
    });
    const missingEvidenceReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: missingEvidence.root,
      artifactPath: missingEvidence.predecessorPath,
      artifact: missingEvidence.predecessor,
    });

    expect(missingEvidenceReport.status).toBe("blocked");
    expect(missingEvidenceReport.blockingReasons).toContain(
      "successor evidence reference file is missing: references/reports/missing.json",
    );
    expect(missingEvidenceReport.blockingReasons).toContain(
      "successor evidenceReferences must cite predecessor artifact or evidence reference",
    );

    const noCitation = await writeNextArtifactFixture({
      successorEvidencePath: "references/reports/unrelated.json",
    });
    await mkdir(join(noCitation.root, "references", "reports"), { recursive: true });
    await writeFile(join(noCitation.root, "references", "reports", "unrelated.json"), "{}\n", "utf8");
    const noCitationReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: noCitation.root,
      artifactPath: noCitation.predecessorPath,
      artifact: noCitation.predecessor,
    });

    expect(noCitationReport.status).toBe("blocked");
    expect(noCitationReport.blockingReasons).toEqual([
      "successor evidenceReferences must cite predecessor artifact or evidence reference",
    ]);
  });

  test("blocks active stop conditions and push requirements in the successor", async () => {
    const activeStop = await writeNextArtifactFixture({
      successor: {
        stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
          check.id === "decision_required"
            ? {
                ...check,
                active: true,
                evidence: "BK must choose the next product boundary.",
              }
            : check,
        ),
      },
    });
    const activeStopReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: activeStop.root,
      artifactPath: activeStop.predecessorPath,
      artifact: activeStop.predecessor,
    });

    expect(activeStopReport.status).toBe("blocked");
    expect(activeStopReport.blockingReasons).toContain(
      "successor stop condition active: decision_required: BK must choose the next product boundary.",
    );

    const pushRequired = await writeNextArtifactFixture({
      successor: {
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      },
    });
    const pushRequiredReport = await buildSequentialContinuationNextArtifactReport({
      repoRoot: pushRequired.root,
      artifactPath: pushRequired.predecessorPath,
      artifact: pushRequired.predecessor,
    });

    expect(pushRequiredReport.status).toBe("blocked");
    expect(pushRequiredReport.blockingReasons).toContain(
      "successor artifact invalid: autonomyEnvelope.pushAllowed must be false",
    );
    expect(pushRequiredReport.blockingReasons).toContain("successor autonomyEnvelope.pushAllowed must be false");
  });

  test("blocks independently invalid successor artifacts", async () => {
    const { root, predecessorPath, predecessor } = await writeNextArtifactFixture({
      successor: {
        currentSlice: {
          ...artifact().currentSlice,
          id: "S10",
          status: "ready",
          actionType: "auto_dispatch" as SequentialContinuationActionType,
          dependencyStatus: "met",
          prerequisites: ["S9 completed"],
        },
      },
    });

    const report = await buildSequentialContinuationNextArtifactReport({
      repoRoot: root,
      artifactPath: predecessorPath,
      artifact: predecessor,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockingReasons).toContain(
      "successor artifact invalid: currentSlice.actionType must be manual_decision, report_only, readiness_check, run_task, or batch_plan: auto_dispatch",
    );
  });
});

describe("Sequential CEO Autopilot status update evidence", () => {
  test("accepts a completed update from cited trusted run-log evidence", () => {
    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence: statusEvidence(),
    });

    expect(result.report).toEqual({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      status: "accepted",
      violations: [],
      requestedOutcome: "completed",
      acceptedOutcome: "completed",
      currentSlice: {
        id: "S2",
        previousStatus: "ready",
        updatedStatus: "completed",
        actionType: "run_task",
        dependencyStatus: "met",
      },
      evidenceReferences: [
        {
          kind: "run_log",
          path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
          summary: "S2 worker run completed with passing deterministic verification.",
          result: "passed",
        },
      ],
      exactNextSamanthaCommand: "sam c: references/initiatives/sequential-ceo-autopilot.md S3",
      blockedReportText: null,
      artifactUpdated: true,
      trustedStateChanges: true,
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
      },
    });
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
    expect(result.updatedArtifact?.updatedAt).toBe("2026-05-19T01:00:00.000Z");
    expect(result.updatedArtifact?.evidenceReferences).toEqual(statusEvidence().evidenceReferences);
    expect(result.updatedArtifact?.autonomyEnvelope.pushAllowed).toBe(false);
  });

  test("accepts failed evidence as a blocked transition with cited failure evidence", () => {
    const evidence = statusEvidence({
      outcome: "failed",
      evidenceReferences: [
        {
          kind: "run_log",
          path: "runs/2026-05-19T01-00-00-000Z-sequential-ceo-autopilot-s2.json",
          summary: "Verification failed after the allowed worker run.",
          result: "failed",
        },
      ],
      nextStep: {
        kind: "blocked_report",
        value: "Blocked: verification failed; prepare a narrow rework report before continuing.",
      },
    });

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence,
    });

    expect(result.report.status).toBe("accepted");
    expect(result.report.requestedOutcome).toBe("failed");
    expect(result.report.acceptedOutcome).toBe("blocked");
    expect(result.report.currentSlice.updatedStatus).toBe("blocked");
    expect(result.report.blockedReportText).toBe(
      "Blocked: verification failed; prepare a narrow rework report before continuing.",
    );
    expect(result.updatedArtifact?.currentSlice.status).toBe("blocked");
    expect(result.updatedArtifact?.currentSlice.dependencyStatus).toBe("blocked");
    expect(result.updatedArtifact?.nextStep.kind).toBe("blocked_report");
    expect(validateSequentialContinuationArtifact(result.updatedArtifact)).toEqual([]);
  });

  test("rejects worker prose-only evidence instead of trusting stdout text", () => {
    const evidence = statusEvidence({
      evidenceReferences: [
        {
          kind: "worker_output_text_only" as SequentialContinuationStatusEvidenceDocument["evidenceReferences"][number]["kind"],
          path: "runs/worker-output.txt",
          summary: "Worker prose says HARNESS_RESULT pass.",
          result: "passed",
        },
      ],
    });

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence,
    });

    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain(
      "status evidence evidenceReferences[0].kind must be run_log, readiness_report, continuation_report, or report_review: worker_output_text_only",
    );
    expect(result.updatedArtifact).toBeNull();
  });

  test("rejects report-only recommendation evidence as trusted completion", () => {
    const reportOnlyArtifact = artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "report_only",
      },
    });
    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: reportOnlyArtifact,
      evidence: statusEvidence({
        evidenceReferences: [
          {
            kind: "report_review",
            path: "references/reports/recommendation.json",
            summary: "Reviewer recommends marking S2 complete but did not cite deterministic completion.",
            result: "recommendation_only",
          },
        ],
      }),
    });

    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain("report-only recommendation-only evidence cannot complete a slice");
    expect(result.report.violations).toContain("completed update requires trusted structured evidence for report_only");
    expect(result.updatedArtifact).toBeNull();
  });

  test("rejects missing citations and unknown status evidence fields", () => {
    expect(
      validateSequentialContinuationStatusEvidence({
        ...statusEvidence(),
        evidenceReferences: [],
      }),
    ).toContain("status evidence evidenceReferences must be a non-empty array");

    expect(
      validateSequentialContinuationStatusEvidence({
        ...statusEvidence(),
        markdownRoadmapText: "S2 is done.",
      }),
    ).toContain("unknown status evidence field: markdownRoadmapText");
  });

  test("preserves failed-as-blocked status vocabulary", () => {
    expect(SEQUENTIAL_CONTINUATION_SLICE_STATUSES as readonly string[]).not.toContain("failed");
    expect(
      validateSequentialContinuationArtifact(
        artifact({
          currentSlice: {
            ...artifact().currentSlice,
            status: "failed" as SequentialContinuationArtifact["currentSlice"]["status"],
          },
        }),
      ),
    ).toContain("currentSlice.status must be completed, active, ready, pending, blocked, or dropped: failed");

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath: "/repo/references/continuation/s2.json",
      evidencePath: "/repo/references/continuation/s2-evidence.json",
      artifact: artifact(),
      evidence: statusEvidence({
        outcome: "failed",
        evidenceReferences: [
          {
            kind: "run_log",
            path: "runs/failed.json",
            summary: "Run log records failed verification.",
            result: "failed",
          },
        ],
        nextStep: {
          kind: "blocked_report",
          value: "Blocked: failed verification must be handled as rework.",
        },
      }),
    });

    expect(result.report.status).toBe("accepted");
    expect(result.updatedArtifact?.currentSlice.status).toBe("blocked");
  });
});

describe("Sequential CEO Autopilot guarded single-step continuation", () => {
  function readinessArtifact(
    overrides: Partial<SequentialContinuationArtifact> = {},
  ): SequentialContinuationArtifact {
    return artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "readiness_check",
      },
      ...overrides,
    });
  }

  function readinessStatusEvidence(
    overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
  ): SequentialContinuationStatusEvidenceDocument {
    return statusEvidence({
      evidenceReferences: [
        {
          kind: "readiness_report",
          path: "inline:readiness:references/initiatives/sequential-ceo-autopilot.md",
          summary: "Readiness check returned clear for the current initiative.",
          result: "clear",
        },
      ],
      nextStep: {
        kind: "samantha_command",
        value: "sam c: references/initiatives/sequential-ceo-autopilot.md next single step",
      },
      ...overrides,
    });
  }

  test("executes one ready readiness_check and updates status through S4 evidence handling", async () => {
    let executorCalls = 0;

    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/s5.json",
      artifact: readinessArtifact(),
      executeAction: ({ actionType }) => {
        executorCalls += 1;
        expect(actionType).toBe("readiness_check");
        return {
          evidence: readinessStatusEvidence(),
          inlineEvidenceSummary: "Readiness check returned clear for the current initiative.",
        };
      },
    });

    expect(executorCalls).toBe(1);
    expect(result.report.status).toBe("accepted");
    expect(result.report.selectedActionType).toBe("readiness_check");
    expect(result.report.actionExecuted).toBe(true);
    expect(result.report.actionAttemptCount).toBe(1);
    expect(result.report.generatedEvidencePath).toBeNull();
    expect(result.report.inlineEvidenceSummary).toBe("Readiness check returned clear for the current initiative.");
    expect(result.report.statusUpdateReport?.status).toBe("accepted");
    expect(result.report.statusUpdateReport?.evidencePath).toBe(
      "inline:sequential-continuation:sequential-ceo-autopilot-s2:S2:readiness_check",
    );
    expect(result.report.continued).toBe(false);
    expect(result.report.multiStepLoopStarted).toBe(false);
    expect(result.report.pushPerformed).toBe(false);
    expect(result.report.sideEffects).toEqual({
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
      pushPerformed: false,
    });
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
    expect(result.updatedArtifact?.evidenceReferences).toEqual(readinessStatusEvidence().evidenceReferences);
  });

  test("blocks active stop conditions before calling the executor", async () => {
    let executorCalls = 0;
    const blockedArtifact = readinessArtifact({
      stopConditionChecklist: artifact().stopConditionChecklist.map((check) =>
        check.id === "decision_required"
          ? {
              ...check,
              active: true,
              evidence: "BK must choose the product boundary.",
            }
          : check,
      ),
    });

    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/blocked.json",
      artifact: blockedArtifact,
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "stop condition active: decision_required: BK must choose the product boundary.",
    );
    expect(result.report.actionExecuted).toBe(false);
    expect(result.report.actionAttemptCount).toBe(0);
    expect(result.updatedArtifact).toBeNull();
  });

  test("blocks unmet dependencies before calling the executor", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/dependency-blocked.json",
      artifact: readinessArtifact({
        currentSlice: {
          ...readinessArtifact().currentSlice,
          dependencyStatus: "blocked",
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "currentSlice.dependencyStatus must be met for single-step continuation",
    );
    expect(result.updatedArtifact).toBeNull();
  });

  test("stops manual_decision without executing an action", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/manual.json",
      artifact: artifact({
        currentSlice: {
          ...artifact().currentSlice,
          actionType: "manual_decision",
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.violations).toContain(
      "manual_decision requires BK input and cannot be executed by single-step continuation",
    );
    expect(result.report.actionExecuted).toBe(false);
  });

  test("blocks write-capable actions without reviewed explicit path support", async () => {
    for (const actionType of ["run_task", "batch_plan"] as const) {
      let executorCalls = 0;
      const result = await buildSequentialContinuationSingleStep({
        artifactPath: `/repo/references/continuation/${actionType}.json`,
        artifact: artifact({
          currentSlice: {
            ...artifact().currentSlice,
            actionType,
          },
        }),
        executeAction: () => {
          executorCalls += 1;
          return { evidence: readinessStatusEvidence() };
        },
      });

      expect(executorCalls).toBe(0);
      expect(result.report.status).toBe("blocked");
      expect(result.report.violations).toContain(
        `${actionType} is blocked until reviewed explicit taskSpecPath/batchSpecPath support exists`,
      );
      expect(result.report.sideEffects.workersDispatched).toBe(false);
      expect(result.updatedArtifact).toBeNull();
    }
  });

  test("rejects invalid artifacts without attempting execution", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/invalid.json",
      artifact: readinessArtifact({
        autonomyEnvelope: {
          ...artifact().autonomyEnvelope,
          pushAllowed: true as false,
        },
      }),
      executeAction: () => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidence() };
      },
    });

    expect(executorCalls).toBe(0);
    expect(result.report.status).toBe("rejected");
    expect(result.report.violations).toContain("autonomyEnvelope.pushAllowed must be false");
    expect(result.report.actionAttemptCount).toBe(0);
    expect(result.updatedArtifact).toBeNull();
  });

  test("does not execute a second slice after the first accepted action", async () => {
    let executorCalls = 0;
    const result = await buildSequentialContinuationSingleStep({
      artifactPath: "/repo/references/continuation/no-loop.json",
      artifact: readinessArtifact(),
      executeAction: () => {
        executorCalls += 1;
        return {
          evidence: readinessStatusEvidence({
            nextStep: {
              kind: "samantha_command",
              value: "sam c: references/initiatives/sequential-ceo-autopilot.md S6",
            },
          }),
          inlineEvidenceSummary: "Readiness check returned clear; S6 is only reported as the next command.",
        };
      },
    });

    expect(executorCalls).toBe(1);
    expect(result.report.actionAttemptCount).toBe(1);
    expect(result.report.continued).toBe(false);
    expect(result.report.multiStepLoopStarted).toBe(false);
    expect(result.report.nextStep).toEqual({
      kind: "samantha_command",
      value: "sam c: references/initiatives/sequential-ceo-autopilot.md S6",
    });
    expect(result.updatedArtifact?.currentSlice.id).toBe("S2");
    expect(result.updatedArtifact?.currentSlice.status).toBe("completed");
  });
});

describe("Sequential CEO Autopilot bounded continuation loop", () => {
  function readinessArtifact(
    overrides: Partial<SequentialContinuationArtifact> = {},
  ): SequentialContinuationArtifact {
    return artifact({
      currentSlice: {
        ...artifact().currentSlice,
        actionType: "readiness_check",
      },
      ...overrides,
    });
  }

  function loopReadinessArtifact(sliceId: string): SequentialContinuationArtifact {
    return readinessArtifact({
      artifactId: `sequential-ceo-autopilot-${sliceId.toLowerCase()}`,
      currentSlice: {
        id: sliceId,
        status: "ready",
        actionType: "readiness_check",
        dependencyStatus: "met",
        prerequisites: ["previous slice completed"],
      },
      nextStep: {
        kind: "samantha_command",
        value: `sam c: references/initiatives/sequential-ceo-autopilot.md ${sliceId}`,
      },
    });
  }

  function readinessStatusEvidenceFor(
    artifact: SequentialContinuationArtifact,
    overrides: Partial<SequentialContinuationStatusEvidenceDocument> = {},
  ): SequentialContinuationStatusEvidenceDocument {
    return statusEvidence({
      currentSliceId: artifact.currentSlice.id,
      evidenceReferences: [
        {
          kind: "readiness_report",
          path: `inline:readiness:${artifact.currentSlice.id}`,
          summary: `${artifact.currentSlice.id} readiness check returned clear.`,
          result: "clear",
        },
      ],
      nextStep: {
        kind: "samantha_command",
        value: `sam c: references/initiatives/sequential-ceo-autopilot.md after ${artifact.currentSlice.id}`,
      },
      ...overrides,
    });
  }

  test("continues across two successful readiness_check artifacts without side effects", async () => {
    const firstArtifact = loopReadinessArtifact("S6A");
    const secondArtifact = loopReadinessArtifact("S6B");
    let executorCalls = 0;
    const executedSlices: string[] = [];

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/s6a.json",
      artifact: firstArtifact,
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact, actionType }) => {
        executorCalls += 1;
        executedSlices.push(currentArtifact.currentSlice.id);
        expect(actionType).toBe("readiness_check");
        return {
          evidence: readinessStatusEvidenceFor(currentArtifact),
          inlineEvidenceSummary: `${currentArtifact.currentSlice.id} readiness check returned clear.`,
        };
      },
      selectNextArtifact: ({ updatedArtifact, stepCount, failedEvidenceReworkCyclesUsed }) => {
        expect(updatedArtifact.currentSlice.status).toBe("completed");
        expect(failedEvidenceReworkCyclesUsed).toBe(0);
        if (stepCount === 1) {
          return {
            artifactPath: "/repo/references/continuation/s6b.json",
            artifact: secondArtifact,
          };
        }
        return null;
      },
    });

    expect(executorCalls).toBe(2);
    expect(executorCalls).toBe(
      result.report.singleStepReports.filter((stepReport) => stepReport.status === "accepted").length,
    );
    expect(executedSlices).toEqual(["S6A", "S6B"]);
    expect(result.report).toMatchObject({
      artifactPath: "/repo/references/continuation/s6a.json",
      status: "accepted",
      violations: [],
      stepCount: 2,
      maxSteps: 3,
      stopReason: "no_deterministic_next_artifact",
      failedEvidenceReworkCyclesUsed: 0,
      failedEvidenceReworkCyclesRemaining: 1,
      continued: true,
      multiStepLoopStarted: true,
      pushPerformed: false,
      sideEffects: {
        runTaskCalled: false,
        batchesExecuteCalled: false,
        workersDispatched: false,
        runsCreated: false,
        worktreesCreated: false,
        pushPerformed: false,
      },
    });
    expect(result.report.singleStepReports).toHaveLength(2);
    expect(result.report.singleStepReports.map((stepReport) => stepReport.statusUpdateReport?.currentSlice.id)).toEqual([
      "S6A",
      "S6B",
    ]);
    expect(result.updatedArtifacts.map((entry) => entry.artifactPath)).toEqual([
      "/repo/references/continuation/s6a.json",
      "/repo/references/continuation/s6b.json",
    ]);
    expect(result.updatedArtifacts.every((entry) => entry.artifact.currentSlice.status === "completed")).toBe(true);
  });

  test("stops at maxSteps even when a deterministic next artifact is available", async () => {
    let executorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/max-a.json",
      artifact: loopReadinessArtifact("S6A"),
      maxSteps: 2,
      executeAction: ({ artifact: currentArtifact }) => {
        executorCalls += 1;
        return { evidence: readinessStatusEvidenceFor(currentArtifact) };
      },
      selectNextArtifact: ({ stepCount }) => ({
        artifactPath: `/repo/references/continuation/max-${stepCount + 1}.json`,
        artifact: loopReadinessArtifact(`S6${stepCount + 1}`),
      }),
    });

    expect(executorCalls).toBe(2);
    expect(result.report.status).toBe("accepted");
    expect(result.report.stepCount).toBe(2);
    expect(result.report.maxSteps).toBe(2);
    expect(result.report.stopReason).toBe("max_steps_reached");
    expect(result.report.continued).toBe(true);
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(0);
  });

  test("spends one failed-evidence rework cycle and stops on the next failed evidence", async () => {
    const firstFailure = loopReadinessArtifact("S6F1");
    const secondFailure = loopReadinessArtifact("S6F2");
    let executorCalls = 0;
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/failure-1.json",
      artifact: firstFailure,
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => {
        executorCalls += 1;
        return {
          evidence: readinessStatusEvidenceFor(currentArtifact, {
            outcome: "failed",
            evidenceReferences: [
              {
                kind: "readiness_report",
                path: `inline:readiness:${currentArtifact.currentSlice.id}`,
                summary: `${currentArtifact.currentSlice.id} readiness check failed verification.`,
                result: "failed",
              },
            ],
            nextStep: {
              kind: "blocked_report",
              value: `Blocked: ${currentArtifact.currentSlice.id} needs narrow rework evidence.`,
            },
          }),
        };
      },
      selectNextArtifact: ({ failedEvidenceReworkCyclesUsed }) => {
        selectorCalls += 1;
        expect(failedEvidenceReworkCyclesUsed).toBe(1);
        return {
          artifactPath: "/repo/references/continuation/failure-2.json",
          artifact: secondFailure,
        };
      },
    });

    expect(executorCalls).toBe(2);
    expect(selectorCalls).toBe(1);
    expect(result.report.status).toBe("blocked");
    expect(result.report.stepCount).toBe(2);
    expect(result.report.stopReason).toBe(
      "verification_rework_spent: failed evidence rework budget is already spent",
    );
    expect(result.report.violations).toEqual([
      "verification_rework_spent: failed evidence rework budget is already spent",
    ]);
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(1);
    expect(result.report.failedEvidenceReworkCyclesRemaining).toBe(0);
    expect(result.report.singleStepReports.map((stepReport) => stepReport.statusUpdateReport?.requestedOutcome)).toEqual([
      "failed",
      "failed",
    ]);
    expect(result.report.continued).toBe(true);
    expect(result.report.nextStep).toEqual({
      kind: "blocked_report",
      value: "Blocked: verification_rework_spent; failed evidence rework budget is already spent.",
    });
    expect(result.report.sideEffects.workersDispatched).toBe(false);
    expect(result.updatedArtifacts).toHaveLength(2);
  });

  test("stops when status evidence is rejected and does not select a next artifact", async () => {
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/rejected-evidence.json",
      artifact: loopReadinessArtifact("S6R"),
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => ({
        evidence: readinessStatusEvidenceFor(currentArtifact, {
          evidenceReferences: [],
        }),
      }),
      selectNextArtifact: () => {
        selectorCalls += 1;
        return {
          artifactPath: "/repo/references/continuation/should-not-run.json",
          artifact: loopReadinessArtifact("S6X"),
        };
      },
    });

    expect(selectorCalls).toBe(0);
    expect(result.report.status).toBe("rejected");
    expect(result.report.stepCount).toBe(1);
    expect(result.report.stopReason).toBe("status_evidence_rejected");
    expect(result.report.violations).toContain("status evidence evidenceReferences must be a non-empty array");
    expect(result.report.continued).toBe(false);
    expect(result.updatedArtifacts).toEqual([]);
  });

  test("stops when accepted status evidence blocks the current slice", async () => {
    let selectorCalls = 0;

    const result = await buildSequentialContinuationLoop({
      artifactPath: "/repo/references/continuation/blocked-evidence.json",
      artifact: loopReadinessArtifact("S6B"),
      maxSteps: 3,
      executeAction: ({ artifact: currentArtifact }) => ({
        evidence: readinessStatusEvidenceFor(currentArtifact, {
          outcome: "blocked",
          evidenceReferences: [
            {
              kind: "readiness_report",
              path: `inline:readiness:${currentArtifact.currentSlice.id}`,
              summary: `${currentArtifact.currentSlice.id} readiness check found a blocker.`,
              result: "blocked",
            },
          ],
          nextStep: {
            kind: "blocked_report",
            value: "Blocked: prerequisite evidence is not ready.",
          },
        }),
      }),
      selectNextArtifact: () => {
        selectorCalls += 1;
        return {
          artifactPath: "/repo/references/continuation/should-not-run.json",
          artifact: loopReadinessArtifact("S6X"),
        };
      },
    });

    expect(selectorCalls).toBe(0);
    expect(result.report.status).toBe("blocked");
    expect(result.report.stepCount).toBe(1);
    expect(result.report.stopReason).toBe("status_evidence_blocked: accepted evidence blocked the current slice");
    expect(result.report.failedEvidenceReworkCyclesUsed).toBe(0);
    expect(result.report.failedEvidenceReworkCyclesRemaining).toBe(1);
    expect(result.report.singleStepReports[0]?.statusUpdateReport?.acceptedOutcome).toBe("blocked");
    expect(result.updatedArtifacts).toHaveLength(1);
    expect(result.updatedArtifacts[0]?.artifact.currentSlice.dependencyStatus).toBe("blocked");
  });
});
