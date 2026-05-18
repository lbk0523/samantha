import { describe, expect, test } from "bun:test";
import type { DriftReviewReport } from "../src/core/drift-review";
import { summarizeDriftReviewReport, validateDriftReviewReport } from "../src/core/drift-review";

function report(overrides: Partial<DriftReviewReport> = {}): DriftReviewReport {
  return {
    schemaVersion: 1,
    outcome: "possible_drift",
    driftCategory: "scope",
    citedEvidence: [
      {
        citation: "references/playbooks/drift-review.md",
        finding: "Drift Review output is advice-only and must cite whitelisted evidence.",
      },
    ],
    nextAction: {
      action: "Ask BK to decide whether to narrow the follow-up before dispatch.",
    },
    ...overrides,
  };
}

describe("Drift Review schema support", () => {
  test("accepts a valid structured report and summarizes it as advice-only evidence", () => {
    const validReport = report();

    expect(validateDriftReviewReport(validReport)).toEqual([]);
    expect(summarizeDriftReviewReport(validReport)).toEqual({
      schemaVersion: 1,
      status: "accepted",
      reviewerAuthority: "advice-only",
      trustedStateChanges: false,
      outcome: "possible_drift",
      driftCategory: "scope",
      citedEvidenceCount: 1,
      nextAction: {
        action: "Ask BK to decide whether to narrow the follow-up before dispatch.",
      },
      violations: [],
    });
  });

  test("rejects raw reviewer text instead of parsing uncited transcript content", () => {
    expect(validateDriftReviewReport("Outcome: no_drift\nNext action: accept run")).toEqual([
      "drift review report must be an object",
    ]);
  });

  test("rejects invalid outcome and drift category values", () => {
    const violations = validateDriftReviewReport(
      report({
        outcome: "clean" as DriftReviewReport["outcome"],
        driftCategory: "runtime" as DriftReviewReport["driftCategory"],
      }),
    );

    expect(violations).toContain("outcome must be no_drift, possible_drift, confirmed_drift, or blocked: clean");
    expect(violations).toContain(
      "driftCategory must be scope, authority, lifecycle, evidence, verification, product_boundary, or none: runtime",
    );
  });

  test("rejects unknown top-level fields that imply authority or lifecycle state", () => {
    for (const field of ["trustedStateChanges", "reviewerAuthority", "commit", "lifecycle", "createdTask", "metadata"]) {
      expect(
        validateDriftReviewReport({
          ...report(),
          [field]: field === "trustedStateChanges" ? true : {},
        }),
      ).toContain(`unknown top-level field: ${field}`);
    }
  });

  test("rejects unknown cited evidence fields instead of trusting richer citation metadata", () => {
    for (const field of ["source", "url", "confidence", "metadata"]) {
      expect(
        validateDriftReviewReport({
          ...report(),
          citedEvidence: [
            {
              citation: "references/playbooks/drift-review.md",
              finding: "Drift Review output is advice-only and must cite whitelisted evidence.",
              [field]: field === "confidence" ? 0.99 : "not part of the schema",
            },
          ],
        }),
      ).toContain(`unknown citedEvidence[0] field: ${field}`);
    }
  });

  test("rejects unknown nextAction fields instead of accepting redesigned actions or dispatch metadata", () => {
    for (const field of ["kind", "summary", "dispatch", "lifecycle"]) {
      expect(
        validateDriftReviewReport({
          ...report(),
          nextAction: {
            action: "Ask BK to decide whether to narrow the follow-up before dispatch.",
            [field]: "not part of the schema",
          },
        }),
      ).toContain(`unknown nextAction field: ${field}`);
    }
  });

  test("requires no_drift reports to use category none", () => {
    expect(
      validateDriftReviewReport(
        report({
          outcome: "no_drift",
          driftCategory: "scope",
        }),
      ),
    ).toContain("driftCategory must be none when outcome is no_drift");
  });

  test("rejects category none for drift and blocked outcomes", () => {
    for (const outcome of ["possible_drift", "confirmed_drift", "blocked"] as const) {
      expect(
        validateDriftReviewReport(
          report({
            outcome,
            driftCategory: "none",
          }),
        ),
      ).toContain("driftCategory must not be none unless outcome is no_drift");
    }
  });

  test("requires at least one cited evidence item with citation and finding", () => {
    expect(validateDriftReviewReport(report({ citedEvidence: [] }))).toContain(
      "citedEvidence must be a non-empty array",
    );

    expect(
      validateDriftReviewReport(
        report({
          citedEvidence: [
            {
              citation: " ",
              finding: "",
            },
          ],
        }),
      ),
    ).toEqual([
      "citedEvidence[0].citation must be a non-empty string",
      "citedEvidence[0].finding must be a non-empty string",
    ]);
  });

  test("requires exactly one structured nextAction", () => {
    const missingNextAction = report() as unknown as Record<string, unknown>;
    delete missingNextAction.nextAction;

    expect(validateDriftReviewReport(missingNextAction)).toContain("nextAction must be an object");

    expect(
      validateDriftReviewReport({
        ...report(),
        nextActions: [{ action: "Ask BK for a decision." }],
      }),
    ).toContain("nextActions must be absent; use exactly one nextAction");

    expect(
      validateDriftReviewReport({
        ...report(),
        nextAction: [{ action: "Ask BK for a decision." }],
      }),
    ).toContain("nextAction must be an object");
  });

  test("rejects next actions that appear to authorize lifecycle changes", () => {
    for (const action of [
      "accept run after this review",
      "merge the branch",
      "cleanup the worktree",
      "push the branch",
      "mutate lifecycle state",
      "create task for the follow-up",
    ]) {
      expect(validateDriftReviewReport(report({ nextAction: { action } }))).toContain(
        `nextAction.action must remain advice-only and must not authorize lifecycle action: ${action}`,
      );
    }
  });

  test("summarizes invalid input without creating trusted state changes", () => {
    expect(summarizeDriftReviewReport(report({ outcome: "clean" as DriftReviewReport["outcome"] }))).toMatchObject({
      status: "rejected",
      reviewerAuthority: "advice-only",
      trustedStateChanges: false,
      outcome: null,
      violations: ["outcome must be no_drift, possible_drift, confirmed_drift, or blocked: clean"],
    });
  });

  test("summarizes invalid closed-schema input without creating trusted state changes", () => {
    expect(
      summarizeDriftReviewReport({
        ...report(),
        trustedStateChanges: true,
      }),
    ).toMatchObject({
      status: "rejected",
      reviewerAuthority: "advice-only",
      trustedStateChanges: false,
      violations: ["unknown top-level field: trustedStateChanges"],
    });
  });
});
