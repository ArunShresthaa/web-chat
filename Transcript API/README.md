# YouTube Transcript API

A FastAPI-based service that fetches transcripts from YouTube videos.

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Run the server:

```bash
python main.py
```

The server will start at `http://localhost:8000`

## API Usage

### Endpoint: `/yt-transcript`

**Method:** POST

**Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**

```json
{
  "transcript": "The transcript text..."
}
```

### Example using curl:

```bash
curl -X POST "http://localhost:8000/yt-transcript" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

## Features

- Supports various YouTube URL formats (youtube.com, youtu.be)
- Proper error handling
- Automatic transcript formatting
- FastAPI with automatic OpenAPI documentation

## API Documentation

Once the server is running, you can access the interactive API documentation at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
