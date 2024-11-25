let startTime = {};
let activeTabId = null;
let activeUrl = null;
let isTracking = false;

function getDomain(url) {
    if (!url) return null;
    try {
        const domain = new URL(url).hostname;
        return domain;
    } catch (e) {
        return null;
    }
}

function startTracking(domain, faviconUrl) {
    if (!domain) return;

    if (!startTime[domain]) {
        startTime[domain] = Date.now();
        // Store or update favicon URL whenever we start tracking
        updateFaviconUrl(domain, faviconUrl);
    }
    isTracking = true;
}

function stopTracking() {
    if (activeUrl && isTracking) {
        updateTimeForDomain(activeUrl);
        isTracking = false;
    }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    stopTracking();

    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = getDomain(tab.url);

    activeTabId = activeInfo.tabId;
    activeUrl = domain;
    startTracking(domain, tab.favIconUrl);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId) {
        if (changeInfo.url) {
            stopTracking();
            const domain = getDomain(changeInfo.url);
            activeUrl = domain;
            startTracking(domain, tab.favIconUrl);
        } else if (changeInfo.favIconUrl) {
            // Update favicon URL when it changes
            if (activeUrl) {
                updateFaviconUrl(activeUrl, changeInfo.favIconUrl);
            }
        }
    }
});

function updateFaviconUrl(domain, faviconUrl) {
    if (!domain) return;

    chrome.storage.local.get([domain], (result) => {
        const data = result[domain] || { daily: {}, weekly: {}, monthly: {}, faviconUrl: null };
        if (faviconUrl) {
            data.faviconUrl = faviconUrl;
            chrome.storage.local.set({ [domain]: data });
        }
    });
}

function updateTimeForDomain(domain) {
    if (!domain || !startTime[domain]) return;

    const endTime = Date.now();
    const timeSpent = endTime - startTime[domain];
    delete startTime[domain];

    chrome.storage.local.get([domain], (result) => {
        const data = result[domain] || { daily: {}, weekly: {}, monthly: {}, faviconUrl: null };
        const today = new Date().toISOString().split('T')[0];
        const week = getWeekNumber(new Date());
        const month = new Date().toISOString().slice(0, 7);

        data.daily[today] = (data.daily[today] || 0) + timeSpent;
        data.weekly[week] = (data.weekly[week] || 0) + timeSpent;
        data.monthly[month] = (data.monthly[month] || 0) + timeSpent;

        chrome.storage.local.set({ [domain]: data });
    });
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

// Update storage every second
setInterval(() => {
    if (isTracking && activeUrl) {
        updateTimeForDomain(activeUrl);
        startTime[activeUrl] = Date.now();
    }
}, 1000);