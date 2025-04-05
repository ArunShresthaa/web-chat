// sidebar.js
document.addEventListener('DOMContentLoaded', function () {
    const closeBtn = document.getElementById('close-btn');
    const apiKeyContainer = document.getElementById('api-key-container');
    const chatContainer = document.getElementById('chat-container');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const apiTypeRadios = document.getElementsByName('api-type');

    let pageContent = '';
    let pageTitle = '';
    let pageUrl = '';
    let apiKey = '';
    let chatHistory = []; // Add this to store conversation history
    let darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let currentApiType = 'gemini'; // Default to Gemini API

    // Initialize dark mode
    initTheme();

    // Add dark mode toggle button to header
    addDarkModeToggle();

    // Add API toggle button to header
    addApiToggle();

    // Configure marked.js for markdown parsing
    marked.setOptions({
        renderer: new marked.Renderer(),
        highlight: function (code, language) {
            if (language && hljs.getLanguage(language)) {
                try {
                    return hljs.highlight(code, { language }).value;
                } catch (err) { }
            }
            return hljs.highlightAuto(code).value;
        },
        pedantic: false,
        gfm: true,
        breaks: true,
        sanitize: false,
        smartypants: false,
        xhtml: false
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 120);
        this.style.height = newHeight + 'px';
    });

    // Check if API key is already stored
    chrome.storage.local.get(['geminiApiKey', 'groqApiKey', 'currentApiType'], function (data) {
        // Set the API type if saved
        if (data.currentApiType) {
            currentApiType = data.currentApiType;
            // Update radio button selection
            for (let radio of apiTypeRadios) {
                if (radio.value === currentApiType) {
                    radio.checked = true;
                    break;
                }
            }
        }

        // Get the appropriate API key based on current API type
        if (currentApiType === 'gemini' && data.geminiApiKey) {
            apiKey = data.geminiApiKey;
            apiKeyContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            fetchPageContent();
        } else if (currentApiType === 'groq' && data.groqApiKey) {
            apiKey = data.groqApiKey;
            apiKeyContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            fetchPageContent();
        }
    });

    // Listen for API type selection changes
    for (let radio of apiTypeRadios) {
        radio.addEventListener('change', function () {
            currentApiType = this.value;
            // Check if we already have this API key stored
            const keyToCheck = currentApiType === 'gemini' ? 'geminiApiKey' : 'groqApiKey';
            chrome.storage.local.get(keyToCheck, function (data) {
                if (data[keyToCheck]) {
                    apiKey = data[keyToCheck];
                    apiKeyInput.value = apiKey; // Update the input field
                }
            });
        });
    }

    // Save API key
    saveApiKeyBtn.addEventListener('click', function () {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;

            // Save the appropriate API key based on the selected API type
            const storageKey = currentApiType === 'gemini' ? 'geminiApiKey' : 'groqApiKey';
            const storageData = { [storageKey]: key, 'currentApiType': currentApiType };

            chrome.storage.local.set(storageData, function () {
                apiKeyContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                fetchPageContent();
            });
        }
    });

    // Close sidebar
    closeBtn.addEventListener('click', function () {
        // Send message to parent window (content.js)
        window.parent.postMessage({ action: "close_sidebar" }, "*");
    });

    // Handle sending messages
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function fetchPageContent() {
        // Get page content from the active tab via chrome.tabs API
        chrome.runtime.sendMessage({ action: "get_page_content" }, function (response) {
            if (response) {
                pageContent = response.content;
                pageTitle = response.title;
                pageUrl = response.url;

                // Check if this is a YouTube video with transcript
                if (response.isYouTubeVideo) {
                    // Check if transcript is truly available (not just a placeholder message)
                    const hasTranscript = response.transcript &&
                        !response.transcriptUnavailable &&
                        !response.transcript.includes("don't have access") &&
                        response.transcript.length > 50; // Real transcripts should be longer than this

                    if (hasTranscript) {
                        // Store transcript in context for the chat
                        pageContent = `[VIDEO TRANSCRIPT]: ${response.transcript}\n\n[PAGE CONTENT]: ${pageContent}`;

                        // Add a welcome message specific to YouTube videos with transcript
                        appendMessage(`I'm ready to help you chat about this YouTube video: **"${pageTitle}"**. I have access to the video transcript. What would you like to discuss about this video?`, 'bot');
                    } else {
                        // No transcript available
                        appendMessage(`I'm ready to help you chat about this YouTube video: **"${pageTitle}"**. However, I don't have access to the video transcript, so I can only discuss what's visible on the page. What would you like to know?`, 'bot');
                    }
                } else {
                    // Regular page content
                    appendMessage(`I'm ready to help you with information about **"${pageTitle}"**. What would you like to know?`, 'bot');
                }
            }
        });
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        appendMessage(message, 'user');
        userInput.value = '';
        userInput.style.height = '48px'; // Reset height

        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot';

        const loadingContent = document.createElement('div');
        loadingContent.className = 'message-content';
        loadingContent.innerHTML = '<div class="loading"></div> Thinking...';

        loadingDiv.appendChild(loadingContent);
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Send to Gemini API
        sendToGeminiAPI(message, loadingDiv);
    }

    // Add this function to manage chat history
    function addToChatHistory(role, content) {
        chatHistory.push({ role, content });
        // Limit history to last 10 messages to prevent token limits
        if (chatHistory.length > 10) {
            chatHistory.shift();
        }
    }

    // Modify appendMessage to also add to history
    function appendMessage(text, sender) {
        // Add to chat history
        addToChatHistory(sender === 'user' ? 'user' : 'assistant', text);

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        if (sender === 'bot') {
            // Parse markdown for bot messages
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';

            // Configure marked with safe options
            marked.setOptions({
                headerIds: false, // Disable header IDs to prevent XSS via anchor tags
                mangle: false,    // Disable mangling to prevent XSS via header IDs
            });

            // Create a custom marked extension for additional security
            const renderer = new marked.Renderer();

            // Secure link rendering
            renderer.link = (href, title, text) => {
                // Only allow http, https protocols
                if (!/^https?:\/\//i.test(href)) {
                    return text;
                }
                return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            };

            // Secure image rendering
            renderer.image = (href, title, text) => {
                // Only allow http, https protocols
                if (!/^https?:\/\//i.test(href)) {
                    return text;
                }
                return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
            };

            marked.setOptions({ renderer });

            // Parse markdown and sanitize with DOMPurify
            const htmlContent = marked.parse(text);
            const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
                ALLOWED_TAGS: [
                    'p', 'br', 'b', 'i', 'em', 'strong', 'code', 'pre',
                    'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3',
                    'h4', 'h5', 'h6', 'hr', 'img'
                ],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
                ALLOW_DATA_ATTR: false,
                ADD_ATTR: {
                    'a': 'target="_blank" rel="noopener noreferrer"'
                }
            });

            markdownDiv.innerHTML = sanitizedHtml;
            messageContent.appendChild(markdownDiv);

            // Apply syntax highlighting to code blocks
            messageContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            // Regular text for user messages
            messageContent.textContent = text;
        }

        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send message to the selected API (Gemini or Groq)
    function sendToGeminiAPI(userQuery, loadingElement) {
        // Create conversation context from history
        const conversationContext = chatHistory
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n\n');

        // Check if this is a YouTube video page by looking for transcript in content
        const isYouTubeVideo = pageContent.includes('[VIDEO TRANSCRIPT]:');

        let prompt;

        if (isYouTubeVideo) {
            prompt = `
                    You are a helpful assistant that answers questions about YouTube videos based on their transcripts.
                    
                    Current video: "${pageTitle}"
                    URL: ${pageUrl}
                    
                    Previous conversation context:
                    ${conversationContext}
                    
                    ${pageContent.substring(0, 15000)}
                    
                    User query: ${userQuery}
                    
                    Please answer the user's question based on the video transcript and previous conversation context.
                    If the answer isn't in the transcript, politely say so.
                    If asked about visual elements not described in the transcript, explain that you can only access the spoken content.
                    
                    IMPORTANT: Format your response using Markdown to improve readability.
                    - Use headings (##, ###) for organization
                    - Use **bold** or *italic* for emphasis
                    - Use \`code\` for technical terms or snippets
                    - Use bullet points or numbered lists for multiple items
                    - Use > for quotations from the transcript
                    
                    Keep your response concise and focused on answering the query.
                `;
        } else {
            prompt = `
                    You are a helpful assistant that answers questions about webpage content.
                    
                    Current webpage: "${pageTitle}"
                    URL: ${pageUrl}
                    
                    Previous conversation context:
                    ${conversationContext}
                    
                    Content of the webpage:
                    '''
                    ${pageContent.substring(0, 12000)}
                    '''
                    
                    User query: ${userQuery}
                    
                    Please answer the user's question based on the webpage content and previous conversation context.
                    If the answer isn't in the content, politely say so.
                    
                    IMPORTANT: Format your response using Markdown to improve readability.
                    - Use headings (##, ###) for organization
                    - Use **bold** or *italic* for emphasis
                    - Use \`code\` for technical terms or snippets
                    - Use bullet points or numbered lists for multiple items
                    - Use code blocks with language specification for code snippets (e.g., \`\`\`javascript)
                    - Use > for quotations from the page
                    
                    But keep your response concise and focused on answering the query.
                `;
        }

        // Based on API type, send to different endpoints with appropriate formatting
        if (currentApiType === 'gemini') {
            // Gemini API request
            fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            })
                .then(response => response.json())
                .then(data => {
                    // Remove loading indicator
                    chatMessages.removeChild(loadingElement);

                    // Check if we have a valid response
                    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                        const responseText = data.candidates[0].content.parts[0].text;
                        appendMessage(responseText, 'bot');
                    } else if (data.error) {
                        appendMessage(`**Error:** ${data.error.message || 'Failed to get response from Gemini'}`, 'bot');
                    } else {
                        appendMessage(`**Sorry!** I couldn't generate a response. Please try again.`, 'bot');
                    }
                })
                .catch(error => {
                    chatMessages.removeChild(loadingElement);
                    appendMessage(`**Error:** ${error.message || 'Failed to connect to Gemini API'}`, 'bot');
                    console.error('Error:', error);
                });
        } else {
            // Groq API request
            fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama3-70b-8192", // Using Llama3 model
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful assistant that analyzes webpage content and responds to user queries."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                })
            })
                .then(response => response.json())
                .then(data => {
                    // Remove loading indicator
                    chatMessages.removeChild(loadingElement);

                    // Check if we have a valid response
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        const responseText = data.choices[0].message.content;
                        appendMessage(responseText, 'bot');
                    } else if (data.error) {
                        appendMessage(`**Error:** ${data.error.message || 'Failed to get response from Groq'}`, 'bot');
                    } else {
                        appendMessage(`**Sorry!** I couldn't generate a response. Please try again.`, 'bot');
                    }
                })
                .catch(error => {
                    chatMessages.removeChild(loadingElement);
                    appendMessage(`**Error:** ${error.message || 'Failed to connect to Groq API'}`, 'bot');
                    console.error('Error:', error);
                });
        }
    }

    // Add function to clear chat history
    function clearChat() {
        chatHistory = [];
        chatMessages.innerHTML = '';

        // Check if this is a YouTube video page with a real transcript
        const hasRealTranscript = pageContent.includes('[VIDEO TRANSCRIPT]:') &&
            pageContent.split('[VIDEO TRANSCRIPT]:')[1].split('[PAGE CONTENT]:')[0].trim().length > 50;

        // Check if this is a YouTube video without transcript
        const isYouTubeWithoutTranscript = pageUrl.includes('youtube.com/watch?v=') && !hasRealTranscript;

        // Add initial welcome message based on page type
        if (hasRealTranscript) {
            appendMessage(`I'm ready to help you chat about this YouTube video: **"${pageTitle}"**. I have access to the video transcript. What would you like to discuss about this video?`, 'bot');
        } else if (isYouTubeWithoutTranscript) {
            appendMessage(`I'm ready to help you chat about this YouTube video: **"${pageTitle}"**. However, I don't have access to the video transcript, so I can only discuss what's visible on the page. What would you like to know?`, 'bot');
        } else {
            // Regular page content
            appendMessage(`I'm ready to help you with information about **"${pageTitle}"**. What would you like to know?`, 'bot');
        }
    }

    // Add a clear chat button to the UI
    function addClearChatButton() {
        const headerLogo = document.querySelector('.header-logo');
        const clearButton = document.createElement('button');
        clearButton.id = 'clear-chat';
        clearButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
            `;
        clearButton.setAttribute('aria-label', 'Clear chat');
        clearButton.addEventListener('click', clearChat);
        headerLogo.appendChild(clearButton);
    }

    // Call this when the page loads
    addClearChatButton();

    // Add this function to add a dark mode toggle button
    function addDarkModeToggle() {
        const headerLogo = document.querySelector('.header-logo');
        const darkModeButton = document.createElement('button');
        darkModeButton.id = 'dark-mode-toggle';
        darkModeButton.setAttribute('aria-label', 'Toggle dark mode');

        // Set initial icon based on current mode
        updateDarkModeIcon(darkModeButton);

        darkModeButton.addEventListener('click', () => {
            darkMode = !darkMode;
            updateTheme();
            updateDarkModeIcon(darkModeButton);

            // Save preference to storage
            chrome.storage.local.set({ 'darkModeEnabled': darkMode });
        });

        headerLogo.appendChild(darkModeButton);
    }

    function updateDarkModeIcon(button) {
        button.innerHTML = darkMode ?
            // Sun icon for light mode
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>` :
            // Moon icon for dark mode
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 A7 7 0 0 0 21 12.79z"></path>
                </svg>`;
    }

    function initTheme() {
        // Check if user has a saved preference
        chrome.storage.local.get('darkModeEnabled', (data) => {
            if (data.darkModeEnabled !== undefined) {
                darkMode = data.darkModeEnabled;
                updateTheme();
            }
        });

        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)')
                .addEventListener('change', e => {
                    // Only update if user hasn't set a preference
                    chrome.storage.local.get('darkModeEnabled', (data) => {
                        if (data.darkModeEnabled === undefined) {
                            darkMode = e.matches;
                            updateTheme();
                        }
                    });
                });
        }
    }

    function updateTheme() {
        if (darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }

    // Add API toggle button to the header
    function addApiToggle() {
        const headerLogo = document.querySelector('.header-logo');
        const apiToggleButton = document.createElement('button');
        apiToggleButton.id = 'api-toggle';
        apiToggleButton.setAttribute('aria-label', 'Toggle between Gemini and Groq APIs');

        // Set initial icon based on current API
        updateApiToggleIcon(apiToggleButton);

        apiToggleButton.addEventListener('click', () => {
            // Toggle between Gemini and Groq
            currentApiType = currentApiType === 'gemini' ? 'groq' : 'gemini';

            // Check if we have a key for the selected API
            const keyToCheck = currentApiType === 'gemini' ? 'geminiApiKey' : 'groqApiKey';
            chrome.storage.local.get(keyToCheck, function (data) {
                if (data[keyToCheck]) {
                    // If we have a key, use it
                    apiKey = data[keyToCheck];
                    updateApiToggleIcon(apiToggleButton);

                    // Save the preference
                    chrome.storage.local.set({ 'currentApiType': currentApiType });

                    // Show a message indicating API change
                    appendMessage(`Switched to ${currentApiType === 'gemini' ? 'Gemini' : 'Groq'} API. You can continue chatting.`, 'system');
                } else {
                    // If we don't have a key, prompt for one
                    appendMessage(`Please enter your ${currentApiType === 'gemini' ? 'Gemini' : 'Groq'} API key in the settings.`, 'system');

                    // Go back to the previous API since we don't have a key for the new one
                    currentApiType = currentApiType === 'gemini' ? 'groq' : 'gemini';
                    updateApiToggleIcon(apiToggleButton);

                    // Show the API key container
                    apiKeyContainer.style.display = 'flex';
                    chatContainer.style.display = 'none';

                    // Update the radio button selection
                    for (let radio of apiTypeRadios) {
                        if (radio.value === currentApiType) {
                            radio.checked = true;
                            break;
                        }
                    }
                }
            });
        });

        headerLogo.appendChild(apiToggleButton);
    }

    function updateApiToggleIcon(button) {
        button.innerHTML = currentApiType === 'gemini' ?
            // Gemini icon (simplified Google G)
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="api-toggle-gemini">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v8"></path>
                    <path d="M8 12h8"></path>
                </svg>` :
            // Groq icon (simplified lightning bolt)
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="api-toggle-groq">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>`;
    }
});
