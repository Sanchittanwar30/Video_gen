# Video Generator Frontend

React frontend for the video generation system with OpenAI integration.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create `.env` file (optional):
```env
VITE_API_URL=http://localhost:3000
```

3. Start development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Features

- Video requirements form
- OpenAI-powered content generation
- Real-time job status tracking
- Video preview and download

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

