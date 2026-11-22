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

## Lighthouse

On the live site, phone and desktop. Accessibility, Best Practices and SEO are 100 on
every page tested: the staff sign-in page, the board, and the ten patient pages below.
Performance is 83–100, most pages 96 or higher:

| Page                       | Phone | Desktop |
| -------------------------- | ----- | ------- |
| Choose an office (`/book`) | 83    | 89      |
| Book, signed out           | 100   | 99      |
| Patient sign-in            | 97    | 97      |
| Sign up                    | 93    | 99      |
| Forgot password            | 99    | 96      |
| Demo inbox                 | 96    | 98      |
| Check-in link              | 97    | 97      |
| Your visits (signed in)    | 100   | 97      |
| Book, signed in            | 100   | 98      |
| Change password            | 100   | 97      |

The signed-in pages ran as the demo patient with the cache warm, so their Performance
reads a little high.

**`/book` was the weakest, and part of that is fixed.** The page showed a single
"Loading…" line until the office list came back (after the mock API's 400 ms), then
grew, pushing the footer down: a layout shift of 0.082, the only one on any patient
page. It now shows the heading, the sign-in link and two placeholder cards the size of
the real ones from the start. On a local production build the shift went from 0.082 to
0.004. The rest of its score is Total Blocking Time, which swung from 10 to 430 ms
between runs of the same build on my machine (scores 88–99), so the table's 83 and 89
are from before the fix and partly noise. I haven't re-run Lighthouse on the live site.

Not covered: the reset-password page (it needs a live token), dark mode, and the open
drawers and dialogs (axe checks those; Lighthouse only scores page loads).
