## [1.0.0] — 2026-05-20

### Added
- **Analytics Scraping**: Automatically scrapes YouTube Studio analytics for all published videos — overview tab (avg view duration, avg % viewed) and reach tab (impressions, CTR, views, suggested + browse traffic).
- **Impressions First 2 Days**: Captures impressions in the first 48 hours since publish using YouTube's native `since_publish` period — matches the "First 2 days" tooltip in YouTube Studio exactly.
- **CSV & Excel Export**: Export scraped data as `.csv` or `.xls` (XML Spreadsheet 2003, no library required). Format selectable from the popup before scraping.
- **Video Filter**: Filter which videos to scrape — all published, latest/oldest N videos, or a custom date range.
- **Progress Tracking**: Live progress card with video count, current phase, and ETA estimate based on average time per video.
- **Dark / Light Theme**: Toggle between dark and light themes, persisted across popup sessions.
- **Auto-return to Content Page**: After scraping completes, the tab automatically navigates back to the YouTube Studio Content page.
