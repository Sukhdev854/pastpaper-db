import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { questions, subject } = await req.json();
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 401 });

  // Build frequency map
  const tagFreq: Record<string, { count: number; years: number[] }> = {};
  for (const q of questions) {
    for (const tag of q.tags || []) {
      if (!tagFreq[tag]) tagFreq[tag] = { count: 0, years: [] };
      tagFreq[tag].count++;
      const yr = parseInt(q.year);
      if (yr && !tagFreq[tag].years.includes(yr)) tagFreq[tag].years.push(yr);
    }
  }

  const summary = Object.entries(tagFreq)
    .map(([tag, d]) => `${tag}: appeared ${d.count} times, years: ${d.years.sort().join(", ")}`)
    .join("\n");

  const prompt = `You are analysing a Cambridge ${subject || "Humanities"} past paper question database to predict likely upcoming questions.

Here is the topic frequency data from the database:
${summary}

Total questions in database: ${questions.length}
Years covered: ${Array.from(new Set(questions.map((q: { year: string }) => q.year))).sort().join(", ")}

Based on:
1. Topics that haven't appeared recently (gap analysis)
2. Topics that appear cyclically
3. Topics that have been underrepresented
4. Cambridge exam pattern trends

Return ONLY a JSON object (no markdown):
{
  "predictions": [
    {
      "topic": "Topic name",
      "confidence": "High" | "Medium" | "Low",
      "reasoning": "1-2 sentence explanation",
      "lastSeen": "year or 'Never'"
    }
  ],
  "insights": ["insight 1", "insight 2", "insight 3"]
}

Give 5-8 predictions, ranked from most to least likely.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const content = data.content?.[0]?.text || "{}";
    const clean = content.replace(/```json\n?|```\n?/g, "").trim();
    return NextResponse.json(JSON.parse(clean));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
