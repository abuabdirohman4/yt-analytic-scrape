# CLAUDE.md — references/

Saved HTML snapshots of YouTube Studio pages. Use these to find DOM selectors without loading the live site. Each `.html` file has a `*_files/` folder with assets (JS, CSS, images) — ignore those.

## Files

### `channel-content.html`
**URL:** `studio.youtube.com/channel/{id}/videos`
**Contains:** Full video list table. Each video is a `ytcp-video-row` element.

Key selectors per row:
| Data | Selector |
|---|---|
| Video ID | `a[href*="/video/"][href*="/edit"]` → extract from href |
| Title | `#video-title` |
| Upload date | `.tablecell-date` |
| Visibility | `.cell-description` |
| Views | `.tablecell-views` (plain number with commas, e.g. `"2,035"`) |
| Duration | `ytcp-thumbnail .label` |

---

### `analytics-overview.html`
**URL:** `studio.youtube.com/video/{id}/analytics/tab-overview/period-default`
**Contains:** Overview tab — retention metrics.

Key selectors:
| Data | Selector |
|---|---|
| Avg View Duration | `yta-audience-retention-highlights-video-card-v2 .metric-row` → div[0] label, div[1] value |
| Avg % Viewed | same row structure, label contains "percentage viewed" |

---

### `analytics-reach.html`
**URL:** `studio.youtube.com/video/{id}/analytics/tab-reach_viewers/period-default`
**Contains:** Reach tab — impressions, CTR, traffic sources.

Key selectors:
| Data | Selector |
|---|---|
| Impressions | `yta-key-metric-block` where `#metric-label` contains "Impressions" |
| CTR | `yta-key-metric-block` where `#metric-label` contains "click-through rate" |
| Traffic sources | `yta-video-traffic-source-card .traffic-row-container` → `.traffic-source-title` + `.share-value` |
| Traffic (fallback) | `yta-table-card tr.table-row` → `.title-text.debug-dimension-value` + `.value.debug-table-value` |

Note: **Views is NOT scraped from this tab** — use `channel-content.html` (`.tablecell-views`) instead. Very new videos may not have a Views metric block here.

---

### `analytic-reach-custom.html`
**URL:** `studio.youtube.com/video/{id}/analytics/tab-reach_viewers/period-since_publish,time_period_unit_nth_days,2`
**Contains:** Reach tab scoped to first 2 days since publish.

Key selectors:
| Data | Selector |
|---|---|
| Impressions First 2 Days | `yta-key-metric-block` where `#metric-label` contains "Impressions" |

URL detection: `url.includes('time_period_unit_nth_days')` → page type `reach48h`.

---

### `analytics-engagement.html`
**URL:** `studio.youtube.com/video/{id}/analytics/tab-interest_viewers/period-default`
**Contains:** Engagement/interest tab. Not currently scraped. Potential future source for likes, comments, shares.

---

### `video-details.html`
**URL:** `studio.youtube.com/video/{id}/edit`
**Contains:** Video edit page — title, description, visibility.

Key selectors:
| Data | Selector |
|---|---|
| Description | `ytcp-video-description #textbox` or `div[aria-label*="Tell viewers about your video"]` |
| Title | `ytcp-video-title #textbox` or `div[aria-label*="Add a title"]` |

Note: Elements are inside Web Components with shadow DOM (`ytcp-*`). Use `#textbox` child selector.
