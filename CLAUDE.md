# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loading for Development

No build system. Load directly in Chrome:

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this directory
3. After any file change → click **reload** on the extension card
4. Content script changes also require reloading the YouTube Studio tab

## Architecture

MV3 extension. Three-layer pattern:

```
popup/ ←→ background.js (service worker) ←→ content.js (injected into studio.youtube.com)
```

**Message flow:**
1. Popup sends `startScraping` → background stores tab ID, calls `injectToTab()`, forwards command
2. Content script runs `runScraping()` on the Content page, then navigates the tab through analytics pages
3. Each page load re-injects `content.js`; the auto-continue guard at the bottom resumes from `chrome.storage.local` state
4. Content → background: `updateProgress`, `scrapingJobDone`, `navigateTo`
5. Background → popup: `updateStatus`, `updateProgress`

**Scraping state in `chrome.storage.local`:**
- `scrapeQueue` — filtered video list (oldest→newest)
- `currentVideoIndex` — which video is being processed
- `scrapePhase` — current phase name (`overview`, `reach48h`, `reach`, `video-details`)
- `scrapePhases` — ordered array of phases computed from `selectedColumns` (e.g. `['reach']` if only Impressions selected)
- `scrapedData` — accumulated results array
- `channelId` — for returning to Content page after done
- `selectedColumns` — which columns user wants (drives phase computation and export filtering)
- `scrapeFilter`, `exportFormat` — persisted UI settings

## Key Patterns

**Phase skipping (`content.js`):**
`buildScrapePhases(selectedColumns)` computes which analytics pages to visit. If user only selects channel-content columns (Title, Upload Date, Video Duration), scraping completes immediately without any navigation. `getPhaseUrl(videoId, phase)` builds the URL for each phase.

**Column → source mapping:**
| Source | Columns |
|---|---|
| channel-content (free) | Title, Upload Date, Video Age (Day), Video Duration |
| overview tab | Avg View Duration, Avg % Viewed |
| reach48h tab | Impressions First 2 Days |
| reach tab | Impressions, CTR, Views, Suggested + Browse |
| video-details (/edit) | Description |

**`HEADERS` order in `background.js` must match `ALL_COLUMNS` order in `popup.js`** — both define the same 12 columns. Export filters `HEADERS` by `selectedColumns` before generating CSV/Excel.

**ETA tracking** uses `scrapePhases.at(-1)` as the completion signal, not hardcoded `'reach'`.

**Double-injection guard:** `window.ytScraperLoaded` prevents re-registering listeners when content script is re-injected.

**Date normalization:** YouTube omits the year for current-year uploads. `normalizeUploadDate()` appends current year before sorting.

## Fragile Selectors

These will break if YouTube Studio updates its UI:

| Purpose | Selector |
|---|---|
| Video rows | `ytcp-video-row` |
| Video title in row | `#video-title` |
| Upload date in row | `.tablecell-date` |
| Visibility status | `.cell-description` |
| Video link (for ID extraction) | `a[href*="/video/"][href*="/edit"]` |
| Duration in thumbnail | `ytcp-thumbnail .label` |
| Analytics metric blocks | `yta-key-metric-block` |
| Metric label | `#metric-label` |
| Retention card | `yta-audience-retention-highlights-video-card-v2` |
| Traffic source cards | `yta-video-traffic-source-card .traffic-row-container` |
| Description field (/edit page) | `ytcp-video-description #textbox` |
