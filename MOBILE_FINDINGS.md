# Mobile optimisation pass — Task 0 findings

Scope read: `src/components/islands/MainIsland.tsx`, `src/layouts/BaseLayout.astro`,
`src/styles/global.css`, `src/styles/tokens.css`, `src/pages/index.astro`,
`src/pages/standard/[slug].astro`, `src/pages/faqs.astro`. Also opened
`FaqsIsland.tsx` and `admin/queue.astro` since they're embedded in / adjacent to
the pages above and the instruction file explicitly covers them in tasks 6-8.

Confirmed: `GraphIsland.tsx` and `TimelineIsland.tsx` have zero importers anywhere
in `src/` or `astro.config.*`. Left untouched, not referenced further below.

There are **two separate header implementations**, not one: `SiteHeader` inside
`MainIsland.tsx` (inline styles, used only on `index.astro` via `fullPage`), and
`.site-header` inside `BaseLayout.astro` (scoped CSS, used on every other page:
`[slug].astro`, `faqs.astro`, `admin/queue.astro`). They are structurally near-
identical (brand mark + text, nav pill group, Source link, one flex row, 28px
padding, no wrap) and both need the Task 2 fix independently, in their own
styling systems (classes in `global.css` for the island, scoped `<style>` for
BaseLayout).

## 1. Fixed pixel dimensions that cannot shrink below 640px

- `MainIsland.tsx:156` FrameworkBar row — intentional pan container, see §6.
- `MainIsland.tsx:297` RadarStrip scroller — cards fixed `width: 214`, `minHeight: 112` — intentional pan container, see §6.
- `MainIsland.tsx:492` Timeline plot `minWidth: tlFull ? 1080 : 840` — intentional pan container, see §6.
- `MainIsland.tsx:509` Timeline name column fixed `width: 172` — this is the sticky-column target in Task 6.1.
- `MainIsland.tsx:614` Transitions stage fixed `width: 800, height: 520` — intentional pan container, see §6.
- `MainIsland.tsx:293-294` Radar prev/next arrow buttons, fixed `30x30`.
- `MainIsland.tsx:698` Drawer close button, fixed `32x32`.
- `MainIsland.tsx:379-400` Catalog row `gridTemplateColumns: '1fr auto'` — the `auto` column (version + verified + status pill) has no max-width and doesn't shrink; this is the Task 5 target.
- `MainIsland.tsx:127-144` / `BaseLayout.astro:110-127` — both headers: no `flex-wrap`, no `min-width:0` on the brand text, nav group has no shrink allowance. This is the Task 2 target, in both places.
- `[slug].astro:278-291` facts-grid: `repeat(4, 1fr)` already has the existing 640px → `1fr 1fr` rule. Matches the instruction file exactly.

## 2. Horizontal overflow risk at 320/375/414px

- **Both headers** (`SiteHeader` in `MainIsland.tsx`, `.site-header-inner` in `BaseLayout.astro`): confirmed overflow. Sum of brand mark+text, three nav pills, and the Source link, with 28px padding each side and no wrap/shrink, exceeds 320-414px viewport width. This is real document-level overflow, not contained by any scroller. Task 2 target.
- Catalog card row (`MainIsland.tsx:379-400`): the rigid right column (version/verified/status) plus an unshrinking name column with no `text-overflow`/`overflow` handling on the name `div` (`MainIsland.tsx:389`) risks pushing the row wider than the viewport at 320-375px. Task 5 target.
- Everything else checked (Hero, stat row, Radar section wrapper, Catalog search/filter row, `[slug].astro`/`faqs.astro` grids and rows, admin queue cards) uses `flex-wrap: wrap` or naturally-wrapping text and did not show an overflow risk — they reflow to multiple lines instead of overflowing.
- Intentional pan containers (FrameworkBar, RadarStrip scroller, Timeline plot, Transitions stage) correctly contain their fixed-width content in `overflow-x: auto`; they don't leak into document-level overflow. See §6.

## 3. Interactive targets under 44×44px

- Radar prev/next arrows, `MainIsland.tsx:293-294` — 30×30 (explicitly named in Task 4; plan is to hide under `pointer: coarse` rather than enlarge).
- Transitions orbs, `MainIsland.tsx:551` — min radius 15 → 30px diameter (explicitly named in Task 7).
- Drawer close button, `MainIsland.tsx:698` — 32×32. Not named in any task but fails the same bar; Task 8's drawer acceptance ("dismisses on touch") implies this should be fixed too.
- Nav pill buttons, both headers — ~7px+7px vertical padding at 13.5px font ≈ 30px tall.
- Catalog status filter chips and sort `<select>`, `MainIsland.tsx:352-362` — named directly in Task 4.
- Timeline "Show document releases" toggle and doc-type filter chips, `MainIsland.tsx:463-478` — ~31px tall. Not named in Task 6 (which only calls out sticky column, type sizes, doc layer, full-screen prominence) but same underlying issue; flagging for consistency, low priority since Task 6 doesn't request it.
- Timeline "Full screen" toggle, `MainIsland.tsx:480-482` — same sizing issue; Task 6.4 asks to make it "prominent," which will fix this incidentally.
- `FaqsIsland.tsx` "Show N more" button (~33px tall) and the FAQ accordion header — not covered by any numbered task; noting for completeness, treating as low priority alongside admin/queue (Task 8 only mandates "not break," not polish).

