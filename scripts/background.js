const setScrapingState = async (isScraping, status) => {
    await chrome.storage.local.set({ isScraping, status });
    try {
        await chrome.runtime.sendMessage({ action: 'updateStatus', isScraping, status });
    } catch (e) {
        if (!e.message.includes('Receiving end does not exist')) throw e;
    }
};

function injectToTab(tabId, command) {
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['scripts/content.js']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error(`[Background] Injection failed: ${chrome.runtime.lastError.message}`);
            setScrapingState(false, 'Injection failed.');
            return;
        }
        chrome.tabs.sendMessage(tabId, command);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                setScrapingState(false, 'No active tab found.');
                sendResponse({ success: false });
                return;
            }
            chrome.storage.local.set({
                scrapingTabId: tabId,
                videoFinishTimes: [],
                scrapedData: [],
                scrapeQueue: [],
                currentVideoIndex: 0,
                lastProgress: null
            });
            setScrapingState(true, 'Starting...');
            injectToTab(tabId, request);
            sendResponse({ success: true });
        });
        return true;
    }

    else if (request.action === 'stopScraping') {
        chrome.storage.local.get(['scrapingTabId'], (r) => {
            setScrapingState(false, 'Stopped.');
            if (r.scrapingTabId) injectToTab(r.scrapingTabId, { action: 'stopScraping' });
        });
        sendResponse({ success: true });
    }

    else if (request.action === 'getStatus') {
        chrome.storage.local.get(['isScraping', 'status'], (result) => {
            sendResponse({
                isScraping: result.isScraping ?? false,
                status: result.status ?? 'Ready'
            });
        });
        return true;
    }

    else if (request.action === 'updateProgress') {
        const { currentVideo, totalVideos, phase } = request;
        chrome.storage.local.get(['videoFinishTimes'], (r) => {
            const times = r.videoFinishTimes || [];

            // Record timestamp only when a video is fully done (reach = last phase per video)
            if (phase === 'reach') {
                times.push(Date.now());
                chrome.storage.local.set({ videoFinishTimes: times });
            }

            // ETA from average interval between completion timestamps
            let etaSeconds = null;
            if (times.length >= 2) {
                const intervals = [];
                for (let i = 1; i < times.length; i++) {
                    intervals.push(times[i] - times[i - 1]);
                }
                const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const videosLeft = totalVideos - currentVideo;
                etaSeconds = Math.round(avgMs * videosLeft / 1000);
            }

            const progressData = { ...request, etaSeconds };
            chrome.storage.local.set({ lastProgress: progressData });
            chrome.runtime.sendMessage(progressData).catch(() => {});
        });
    }

    else if (request.action === 'scrapingJobDone') {
        console.log('[Background] Scraping done. Generating CSV.');
        setScrapingState(false, 'Done!');
        chrome.storage.local.set({ lastProgress: null });
        chrome.storage.local.get(['scrapedData'], (result) => {
            const data = result.scrapedData || [];
            if (data.length === 0) {
                sendResponse({ success: false });
                return;
            }
            const csv = generateCSV(data);
            const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
            const filename = `yt-analytics_${Date.now()}.csv`;
            chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[Background] Download failed:', chrome.runtime.lastError.message);
                }
            });
        });
        sendResponse({ success: true });
        return true;
    }

    else if (request.action === 'navigateTo') {
        chrome.storage.local.get(['scrapingTabId'], (r) => {
            if (r.scrapingTabId) {
                chrome.tabs.update(r.scrapingTabId, { url: request.url });
            }
        });
        sendResponse({ success: true });
    }

    return true;
});

function generateCSV(data) {
    const headers = [
        'Upload Date',
        'Video Age (Day)',
        'Impressions (2 Days)',
        'Impressions',
        'CTR',
        'Views',
        'Suggested + Browse',
        'Video Duration',
        'Avg View Duration',
        'Avg % Viewed'
    ];

    const escapeCSV = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const calcAgeDays = (uploadDateStr) => {
        if (!uploadDateStr) return '';
        const uploaded = new Date(uploadDateStr);
        if (isNaN(uploaded.getTime())) return '';
        return Math.floor((Date.now() - uploaded.getTime()) / (1000 * 60 * 60 * 24));
    };

    const rows = data.map(row => headers.map(h => {
        if (h === 'Video Age (Day)') return escapeCSV(calcAgeDays(row.uploadDate));
        const keyMap = {
            'Upload Date': 'uploadDate',
            'Impressions (2 Days)': 'impressions48h',
            'Impressions': 'impressions',
            'CTR': 'ctr',
            'Views': 'views',
            'Suggested + Browse': 'suggestedPlusBrowse',
            'Video Duration': 'videoDuration',
            'Avg View Duration': 'avgViewDuration',
            'Avg % Viewed': 'avgPctViewed'
        };
        return escapeCSV(row[keyMap[h]]);
    }).join(','));

    return [headers.join(','), ...rows].join('\n');
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isScraping: false,
        status: 'Ready',
        scrapedData: [],
        scrapeQueue: [],
        currentVideoIndex: 0,
        videoFinishTimes: [],
        lastProgress: null
    });
});
