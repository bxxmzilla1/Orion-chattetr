# Orion

Orion is a desktop companion app. Upload your videos, tag and describe them, then
chat with Orion — an AI companion powered by the **Grok (x.ai) API** that reads
your video library for context and tries to build a real relationship with you
through small talk and genuine curiosity.

## Features

- **Chat** with Orion, a warm companion that gets to know you over time.
- **Persona**: write a free-text description of the personality you want Orion
  to have (name, tone, quirks, speech style). Orion analyzes it and stays in
  character in every reply. Leave it empty for the default personality.
  - **Build from documents**: pick a folder of reference files (PDF, DOCX, TXT, MD
    — including subfolders). Grok drafts a persona from everything in that folder.
    The persona prompt and folder path are saved locally (settings + localStorage)
    so they persist across restarts. Full immersion — never labels herself as AI.
    Review/edit anytime, then Save if you change it by hand.
- **Video Library**: upload videos, then add **tags** and a **description** to each.
- Orion uses your library's tags and descriptions as context in every conversation.
- Local-first: your videos, notes, and API key are stored only on your machine.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open **Settings** in the app and:
   - Enter your name (what Orion should call you).
   - Paste your **Grok API key** from [console.x.ai](https://console.x.ai).
   - Pick a model (default: `grok-4`).
   - Click **Save settings**.

## How to use

1. Go to **Library → Upload videos** and select one or more video files.
2. Click any video to add a **title**, **tags**, and a **description**.
3. Switch to **Chat** and start talking. Orion knows your library and will chat,
   ask about your day, and reference your videos naturally.

## Tech

- **Electron** (main + preload + renderer, context isolation enabled).
- Local videos are served to the renderer through a custom `orion-media://`
  protocol, so web security stays on.
- Data is stored as JSON in Electron's `userData` directory:
  - `videos.json` — your library and its tags/descriptions.
  - `settings.json` — your name, chosen model, and API key.

## Notes

- The Grok API key is stored locally in plain JSON in your user data folder and
  is only sent to `api.x.ai`. Treat that folder as sensitive.
- No thumbnails are generated with an external tool; previews use the video's
  own first frame.
