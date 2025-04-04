// background.js
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
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