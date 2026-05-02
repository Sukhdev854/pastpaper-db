# PaperBank — AI Past Paper Question Database

## Project idea

Build a web app for students to upload Cambridge past papers (PDF), have AI extract and split them into individual questions, tag each question with topic labels, and then analyse the database to predict what topics are likely to come up in upcoming exams.

## Core features

### 1. Upload & Parse
- User uploads a Cambridge past paper as a PDF
- User enters metadata: year (e.g. 2023), session (May/June, Oct/Nov, Feb/March), paper number (1/2/3), component code (optional, e.g. 9489/12)
- App extracts all text from the PDF
- AI (via API call) splits the text into individual questions and sub-parts (e.g. Q1, Q2a, Q2b, Q3a(i), Q3a(ii))
- Each question is stored with its metadata

### 2. AI Topic Tagging
- After parsing, each question is automatically sent to an AI API
- AI suggests 1–3 topic tags per question
- For humanities/social sciences (Cambridge History, Geography, Economics etc), tags should include:
  - Skill type: "Source analysis", "Essay", "Causation question", "Significance", "Comparison"
  - Content topic: e.g. "Cold War", "Nationalism", "Trade policy", "Urbanisation"
- User can review and edit tags inline (comma-separated input)

### 3. Question Bank
- Table/list view of all questions across all uploaded papers
- Filter by: topic tag, year, session, paper number
- Full text search across question text and tags
- Click to expand full question text

### 4. Predict & Analyse
- Topic frequency bar chart showing which topics appear most across the database
- Gap analysis: topics that haven't appeared recently (last 2–3 years)
- AI prediction report: ranked list of topics likely to appear next, with:
  - Confidence level (High / Medium / Low)
  - Reasoning (1–2 sentences)
  - Last seen year

### 5. Data Management
- Export full database as JSON
- Import from JSON (for backup/restore)
- Clear all data option

## Technical requirements

- **Framework**: Next.js (App Router) — must deploy directly to Vercel with zero config changes
- **Styling**: CSS Modules or Tailwind — dark theme preferred
- **PDF parsing**: pdfjs-dist library (client-side, no server needed for PDF reading)
- **AI**: Calls to Anthropic Claude API (claude-sonnet-4-20250514) via a Next.js API route
- **Storage**: localStorage only — no database, no backend auth, no external storage
- **API key**: User enters their own Anthropic API key in a Settings page; stored in localStorage; sent as a header to the internal API route which forwards it to Anthropic
- **Vercel ready**: No environment variables required, no external services, must build with `npm run build` with zero errors

## Data model

Each question object:
```json
{
  "id": "q_1234567890_0",
  "paperId": "paper_1234567890",
  "year": "2023",
  "session": "May/June",
  "paperNumber": "1",
  "component": "9489/12",
  "questionNumber": "2a",
  "text": "Study Sources A and B. How far do these sources agree about...",
  "marks": 15,
  "tags": ["Source analysis", "Cold War"],
  "createdAt": 1234567890
}
```

## UI layout

- Sidebar navigation with 4 tabs: Upload, Question Bank, Predict, Settings
- Stats in sidebar: total papers, questions, topics
- Clean, dense data UI — this is a study tool, not a landing page
- Toast notifications for feedback (success/error)
- Responsive (works on mobile too)

## Subject context

Designed primarily for Cambridge IGCSE and A-Level **Humanities and Social Sciences** (History, Geography, Economics, Sociology, etc). The AI tagging prompts should be tuned for this context. The subject is configurable in Settings.

## What NOT to build

- No user accounts or login
- No cloud database
- No file hosting
- No payment system
- No mark scheme generation (future feature)
- No multi-user features

## Success criteria

A student can:
1. Upload 5+ years of past papers in one session
2. Have all questions automatically tagged
3. See which topics come up most often
4. Get a prediction of what's likely to appear next year
5. Filter the bank to practice only questions from a specific topic
