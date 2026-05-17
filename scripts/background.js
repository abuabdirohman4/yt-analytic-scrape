const setScrapingState = async (isScraping, status) => {
    await chrome.storage.local.set({ isScraping, status });
    try {
        await chrome.runtime.sendMessage({ action: 'updateStatus', isScraping, status });
    } catch (e) {
        if (!e.message.includes('Receiving end does not exist')) throw e;
    }
};

function injectAndSendCommand(command) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) {
            console.error('[Background] No active tab found.');
            setScrapingState(false, 'Error: No active tab found.');
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error(`[Background] Injection failed: ${chrome.runtime.lastError.message}`);
                setScrapingState(false, 'Injection failed.');
                return;
            }
            chrome.tabs.sendMessage(tab.id, command);
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        setScrapingState(true, 'Starting...');
        chrome.storage.local.set({ scrapedData: [], scrapeQueue: [], currentVideoIndex: 0 });
        injectAndSendCommand(request);
        sendResponse({ success: true });
    }

    else if (request.action === 'stopScraping') {
        setScrapingState(false, 'Stopped.');
        injectAndSendCommand({ action: 'stopScraping' });
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
        chrome.runtime.sendMessage(request);
    }

    else if (request.action === 'scrapingJobDone') {
        console.log('[Background] Scraping done. Generating CSV.');
        setScrapingState(false, 'Done!');
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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { url: request.url });
            }
        });
        sendResponse({ success: true });
    }

    return true;
});

function generateCSV(data) {
    const headers = [
        'Video ID',
        'Title',
        'Upload Date',
        'Impressions',
        'CTR',
        'Views',
        'Suggested Videos %',
        'Browse Features %',
        'Avg View Duration'
    ];

    const escapeCSV = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const rows = data.map(row => headers.map(h => {
        const keyMap = {
            'Video ID': 'videoId',
            'Title': 'title',
            'Upload Date': 'uploadDate',
            'Impressions': 'impressions',
            'CTR': 'ctr',
            'Views': 'views',
            'Suggested Videos %': 'suggestedVideos',
            'Browse Features %': 'browseFeatures',
            'Avg View Duration': 'avgViewDuration'
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
        currentVideoIndex: 0
    });
});
