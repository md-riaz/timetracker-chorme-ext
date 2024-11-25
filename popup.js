let currentPeriod = 'daily';
let updateInterval;
let lastUpdate = {};

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    return `${hours}h ${minutes}m ${seconds}s`;
}

function getDomain(url) {
    if (!url) return null;
    try {
        const { protocol, hostname } = new URL(url);
        return `${protocol}//${hostname}`;
    } catch (e) {
        return null;
    }
}

function getPeriodKey() {
    const date = new Date();
    switch (currentPeriod) {
        case 'daily':
            return date.toISOString().split('T')[0];
        case 'weekly':
            return getWeekNumber(date);
        case 'monthly':
            return date.toISOString().slice(0, 7);
    }
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

function createFaviconElement(domain, faviconUrl) {
    const container = document.createElement('div');
    container.className = 'favicon-container';

    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = faviconUrl || `chrome://favicon/${domain}`;  // Use Chrome's internal favicon service as fallback

    const fallback = document.createElement('div');
    fallback.className = 'favicon-fallback';
    fallback.textContent = domain ? domain[0].toUpperCase() : '?';

    img.onerror = () => {
        container.innerHTML = '';
        container.appendChild(fallback);
    };

    container.appendChild(img);
    return container;
}

async function updateDisplay() {
    const data = await chrome.storage.local.get(null);
    const siteList = document.querySelector('.site-list');
    const periodKey = getPeriodKey();

    // Get active tab info
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const currentDomain = currentTab ? getDomain(currentTab.url) : null;

    const sites = Object.entries(data)
        .map(([domain, timeData]) => {
            let time = timeData[currentPeriod][periodKey] || 0;

            if (domain === currentDomain) {
                const now = Date.now();
                if (lastUpdate[domain]) {
                    time += (now - lastUpdate[domain]);
                }
                lastUpdate[domain] = now;
            }

            return {
                domain,
                time,
                faviconUrl: timeData.faviconUrl
            };
        })
        .filter(site => site.time > 0)
        .sort((a, b) => b.time - a.time);

    if (sites.length === 0) {
        siteList.innerHTML = '<div class="no-data">No data for this period</div>';
        return;
    }

    const newHTML = sites.map(site => `
    <div class="site-item">
      ${createFaviconElement(site.domain, site.faviconUrl).outerHTML}
      <div class="site-info">
        <div class="site-domain">${site.domain || 'Unknown'}</div>
        <div class="time">${formatTime(site.time)}</div>
      </div>
    </div>
  `).join('');

    if (siteList.innerHTML !== newHTML) {
        siteList.innerHTML = newHTML;
    }
}

// Set up period toggle buttons
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.toggle-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentPeriod = btn.dataset.period;
        lastUpdate = {}; // Reset last update times when changing periods
        updateDisplay();
    });
});

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await updateDisplay();
    // Update display every second
    updateInterval = setInterval(updateDisplay, 1000);
});

// Cleanup
window.addEventListener('unload', () => {
    clearInterval(updateInterval);
});