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

        // Send the content back to the requester
        sendResponse({
            content: pageContent,
            title: pageTitle,
            url: url
        });
        return true; // Required for async sendResponse
    }
});

// Add this event listener to handle messages from the sidebar
window.addEventListener('message', function (event) {
    // Verify the message origin if needed
    if (event.data && event.data.action === "close_sidebar") {
        closeSidebar();
    }
});

function openSidebar() {
    if (!sidebarIframe) {
        // Create iframe for sidebar with minimal styling to prevent leakage
        sidebarIframe = document.createElement('iframe');
        sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
        sidebarIframe.id = 'website-chat-sidebar';

        // Apply only positioning styles to the iframe itself
        Object.assign(sidebarIframe.style, {
            height: '100%',
            width: '400px',
            position: 'fixed',
            top: '0',
            right: '-400px',  // Start off-screen for animation
            zIndex: '9999',
            border: 'none',
            boxShadow: '-2px 0 5px rgba(0,0,0,0.2)',
            transition: 'right 0.3s ease-in-out'
        });

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'website-chat-resize-handle';

        // Minimal styling for resize handle
        Object.assign(resizeHandle.style, {
            position: 'fixed',
            top: '0',
            bottom: '0',
            width: '5px',
            cursor: 'ew-resize',
            zIndex: '10000',
            right: '400px', // Position next to iframe
            backgroundColor: 'transparent'
        });

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

            // Minimal styling for overlay
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                zIndex: '10001',
                cursor: 'ew-resize',
                backgroundColor: 'transparent'
            });

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
    }

    // Animate sidebar opening
    setTimeout(() => {
        sidebarIframe.style.right = '0';
    }, 50);

    sidebarOpen = true;
}

function closeSidebar() {
    if (sidebarIframe) {
        // Animate closing
        sidebarIframe.style.right = `-${sidebarIframe.style.width}`;

        // Remove resize handle
        const resizeHandle = document.getElementById('website-chat-resize-handle');
        if (resizeHandle) {
            resizeHandle.remove();
        }

        // Remove iframe after animation completes
        setTimeout(() => {
            if (sidebarIframe && sidebarIframe.parentNode) {
                sidebarIframe.parentNode.removeChild(sidebarIframe);
                sidebarIframe = null;
            }
        }, 300);
    }
    sidebarOpen = false;
}