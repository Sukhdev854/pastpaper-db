# PaperBank — Cambridge Past Paper Database

Upload Cambridge past papers, extract questions with AI, tag by topic, and predict what's coming next.

## Features

- **Upload PDFs** — automatically extracts every question and sub-part
- **AI tagging** — Claude suggests topic tags for each question
- **Question bank** — filter by topic, year, search keywords
- **Predictions** — AI analyses patterns to predict likely upcoming questions
- **Export/Import** — your database as JSON, portable across devices

## Deploy to Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/pastpaper-db)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup

1. Go to **Settings** in the app
2. Paste your [Anthropic API key](https://console.anthropic.com/settings/keys)
3. Set your subject (e.g. History, Geography, Economics)
4. Upload a past paper PDF and you're ready

## Data storage

All data is stored in your browser's localStorage — nothing is sent to any server except directly to Anthropic's API for AI processing. Your API key never leaves your browser.

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- pdfjs-dist for PDF parsing
- Anthropic API (claude-sonnet) for question extraction and tagging
