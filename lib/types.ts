export interface Question {
  id: string;
  paperId: string;
  year: string;
  session: string; // May/Nov/March
  paperNumber: string;
  component: string;
  questionNumber: string;
  subPart?: string;
  text: string;
  marks?: number;
  tags: string[];
  createdAt: number;
}

export interface Paper {
  id: string;
  year: string;
  session: string;
  paperNumber: string;
  component: string;
  subject: string;
  uploadedAt: number;
  questionCount: number;
}

export interface Database {
  papers: Paper[];
  questions: Question[];
  tags: string[]; // all known tags
}
