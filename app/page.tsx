"use client";
import { useState, useEffect, useRef } from "react";
import type { Question, Paper } from "@/lib/types";
import { getDB, addPaper, updateQuestionTags, deletePaper, exportDB, importDB } from "@/lib/db";
import styles from "./page.module.css";

type Tab = "upload" | "questions" | "predict" | "settings";

export default function Home() {
  const [tab, setTab] = useState<Tab>("upload");
  const [apiKey, setApiKey] = useState("");
  const [subject, setSubject] = useState("History");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [paperMeta, setPaperMeta] = useState({ year: "", session: "May/June", paperNumber: "1", component: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  // Predict state
  const [predicting, setPredicting] = useState(false);
  const [predictions, setPredictions] = useState<{ topic: string; confidence: string; reasoning: string; lastSeen: string }[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("paperbank_apikey");
    if (saved) setApiKey(saved);
    const savedSubject = localStorage.getItem("paperbank_subject");
    if (savedSubject) setSubject(savedSubject);
    loadDB();
  }, []);

  function loadDB() {
    const db = getDB();
    setQuestions(db.questions);
    setPapers(db.papers);
    setAllTags(db.tags);
  }

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }

  async function extractTextFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item: unknown) => (item as { str: string }).str).join(" ") + "\n";
    }
    return fullText;
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return notify("Please select a PDF file");
    if (!apiKey) return notify("Add your API key in Settings first");
    if (!paperMeta.year) return notify("Please enter the year");

    setUploading(true);
    setUploadStep("Reading PDF...");

    try {
      const text = await extractTextFromPDF(file);
      setUploadStep("Parsing questions with AI...");

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ text, action: "parse", subject }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const parsed: { questionNumber: string; text: string; marks?: number }[] = data.questions;
      setUploadStep(`Found ${parsed.length} questions. Auto-tagging...`);

      const paperId = `paper_${Date.now()}`;
      const newQuestions: Question[] = [];

      for (let i = 0; i < parsed.length; i++) {
        setUploadStep(`Tagging question ${i + 1}/${parsed.length}...`);
        let tags: string[] = [];

        try {
          const tagRes = await fetch("/api/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ text: parsed[i].text, action: "tag", subject }),
          });
          const tagData = await tagRes.json();
          tags = tagData.tags || [];
        } catch {
          tags = [];
        }

        newQuestions.push({
          id: `q_${Date.now()}_${i}`,
          paperId,
          year: paperMeta.year,
          session: paperMeta.session,
          paperNumber: paperMeta.paperNumber,
          component: paperMeta.component,
          questionNumber: parsed[i].questionNumber,
          text: parsed[i].text,
          marks: parsed[i].marks ?? undefined,
          tags,
          createdAt: Date.now(),
        });
      }

      const paper: Paper = {
        id: paperId,
        year: paperMeta.year,
        session: paperMeta.session,
        paperNumber: paperMeta.paperNumber,
        component: paperMeta.component,
        subject,
        uploadedAt: Date.now(),
        questionCount: newQuestions.length,
      };

      addPaper(paper, newQuestions);
      loadDB();
      setUploadStep("");
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      notify(`✓ Added ${newQuestions.length} questions from ${paperMeta.year} ${paperMeta.session} Paper ${paperMeta.paperNumber}`);
      setTab("questions");
    } catch (e: unknown) {
      setUploading(false);
      setUploadStep("");
      notify("Error: " + (e instanceof Error ? e.message : "Something went wrong"));
    }
  }

  async function handlePredict() {
    if (!apiKey) return notify("Add your API key in Settings");
    if (questions.length < 5) return notify("Need at least 5 questions in the database");
    setPredicting(true);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ questions, subject }),
      });
      const data = await res.json();
      setPredictions(data.predictions || []);
      setInsights(data.insights || []);
    } catch (e: unknown) {
      notify("Prediction failed: " + (e instanceof Error ? e.message : "Error"));
    }
    setPredicting(false);
  }

  function handleTagEdit(qId: string, rawInput: string) {
    const tags = rawInput.split(",").map((t) => t.trim()).filter(Boolean);
    updateQuestionTags(qId, tags);
    loadDB();
  }

  function handleExport() {
    const json = exportDB();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paperbank_export.json";
    a.click();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importDB(reader.result as string);
      if (ok) { loadDB(); notify("Database imported!"); }
      else notify("Import failed — invalid file");
    };
    reader.readAsText(file);
  }

  const years = ["All", ...Array.from(new Set(questions.map((q) => q.year))).sort().reverse()];
  const tagOptions = ["All", ...allTags];

  const filtered = questions.filter((q) => {
    const matchTag = filterTag === "All" || q.tags.includes(filterTag);
    const matchYear = filterYear === "All" || q.year === filterYear;
    const matchSearch = !searchTerm || q.text.toLowerCase().includes(searchTerm.toLowerCase()) || q.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchTag && matchYear && matchSearch;
  });

  // Frequency data for mini chart
  const tagFreq = allTags.map((tag) => ({
    tag,
    count: questions.filter((q) => q.tags.includes(tag)).length,
  })).sort((a, b) => b.count - a.count).slice(0, 12);

  const maxFreq = tagFreq[0]?.count || 1;

  return (
    <div className={styles.app}>
      {notification && <div className={styles.toast}>{notification}</div>}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>PB</span>
          <div>
            <div className={styles.logoTitle}>PaperBank</div>
            <div className={styles.logoSub}>{subject}</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {([["upload", "↑", "Upload Paper"], ["questions", "≡", "Question Bank"], ["predict", "◈", "Predict"], ["settings", "⚙", "Settings"]] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} className={`${styles.navBtn} ${tab === id ? styles.active : ""}`} onClick={() => setTab(id)}>
              <span className={styles.navIcon}>{icon}</span>
              {label}
              {id === "questions" && questions.length > 0 && (
                <span className={styles.badge}>{questions.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarStats}>
          <div className={styles.stat}><span className={styles.statNum}>{papers.length}</span><span className={styles.statLabel}>Papers</span></div>
          <div className={styles.stat}><span className={styles.statNum}>{questions.length}</span><span className={styles.statLabel}>Questions</span></div>
          <div className={styles.stat}><span className={styles.statNum}>{allTags.length}</span><span className={styles.statLabel}>Topics</span></div>
        </div>
      </aside>

      <main className={styles.main}>

        {/* UPLOAD TAB */}
        {tab === "upload" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Upload a Paper</h1>
            <p className={styles.pageDesc}>Upload a Cambridge past paper PDF. AI will extract every question and suggest topic tags automatically.</p>

            <div className={styles.form}>
              <div className={styles.formRow}>
                <label className={styles.label}>Year</label>
                <input type="text" placeholder="e.g. 2023" value={paperMeta.year} onChange={e => setPaperMeta(p => ({ ...p, year: e.target.value }))} style={{ maxWidth: 120 }} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>Session</label>
                <select value={paperMeta.session} onChange={e => setPaperMeta(p => ({ ...p, session: e.target.value }))} style={{ maxWidth: 200 }}>
                  <option>May/June</option>
                  <option>Oct/Nov</option>
                  <option>Feb/March</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>Paper No.</label>
                <select value={paperMeta.paperNumber} onChange={e => setPaperMeta(p => ({ ...p, paperNumber: e.target.value }))} style={{ maxWidth: 120 }}>
                  <option>1</option><option>2</option><option>3</option><option>4</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.label}>Component / Variant</label>
                <input type="text" placeholder="e.g. 9489/12, optional" value={paperMeta.component} onChange={e => setPaperMeta(p => ({ ...p, component: e.target.value }))} style={{ maxWidth: 220 }} />
              </div>

              <div className={styles.dropzone} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} />
                <div className={styles.dropIcon}>⬆</div>
                <div>Click to select PDF</div>
                <div className={styles.dropSub}>Cambridge past paper (.pdf)</div>
              </div>

              <button className={styles.primaryBtn} onClick={handleUpload} disabled={uploading}>
                {uploading ? uploadStep || "Processing..." : "Upload & Parse"}
              </button>

              {uploading && (
                <div className={styles.progress}>
                  <div className={styles.progressBar} />
                </div>
              )}
            </div>

            {papers.length > 0 && (
              <div className={styles.paperList}>
                <h2 className={styles.sectionTitle}>Uploaded Papers</h2>
                {papers.map((p) => (
                  <div key={p.id} className={styles.paperItem}>
                    <div>
                      <span className={styles.paperTitle}>{p.year} {p.session} · Paper {p.paperNumber}</span>
                      {p.component && <span className={styles.paperComponent}> · {p.component}</span>}
                    </div>
                    <div className={styles.paperMeta}>{p.questionCount} questions</div>
                    <button className={styles.deleteBtn} onClick={() => { deletePaper(p.id); loadDB(); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUESTIONS TAB */}
        {tab === "questions" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Question Bank</h1>
            <div className={styles.filters}>
              <input placeholder="Search questions or tags..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 2 }} />
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ flex: 1 }}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ flex: 1 }}>
                {tagOptions.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className={styles.resultCount}>{filtered.length} question{filtered.length !== 1 ? "s" : ""}</div>

            <div className={styles.questionList}>
              {filtered.length === 0 && (
                <div className={styles.empty}>No questions yet. Upload a paper to get started.</div>
              )}
              {filtered.map((q) => (
                <div key={q.id} className={styles.questionCard}>
                  <div className={styles.qMeta}>
                    <span className={styles.qRef}>{q.year} {q.session} · P{q.paperNumber} · Q{q.questionNumber}</span>
                    {q.marks && <span className={styles.qMarks}>[{q.marks}m]</span>}
                  </div>
                  <p className={styles.qText}>{q.text}</p>
                  <div className={styles.qTagRow}>
                    <div className={styles.tagChips}>
                      {q.tags.map(t => (
                        <span key={t} className={styles.tagChip}>{t}</span>
                      ))}
                    </div>
                    <input
                      className={styles.tagInput}
                      defaultValue={q.tags.join(", ")}
                      placeholder="Edit tags (comma separated)"
                      onBlur={e => handleTagEdit(q.id, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleTagEdit(q.id, (e.target as HTMLInputElement).value); }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREDICT TAB */}
        {tab === "predict" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Predict & Analyse</h1>

            {tagFreq.length > 0 && (
              <div className={styles.chartSection}>
                <h2 className={styles.sectionTitle}>Topic Frequency</h2>
                <div className={styles.barChart}>
                  {tagFreq.map(({ tag, count }) => (
                    <div key={tag} className={styles.barRow}>
                      <span className={styles.barLabel}>{tag}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(count / maxFreq) * 100}%` }} />
                      </div>
                      <span className={styles.barCount}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className={styles.primaryBtn} onClick={handlePredict} disabled={predicting}>
              {predicting ? "Analysing patterns..." : "Generate Predictions"}
            </button>

            {predictions.length > 0 && (
              <div className={styles.predictions}>
                <h2 className={styles.sectionTitle}>Predicted Topics</h2>
                {predictions.map((p, i) => (
                  <div key={i} className={`${styles.predCard} ${styles[`conf${p.confidence}`]}`}>
                    <div className={styles.predHeader}>
                      <span className={styles.predTopic}>{p.topic}</span>
                      <span className={`${styles.confBadge} ${styles[`conf${p.confidence}`]}`}>{p.confidence}</span>
                      <span className={styles.predLast}>Last seen: {p.lastSeen}</span>
                    </div>
                    <p className={styles.predReason}>{p.reasoning}</p>
                  </div>
                ))}

                {insights.length > 0 && (
                  <div className={styles.insightsBox}>
                    <h3 className={styles.insightsTitle}>Key Insights</h3>
                    <ul className={styles.insightsList}>
                      {insights.map((ins, i) => <li key={i}>{ins}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Settings</h1>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Anthropic API Key</h2>
              <p className={styles.settingsDesc}>Your key is stored only in your browser — never sent anywhere except directly to Anthropic.</p>
              <input
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value);
                  localStorage.setItem("paperbank_apikey", e.target.value);
                }}
              />
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className={styles.link}>Get an API key →</a>
            </div>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Subject</h2>
              <input
                type="text"
                placeholder="e.g. History, Geography, Economics"
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  localStorage.setItem("paperbank_subject", e.target.value);
                }}
                style={{ maxWidth: 300 }}
              />
            </div>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Data</h2>
              <div className={styles.dataButtons}>
                <button className={styles.secondaryBtn} onClick={handleExport}>Export database (JSON)</button>
                <label className={styles.secondaryBtn} style={{ cursor: "pointer" }}>
                  Import database
                  <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
                </label>
                <button className={styles.dangerBtn} onClick={() => {
                  if (confirm("Delete ALL data? This cannot be undone.")) {
                    localStorage.removeItem("paperbank_db");
                    loadDB();
                    notify("Database cleared");
                  }
                }}>Clear all data</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
