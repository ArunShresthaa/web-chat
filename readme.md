# Website Content Chat Extension

A Chrome extension that allows you to chat with any webpage's content using the Gemini AI API. Have interactive conversations about the content you're reading, ask questions, and get contextual responses.

## Features

- 🚀 Chat with any webpage content using Gemini AI
- 💬 Maintains conversation context for natural dialogue
- 🎨 Markdown support for formatted responses
- 📝 Syntax highlighting for code blocks
- ↔️ Resizable sidebar interface
- 🔐 Secure local API key storage
- ⌨️ Keyboard shortcut support
- 🎯 Context-aware responses
- 🔄 Real-time content updates

## Installation

### From Source

1. Clone this repository:

```bash
git clone [repository-url]
```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your Chrome toolbar

## Setup

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the extension icon in your Chrome toolbar
3. Enter your Gemini API key in the setup screen
4. The API key is stored locally in your browser and is never sent anywhere except to Google's Gemini API

## Usage

### Opening the Chat

- Click the extension icon in your toolbar, or
- Use the keyboard shortcut:
  - Windows/Linux: `Ctrl+Shift+S`
  - Mac: `Command+Shift+S`

### Features

- **Resize**: Drag the left edge of the sidebar to adjust its width
- **Chat**: Type your questions about the webpage content
- **Context**: The chat maintains conversation history for contextual follow-up questions
- **Formatting**: Responses are formatted in Markdown with syntax highlighting for code
- **Navigation**: Chat sidebar persists as you scroll the webpage

## Privacy & Security

### Data Usage

- Your Gemini API key is stored locally using Chrome's storage API
- Webpage content is processed locally and only sent to Gemini API when you ask questions
- Chat history is stored in memory and cleared when you close the sidebar
- No data is collected, stored, or transmitted to any third parties

### Security Considerations

- The extension requires minimal permissions:
  - `activeTab`: To access current webpage content
  - `storage`: To store your API key locally
  - `scripting`: To inject the chat interface

### API Usage

- All API calls are made directly to Google's Gemini API using your provided key
- Communication is encrypted using HTTPS
- API costs are based on your Gemini API usage terms

## Technical Details

### Architecture

- **Background Script**: Handles extension initialization and events
- **Content Script**: Manages the sidebar iframe and webpage integration
- **Sidebar**: Contains the chat interface and API communication logic

### Libraries Used

- `marked.js`: Markdown parsing
- `highlight.js`: Syntax highlighting for code blocks

### Browser Support

- Chrome/Chromium-based browsers (v88+)
- Manifest V3 compliant

## Development

### Project Structure

├── manifest.json
├── background.js
├── content.js
├── sidebar.js
├── sidebar.html
├── sidebar.css
└── lib/
├── marked.min.js
├── highlight.min.js
└── highlight.min.css

### Building

No build process required - the extension can be loaded directly as unpacked.

## Limitations

- Maximum webpage content length is limited to prevent token limits
- Chat history is limited to last 10 messages
- Works only on regular webpages (not on Chrome Web Store or other restricted pages)
- Requires active internet connection for API communication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License
