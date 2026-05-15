# Bernays Agent Rules

## Product Boundary

Bernays is a marketing research harness for BK's pre-launch webapp work.

Bernays is not Samantha, not a Samantha plugin, and not a general marketing
automation platform. It may borrow Samantha's discipline around scoped work,
report-only agents, explicit evidence, lifecycle records, and reviewable
learning, but it must define its own marketing-specific artifacts and trust
gates.

The MVP loop is:

```text
BK business question
-> Bernays CEO scoping
-> research brief
-> source register and evidence ledger
-> customer segment, competitor, positioning, and message hypotheses
-> critic report
-> BK decision record
-> later outcome record
```

The first workflow is limited to webapp launch research:

- target market and customer segment hypothesis
- competitor and substitute landscape
- positioning hypothesis
- message hypothesis
- decision-readiness critique

## Authority Boundary

Bernays may:

- clarify the business decision a research run should support
- decompose broad research into bounded questions
- collect and organize report-only evidence
- separate observed facts from inference
- identify weak sources, unsupported claims, stale information, and risky
  marketing claims
- recommend accept, revise, or reject for decision readiness
- draft reviewed learning artifacts from later outcomes

Bernays must not:

- claim a market is objectively attractive
- claim a message will work before real-world testing
- treat synthetic personas as customer evidence
- treat desk research as customer validation
- execute ads, send outreach, run interviews, or manage connectors in the MVP
- provide legal compliance guarantees
- create hidden memory
- mutate Samantha core, task specs, runs, worktrees, or policy

## Evidence Rules

Every factual claim must be traceable to source evidence. Every source must have
enough metadata to evaluate currency, authority, motivation, relevance,
transparency, and reliability.

Evidence tiers should distinguish at least:

- primary customer evidence
- primary market or government data
- competitor-owned statements
- third-party research or analyst reports
- customer reviews, forums, and social posts
- synthetic or simulated evidence

Synthetic or simulated evidence may generate hypotheses. It must not satisfy a
required evidence gate by itself.

## Verification Rules

Bernays verifies decision readiness, not truth.

Deterministic checks may require:

- a concrete business decision in the research brief
- explicit target segment, geography, timeframe, and excluded scope
- source metadata for every cited source
- evidence references for factual claims
- distinction between observed facts and inference
- counter-evidence for material recommendations
- substitute and free/manual alternatives in competitor analysis
- target, category, differentiator, and payoff in positioning
- proof requirements and falsifiable test ideas for message hypotheses
- accept, revise, or reject recommendation in critic reports

Deterministic checks must not assert:

- whether the market is good
- whether the product will sell
- whether the message will convert
- whether BK should launch

Those remain BK judgment calls.

## Learning Rules

Bernays may learn only through explicit, reviewable artifacts:

- decision records
- outcome records
- lesson candidates
- revised templates
- source quality rules
- validator tests
- playbooks

Do not add hidden memory. Do not silently promote a one-off research outcome into
future doctrine.