## 4. Hover-only affordances with no touch/focus equivalent

- Catalog card row `onMouseEnter`/`onMouseLeave`, `MainIsland.tsx:381-382` — the only signal a row is clickable (border/shadow/lift). Explicitly named in Task 4; fix is additive `:active` CSS, keep the JS handlers.
- Timeline row `onMouseEnter`/`onMouseLeave`, `MainIsland.tsx:506-507` — same pattern (background tint on hover), not named in any task. Cosmetic only (row is already fully tappable via `onClick`), so I'm treating it as out of scope unless told otherwise — Task 6 doesn't ask for it and adding unrequested `:active` states there would be scope creep.
- Transitions drag, `onMouseDown` + window `mousemove`/`mouseup`, `MainIsland.tsx:586-593` — Task 7.1 covers this explicitly (conditional copy, not porting to pointer events).
- Doc-row `:hover` background tints in `[slug].astro` (`.doc-row:hover`) and `DetailDrawer`/`FaqsIsland` (inline `onMouseEnter`/`onMouseLeave`) — purely decorative color shifts, the links themselves work fine on tap without the hover state. Not treating these as defects.
- `nav-tab:hover`, `github-link:hover`, `back-link:hover`, `source-btn:hover` in CSS — same: decorative only, not gating functionality.

## 5. Inputs with font-size under 16px

- Catalog search input, `MainIsland.tsx:350` — `fontSize: 14`. Task 4 target.
- Catalog sort `<select>`, `MainIsland.tsx:352` — `fontSize: 13.5`. Not named explicitly in Task 4 (which says "search input" and "sort control" padding, not font), but a `<select>` also triggers iOS zoom on focus at this size, and the global acceptance criterion says "no input triggers iOS zoom" — treating the select's font-size as in scope under that global bar.
- `FaqsIsland.tsx:100` search input — `fontSize: '0.8125rem'` (13px). Not in the named file list for Task 0, but it's embedded in both `[slug].astro` and `faqs.astro` which Task 8 explicitly covers, so flagging it as part of that task's surface.
- No other `<input>`/`<select>`/`<textarea>` elements found in the covered files or `admin/queue.astro`.

## 6. Surfaces already panning correctly (leave as pan containers)

- `FrameworkBar`, `MainIsland.tsx:156` (`overflowX: 'auto'`) — leave the mechanism, only adjust padding per Task 2.
- `RadarStrip` scroller, `MainIsland.tsx:297` (`overflowX: 'auto'`, `scrollSnapType: 'x proximity'`) — leave alone.
- Timeline plot wrapper, `MainIsland.tsx:491-492` (`overflowX: 'auto'`, `minWidth: 840/1080`) — leave alone per Task 6, add sticky name column and type-size fixes on top.
- Transitions stage wrapper, `MainIsland.tsx:613` (`overflowX: 'auto'`, fixed `800×520` stage) — leave the pan model per Task 7, fix orb hit targets and legend placement on top.

## 7. Where the instruction file doesn't match the code

- **Task 2's footer fallback condition is the actual case, not a hypothetical.** Neither footer has a Source/GitHub link: `MainIsland.tsx`'s own footer (`MainIsland.tsx:837-841`) only has the license/attribution text, and `BaseLayout.astro`'s footer (`.site-footer-inner`, lines 212-223) has the same text with no link either. Per Task 2's own instruction ("if it does not [exist], keep the header link and shorten something else instead"), I will **keep the Source link in both headers** and shrink/hide something else (brand text) instead of dropping it. Flagging this because the task read as if the footer link probably exists; it doesn't, in either header's corresponding footer.
- **Task 2 only describes one header,** but there are two independent implementations (`SiteHeader` in the island, `.site-header` in `BaseLayout.astro`) that need the fix separately, in two different styling systems (see intro above).
- **Global acceptance criteria say `validate-data` must pass**, but the actual script in `package.json` is named `validate` (`pnpm validate`, running `scripts/validate-data.ts`). No script called `validate-data` exists. I'll run `pnpm validate`.
- Everything else in the instruction file (breakpoint at 640px already present in `[slug].astro`, `MainIsland.tsx` being a React island unreached by Astro scoped styles, tokens.css/tokens.ts as sole theme source, GraphIsland/TimelineIsland having no importers) checked out against the code as written.

No source files were changed in this step.
