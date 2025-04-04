// background.js
function isGoogleDomain(url) {
    if (!url) return false;
    return url.match(/^https?:\/\/([^\/]+\.)?google\.(com|co\.[a-z]{2,}|[a-z]{2})\/.*$/i) !== null;
}

// Listen for tab updates to manage icon state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only process if URL is available
    if (tab.url) {
        try {
            // Set icon based on whether it's a Google domain
            const iconPath = {
                "16": "images/icon16.png",
                "48": "images/icon48.png",
                "128": "images/icon128.png"
            };

            if (isGoogleDomain(tab.url)) {
                // Disable icon for Google domains
                chrome.action.setIcon({
                    path: {
                        "16": "images/icon16-disabled.png",
                        "48": "images/icon48-disabled.png",
                        "128": "images/icon128-disabled.png"
                    },
                    tabId: tabId
                });
                chrome.action.disable(tabId);
            } else {
                // Enable icon for non-Google domains
                chrome.action.setIcon({
                    path: iconPath,
                    tabId: tabId
                });
                chrome.action.enable(tabId);
            }
        } catch (error) {
            console.error('Error setting icon:', error);
            // Set default icon as fallback
            chrome.action.setIcon({
                path: {
                    "16": "images/icon16.png",
                    "48": "images/icon48.png",
                    "128": "images/icon128.png"
                },
                tabId: tabId
            });
        }
    }
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && !isGoogleDomain(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
    }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle_sidebar") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && !isGoogleDomain(tabs[0].url)) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
            }
        });
    }
});