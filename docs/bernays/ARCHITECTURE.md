# Bernays Architecture

Last updated: 2026-05-15

## System Shape

Bernays is a thin marketing research harness around strong agent judgment and
deterministic decision-readiness checks.

```text
BK
-> Bernays CEO
-> ResearchBrief
-> report-only research and synthesis
-> SourceRegister
-> EvidenceLedger
-> CustomerSegmentHypotheses
-> CompetitorLandscape
-> PositioningAndMessageHypotheses
-> CriticReport
-> DecisionRecord
-> OutcomeRecord
```

The harness owns the artifact shapes, evidence routing, validation, lifecycle
state, and final decision surface. Agents may produce reports and drafts, but
they do not grant trust to their own output.

## Design Tension

Marketing research has weaker deterministic truth checks than software work.
Bernays should not pretend otherwise.

The rule is:

```text
Use deterministic checks for completeness, traceability, and decision readiness.
Use BK judgment and later outcomes for market truth.
```

The useful gate is not "is this strategy correct?" The useful gate is "is this
research good enough to support the named decision, and are its uncertainties
visible?"

## Task Classes

### Research Briefing

Defines the decision, audience, scope, excluded scope, source expectations,
confidence threshold, and stop condition.

This class should fail if the decision is vague or if the research question is
too broad to judge.

### Source Collection

Collects source metadata and assigns reliability context. This is report-only
unless the task is explicitly writing the source register artifact.

Source metadata should support evaluation of:

- currency
- authority
- motivation
- relevance
- transparency
- geography fit
- primary or secondary status

### Evidence Ledgering

Turns research into atomic claims with source references and counter-evidence.

The ledger must separate observed facts from inference. Unsupported factual
claims should fail validation.

### Synthesis

Produces customer segment, competitor, positioning, and message hypotheses.

Synthesis output is advisory. It is not market validation.

### Critique

Reviews the artifact set for unsupported claims, weak sources, overconfident
inference, stale evidence, risky advertising claims, and missing direct customer
validation.

Critique output must end in one of:

- `accept`
- `revise`
- `reject`

### Decision Record

Records BK's decision and rationale. The decision record may accept a report for
use while still listing unresolved risks.

### Outcome Record

Records later launch, campaign, interview, or experiment evidence. Outcome
records are the input for reviewed learning.

## Core Artifacts

### ResearchBrief

Required fields:

- business decision
- product description
- candidate segments
- geography and language
- timeframe
- excluded scope
- source requirements
- decision threshold
- stop condition

### SourceRegister

Required fields:

- source id
- title
- URL or local reference
- source type
- publish date or explicit unknown
- access date
- author or publisher
- incentive or bias note
- geography relevance
- primary or secondary classification
- reliability tier

### EvidenceLedger

Required fields:

- claim id
- atomic claim
- claim type
- observed fact or inference
- supporting source ids
- counter-evidence source ids where material
- confidence
- uncertainty note

### CustomerSegmentHypotheses

Required fields:

- segment
- job-to-be-done
- current workaround
- pain intensity assumption
- willingness-to-pay assumption
- reach channel assumption
- required direct validation

### CompetitorLandscape

Required fields:

- direct competitors
- indirect competitors
- substitute behaviors
- free or manual alternatives
- pricing or business model comparison
- saturation notes
- barriers

### PositioningAndMessageHypotheses

Required fields:

- target
- category
- differentiator
- payoff
- not-for segment
- message claim
- proof needed
- falsifiable test idea
- prohibited or unsupported claims

### CriticReport

Required fields:

- unsupported claims
- weak or stale sources
- overconfident inferences
- missing direct customer evidence
- risky advertising claims
- decision blockers
- accept, revise, or reject recommendation

## Validation Boundary

Bernays validators can reject artifacts for missing structure, unsupported
claims, missing source metadata, weak traceability, and incomplete critique.

Validators should warn when secondary research is coherent but direct customer
validation is still required.

Validators must not issue launch approval, legal approval, or campaign success
predictions.

## Non-Goals

Bernays v0 does not include:

- ad execution
- customer interview execution
- survey panel management
- CRM integration
- analytics connectors
- dashboards
- content calendars
- autonomous campaign optimization
- legal compliance certification
- hidden memory
- Samantha core integration

