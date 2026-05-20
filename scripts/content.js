// ===================== HELPERS =====================

function getPageType() {
    const url = window.location.href;
    if (url.includes('/videos') && !url.includes('/analytics')) return 'channel-content';
    if (url.includes('/analytics/tab-reach') && (url.includes('time_period_unit_nth_days') || /period-\d+,\d+/.test(url))) return 'reach48h';
    if (url.includes('/analytics/tab-reach')) return 'reach';
    if (url.includes('/analytics/tab-overview')) return 'overview';
    return 'other';
}

function waitForUrlMatch(pattern, timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (pattern.test(window.location.href)) { resolve(); return; }
        const interval = setInterval(() => {
            if (pattern.test(window.location.href)) {
                clearInterval(interval);
                clearTimeout(timer);
                resolve();
            }
        }, 100);
        const timer = setTimeout(() => {
            clearInterval(interval);
            reject(new Error(`Timeout waiting for URL: ${pattern}`));
        }, timeout);
    });
}

function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) { resolve(existing); return; }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for: ${selector}`));
        }, timeout);
    });
}

function getMetricByLabel(labelText) {
    const blocks = document.querySelectorAll('yta-key-metric-block');
    for (const block of blocks) {
        const labelEl = block.querySelector('#metric-label');
        if (labelEl && labelEl.textContent.trim().includes(labelText)) {
            const container = block.querySelector('#metric-and-performance-container');
            if (!container) continue;
            const spans = container.querySelectorAll('span');
            if (spans.length > 0) return spans[0].textContent.trim();
            return container.textContent.trim().split('\n')[0].trim();
        }
    }
    return null;
}

// Convert "7.8k" → 7800, "2.2m" → 2200000, "733" → 733, "7.5%" → "7.5%"
function parseNumber(val) {
    if (!val) return '';
    const s = val.trim();
    if (s.endsWith('%')) return s; // keep percentages as-is
    const lower = s.toLowerCase();
    const num = parseFloat(lower);
    if (isNaN(num)) return s;
    if (lower.endsWith('k')) return Math.round(num * 1000);
    if (lower.endsWith('m')) return Math.round(num * 1000000);
    return num;
}

// Convert duration string to HH:MM:SS or MM:SS format, stripping milliseconds.
// Handles "35.11.00" (dots) or "35:11:00" (colons) or "04.05" etc.
function formatDuration(val) {
    if (!val) return '';
    // Normalize: replace dots with colons
    const normalized = val.trim().replace(/\./g, ':');
    // Split into parts
    const parts = normalized.split(':').map(p => p.trim());
    // Drop trailing milliseconds segment if it exists (e.g. "35:11:00" → keep as-is since it's HH:MM:SS)
    // YouTube duration is at most HH:MM:SS — if 3 parts assume H:M:S, if 2 assume M:S
    if (parts.length >= 3) {
        // HH:MM:SS — strip any 4th part
        return parts.slice(0, 3).join(':');
    }
    return parts.join(':');
}

// Calculate days between upload date string (e.g. "04 May 2026") and today
function calcVideoAgeDays(uploadDateStr) {
    if (!uploadDateStr) return '';
    const uploaded = new Date(uploadDateStr);
    if (isNaN(uploaded.getTime())) return '';
    const today = new Date();
    const diffMs = today - uploaded;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Parse "63.6%" → 63.6 (as number), for summing percentages
function parsePercent(val) {
    if (!val) return null;
    const match = val.trim().match(/^([\d.]+)%$/);
    return match ? parseFloat(match[1]) : null;
}

function normalizeUploadDate(dateStr) {
    if (!dateStr) return '';
    if (/\d{4}/.test(dateStr)) return dateStr;
    return `${dateStr} ${new Date().getFullYear()}`;
}

// ===================== FILTER =====================

function applyFilter(videos, filter) {
    if (!filter || filter.mode === 'all') return videos;

    if (filter.mode === 'count') {
        const n = parseInt(filter.count, 10);
        if (!n || n <= 0) return videos;
        // videos sorted oldest→newest; latest = end of array
        return filter.direction === 'oldest' ? videos.slice(0, n) : videos.slice(-n);
    }

    if (filter.mode === 'date') {
        const from = filter.from ? new Date(filter.from) : null;
        const to = filter.to ? new Date(filter.to) : null;
        return videos.filter(v => {
            const d = new Date(v.uploadDate);
            if (isNaN(d)) return true;
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }

    return videos;
}

// ===================== SCRAPING FUNCTIONS =====================

async function getVideoListFromPage() {
    console.log('[Content Script] Waiting for video list to render...');
    try {
        await waitForElement('ytcp-video-row', 15000);
    } catch (e) {
        console.error('[Content Script] Timed out waiting for video list:', e.message);
        return [];
    }
    await new Promise(r => setTimeout(r, 1000));

    const rows = document.querySelectorAll('ytcp-video-row');
    const videos = [];

    rows.forEach(row => {
        // Skip Scheduled, Draft, Private
        const visibilityEl = row.querySelector('.cell-description');
        if (visibilityEl) {
            const vis = visibilityEl.textContent.trim().toLowerCase();
            if (vis.includes('scheduled') || vis.includes('draft') || vis.includes('private')) return;
        }

        // Extract video ID from href /video/<id>/edit
        const link = row.querySelector('a[href*="/video/"][href*="/edit"]');
        if (!link) return;
        const match = link.href.match(/\/video\/([^/]+)\//);
        if (!match) return;
        const videoId = match[1];

        const titleEl = row.querySelector('#video-title');
        const title = titleEl ? titleEl.textContent.trim() : '';

        const dateEl = row.querySelector('.tablecell-date');
        const uploadDate = normalizeUploadDate(dateEl ? dateEl.textContent.trim().split('\n')[0].trim() : '');

        // Video duration from thumbnail timestamp label
        const durationEl = row.querySelector('ytcp-thumbnail .label');
        const videoDuration = formatDuration(durationEl ? durationEl.textContent.trim() : '');

        videos.push({ videoId, title, uploadDate, videoDuration });
    });

    // Sort oldest to newest
    videos.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));

    console.log(`[Content Script] Found ${videos.length} published videos:`, videos);
    return videos;
}

function buildFirst2DaysUrl(videoId) {
    return `https://studio.youtube.com/video/${videoId}/analytics/tab-reach_viewers/period-since_publish,time_period_unit_nth_days,2`;
}

