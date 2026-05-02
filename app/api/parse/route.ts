import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, action, subject } = await req.json();
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "No API key provided" }, { status: 401 });
  }

  let prompt = "";

  if (action === "parse") {
    prompt = `You are parsing a Cambridge ${subject || "Humanities"} past paper. 

Extract every question and sub-question from this text. Return ONLY a valid JSON array — no markdown, no explanation.

Each object must have:
- "questionNumber": string (e.g. "1", "2a", "3b(i)")
- "text": string (the full question text, including any source/stimulus references)
- "marks": number or null (if marks are shown in brackets)

Rules:
- Include main questions AND sub-parts as separate entries
- Preserve ALL the question text including context/source references
- Do NOT include instructions like "Answer ALL questions"
- If a question has multiple parts, list each part separately

Paper text:
---
${text.slice(0, 12000)}
---

Return ONLY the JSON array, nothing else.`;
  } else if (action === "tag") {
    prompt = `You are tagging a Cambridge ${subject || "History/Humanities"} past paper question with topic tags.

Question: "${text}"

Return ONLY a JSON object with one key "tags" containing an array of 1-3 relevant topic tags.

Tag guidelines for Cambridge Humanities:
- Use specific topic names (e.g. "Nationalism", "Cold War", "Colonialism", "Source analysis", "Causation", "Significance", "Comparison", "Essay — change over time")
- First tag should be the SKILL TYPE (e.g. "Source analysis", "Essay", "Short answer", "Causation question")
- Second/third tags should be CONTENT TOPICS from the paper
- Keep tags concise (2-4 words max each)
- Use Title Case

Return ONLY: {"tags": ["Tag1", "Tag2"]}`;
  }

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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "API error" }, { status: res.status });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    if (action === "parse") {
      // strip markdown fences if present
      const clean = content.replace(/```json\n?|```\n?/g, "").trim();
      const questions = JSON.parse(clean);
      return NextResponse.json({ questions });
    } else {
      const clean = content.replace(/```json\n?|```\n?/g, "").trim();
      const result = JSON.parse(clean);
      return NextResponse.json(result);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
