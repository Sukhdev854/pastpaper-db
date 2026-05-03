import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject");
  const year = searchParams.get("year");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");

  let query = supabase.from("questions").select("*").order("created_at", { ascending: false });

  if (subject && subject !== "All") query = query.eq("subject", subject);
  if (year && year !== "All") query = query.eq("year", year);
  if (tag && tag !== "All") query = query.contains("tags", [tag]);
  if (search) query = query.textSearch("text", search, { type: "websearch" });

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, tags } = await req.json();
  const { error } = await supabase.from("questions").update({ tags }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
