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
        console.log('[Background] Scraping done. Generating export.');
        setScrapingState(false, 'Done!');
        chrome.storage.local.set({ lastProgress: null });
        chrome.storage.local.get(['scrapedData', 'exportFormat', 'scrapingTabId'], (result) => {
            const data = result.scrapedData || [];
            const format = result.exportFormat || 'csv';
            if (data.length === 0) {
                sendResponse({ success: false });
                return;
            }
            if (format === 'excel') {
                const xml = generateExcel(data);
                const dataUrl = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(xml);
                const filename = `yt-analytics_${Date.now()}.xls`;
                chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[Background] Download failed:', chrome.runtime.lastError.message);
                    }
                });
            } else {
                const csv = generateCSV(data);
                const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                const filename = `yt-analytics_${Date.now()}.csv`;
                chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[Background] Download failed:', chrome.runtime.lastError.message);
                    }
                });
            }
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

const HEADERS = [
    'Upload Date',
    'Video Age (Day)',
    'Impressions',
    'Impressions First 2 Days',
    'CTR',
    'Views',
    'Suggested + Browse',
    'Video Duration',
    'Avg View Duration',
    'Avg % Viewed'
];

const KEY_MAP = {
    'Upload Date': 'uploadDate',
    'Impressions': 'impressions',
    'Impressions First 2 Days': 'impressions48h',
    'CTR': 'ctr',
    'Views': 'views',
    'Suggested + Browse': 'suggestedPlusBrowse',
    'Video Duration': 'videoDuration',
    'Avg View Duration': 'avgViewDuration',
    'Avg % Viewed': 'avgPctViewed'
};

const calcAgeDays = (uploadDateStr) => {
    if (!uploadDateStr) return '';
    const uploaded = new Date(uploadDateStr);
    if (isNaN(uploaded.getTime())) return '';
    return Math.floor((Date.now() - uploaded.getTime()) / (1000 * 60 * 60 * 24));
};

const getRowValue = (row, h) => {
    if (h === 'Video Age (Day)') return calcAgeDays(row.uploadDate);
    return row[KEY_MAP[h]] ?? '';
};

function generateCSV(data) {
    const escapeCSV = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const rows = data.map(row => HEADERS.map(h => escapeCSV(getRowValue(row, h))).join(','));
    return [HEADERS.join(','), ...rows].join('\n');
}

function generateExcel(data) {
    const escapeXml = (val) => {
        if (val == null) return '';
        return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const headerRow = HEADERS.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
    const dataRows = data.map(row => {
        const cells = HEADERS.map(h => {
            const val = getRowValue(row, h);
            const isNum = val !== '' && !isNaN(Number(String(val).replace('%', ''))) && !String(val).endsWith('%');
            const type = isNum ? 'Number' : 'String';
            return `<Cell><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Analytics">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isScraping: false,
        status: 'Ready',
        scrapedData: [],
        scrapeQueue: [],
        currentVideoIndex: 0,
        videoFinishTimes: [],
        lastProgress: null,
        scrapeFilter: { mode: 'all' },
        exportFormat: 'csv'
    });
});
