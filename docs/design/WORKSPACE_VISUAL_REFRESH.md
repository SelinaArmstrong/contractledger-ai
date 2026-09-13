# Workspace visual refresh

## Brief

Extend the approved public-page identity into the existing operations workspace: navy ink, warm paper and restrained mint/teal. Improve navigation legibility, information hierarchy, card rhythm, table readability and action contrast without changing business workflows or values.

Scope: shared tokens and primitives, sidebar/header/mobile navigation, dashboard hierarchy, registers, review/approval/obligation/validation views, dialogs and sign-in. Preserve status semantics, labels, role-based controls, dataset and all event handlers.

Acceptance: readable complete navigation labels; consistent shared surfaces and type; no page-level horizontal overflow on mobile; tables retain their own scrolling; dialogs fit small viewports; visible focus and selected navigation; navigation, filters and read-only inspection still work. Use existing unit checks plus representative browser inspection, lint, typecheck and build. No deployment.

## Implementation and validation

Shared styling and responsive refinements are implemented.

### Delivered

- Central palette in `app/globals.css`: warm paper, navy primary, green/mint accents, consistent borders, chart colours and focus rings. Existing semantic warning/error/success colours remain distinct.
- Migrated repeated decorative colours across presentation components to shared tokens. Improved operational small print, button sizing, table headings and row spacing.
- Sidebar widened to 272 px; complete wrapping navigation labels and `aria-current` identify the current view. Mobile navigation retains horizontal scrolling and the More menu.
- Dashboard has a clearer heading, a navy current-value card and a navy primary workflow card. All metric values still come from the existing workspace payload.
- Export actions use a secondary treatment; primary record-creation actions remain prominent.
- Grid children can shrink around their table scrollers, fixing the case-study table expanding the mobile page.
- Dialog geometry uses dynamic viewport units and bounded minimum heights. The assistant header and composer are more compact on small screens, with a visible outer focus ring and simpler user-facing copy.

### Verification — 2026-09-12

- Existing tests: 27 files / 233 tests passed.
- Lint, TypeScript and the production build passed. Build retains the pre-existing large-chunk and vinext route-classification warnings.
- Visited all 10 workspace views at desktop 1440 px and mobile 320 px. Each view displayed the expected heading and selected navigation. Final mobile widths were 320 px across all ten views; the case-study table stays inside its scroller.
- Visually inspected the dashboard and contract register at desktop, the dashboard at 390 px, and record details plus the assistant at 320 px.
- Opened contract details and the assistant without submitting AI requests or writing business data. Both dialog bounds fit the 320 × 740 viewport.
- Selected the Apex Equipment supplier filter in the contract register and verified the matching record; clearing the filter restores the register.
- Existing SEO routes and assets are checked separately with `npm run check:seo`.

### Bounded metric and limitations

10 existing workspace views checked for navigation and mobile page width. This is a local interface check, not a performance, accessibility certification or production outcome claim. All data seen in the browser is fictional portfolio data. No business data was created, reset or changed for this visual review.

The working tree already contained business-workflow and SEO changes, which were preserved. This visual refresh changes presentation, copy and layout; it does not certify unrelated changes. The refreshed site has not been deployed.
