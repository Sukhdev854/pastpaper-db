# PaperBank v2 — Cloud Edition

Cambridge past paper database with real cloud storage. Upload once, access from anywhere.

## Stack
- **Next.js 14** — frontend + API routes
- **Supabase** — Postgres database (free tier is plenty)
- **Anthropic Claude** — question extraction + topic tagging + predictions
- **Vercel** — hosting (zero config)

---

## One-time Setup (takes ~10 minutes)

### 1. Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Once created: go to **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Settings → API** → copy your **Project URL** and **anon/public key**

### 2. Deploy to Vercel
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add these **Environment Variables** before deploying:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |
| `APP_PASSWORD` | Any password you choose |
| `JWT_SECRET` | Run `openssl rand -base64 32` and paste the output |

4. Click **Deploy** — that's it.

### 3. Open the app
Go to your Vercel URL, enter your password, and start uploading papers.

---

## How to upload papers

Name your PDFs in the Cambridge format:
```
9708_s23_qp_22.pdf
```
- `9708` — subject code
- `s` — session (s = May/June, w = Oct/Nov, m = Feb/March)
- `23` — year (2023)
- `qp` — question paper (always this)
- `22` — paper 2, variant 2

Then go to Upload → select any number of PDFs → click Process.

---

## Local development

```bash
cp .env.example .env.local
# fill in your values
npm install
npm run dev
```
