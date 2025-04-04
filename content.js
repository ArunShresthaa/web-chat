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

// Add this event listener to handle messages from the sidebar
window.addEventListener('message', function (event) {
    // Verify the message origin if needed
    if (event.data.action === "close_sidebar") {
        closeSidebar();
    }
});

function openSidebar() {
    if (!sidebarIframe) {
        // Create iframe for sidebar
        sidebarIframe = document.createElement('iframe');
        sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
        sidebarIframe.id = 'website-chat-sidebar';
        sidebarIframe.style.height = '100%';
        sidebarIframe.style.width = '400px';
        sidebarIframe.style.position = 'fixed';
        sidebarIframe.style.top = '0';
        sidebarIframe.style.right = '0';
        sidebarIframe.style.zIndex = '9999';
        sidebarIframe.style.border = 'none';
        sidebarIframe.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.2)';
        sidebarIframe.style.transition = 'all 0.3s ease-in-out';

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'website-chat-resize-handle';
        resizeHandle.style.position = 'fixed';
        resizeHandle.style.top = '0';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.width = '5px';
        resizeHandle.style.cursor = 'ew-resize';
        resizeHandle.style.zIndex = '10000';

        document.body.appendChild(sidebarIframe);
        document.body.appendChild(resizeHandle);

        // Add resize functionality
        let isResizing = false;
        let startX;
        let startWidth;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(sidebarIframe.style.width, 10);

            // Add temporary overlay to prevent iframe from capturing mouse events
            const overlay = document.createElement('div');
            overlay.id = 'resize-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.zIndex = '10001';
            document.body.appendChild(overlay);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = startWidth - (e.clientX - startX);
            const minWidth = 300; // Minimum width
            const maxWidth = Math.min(800, window.innerWidth - 100); // Maximum width

            if (width >= minWidth && width <= maxWidth) {
                sidebarIframe.style.width = `${width}px`;
                resizeHandle.style.right = `${width}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                const overlay = document.getElementById('resize-overlay');
                if (overlay) {
                    overlay.remove();
                }
            }
        });

        // Position resize handle
        updateResizeHandlePosition();
    }

    // Animate sidebar opening
    setTimeout(() => {
        sidebarIframe.style.right = '0';
        updateResizeHandlePosition();
    }, 50);

    sidebarOpen = true;
}

function updateResizeHandlePosition() {
    const resizeHandle = document.getElementById('website-chat-resize-handle');
    if (resizeHandle && sidebarIframe) {
        resizeHandle.style.right = sidebarIframe.style.width;
    }
}

function closeSidebar() {
    if (sidebarIframe) {
        sidebarIframe.style.right = `-${sidebarIframe.style.width}`;
        const resizeHandle = document.getElementById('website-chat-resize-handle');
        if (resizeHandle) {
            resizeHandle.remove();
        }
        setTimeout(() => {
            document.body.removeChild(sidebarIframe);
            sidebarIframe = null;
        }, 300);
    }
    sidebarOpen = false;
}