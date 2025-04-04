// background.js
function isGoogleDomain(url) {
    return url.match(/^https?:\/\/([^\/]+\.)?google\.(com|co\.[a-z]{2,})\/.*$/i);
}

// Disable extension icon on Google domains
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        chrome.action.setIcon({
            path: {
                "16": "images/icon16.png",
                "48": "images/icon48.png",
                "128": "images/icon128.png"
            },
            tabId: tabId
        });

        chrome.action.setEnabled({
            tabId: tabId,
            enabled: !isGoogleDomain(tab.url)
        });
    }
});

// Existing click handler
chrome.action.onClicked.addListener((tab) => {
    if (!isGoogleDomain(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
    }
});

// Listen for the keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle_sidebar") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
            }
        });
    }
});