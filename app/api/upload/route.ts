import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseFilename, getSubjectName } from "@/lib/types";

async function callClaude(messages: { role: string; content: string }[], apiKey: string) {
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
      messages,
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return text.replace(/```json\n?|```\n?/g, "").trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const body = await req.json();
  const { text, filename, subjectOverride } = body;

  const parsed = parseFilename(filename);
  if (!parsed) return NextResponse.json({ error: "Could not parse filename" }, { status: 400 });

  const subject = subjectOverride || getSubjectName(parsed.subjectCode);
  const paperId = `${parsed.subjectCode}_${parsed.year}_${parsed.session.replace("/", "")}_${parsed.paperNumber}_${Date.now()}`;

  // Step 1: extract questions
  const parsePrompt = `You are parsing a Cambridge ${subject} past paper.

Extract every question and sub-question. Return ONLY a valid JSON array, no markdown.

Each object:
- "questionNumber": string (e.g. "1", "2a", "3b(i)")
- "text": string (full question text)
- "marks": number or null

Rules: include ALL parts separately, preserve full text, skip admin instructions only.

Paper text:
---
${text.slice(0, 14000)}
---`;

  let questions: { questionNumber: string; text: string; marks?: number }[] = [];
  try {
    const raw = await callClaude([{ role: "user", content: parsePrompt }], apiKey);
    questions = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse questions: " + e }, { status: 500 });
  }

  // Step 2: batch tag all questions in one call
  const tagPrompt = `You are tagging Cambridge ${subject} past paper questions with topic tags.

For each question below, suggest 1-3 topic tags.
- First tag: skill type (e.g. "Source analysis", "Essay", "Causation", "Data response", "Short answer")
- Other tags: content topics specific to the subject

Return ONLY a JSON array of objects: [{"i": 0, "tags": ["Tag1", "Tag2"]}, ...]

Questions:
${questions.map((q, i) => `${i}. ${q.text.slice(0, 200)}`).join("\n")}`;

  let tagMap: Record<number, string[]> = {};
  try {
    const raw = await callClaude([{ role: "user", content: tagPrompt }], apiKey);
    const tagArr: { i: number; tags: string[] }[] = JSON.parse(raw);
    tagArr.forEach(({ i, tags }) => { tagMap[i] = tags; });
  } catch {
    // tagging failed — continue with empty tags
  }

  // Step 3: build DB rows
  const questionRows = questions.map((q, i) => ({
    id: `${paperId}_q${i}`,
    paper_id: paperId,
    subject,
    subject_code: parsed.subjectCode,
    year: parsed.year,
    session: parsed.session,
    paper_number: parsed.paperNumber,
    component: parsed.component,
    question_number: q.questionNumber,
    text: q.text,
    marks: q.marks ?? null,
    tags: tagMap[i] || [],
  }));

  const paperRow = {
    id: paperId,
    filename,
    subject,
    subject_code: parsed.subjectCode,
    year: parsed.year,
    session: parsed.session,
    paper_number: parsed.paperNumber,
    component: parsed.component,
    question_count: questionRows.length,
  };

  // Step 4: save to Supabase
  const { error: paperErr } = await supabase.from("papers").insert(paperRow);
  if (paperErr) return NextResponse.json({ error: paperErr.message }, { status: 500 });

  const { error: qErr } = await supabase.from("questions").insert(questionRows);
  if (qErr) {
    await supabase.from("papers").delete().eq("id", paperId);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, questionCount: questionRows.length, paperId });
}
