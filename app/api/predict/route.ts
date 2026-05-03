import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { subject } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  let query = supabase.from("questions").select("tags, year, subject");
  if (subject && subject !== "All") query = query.eq("subject", subject);

  const { data: questions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!questions || questions.length < 5) return NextResponse.json({ error: "Not enough data" }, { status: 400 });

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
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tag, d]) => `${tag}: ${d.count} times, years: ${d.years.sort().join(", ")}`)
    .join("\n");

  const years = [...new Set(questions.map(q => q.year))].sort();

  const prompt = `You are analysing a Cambridge ${subject || "Humanities"} past paper database to predict upcoming questions.

Topic frequency data:
${summary}

Total questions: ${questions.length}
Years covered: ${years.join(", ")}

Predict likely topics for the NEXT exam session based on:
1. Topics not seen recently (gap analysis)
2. Cyclical patterns
3. Underrepresented topics

Return ONLY JSON (no markdown):
{
  "predictions": [
    {"topic": "...", "confidence": "High|Medium|Low", "reasoning": "...", "lastSeen": "year or Never"}
  ],
  "insights": ["...", "...", "..."]
}

5-8 predictions, ranked most to least likely.`;

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
  const content = (data.content?.[0]?.text || "{}").replace(/```json\n?|```\n?/g, "").trim();
  try {
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ error: "Bad prediction response" }, { status: 500 });
  }
}
