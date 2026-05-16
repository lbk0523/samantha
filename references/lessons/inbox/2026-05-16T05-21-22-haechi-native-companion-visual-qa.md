# Lesson Candidate: 2026-05-16T05-21-22-haechi-native-companion-visual-qa

## Source
- Source: codex / haechi Toss Native Companion UI implementation session
- Target repo: /Users/byung/Documents/haechi
- Task id: haechi-native-companion-visual-qa
- Task title: Preserve brand character quality while implementing Toss-native companion UI
- Run log: not available; this candidate comes from an interactive Samantha
  learn request after iterative local browser UI implementation.

## Evidence
- Observed outcome: the Haechi app reached a stable first implementation scope
  through repeated screenshot-driven UI feedback, browser verification, and
  focused patches.
- Initial risk: applying a Toss-native list structure was not enough. The
  brand identity weakened when the Haechi character was too small on home.
- Visual failure: transparent PNG character assets looked low-quality when CSS
  wrappers added white rounded backgrounds. Removing wrapper surfaces and
  using only alpha-aware `drop-shadow` restored the intended character asset
  quality.
- Interaction failure risk: reading animation with direct `img src` frame
  swaps felt choppy. A two-layer crossfade preserved the five PNG frames while
  softening the frame transition.
- Verification risk: Browser screenshot and computed-style checks caught visual
  problems that static lint/build verification could not catch.
- Repository constraint: the target repo was not a Git repository, so branch,
  commit, and push based rollback were not available. Small reversible patches
  plus immediate browser verification were the practical rollback strategy.

### Changed Files
- `src/App.tsx`
- `src/App.css`
- `src/components/StepSelector.tsx`
- `src/components/ReadingHaechiLoop.tsx`
- `src/components/VerdictCard.tsx`
- `src/components/HistoryList.tsx`
- `src/utils/share.ts`
- `src/data/verdicts.ts`
- `index.html`
- `granite.config.ts`
- `README.md`

### Verification Summary
- `npm run lint` -> pass
- `npm run build:web` -> pass
- `npm run build` -> pass
- Local browser URL: `http://127.0.0.1:5173/`
- Mobile browser flow verified: home -> concern -> mood -> value -> reading -> result.
- Console error/warn checks returned no relevant app errors after the final
  implementation checks.
- Reading crossfade evidence showed back/front image layers simultaneously
  during frame changes and distinct frame `src` values progressing through the
  reading PNG sequence.

## Proposed Lesson
- Proposed lesson: For consumer-facing companion UI work, treat brand character
  visibility, transparent asset compositing, and screenshot-based visual QA as
  first-class acceptance criteria, not cosmetic polish after functional flow
  verification.
- Affected layer: frontend implementation playbook / visual QA checklist
- Suggested artifact type: frontend companion UI playbook or project readiness
  checklist
- Risk if adopted: If applied to internal tools or non-brand surfaces, this can
  over-weight visual review and slow small utility work. Keep it scoped to
  consumer-facing, brand-sensitive, character-led, or platform-submitted UI.
- Review note: Review manually before promotion. This candidate must not modify
  promoted artifacts by itself.

## Candidate Guidance
- Preserve platform-native structure and brand identity separately. A native
  layout can still fail if the primary brand asset is visually underweighted.
- For transparent PNG character assets, inspect whether wrapper backgrounds,
  border radii, and shadows create unintended cards. Prefer transparent wrappers
  and alpha-aware `drop-shadow` when the supplied asset already has clean
  transparency.
- For frame-based PNG animation, use a bounded two-layer crossfade before
  introducing new asset formats or pipelines. Keep frame timing and total
  product flow constraints explicit.
- Do not claim visual fixes from DOM class names alone. Include browser
  screenshot evidence and, when relevant, computed styles for background,
  `box-shadow`, `filter`, z-index/layering, and opacity.
- When the target repo is not a Git repository, do not promise branch or push
  rollback. State the limitation and use small patches plus immediate browser
  verification instead.

