# YT Studio Analytics Scraper — Features

## Analytics Scraping

> Scrapes YouTube Studio analytics for every published video and exports the data.

**How to use:**
1. Open YouTube Studio → Content page
2. Open the extension popup
3. Click **Start scraping**

**Data collected per video:**
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
