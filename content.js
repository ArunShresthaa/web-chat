// content.js
// Listen for messages from the background script or side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_page_content") {
        // Get the content of the page
        const pageContent = document.body.innerText;
        const pageTitle = document.title;
        const url = window.location.href;

        // Send the content back to the requester
        sendResponse({
            content: pageContent,
            title: pageTitle,
            url: url
        });
        return true; // Required for async sendResponse
    }
});