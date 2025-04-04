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

    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        if (sender === 'bot') {
            // Parse markdown for bot messages
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';
            markdownDiv.innerHTML = marked.parse(text);
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

    function sendToGeminiAPI(userQuery, loadingElement) {
        const prompt = `
        You are a helpful assistant that answers questions about webpage content.
        
        Current webpage: "${pageTitle}"
        URL: ${pageUrl}
        
        Content of the webpage:
        '''
        ${pageContent.substring(0, 12000)} // Limiting content length to avoid token limits
        '''
        
        User query: ${userQuery}
        
        Please answer the user's question based on the webpage content. 
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
});