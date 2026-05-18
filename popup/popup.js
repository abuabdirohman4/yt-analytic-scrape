document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const statusCardWrap = document.getElementById('statusCardWrap');
    const progressCardWrap = document.getElementById('progressCardWrap');
    const statusCard = document.getElementById('statusCard');
    const statusIconCircle = document.getElementById('statusIconCircle');
    const statusIconSvg = document.getElementById('statusIconSvg');
    const statusDot = document.getElementById('statusDot');
    const statusLabel = document.getElementById('statusLabel');
    const statusSub = document.getElementById('statusSub');
    const progressCount = document.getElementById('progressCount');
    const progressTitle = document.getElementById('progressTitle');
    const progressFill = document.getElementById('progressFill');
    const etaPill = document.getElementById('etaPill');
    const etaEstimating = document.getElementById('etaEstimating');
    const themeToggle = document.getElementById('themeToggle');

    // ── Icons ──
    const ICONS = {
        check: '<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" fill="currentColor"/>',
        play:  '<path d="M8 5v14l11-7L8 5Z" fill="currentColor"/>',
        error: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" fill="currentColor"/>',
    };

    // ── Theme ──
    chrome.storage.local.get(['theme'], (r) => {
        const theme = r.theme || 'dark';
        applyTheme(theme);
    });

    themeToggle.addEventListener('click', () => {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        chrome.storage.local.set({ theme: next });
    });

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        themeToggle.textContent = theme === 'dark' ? '☀' : '🌙';
    }

    // ── Status card helpers ──
    function showStatusCard(label, sub, iconName, dotColor) {
        statusCardWrap.style.display = '';
        progressCardWrap.style.display = 'none';

        statusLabel.textContent = label;
        statusSub.textContent = sub;
        statusIconSvg.innerHTML = ICONS[iconName] || ICONS.check;

        statusIconCircle.className = 'status-icon-circle';
        statusDot.style.background = dotColor;
        statusCard.querySelector('svg').style.color = dotColor;
    }

    function showProgressCard() {
        statusCardWrap.style.display = 'none';
        progressCardWrap.style.display = '';
    }

    // ── UI state ──
    function updateUI(isScraping, status) {
        startButton.disabled = isScraping;
        stopButton.disabled = !isScraping;

        if (isScraping) return; // progress card handles the display

        const s = (status || '').toLowerCase();
        if (s.includes('done')) {
            showStatusCard('Scrape complete', 'CSV downloaded successfully', 'check', '#16a34a');
        } else if (s.includes('error') || s.includes('fail') || s.includes('injection')) {
            showStatusCard(status, 'Check the console for details', 'error', '#f59e0b');
        } else if (s.includes('stop')) {
            showStatusCard('Stopped', 'Click Start to begin a new scrape', 'check', '#606060');
        } else {
            showStatusCard('Ready to scrape', 'Open Content page in Studio', 'check', '#16a34a');
        }
    }

    // ── Progress card helpers ──
    function showProgressFromData(data) {
        const { currentVideo, totalVideos, phase, videoTitle, etaSeconds } = data;
        showProgressCard();

        const pct = Math.max(2, Math.round((currentVideo / totalVideos) * 100));
        const phaseLabel = phase === 'reach' ? 'Reach' : 'Overview';

        progressCount.textContent = `Video ${currentVideo}/${totalVideos}`;
        progressTitle.textContent = `${phaseLabel}: ${videoTitle || ''}`;
        progressFill.style.width = `${pct}%`;

        if (etaSeconds != null) {
            const min = Math.floor(etaSeconds / 60);
            const sec = etaSeconds % 60;
            etaPill.textContent = `~${min > 0 ? min + 'm ' : ''}${sec}s left`;
            etaPill.style.display = '';
            etaEstimating.style.display = 'none';
        } else {
            etaPill.style.display = 'none';
            etaEstimating.style.display = '';
        }
    }

    // ── Buttons ──
    startButton.addEventListener('click', () => {
        startButton.disabled = true;
        stopButton.disabled = false;
        showProgressCard();
        progressCount.textContent = 'Video 1/…';
        progressTitle.textContent = 'Starting…';
        progressFill.style.width = '0%';
        etaPill.style.display = 'none';
        etaEstimating.style.display = '';

        chrome.runtime.sendMessage({ action: 'startScraping' }, (response) => {
            if (chrome.runtime.lastError) {
                updateUI(false, 'Error: Failed to start');
            }
        });
    });

    stopButton.addEventListener('click', () => {
        stopButton.disabled = true;
        chrome.runtime.sendMessage({ action: 'stopScraping' });
    });

    // ── Live message listener ──
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'updateStatus') {
            updateUI(request.isScraping, request.status);
        } else if (request.action === 'updateProgress') {
            showProgressFromData(request);
        }
    });

    // ── Initial load — restore state ──
    chrome.storage.local.get(['isScraping', 'status', 'lastProgress'], (r) => {
        if (chrome.runtime.lastError || !r) {
            updateUI(false, 'Ready');
            return;
        }
        if (r.isScraping && r.lastProgress) {
            startButton.disabled = true;
            stopButton.disabled = false;
            showProgressFromData(r.lastProgress);
        } else {
            updateUI(r.isScraping ?? false, r.status ?? 'Ready');
        }
    });
});
