// Configuration settings for the extension
const config = {
    // API endpoints
    ytTranscriptApiUrl: 'http://localhost:8000/yt-transcript',

    // Function to check if URL is a YouTube video
    isYoutubeVideo: (url) => {
        return url && url.includes('youtube.com/watch?v=');
    }
}; 