async function scrapeReach48hTab() {
    console.log('[Content Script] Scraping Reach 2-days tab...');
    try {
        await waitForUrlMatch(/time_period_unit_nth_days/);
    } catch (e) {
        console.warn('[Content Script] Reach 2-days tab: URL did not match in time.');
    }
    try {
        await waitForElement('yta-key-metric-block');
    } catch (e) {
        console.warn('[Content Script] Reach 2-days tab: no metric blocks found, skipping.');
        return null;
    }
    await new Promise(r => setTimeout(r, 1500));
    const impressions48h = parseNumber(getMetricByLabel('Impressions'));
    console.log('[Content Script] Reach 2-days data:', { impressions48h });
    return { impressions48h };
}

async function scrapeReachTab() {
    console.log('[Content Script] Scraping Reach tab...');
    // Wait for URL to be period-default (not the 48h custom period from previous phase)
    try {
        await waitForUrlMatch(/tab-reach_viewers\/period-default/);
    } catch (e) {
        console.warn('[Content Script] Reach tab: URL did not match period-default in time.');
    }
    try {
        await waitForElement('yta-key-metric-block');
    } catch (e) {
        console.warn('[Content Script] Reach tab: no metric blocks found, skipping.');
        return null;
    }
    await new Promise(r => setTimeout(r, 1500));

    const impressions = parseNumber(getMetricByLabel('Impressions'));
    const ctr = getMetricByLabel('click-through rate');
    const views = parseNumber(getMetricByLabel('Views'));

    let suggestedVideos = null;
    let browseFeatures = null;

    // Traffic sources: yta-video-traffic-source-card with .traffic-source-title + .share-value
    const sourceCards = document.querySelectorAll('yta-video-traffic-source-card .traffic-row-container');
    sourceCards.forEach(card => {
        const titleEl = card.querySelector('.traffic-source-title');
        const shareEl = card.querySelector('.share-value');
        if (!titleEl || !shareEl) return;
        const titleText = titleEl.textContent.trim().toLowerCase();
        const shareText = shareEl.textContent.trim();
        if (titleText.includes('suggested video')) suggestedVideos = shareText;
        if (titleText.includes('browse feature')) browseFeatures = shareText;
    });

    // Fallback: yta-table-card rows (custom reach page variant)
    if (!suggestedVideos && !browseFeatures) {
        const tableRows = document.querySelectorAll('yta-table-card tr.table-row');
        tableRows.forEach(row => {
            const titleEl = row.querySelector('.title-text.debug-dimension-value');
            const valueEl = row.querySelector('.value.debug-table-value');
            if (!titleEl || !valueEl) return;
            const titleText = titleEl.textContent.trim().toLowerCase();
            const valueText = valueEl.textContent.trim();
            if (titleText.includes('suggested video')) suggestedVideos = valueText;
            if (titleText.includes('browse feature')) browseFeatures = valueText;
        });
    }

    // Sum suggested + browse into one field
    const sP = parsePercent(suggestedVideos);
    const bP = parsePercent(browseFeatures);
    const suggestedPlusBrowse = (sP !== null && bP !== null)
        ? (sP + bP).toFixed(1) + '%'
        : (sP !== null ? suggestedVideos : (bP !== null ? browseFeatures : null));

    console.log('[Content Script] Reach data:', { impressions, ctr, views, suggestedPlusBrowse });
    return { impressions, ctr, views, suggestedPlusBrowse };
}

