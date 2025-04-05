// background.js
function isExcludedDomain(url) {
    if (!url) return false;
    return url.match(/^https?:\/\/([^\/]+\.)?(google\.(com|co\.[a-z]{2,}|[a-z]{2})|youtube\.com)\/.*$/i) !== null;
}

// Set up the side panel when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    // Configure the side panel for all URLs
    chrome.sidePanel.setOptions({
        path: 'sidebar.html',
        enabled: true
    });
});

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
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url && !isExcludedDomain(tab.url)) {
        try {
            // Toggle the side panel
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
            console.log("Error opening side panel:", error);
        }
    }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle_sidebar") {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !isExcludedDomain(tab.url)) {
                try {
                    // Get the current state of the side panel
                    const panelInfo = await chrome.sidePanel.getOptions({ tabId: tab.id });

                    if (panelInfo.enabled) {
                        // Toggle the side panel visibility
                        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        await chrome.sidePanel.open({ tabId: currentTab.id });
                    }
                } catch (error) {
                    console.log("Error toggling side panel:", error);
                }
            }
        } catch (error) {
            console.error('Error in command listener:', error);
        }
    }
});

// Listen for messages from content scripts or sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_page_content") {
        // Forward the request to the active tab's content script
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "get_page_content" }, (response) => {
                    sendResponse(response);
                });
            }
        });
        return true; // Required for async sendResponse
    }

    if (request.action === "close_side_panel") {
        // Close the side panel
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.sidePanel.close({ tabId: tabs[0].id }).catch(error => {
                    console.error("Error closing side panel:", error);
                });
            }
        });
    }
});