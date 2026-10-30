# Halbwert

Private harm-reduction substance journal. App Store listing, positioning and review notes: see [APPSTORE.md](APPSTORE.md). Privacy policy: `privacy.html`, support page: `support.html`.

Offline-first web app (PWA) for iPhone: log a substance plan, a daily journal, mood and nutrition.

- **Tag:** mood 0–5 (smileys), plan items to tick off, free entries (any category, incl. recreational), calories/macros, journal, PDF/photo attachments per day (PDF text is extracted on device with bundled pdf.js and is searchable).
- **Verlauf:** month calendar with mood + markers, monthly totals, full-text search over journal, entries and PDF text.
- **Trends:** mood curve (and calories) for week / month / 3 months / year / all; tap a smiley to see which substances were taken on days with that mood, plus average mood with vs. without each substance.
- **Plan:** substances by category; interval (incl. 3.5 days), weekdays, specific dates, or as-needed; per-substance after-effect days ("im System"), used on the day view and in the mood analysis.
- **Lexikon:** reference half-lives for ~235 medications, PEDs, peptides, recreational substances and supplements (`substances-db.js`); drives the default after-effect days (≈ 5 half-lives) and an estimated level curve per substance.
- **Wechselwirkungen:** class-based interaction rules (`interactions.js`: opioids, benzos, alcohol, GHB, gabapentinoids, serotonergics/MAOIs, stimulants, PDE5/nitrates, anticoagulants, QT, CYP inhibitors, liver load, …) checked against everything taken, planned or still active (≈ 5 half-lives). Shown on the day view, live in the entry dialog, and as a combo check in the lexicon. Not exhaustive; not medical advice.
- **Mehr:** calorie goals, backup (JSON incl. documents) / restore, CSV export, theme.

All data lives only on the device (IndexedDB). No build step; the service worker caches everything so the app runs fully offline after the first load.

## Install on iPhone

1. Host the folder once over HTTPS (e.g. GitHub Pages: Settings → Pages → Deploy from branch → `master` / root).
2. Open the URL in Safari → Share → "Zum Home-Bildschirm".
3. Start it from the home screen. From then on it works without internet.

`vendor/` contains pdf.js 3.11.174 (Apache-2.0, see `vendor/pdfjs-LICENSE`).
