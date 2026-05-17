document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const statusMessage = document.getElementById('statusMessage');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');

    const updateStatusMessage = (message, type = 'default') => {
        const icon = statusMessage.querySelector('.status-icon');
        const text = statusMessage.querySelector('.status-text');
        statusMessage.className = 'status-message';

        switch (type) {
            case 'running':
                icon.textContent = '↻';
                icon.style.animation = 'spin 1s linear infinite';
                statusMessage.classList.add('running');
                break;
            case 'success':
                icon.textContent = '✓';
                icon.style.animation = '';
                statusMessage.classList.add('success');
                break;
            case 'error':
                icon.textContent = '✕';
                icon.style.animation = '';
                statusMessage.classList.add('error');
                break;
            default:
                icon.textContent = '✓';
                icon.style.animation = '';
        }
        text.textContent = message;
    };

    const showProgress = (pct, label) => {
        progressContainer.style.display = 'flex';
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = label || '';
    };

    const hideProgress = () => {
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
    };

    const updateUI = (isScraping, status) => {
        startButton.disabled = isScraping;
        stopButton.disabled = !isScraping;
        if (status) {
            const type = isScraping ? 'running'
                : status.toLowerCase().includes('done') || status.toLowerCase().includes('ready') ? 'success'
                : status.toLowerCase().includes('error') || status.toLowerCase().includes('fail') ? 'error'
                : 'default';
            updateStatusMessage(status, type);
        }
        if (!isScraping) hideProgress();
    };

    const showProgressFromData = (data) => {
        const { currentVideo, totalVideos, phase, videoTitle, etaSeconds } = data;
        const pct = Math.round(((currentVideo - 1) / totalVideos) * 100);
        const phaseLabel = phase === 'reach' ? 'Reach' : 'Overview';

        let statusLabel = `Video ${currentVideo}/${totalVideos} — ${phaseLabel}`;
        if (videoTitle) statusLabel += ': ' + videoTitle.substring(0, 25);

        let etaLabel = '';
        if (etaSeconds != null) {
            const min = Math.floor(etaSeconds / 60);
            const sec = etaSeconds % 60;
            etaLabel = `~${min > 0 ? min + 'm ' : ''}${sec}s left`;
        }

        showProgress(pct, etaLabel);
        updateStatusMessage(statusLabel, 'running');
    };

    startButton.addEventListener('click', () => {
        updateUI(true, 'Starting...');
        chrome.runtime.sendMessage({ action: 'startScraping' }, (response) => {
            if (chrome.runtime.lastError) {
                updateUI(false, 'Failed to start');
            }
        });
    });

    stopButton.addEventListener('click', () => {
        updateUI(false, 'Stopping...');
        chrome.runtime.sendMessage({ action: 'stopScraping' });
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'updateStatus') {
            updateUI(request.isScraping, request.status);
        } else if (request.action === 'updateProgress') {
            showProgressFromData(request);
        }
    });

    // Load initial status + restore progress if popup reopened mid-scrape
    chrome.storage.local.get(['isScraping', 'status', 'lastProgress'], (r) => {
        if (chrome.runtime.lastError || !r) {
            updateUI(false, 'Ready to scrape');
            return;
        }
        updateUI(r.isScraping ?? false, r.status ?? 'Ready to scrape');
        if (r.isScraping && r.lastProgress) {
            showProgressFromData(r.lastProgress);
        }
    });
});
