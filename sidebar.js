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
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
        });
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
                    const welcomeMessage = document.createElement('div');
                    welcomeMessage.className = 'message bot';
                    welcomeMessage.textContent = `I'm ready to help you with information about "${pageTitle}". What would you like to know?`;
                    chatMessages.appendChild(welcomeMessage);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
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

        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot';
        loadingDiv.innerHTML = '<div class="loading"></div>';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Send to Gemini API
        sendToGeminiAPI(message, loadingDiv);
    }

    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
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
        
        Please answer the user's question based on the webpage content. If the answer isn't in the content, politely say so.
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
                    appendMessage(`Error: ${data.error.message || 'Failed to get response from Gemini'}`, 'system');
                } else {
                    appendMessage('Sorry, I couldn\'t generate a response. Please try again.', 'system');
                }
            })
            .catch(error => {
                chatMessages.removeChild(loadingElement);
                appendMessage(`Error: ${error.message || 'Failed to connect to Gemini API'}`, 'system');
                console.error('Error:', error);
            });
    }
});