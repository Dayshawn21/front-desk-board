# Performance

([Back to the README](../README.md))

Measured, then decided. Numbers are from Chrome with the CPU slowed 4×, the same
slowdown Lighthouse uses for phones, as medians of 12 interleaved runs.

- **Signing in.** The click responds in about 150–190 ms here, against a local
  production build. Lighthouse's run on the live site said 420 ms; I haven't pinned down
  that gap (different setup and throttling method). React's render of
  the whole board is about 60 ms. The rest is the browser's style and layout, which it
  must do once before painting the new board.
- **Focus on the heading.** Lighthouse flags a "forced reflow": after sign-in the app
  moves focus to the page heading (so screen-reader users start at the top), and
  `focus()` makes the browser lay out the page right away. Removing it cut JavaScript
  time by ~70 ms but added the same amount of native work later, so the total didn't
  change. It stays.
- **No memoization.** With a ~60 ms render and nothing re-rendering in a loop, `memo`
  and `useMemo` would add code without a measurable gain. Fewer DOM nodes didn't help
  either: the provider view (no clickable empty slots, 250 elements vs 426) was no faster.
- **No code splitting yet.** Lazy-loading the two drawers would save about 7 KB gzipped
  of ~93 KB, so it isn't worth the extra loading state. I'd split code once a drawer
  pulls in a heavy dependency (a date picker, a rich-text editor), or split the whole
  board from the sign-in page if first load mattered more; Lighthouse estimates ~50 KB
  of the bundle is unused on the sign-in page.
