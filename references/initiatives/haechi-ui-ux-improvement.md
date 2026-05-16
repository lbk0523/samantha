# Initiative: haechi UI/UX improvement after MVP

Status: active
Source: Samantha session on 2026-05-16 closing the functional MVP phase for
`/Users/byung/Documents/haechi`.
Last updated: 2026-05-16

## Goal

Bring the 관악해치보살 Apps in Toss WebView app from a functional MVP to a
submission-worthy mobile UI/UX. The next phase should make the app feel like a
coherent character-led product, not a toy project.

## Accepted Decisions

- The functional MVP phase is closed.
- The app is not ready to submit to Toss in its current visual state.
- The next session should start with UI/UX brainstorming, not immediate code.
- 해치 must remain the central product character and the primary visual anchor.
- Character PNG assets are now wired through `public/characters/`.
- Reading animation uses five PNG frames under `public/characters/reading/`.
- Reading frame duration is 300ms per frame.
- Reading screen duration is randomly selected from 1.5s, 1.8s, 2.1s, and 2.4s.
- The CSS cascade bug where a hidden fallback overlaid `haechi-home` was fixed
  and recorded as a lesson candidate.

## Non-Goals

- Do not submit to Toss before the UI/UX improvement phase is complete.
- Do not reopen the basic decision flow unless it blocks visual quality.
- Do not add backend/API work during the UI/UX brainstorming slice.
- Do not copy or closely imitate external character references.
- Do not treat passing build checks as enough visual readiness evidence.

## Invariants

- Follow `/Users/byung/Documents/haechi/AGENTS.md`.
- Consult `docs/skills/apps-in-toss.md` and `docs/skills/tds-mobile.md`.
- Keep changes surgical and scoped to the active slice.
- Verify rendered UI in a browser, not only with `npm run build`.
- For animation, fallback, overlay, and hidden-state bugs, check computed style,
  z-index/layering, and screenshot evidence.
- The initiative brief is reviewable state, not hidden memory.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Build functional MVP flow: home, three-step selection, reading screen, result, history, share, stamp. | none | `npm run lint`, `npm run build:web`, `npm run build`, local browser smoke checks. | n/a |
| S2 | completed | Replace temporary character placeholders with generated haechi assets and fix reading animation. | S1 | Real PNG asset load confirmed; reading frames `01` to `05` verified; fallback `display: none`; `npm run lint`, `npm run build:web`, `npm run build`. | n/a |
| S3 | ready | Brainstorm a submission-worthy UI/UX direction for the existing app, preserving the core flow but raising visual quality. | S2 | Brainstorm brief with accepted direction, rejected alternatives, open questions, and implementation-ready next prompt. | See Current Next Slice. |
| S4 | pending | Implement the accepted UI/UX direction in the app. | S3 | Browser screenshot review on mobile viewport, interaction flow, `npm run lint`, `npm run build:web`, `npm run build`. | pending S3 |
| S5 | pending | Final submission-readiness review against Apps in Toss/TDS mobile expectations. | S4 | Checklist-based review plus rendered browser evidence. | pending S4 |

## Current Next Slice

S3 is ready.

Start the next session with UI/UX brainstorming. The output should be a
decision-complete Brainstorm Brief before any implementation. The brainstorming
should focus on:

- why the current UI feels toy-like;
- what a Toss miniapp user should feel in the first 5 seconds;
- how the 해치 character should lead the visual system;
- which screen hierarchy, spacing, typography, and interaction patterns should
  change;
- what should stay from the functional MVP;
- what level of visual polish is required before Toss submission.

## End-of-Session Update Rule

Before ending any session that works on this initiative, update this file with:

- the slice status that changed;
- accepted/rejected UI decisions;
- verification evidence;
- any new blocker;
- the next ready slice and its prompt.

## Completion Rule

This initiative is complete when the app has:

- a character-led UI that no longer reads as a toy project;
- rendered mobile browser evidence for the full flow;
- `npm run lint`, `npm run build:web`, and `npm run build` passing;
- no known visual blockers before Toss submission review.

