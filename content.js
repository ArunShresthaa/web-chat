// content.js
let sidebarOpen = false;
let sidebarIframe = null;
let videoTranscript = null;
let configIsReady = false;

// Function to check if config is available and set up YouTube handlers
function ensureConfigLoaded(retryCount = 0, maxRetries = 5) {
    if (typeof config !== 'undefined' && config) {
        configIsReady = true;
        return Promise.resolve(true);
    }

    // If we've exceeded max retries, return a rejected promise
    if (retryCount >= maxRetries) {
        return Promise.reject(new Error('Config failed to load after multiple attempts'));
    }

    // Implement exponential backoff - wait longer between each retry
    const delay = Math.min(100 * Math.pow(2, retryCount), 3000); // Max 3 second delay

    return new Promise(resolve => {
        setTimeout(() => {
            if (typeof config !== 'undefined' && config) {
                configIsReady = true;
                resolve(true);
            } else {
                // Retry with incremented count
                ensureConfigLoaded(retryCount + 1, maxRetries)
                    .then(resolve)
                    .catch(() => {
                        // Last resort - create a fallback config if all retries fail
                        if (!configIsReady) {
                            window.config = {
                                ytTranscriptApiUrl: 'http://localhost:8000/yt-transcript',
                                isYoutubeVideo: (url) => url && url.includes('youtube.com/watch?v=')
                            };
                            configIsReady = true;
                            resolve(true);
                        }
                    });
            }
        }, delay);
    });
}

// Try to initialize when the script loads
ensureConfigLoaded()
    .then(() => {
        console.log('Config initialized successfully');
    })
    .catch(err => {
        console.error('Config initialization failed, using fallback:', err);
    });

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
        // Always respond within the timeout period, even if there's an error
        getPageContent()
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error("Error getting page content:", error);
                sendResponse({
                    content: "Error retrieving page content.",
                    title: document.title || "Unknown Page",
                    url: window.location.href,
                    isYouTubeVideo: false,
                    error: error.message
                });
            });

        return true; // Required for async sendResponse
    }
});

// Function to get page content, including YouTube transcript if applicable
async function getPageContent() {
    try {
        // Wait for config to be loaded before proceeding
        try {
            await ensureConfigLoaded();
        } catch (configError) {
            console.error('Config loading error:', configError);
            // Continue with fallback behavior
        }

        // Get basic page information
        const pageContent = document.body.innerText;
        const pageTitle = document.title;
        const url = window.location.href;

        // Safely check if config exists and if this is a YouTube video
        if (typeof config !== 'undefined' && config && config.isYoutubeVideo && config.isYoutubeVideo(url)) {
            // Try to fetch the transcript if not already fetched
            if (!videoTranscript) {
                try {
                    // Set a timeout to avoid hanging if the server doesn't respond
                    const fetchPromise = fetchYouTubeTranscript(url);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Transcript fetch timed out')), 3000)
                    );

                    videoTranscript = await Promise.race([fetchPromise, timeoutPromise]);
                } catch (error) {
                    console.error('Error fetching YouTube transcript:', error);
                    videoTranscript = null; // Explicitly set to null on error
                }
            }

            // Return content with transcript if available
            return {
                content: pageContent,
                title: pageTitle,
                url: url,
                isYouTubeVideo: true,
                transcript: videoTranscript || 'Transcript could not be loaded.'
            };
        } else {
            // Return regular page content for non-YouTube pages or if config is not defined
            return {
                content: pageContent,
                title: pageTitle,
                url: url,
                isYouTubeVideo: false
            };
        }
    } catch (error) {
        // Ensure we always return something even if there's an error
        console.error('Error in getPageContent:', error);
        return {
            content: "Error retrieving page content.",
            title: document.title || "Unknown Page",
            url: window.location.href,
            isYouTubeVideo: false,
            error: error.message
        };
    }
}

// Function to fetch YouTube transcript
async function fetchYouTubeTranscript(videoUrl) {
    try {
        // Check if config is defined
        if (typeof config === 'undefined' || !config || !config.ytTranscriptApiUrl) {
            console.error('Config is not properly defined for transcript fetching');
            return null;
        }

        // Check if the local API is available first
        const response = await fetch(config.ytTranscriptApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch transcript: ${response.status}`);
        }

        const data = await response.json();

        // Verify the transcript data exists
        if (!data || !data.transcript) {
            throw new Error('Invalid transcript data returned from API');
        }

        return data.transcript;
    } catch (error) {
        console.error('Error fetching transcript:', error);
        // Return null instead of throwing to avoid breaking the promise chain
        return null;
    }
}

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