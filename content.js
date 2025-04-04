// content.js
let sidebarOpen = false;
let sidebarIframe = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle_sidebar") {
        if (sidebarOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    if (request.action === "get_page_content") {
        // Get the content of the page
        const pageContent = document.body.innerText;
        const pageTitle = document.title;
        const url = window.location.href;

        // Send the content back to the sidebar
        sendResponse({
            content: pageContent,
            title: pageTitle,
            url: url
        });
        return true;
    }
});

function openSidebar() {
    if (!sidebarIframe) {
        // Create iframe for sidebar
        sidebarIframe = document.createElement('iframe');
        sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
        sidebarIframe.id = 'website-chat-sidebar';
        sidebarIframe.style.height = '100%';
        sidebarIframe.style.width = '350px';
        sidebarIframe.style.position = 'fixed';
        sidebarIframe.style.top = '0';
        sidebarIframe.style.right = '0';
        sidebarIframe.style.zIndex = '9999';
        sidebarIframe.style.border = 'none';
        sidebarIframe.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.2)';
        sidebarIframe.style.transition = 'all 0.3s ease-in-out';
        document.body.appendChild(sidebarIframe);
    }

    // Animate sidebar opening
    setTimeout(() => {
        sidebarIframe.style.right = '0';
    }, 50);

    sidebarOpen = true;
}

function closeSidebar() {
    if (sidebarIframe) {
        // Animate sidebar closing
        sidebarIframe.style.right = '-350px';

        // Remove iframe after animation completes
        setTimeout(() => {
            document.body.removeChild(sidebarIframe);
            sidebarIframe = null;
        }, 300);
    }

    sidebarOpen = false;
}