# Wingst Chrome Extension (Manifest V3) — Build & Installation Guide

## 1. Architecture Overview

The Wingst Chrome Extension (`extension/`) is a genuine **Manifest V3 New Tab replacement** (`chrome_url_overrides.newtab`).

Because a packaged Chrome Extension runs statically under the `chrome-extension://` origin without a Next.js Node server:
- **Storage Adapter**: Extension preferences, Quick Links, Daily Activity checklists, historical completion records, and Notepad entries are persisted in `chrome.storage.local` (with fallback to `localStorage`), while large uploaded background images/GIFs/videos are stored in extension-scoped `IndexedDB` (`wingst_local_media_db`). Website storage and Extension storage are intentionally isolated; users can transfer configurations between them at any time using **Settings → Data & Privacy → Export / Import JSON**.
- **Direct HTTPS API Clients**: All external data integrations in the extension communicate directly over HTTPS with public, CORS-enabled endpoints that require no secret credentials:
  - **Weather & Geocoding**: `https://api.open-meteo.com/v1/forecast` and `https://geocoding-api.open-meteo.com/v1/search`
  - **Trading / Forex**: `https://api.frankfurter.dev/v1/...` and `https://api.frankfurter.app/...` (ECB indicative reference rates starting with `USD/IDR`)
  - **Prayer Times**: `https://api.myquran.com/v2/sholat/jadwal/...` (Kemenag RI) with automatic fallback to `https://api.aladhan.com/v1/timings/...`
- **Official Music Embeds**: Uses sandboxed `<iframe>` embeds from `open.spotify.com`, `www.youtube.com`, `embed.music.apple.com`, and `w.soundcloud.com` permitted via Manifest V3 `frame-src`.
- **Strict Manifest V3 Compliance**: Zero remotely hosted executable JavaScript (`script-src 'self'; object-src 'self'`).

---

## 2. Building & Verifying the Extension Package

Run the extension build and verification script from the project root:

```bash
npm run build:extension
```

This script (`scripts/build-extension.mjs`):
1. Generates crisp binary PNG icons (`16x16`, `48x48`, `128x128`) in `extension/icons/`.
2. Writes and validates `extension/manifest.json` against Manifest V3 rules.
3. Outputs the self-contained New Tab application (`extension/newtab.html`, `extension/styles.css`, `extension/newtab.js`, `extension/service-worker.js`, and `extension/assets/wingst-default-hero.svg`).
4. Verifies that all required files exist and no remote script tags are present.

---

## 3. Installing in Google Chrome (Developer Mode)

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON in the top-right corner.
3. Click **Load unpacked** in the top-left toolbar.
4. Select the `/extension` directory inside this repository.
5. Open a new browser tab (`Ctrl+T` / `Cmd+T`) to launch the **Wingst** New Tab workspace.

---

## 4. Permissions Justification

| Permission | Reason |
| :--- | :--- |
| `storage` | Required to store layout spans, quick links, notes, daily activity history, and theme preferences in `chrome.storage.local`. |
| `geolocation` (optional) | Used only when the user explicitly clicks the **GPS** button in the Weather module to detect their current coordinates. |
| `host_permissions` | Scoped strictly to `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `api.frankfurter.dev`, `api.frankfurter.app`, `api.myquran.com`, and `api.aladhan.com`. |

---

## 5. Known Platform Limitations

- **Storage Isolation**: Browser security isolates `chrome-extension://` storage from `http://localhost:3000` website storage. Use the built-in JSON Export/Import in Settings to move configurations between the website and extension.
- **Embedded Music Authentication**: Official Spotify, Apple Music, YouTube, and SoundCloud embeds play full tracks only if you are signed into that provider in your browser; otherwise providers play preview clips according to their platform policies.
- **Indicative Forex Rates**: Exchange rates retrieved from ECB/Frankfurter are daily/reference rates and are explicitly labeled as non-executable indicative data.
