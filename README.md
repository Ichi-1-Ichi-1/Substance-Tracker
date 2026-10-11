# Substance Tracker

A small offline-first web app (PWA) for logging a substance/medication plan: one tap to log a dose, injection-site rotation, history, weekly totals and health readings (weight, blood pressure, resting pulse, blood work notes).

- Everything is stored **only locally in the browser** (localStorage); nothing is uploaded.
- Back up regularly via **Daten → Backup exportieren**.
- No build step: plain `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`.

## Run

Serve the folder over HTTP(S), e.g. `python3 -m http.server`, or enable GitHub Pages
(Settings → Pages → Deploy from branch → `master` / root). Open the URL on your phone and
choose "Add to Home Screen" to install it as an app.
