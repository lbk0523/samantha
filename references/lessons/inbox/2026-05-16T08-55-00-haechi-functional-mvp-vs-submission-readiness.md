# Lesson Candidate: 2026-05-16T08-55-00-haechi-functional-mvp-vs-submission-readiness

## Source
- Source: codex / haechi MVP phase closeout session
- Target repo: /Users/byung/Documents/haechi
- Task id: haechi-functional-mvp-vs-submission-readiness
- Task title: Separate functional MVP closure from platform submission readiness
- Run log: not available; this candidate comes from an interactive Samantha
  phase-closeout request.

## Evidence
- Observed outcome: the core app flow reached functional MVP closure, but BK
  explicitly judged the UI/UX too toy-like for Toss submission.
- Failure risk: treating functional verification as submission readiness would
  prematurely push a product with weak visual credibility.

### Relevant Files
- `src/App.tsx`
- `src/App.css`
- `src/components/HaechiAvatar.tsx`
- `src/components/ReadingHaechiLoop.tsx`
- `public/characters/**`
- `docs/skills/apps-in-toss.md`
- `docs/skills/tds-mobile.md`

### Verification Summary
- `npm run lint` -> pass
- `npm run build:web` -> pass
- `npm run build` -> pass
- Local browser flow verified for functional behavior and reading animation.
- Visual submission readiness deliberately not accepted.

## Proposed Lesson
- Proposed lesson: For product MVP work, explicitly separate "functional MVP
  complete" from "platform submission ready." Passing tests, builds, and local
  browser smoke checks can close the functional phase while still requiring a
  dedicated visual/UX readiness phase.
- Affected layer: product planning / phase gate
- Suggested artifact type: initiative continuity brief or readiness checklist
- Risk if adopted: If applied too broadly, this can create unnecessary phase
  ceremony for small internal tools. Keep it scoped to consumer-facing,
  platform-submitted, or brand-sensitive products.
- Review note: Review manually before promotion. This candidate must not modify
  promoted artifacts by itself.

