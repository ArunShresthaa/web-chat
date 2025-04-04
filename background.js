// background.js
function isExcludedDomain(url) {
    if (!url) return false;
    return url.match(/^https?:\/\/([^\/]+\.)?(google\.(com|co\.[a-z]{2,}|[a-z]{2})|youtube\.com)\/.*$/i) !== null;
}

// Listen for tab updates to manage icon state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only process if URL is available
    if (tab.url) {
        try {
            if (isExcludedDomain(tab.url)) {
                // Disable icon for excluded domains
                chrome.action.disable(tabId);
            } else {
                // Enable icon for non-excluded domains
                chrome.action.enable(tabId);
            }
        } catch (error) {
            console.error('Error updating icon state:', error);
        }
    }
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && !isExcludedDomain(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
    }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle_sidebar") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && !isExcludedDomain(tabs[0].url)) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
            }
        });
    }
});