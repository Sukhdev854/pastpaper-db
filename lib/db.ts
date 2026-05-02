import type { Database, Question, Paper } from "./types";

const DB_KEY = "paperbank_db";

export function getDB(): Database {
  if (typeof window === "undefined") return { papers: [], questions: [], tags: [] };
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { papers: [], questions: [], tags: [] };
    return JSON.parse(raw) as Database;
  } catch {
    return { papers: [], questions: [], tags: [] };
  }
}

export function saveDB(db: Database) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function addPaper(paper: Paper, questions: Question[]) {
  const db = getDB();
  db.papers = [paper, ...db.papers];
  db.questions = [...questions, ...db.questions];
  // merge new tags
  const allTags = new Set(db.tags);
  questions.forEach((q) => q.tags.forEach((t) => allTags.add(t)));
  db.tags = Array.from(allTags).sort();
  saveDB(db);
}

export function updateQuestionTags(id: string, tags: string[]) {
  const db = getDB();
  db.questions = db.questions.map((q) => (q.id === id ? { ...q, tags } : q));
  // add any new tags to global list
  const allTags = new Set(db.tags);
  tags.forEach((t) => allTags.add(t));
  db.tags = Array.from(allTags).sort();
  saveDB(db);
}

export function deleteQuestion(id: string) {
  const db = getDB();
  db.questions = db.questions.filter((q) => q.id !== id);
  saveDB(db);
}

export function deletePaper(paperId: string) {
  const db = getDB();
  db.papers = db.papers.filter((p) => p.id !== paperId);
  db.questions = db.questions.filter((q) => q.paperId !== paperId);
  saveDB(db);
}

export function exportDB(): string {
  return JSON.stringify(getDB(), null, 2);
}

export function importDB(json: string) {
  try {
    const db = JSON.parse(json) as Database;
    saveDB(db);
    return true;
  } catch {
    return false;
  }
}
