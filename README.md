# YT Studio Analytics Scraper

A Chrome extension that automatically scrapes YouTube Studio analytics for all your published videos and exports the data as CSV or Excel.

## Features

- **Analytics scraping** — collects impressions, CTR, views, traffic sources, view duration, and more for every published video
- **Impressions First 2 Days** — captures the exact "First 2 days" impression count shown in YouTube Studio tooltips
- **Column selection** — choose which columns to include in the export; scraping skips unnecessary analytics tabs automatically
- **Description scraping** — optional column that captures each video's full description text
- **Engagement metrics** — optional columns for Likes, Comments, Subscribers gained, and Realtime viewers per video
- **CSV & Excel export** — download as `.csv` (Google Sheets / Excel) or `.xls` (opens directly in Excel with formatting)
- **Video filter** — scrape all videos, the latest/oldest N, or a custom date range
- **Live progress** — shows current video, phase, and ETA during scraping
- **Dark / light theme** — persists across sessions

## Data Collected

| Column | Description |
|---|---|
| Title | Video title |
| Description | Full video description (optional, from Studio edit page) |
| Upload Date | Date the video was published |
| Video Age (Day) | Days since upload |
| Impressions | Total impressions (default period) |
| Impressions First 2 Days | Impressions in the first 48 hours after publish |
| CTR | Click-through rate |
| Views | Total views |
| Traffic Source (Suggested + Browse %) | Combined suggested + browse percentage |
| Video Duration | Length of the video |
| Avg View Duration | Average time viewers watched |
| Avg % Viewed | Average percentage of video watched |
| Likes | Total likes (optional, from Content page) |
| Comments | Total comment count (optional, from Content page) |
| Subscribers | Subscribers gained attributed to the video (optional) |
| Realtime | Current realtime viewer count at time of scraping (optional) |

## Installation

This extension is not on the Chrome Web Store. Load it manually:

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `yt-analytic-scrape/` folder

## Usage

1. Open [YouTube Studio → Content](https://studio.youtube.com/channel/content)
2. Click the extension icon to open the popup
3. Choose which videos to scrape under **Videos** (All / Count / Date)
4. Choose export format under **Export** (CSV or Excel)
5. Click **Start scraping**

The tab must stay open during scraping (you can freely switch to other tabs). After scraping completes, the file downloads automatically and the tab returns to the Content page.

Only **Published** videos are scraped. Scheduled, Draft, and Private videos are skipped.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read the current YouTube Studio tab |
| `scripting` | Inject the content script into YouTube Studio |
| `storage` | Persist settings and scraping state across sessions |
| `downloads` | Trigger the CSV / Excel file download |
| `host_permissions: studio.youtube.com` | Limit access to YouTube Studio only |