async function scrapeOverviewTab() {
    console.log('[Content Script] Scraping Overview tab...');
    try {
        await waitForUrlMatch(/tab-overview/);
    } catch (e) {
        console.warn('[Content Script] Overview tab: URL did not match in time.');
    }
    try {
        await waitForElement('yta-audience-retention-highlights-video-card-v2');
    } catch (e) {
        console.warn('[Content Script] Overview tab: retention card not found, trying key-metric-block...');
    }
    await new Promise(r => setTimeout(r, 1500));

    // Average view duration and Average percentage viewed from retention card
    let avgViewDuration = null;
    let avgPctViewed = null;

    const retentionRows = document.querySelectorAll('yta-audience-retention-highlights-video-card-v2 .metric-row');
    retentionRows.forEach(row => {
        const divs = row.querySelectorAll('div');
        if (divs.length < 2) return;
        const label = divs[0].textContent.trim().toLowerCase();
        const value = divs[1].textContent.trim();
        if (label.includes('average view duration')) avgViewDuration = value;
        if (label.includes('average percentage viewed')) avgPctViewed = value;
    });

    // YouTube recommendations % — commented out, not needed currently
    // let ytRecommendations = null;
    // const sourceCards = document.querySelectorAll('yta-video-traffic-source-card .traffic-row-container');
    // sourceCards.forEach(card => {
    //     const titleEl = card.querySelector('.traffic-source-title');
    //     const shareEl = card.querySelector('.share-value');
    //     if (!titleEl || !shareEl) return;
    //     const titleText = titleEl.textContent.trim().toLowerCase();
    //     if (titleText.includes('youtube recommendation') || titleText.includes('recommended')) {
    //         ytRecommendations = shareEl.textContent.trim();
    //     }
    // });

    console.log('[Content Script] Overview data:', { avgViewDuration, avgPctViewed });
    return { avgViewDuration: formatDuration(avgViewDuration), avgPctViewed };
}

// ===================== MAIN AUTOMATION =====================

