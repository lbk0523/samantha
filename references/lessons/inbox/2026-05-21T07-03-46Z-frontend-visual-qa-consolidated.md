# Lesson Candidate: 2026-05-21T07-03-46Z-frontend-visual-qa-consolidated

## Source

- Source candidate:
  `references/lessons/inbox/2026-05-16T05-21-22-haechi-native-companion-visual-qa.md`
- Source candidate:
  `references/lessons/inbox/2026-05-16T08-39-19-haechi-reading-animation-css-cascade.md`
- Related candidate:
  `references/lessons/inbox/2026-05-16T08-55-00-haechi-functional-mvp-vs-submission-readiness.md`

## Evidence

- Brand-sensitive companion UI reached stable implementation only after
  screenshot-driven visual QA, not from static build and lint checks alone.
- Transparent character assets degraded when wrappers added opaque card-like
  surfaces; alpha-aware compositing and `drop-shadow` preserved asset quality.
- Reading animation checks were initially misleading because image `src` values
  changed while a CSS cascade kept a fallback layer visibly rendered.
- Computed style showed the hidden fallback class was overridden, so the visual
  state had to be verified through display, layering, and screenshot-visible
  evidence.
- Functional MVP behavior passed before the product was ready for platform
  submission review.

## Proposed Lesson

- Proposed lesson: For consumer-facing, brand-sensitive, character-led, or
  platform-submitted frontend work, visual acceptance must include rendered
  evidence. Do not accept DOM class names or image src changes as sufficient visual proof.
- Separate functional MVP closure from platform submission readiness. Passing
  tests, builds, and local browser smoke checks can close the functional phase
  while still requiring a dedicated visual and UX readiness phase.
- Affected layer: frontend visual QA checklist / product readiness gate.
- Suggested artifact type: candidate playbook update or readiness checklist.
- Risk if adopted: If applied to internal tools or simple static UI changes,
  this can over-weight visual review. Keep it scoped to brand-sensitive,
  animated, fallback-heavy, or platform-submitted UI.
- Review note: Keep this as a lesson candidate until reviewed. This candidate
  consolidates prior candidates but does not delete, rewrite, or promote them.

## Candidate Guidance

- Treat brand character visibility and brand asset quality as acceptance
  criteria for companion UI, not late cosmetic polish.
- For transparent character assets, check wrappers, backgrounds, border radius,
  shadows, and filters. Prefer transparent composition and alpha-aware
  `drop-shadow` when the supplied asset already has clean transparency.
- For animation, fallback, overlay, hidden-state, or CSS cascade bugs, verify
  computed style, z-index or layering, opacity, and screenshot or pixel-visible
  evidence before claiming the visual bug is fixed.
- For platform-submitted products, record whether the current milestone is
  functional MVP closure or submission readiness. Do not collapse those gates
  into one status.
