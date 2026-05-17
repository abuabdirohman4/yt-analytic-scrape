// ===================== HELPERS =====================

function getPageType() {
    const url = window.location.href;
    if (url.includes('/videos') && !url.includes('/analytics')) return 'channel-content';
    if (url.includes('/analytics/tab-reach')) return 'reach';
    if (url.includes('/analytics/tab-interest_viewers')) return 'engagement';
    return 'other';
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

// ===================== SCRAPING FUNCTIONS =====================

async function getVideoListFromPage() {
    console.log('[Content Script] Waiting for video list to render...');
    try {
        await waitForElement('ytcp-video-row', 15000);
    } catch (e) {
        console.error('[Content Script] Timed out waiting for video list:', e.message);
        return [];
    }
    // Small delay to let all rows finish rendering
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

        // Extract video ID from any href containing /video/<id>/
        const link = row.querySelector('a[href*="/video/"][href*="/edit"]');
        if (!link) return;
        const match = link.href.match(/\/video\/([^/]+)\//);
        if (!match) return;
        const videoId = match[1];

        const titleEl = row.querySelector('#video-title');
        const title = titleEl ? titleEl.textContent.trim() : '';

        const dateEl = row.querySelector('.tablecell-date');
        const uploadDate = dateEl ? dateEl.textContent.trim().split('\n')[0].trim() : '';

        videos.push({ videoId, title, uploadDate });
    });

    console.log(`[Content Script] Found ${videos.length} published videos:`, videos);
    return videos;
}

async function scrapeReachTab() {
    console.log('[Content Script] Scraping Reach tab...');
    try {
        await waitForElement('yta-key-metric-block');
    } catch (e) {
        console.warn('[Content Script] Reach tab: no metric blocks found, skipping.');
        return null;
    }
    await new Promise(r => setTimeout(r, 1500));

    const impressions = getMetricByLabel('Impressions');
    const ctr = getMetricByLabel('click-through rate');
    const views = getMetricByLabel('Views');

    let suggestedVideos = null;
    let browseFeatures = null;

    // Traffic sources are in yta-table-card > tr.table-row rows.
    // Each row has: .title-text.debug-dimension-value (source name) and .value.debug-table-value (percentage)
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

    console.log('[Content Script] Reach data:', { impressions, ctr, views, suggestedVideos, browseFeatures });
    return { impressions, ctr, views, suggestedVideos, browseFeatures };
}

async function scrapeEngagementTab() {
    console.log('[Content Script] Scraping Engagement tab...');
    try {
        await waitForElement('yta-key-metric-block');
    } catch (e) {
        console.warn('[Content Script] Engagement tab: no metric blocks found, skipping.');
        return null;
    }
    await new Promise(r => setTimeout(r, 1500));

    const avgViewDuration = getMetricByLabel('Average view duration');
    console.log('[Content Script] Engagement data:', { avgViewDuration });
    return { avgViewDuration };
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

    const videos = await getVideoListFromPage();
    if (videos.length === 0) {
        console.error('[Content Script] No published videos found on page.');
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    await chrome.storage.local.set({ scrapeQueue: videos, scrapedData: [], currentVideoIndex: 0, scrapePhase: 'reach' });

    const firstVideo = videos[0];
    chrome.runtime.sendMessage({
        action: 'navigateTo',
        url: `https://studio.youtube.com/video/${firstVideo.videoId}/analytics/tab-reach_viewers/period-default`
    });
}

async function continueScrapingOnCurrentPage(state) {
    if (window.ytScraperStopRequested) {
        chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        return;
    }

    const { scrapeQueue, currentVideoIndex } = state;
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
        } else {
            const nextVideo = scrapeQueue[nextIndex];
            chrome.runtime.sendMessage({
                action: 'navigateTo',
                url: `https://studio.youtube.com/video/${nextVideo.videoId}/analytics/tab-reach_viewers/period-default`
            });
        }
    };

    try {
        if (pageType === 'reach') {
            const reachData = await scrapeReachTab();
            const result = await chrome.storage.local.get(['scrapedData']);
            const scrapedData = result.scrapedData || [];
            scrapedData[currentVideoIndex] = {
                videoId: video.videoId,
                title: video.title,
                uploadDate: video.uploadDate,
                ...(reachData || {})
            };
            await chrome.storage.local.set({ scrapedData, scrapePhase: 'engagement' });

            chrome.runtime.sendMessage({
                action: 'navigateTo',
                url: `https://studio.youtube.com/video/${video.videoId}/analytics/tab-interest_viewers/period-default`
            });

        } else if (pageType === 'engagement') {
            const engagementData = await scrapeEngagementTab();
            const result = await chrome.storage.local.get(['scrapedData']);
            const scrapedData = result.scrapedData || [];
            if (scrapedData[currentVideoIndex]) {
                scrapedData[currentVideoIndex] = { ...scrapedData[currentVideoIndex], ...(engagementData || {}) };
            }

            const nextIndex = currentVideoIndex + 1;
            await chrome.storage.local.set({ scrapedData, currentVideoIndex: nextIndex, scrapePhase: 'reach' });
            await navigateToNext(nextIndex);

        } else {
            console.warn('[Content Script] Unexpected page type during continue:', pageType);
            chrome.runtime.sendMessage({ action: 'scrapingJobDone' });
        }
    } catch (err) {
        console.error('[Content Script] Error during scraping:', err);
        // On unexpected error, skip to next video instead of stopping entirely
        const nextIndex = currentVideoIndex + 1;
        const result = await chrome.storage.local.get(['scrapedData']);
        const scrapedData = result.scrapedData || [];
        await chrome.storage.local.set({ scrapedData, currentVideoIndex: nextIndex, scrapePhase: 'reach' });
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
    chrome.storage.local.get(['isScraping', 'scrapePhase', 'scrapeQueue', 'currentVideoIndex'], (state) => {
        const pageType = getPageType();
        if (state.isScraping && (pageType === 'reach' || pageType === 'engagement')) {
            console.log('[Content Script] Resuming scraping on page load. Phase:', pageType);
            continueScrapingOnCurrentPage(state);
        }
    });

    console.log('[Content Script] Loaded. Page type:', getPageType());
}
