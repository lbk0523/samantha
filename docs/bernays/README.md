# Bernays Marketing Research Harness

Last updated: 2026-05-15

## Decision

Bernays starts as a separate marketing research harness concept under
`docs/bernays/`.

This folder is an incubation area inside the Samantha repo. It is not Samantha
core, not an executable package, and not the final Bernays repository. The goal
is to define the product boundary and operating doctrine before writing task
specs or implementation code.

## Purpose

Bernays helps BK decide whether a webapp launch direction is research-ready.

The MVP is limited to pre-launch research for:

- target market and customer segment hypotheses
- competitor and substitute landscape
- positioning hypotheses
- message hypotheses
- decision-readiness critique

Bernays should reduce vague marketing work into evidence-backed artifacts and a
clear decision point.

## Why This Exists

Samantha is a software development harness. Its strongest trust gate is
deterministic software verification.

Marketing work needs a different trust model. Bernays should verify:

- whether the business decision is clear
- whether claims are traceable to sources
- whether sources have enough metadata to evaluate
- whether evidence and inference are separated
- whether competitor and substitute analysis is complete enough
- whether positioning and messaging hypotheses are testable
- whether the remaining uncertainty is visible

Bernays should not pretend to verify:

- whether the market is good
- whether customers will buy
- whether the message will convert
- whether BK should launch

Those are business judgments informed by research, not deterministic outputs.

## MVP Flow

```text
BK business question
-> ResearchBrief
-> SourceRegister
-> EvidenceLedger
-> CustomerSegmentHypotheses
-> CompetitorLandscape
-> PositioningAndMessageHypotheses
-> CriticReport
-> DecisionRecord
```

Later outcome evidence can be recorded in `OutcomeRecord` artifacts and reviewed
into lessons.

## Initial Document Set

- `AGENTS.md`: agent and authority rules
- `NORTH_STAR.md`: product identity, success test, and ethical boundary
- `ARCHITECTURE.md`: artifact flow, task classes, and validation boundary

## External Principles To Preserve

Bernays v0 should preserve these external research principles:

- market research and competitive analysis should consider demand, market size,
  saturation, pricing, direct competitors, indirect competitors, and barriers
- go-to-market thinking should keep market definition, customer, distribution,
  positioning, messaging, and price visible even when the MVP focuses on
  positioning
- positioning should name target, category, differentiator, and payoff
- competitor analysis should include substitutes and free or manual alternatives
- customer development requires direct validation later; desk research does not
  prove demand
- objective marketing claims should have support before use
- source evaluation should consider currency, authority, motivation, accuracy,
  relevance, transparency, and lateral corroboration
- synthetic personas or AI simulations may generate hypotheses, but they are not
  customer evidence

## Non-Goals

Bernays v0 does not include:

- production code
- task specs
- worker dispatch
- ad execution
- customer interview execution
- external connectors
- dashboard UI
- campaign calendar management
- autonomous campaign optimization
- legal compliance guarantees
- Samantha core changes

