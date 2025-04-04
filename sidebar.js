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

    let pageContent = '';
    let pageTitle = '';
    let pageUrl = '';
    let apiKey = '';
    let chatHistory = []; // Add this to store conversation history

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
    chrome.storage.local.get('geminiApiKey', function (data) {
        if (data.geminiApiKey) {
            apiKey = data.geminiApiKey;
            apiKeyContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            fetchPageContent();
        }
    });

    // Save API key
    saveApiKeyBtn.addEventListener('click', function () {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;
            chrome.storage.local.set({ 'geminiApiKey': key }, function () {
                apiKeyContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                fetchPageContent();
            });
        }
    });

    // Close sidebar
    closeBtn.addEventListener('click', function () {
        // Send message to parent window (content.js) instead of using chrome.tabs directly
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
        // Get page content from the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "get_page_content" }, function (response) {
                if (response) {
                    pageContent = response.content;
                    pageTitle = response.title;
                    pageUrl = response.url;

                    // Add a welcome message with the page title
                    appendMessage(`I'm ready to help you with information about **"${pageTitle}"**. What would you like to know?`, 'bot');
                }
            });
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

    // Modify sendToGeminiAPI to include chat history
    function sendToGeminiAPI(userQuery, loadingElement) {
        // Create conversation context from history
        const conversationContext = chatHistory
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n\n');

        const prompt = `
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
    }

    // Add function to clear chat history
    function clearChat() {
        chatHistory = [];
        chatMessages.innerHTML = '';
        // Add initial welcome message
        appendMessage(`I'm ready to help you with information about **"${pageTitle}"**. What would you like to know?`, 'bot');
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
});