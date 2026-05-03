export interface Question {
  id: string;
  paper_id: string;
  subject: string;
  subject_code: string;
  year: string;
  session: string;
  paper_number: string;
  component: string;
  question_number: string;
  text: string;
  marks?: number;
  tags: string[];
  created_at?: string;
}

export interface Paper {
  id: string;
  filename: string;
  subject: string;
  subject_code: string;
  year: string;
  session: string;
  paper_number: string;
  component: string;
  question_count: number;
  uploaded_at?: string;
}

export interface ParsedFilename {
  subjectCode: string;
  session: string;
  year: string;
  paperNumber: string;
  component: string;
}

export function parseFilename(filename: string): ParsedFilename | null {
  const match = filename.replace(/\.pdf$/i, "").match(/^(\d{4})_([smw])(\d{2})_qp_(\d+)$/i);
  if (!match) return null;
  const [, subjectCode, sessionCode, yearSuffix, paperVariant] = match;
  const sessionMap: Record<string, string> = { s: "May/June", m: "Feb/March", w: "Oct/Nov" };
  return {
    subjectCode,
    session: sessionMap[sessionCode.toLowerCase()] || sessionCode,
    year: `20${yearSuffix}`,
    paperNumber: paperVariant[0],
    component: `${subjectCode}/${paperVariant}`,
  };
}

export const SUBJECT_CODES: Record<string, string> = {
  "9708": "Economics A-Level",
  "9609": "Business A-Level",
  "9489": "History A-Level",
  "9696": "Geography A-Level",
  "9699": "Sociology A-Level",
  "9084": "Law A-Level",
  "9093": "English Language A-Level",
  "9389": "History Pre-U",
  "0470": "History IGCSE",
  "0460": "Geography IGCSE",
  "0455": "Economics IGCSE",
  "0450": "Business IGCSE",
  "0495": "Sociology IGCSE",
  "9709": "Mathematics A-Level",
};

export function getSubjectName(code: string): string {
  return SUBJECT_CODES[code] || `Subject ${code}`;
}
