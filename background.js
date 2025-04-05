// background.js
// Listen for tab updates to enable icon for all domains
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only process if URL is available
    if (tab.url) {
        try {
            // Enable the icon for all domains
            chrome.action.enable(tabId);
        } catch (error) {
            console.error('Error updating icon state:', error);
        }
    }
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url) {
        try {
            // Check if we can access the tab
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => true
            });

            // If we can access the tab, send the message
            chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }).catch(error => {
                // If content script is not loaded yet, inject it
                if (error.message.includes("Receiving end does not exist")) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }).then(() => {
                        // Try sending the message again after injection
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
                        }, 100);
                    });
                }
            });
        } catch (error) {
            console.log("Cannot access this tab:", error);
        }
    }
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle_sidebar") {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                try {
                    // Check if we can access the tab
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => true
                    });

                    // If we can access the tab, send the message
                    chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }).catch(error => {
                        // If content script is not loaded yet, inject it
                        if (error.message.includes("Receiving end does not exist")) {
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content.js']
                            }).then(() => {
                                // Try sending the message again after injection
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
                                }, 100);
                            });
                        }
                    });
                } catch (error) {
                    console.log("Cannot access this tab:", error);
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
});