async function runScraping() {
    const pageType = getPageType();
    console.log(`[Content Script] runScraping called. Page type: ${pageType}`);

    if (pageType !== 'channel-content') {
        console.error('[Content Script] Must be on the YouTube Studio Videos page to start.');
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    const channelId = window.location.pathname.match(/\/channel\/([^/]+)/)?.[1] || '';

    const allVideos = await getVideoListFromPage();
    if (allVideos.length === 0) {
        console.error('[Content Script] No published videos found on page.');
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    const { scrapeFilter } = await chrome.storage.local.get(['scrapeFilter']);
    const videos = applyFilter(allVideos, scrapeFilter);
    if (videos.length === 0) {
        console.error('[Content Script] No videos match the current filter.');
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }
    console.log(`[Content Script] Filter applied: ${videos.length}/${allVideos.length} videos will be scraped.`);

    await chrome.storage.local.set({ scrapeQueue: videos, scrapedData: [], currentVideoIndex: 0, scrapePhase: 'overview', channelId });

    const firstVideo = videos[0];
    chrome.runtime.sendMessage({
        action: 'navigateTo',
        url: `https://studio.youtube.com/video/${firstVideo.videoId}/analytics/tab-overview/period-default`
    });
}

async function continueScrapingOnCurrentPage(state) {
    if (window.ytScraperStopRequested) {
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    const { scrapeQueue, currentVideoIndex, channelId } = state;
    if (!scrapeQueue || scrapeQueue.length === 0) {
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    const pageType = getPageType();
    const video = scrapeQueue[currentVideoIndex];
    const total = scrapeQueue.length;
    const current = currentVideoIndex + 1;

    console.log(`[Content Script] Processing video ${current}/${total}: ${video.videoId} — phase: ${pageType}`);

    chrome.runtime.sendMessage({
        action: 'updateProgress',
        currentVideo: current,
        totalVideos: total,
        phase: pageType,
        videoTitle: video.title
    });

    const navigateToNext = async (nextIndex) => {
        if (nextIndex >= scrapeQueue.length) {
            console.log('[Content Script] All videos scraped.');
            chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
            if (channelId) {
                chrome.runtime.sendMessage({
                    action: 'navigateTo',
                    url: `https://studio.youtube.com/channel/${channelId}/videos`
                });
            }
        } else {
            const nextVideo = scrapeQueue[nextIndex];
            chrome.runtime.sendMessage({
                action: 'navigateTo',
                url: `https://studio.youtube.com/video/${nextVideo.videoId}/analytics/tab-overview/period-default`
            });
        }
    };

    try {
        if (pageType === 'overview') {
            const overviewData = await scrapeOverviewTab();
            const result = await chrome.storage.local.get(['scrapedData']);
            const scrapedData = result.scrapedData || [];
            scrapedData[currentVideoIndex] = {
                videoId: video.videoId,
                title: video.title,
                uploadDate: video.uploadDate,
                videoDuration: video.videoDuration,
                ...(overviewData || {})
            };
            await chrome.storage.local.set({ scrapedData, scrapePhase: 'reach48h' });

            const url48h = buildFirst2DaysUrl(video.videoId);
            if (url48h) {
                chrome.runtime.sendMessage({ action: 'navigateTo', url: url48h });
            } else {
                // No valid date — skip reach48h, go straight to reach
                await chrome.storage.local.set({ scrapePhase: 'reach' });
                chrome.runtime.sendMessage({
                    action: 'navigateTo',
                    url: `https://studio.youtube.com/video/${video.videoId}/analytics/tab-reach_viewers/period-default`
                });
            }

        } else if (pageType === 'reach48h') {
            const reach48hData = await scrapeReach48hTab();
            const result = await chrome.storage.local.get(['scrapedData']);
            const scrapedData = result.scrapedData || [];
            if (scrapedData[currentVideoIndex]) {
                scrapedData[currentVideoIndex] = { ...scrapedData[currentVideoIndex], ...(reach48hData || {}) };
            }
            await chrome.storage.local.set({ scrapedData, scrapePhase: 'reach' });

            chrome.runtime.sendMessage({
                action: 'navigateTo',
                url: `https://studio.youtube.com/video/${video.videoId}/analytics/tab-reach_viewers/period-default`
            });

        } else if (pageType === 'reach') {
            const reachData = await scrapeReachTab();
            const result = await chrome.storage.local.get(['scrapedData']);
            const scrapedData = result.scrapedData || [];
            if (scrapedData[currentVideoIndex]) {
                scrapedData[currentVideoIndex] = { ...scrapedData[currentVideoIndex], ...(reachData || {}) };
            }

            const nextIndex = currentVideoIndex + 1;
            await chrome.storage.local.set({ scrapedData, currentVideoIndex: nextIndex, scrapePhase: 'overview' });
            await navigateToNext(nextIndex);

        } else {
            console.warn('[Content Script] Unexpected page type during continue:', pageType);
            chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        }
    } catch (err) {
        console.error('[Content Script] Error during scraping:', err);
        const nextIndex = currentVideoIndex + 1;
        const result = await chrome.storage.local.get(['scrapedData']);
        const scrapedData = result.scrapedData || [];
        await chrome.storage.local.set({ scrapedData, currentVideoIndex: nextIndex, scrapePhase: 'overview' });
        await navigateToNext(nextIndex);
    }
}

// ===================== GUARD — only register listeners once =====================

if (!window.ytScraperLoaded) {
    window.ytScraperLoaded = true;
    window.ytScraperStopRequested = false;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[Content Script] Message received:', request.action);

        if (request.action === 'startScraping') {
            window.ytScraperStopRequested = false;
            runScraping();
            sendResponse({ status: 'started' });
        } else if (request.action === 'stopScraping') {
            window.ytScraperStopRequested = true;
            sendResponse({ status: 'stopped' });
        }

        return true;
    });

    // Auto-continue when navigated to an analytics page mid-scrape
    chrome.storage.local.get(['isScraping', 'scrapePhase', 'scrapeQueue', 'currentVideoIndex', 'channelId'], (state) => {
        const pageType = getPageType();
        if (state.isScraping && (pageType === 'overview' || pageType === 'reach48h' || pageType === 'reach')) {
            console.log('[Content Script] Resuming scraping on page load. Phase:', pageType);
            continueScrapingOnCurrentPage(state);
        }
    });

    console.log('[Content Script] Loaded. Page type:', getPageType());
}
