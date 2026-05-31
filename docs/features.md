# YT Studio Analytics Scraper — Features

## Analytics Scraping

> Scrapes YouTube Studio analytics for every published video and exports the data.

**How to use:**
1. Open YouTube Studio → Content page
2. Open the extension popup
3. Click **Start scraping**

**Data collected per video:**
- Title (optional)
- Description (optional)
- Upload Date
- Video Age (days)
- Impressions
- Impressions First 2 Days
- CTR
- Views
- Traffic Source (Suggested + Browse %)
- Video Duration
- Avg View Duration
- Avg % Viewed
- Likes (optional)
- Comments (optional)
- Subscribers (optional)
- Realtime Viewers (optional)

**Notes:**
- Only Published videos are scraped. Scheduled, Draft, and Private videos are skipped.
- The tab must stay open during scraping (you can switch to other tabs freely).

---

## CSV & Excel Export

> Export scraped data as a `.csv` file (for Google Sheets, Excel, or any spreadsheet app) or as `.xls` (opens directly in Excel with proper formatting).

**How to use:**
1. In the popup, select **CSV** or **Excel** under Export before starting
2. After scraping completes, the file downloads automatically

---

## Video Filter

> Choose which videos to scrape instead of always scraping everything.

**How to use:**
1. In the popup, select a filter mode under Videos:
   - **All** — scrape all published videos (default)
   - **Count** — scrape the latest or oldest N videos
   - **Date** — scrape videos uploaded within a date range
2. Click **Start scraping**

**Notes:**
- Filter settings are saved and restored across popup sessions.

---

## Progress Tracking

> See live progress while scraping — current video, phase, and estimated time remaining.

**How to use:**
- Progress card appears automatically when scraping starts.
- ETA is estimated after the first 2 videos complete.

---

## Dark / Light Theme

> Switch between dark and light UI themes.

**How to use:**
- Click the ☀ / 🌙 button in the top-right corner of the popup.
- Theme preference is saved automatically.

---

## Column Selection

> Choose exactly which columns appear in the exported file — skip what you don't need.

**How to use:**
1. In the popup, click **Columns** to expand the accordion panel
2. Check or uncheck columns as needed
3. Click **Start scraping** — only the selected columns are scraped and exported

**Notes:**
- Default selection includes all columns except Title and Description.
- Selecting only channel-level columns (Title, Upload Date, Duration) skips all analytics tab navigation and completes instantly.
- Column selection persists across popup sessions.

---

## Description Scraping

> Capture each video's description text as an additional export column.

**How to use:**
1. In the **Columns** panel, check **Description**
2. A warning appears recommending Excel format — descriptions may contain line breaks that break CSV parsing
3. Click **Start scraping**

**Notes:**
- Description is read from the Studio edit page (`/edit`) for each video.
- Use Excel (`.xls`) export when Description is selected for best compatibility.

---

## Engagement Metrics (Likes, Comments, Subscribers, Realtime)

> Optional columns capturing per-video engagement data — all off by default.

**How to use:**
1. In the **Columns** panel, check any of: **Likes**, **Comments**, **Subscribers**, **Realtime**
2. Click **Start scraping**

**Column details:**
- **Likes** — total likes on the video. Scraped from the Content page (no extra navigation). Videos with no likes show `0`.
- **Comments** — total comment count. Scraped from the Content page.
- **Subscribers** — subscribers gained attributed to the video, from the overview analytics tab. Stored as a plain number (e.g. `23`, not `+23`) for spreadsheet SUM compatibility.
- **Realtime** — current realtime viewer count from the overview tab at the moment of scraping.

**Notes:**
- Likes and Comments require no extra tab navigation — scraped alongside Views from the Content page.
- Subscribers and Realtime trigger the overview tab phase if not already active.
