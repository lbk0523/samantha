# Lesson Candidate: 2026-05-16T08-39-19-haechi-reading-animation-css-cascade

## Source
- Source: codex / haechi reading animation debug session
- Target repo: /Users/byung/Documents/haechi
- Task id: haechi-reading-animation-css-cascade
- Task title: Fix reading animation hidden fallback overlay
- Run log: not available; this candidate comes from an interactive Samantha learn request after local browser debugging.

## Evidence
- Observed outcome: initial verification was misleading, then corrected after BK reported the visible failure persisted.
- Failure reason: DOM state and image `src` sampling showed reading frames changing, but visual output still appeared as `haechi-home` because fallback rendering was controlled by CSS cascade, not by React state alone.

### Changed Files
- `src/components/ReadingHaechiLoop.tsx`
- `src/App.css`

### Verification Summary
- `npm run lint` -> pass
- `npm run build:web` -> pass
- `npm run build` -> pass
- Browser check after fix: `.readingHaechiLoop__image` changed through `haechi-reading-01.png` to `haechi-reading-05.png`
- Browser check after fix: `.readingHaechiLoop__fallback` computed `display` was `none`

### Key Debug Evidence
- Before the final fix, the fallback element had `readingHaechiLoop__fallback--hidden` in `className`.
- Despite the hidden class, `getComputedStyle(fallback).display` returned `grid`.
- The later `.readingHaechiLoop__fallback { display: grid; }` rule overrode the earlier hidden rule with equal specificity.
- The fallback contained `HaechiAvatar variant="home"`, so the visible failure looked like `haechi-home` repeating even while the reading image `src` changed.

## Proposed Lesson
- Proposed lesson: For rendered UI bugs involving hidden fallback layers, do not accept DOM class or `src` evidence alone. Verify computed style, z-index/layering, and a screenshot or pixel-visible evidence before claiming the visual bug is fixed.
- Affected layer: frontend debugging playbook / verification checklist
- Suggested artifact type: playbook update
- Risk if adopted: If over-applied, this can make simple static UI checks too slow. Keep it scoped to animation, fallback, overlay, hidden-state, and CSS cascade bugs.
- Review note: Review manually before promotion. This candidate must not modify promoted artifacts by itself.

