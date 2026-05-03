import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [{ data: questions }, { data: papers }] = await Promise.all([
    supabase.from("questions").select("subject, year, tags"),
    supabase.from("papers").select("subject, year"),
  ]);

  const subjects = [...new Set((questions || []).map((q) => q.subject))].sort();
  const years = [...new Set((questions || []).map((q) => q.year))].sort().reverse();

  const tagSet = new Set<string>();
  (questions || []).forEach((q) => (q.tags || []).forEach((t: string) => tagSet.add(t)));
  const tags = Array.from(tagSet).sort();

  const paperCount = papers?.length || 0;
  const questionCount = questions?.length || 0;

  return NextResponse.json({ subjects, years, tags, paperCount, questionCount });
}
