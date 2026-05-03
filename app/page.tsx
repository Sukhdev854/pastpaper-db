"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Question, Paper } from "@/lib/types";
import { parseFilename, getSubjectName, SUBJECT_CODES } from "@/lib/types";
import styles from "./page.module.css";

type Tab = "upload" | "questions" | "predict" | "settings";

interface BulkFile {
  file: File;
  filename: string;
  parsed: ReturnType<typeof parseFilename>;
  subject: string;
  status: "pending" | "processing" | "done" | "error" | "skipped";
  message: string;
  questionCount: number;
}

interface Meta {
  subjects: string[];
  years: string[];
  tags: string[];
  paperCount: number;
  questionCount: number;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("upload");
  const [meta, setMeta] = useState<Meta>({ subjects: [], years: [], tags: [], paperCount: 0, questionCount: 0 });
  const [papers, setPapers] = useState<Paper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);

  // Filters
  const [filterSubject, setFilterSubject] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterTag, setFilterTag] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Bulk upload
  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Predict
  const [predictSubject, setPredictSubject] = useState("All");
  const [predicting, setPredicting] = useState(false);
  const [predictions, setPredictions] = useState<{ topic: string; confidence: string; reasoning: string; lastSeen: string }[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const [notification, setNotification] = useState("");

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  }

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/meta");
    if (res.ok) setMeta(await res.json());
  }, []);

  const loadPapers = useCallback(async () => {
    const res = await fetch("/api/papers");
    if (res.ok) setPapers(await res.json());
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoadingQ(true);
    const params = new URLSearchParams();
    if (filterSubject !== "All") params.set("subject", filterSubject);
    if (filterYear !== "All") params.set("year", filterYear);
    if (filterTag !== "All") params.set("tag", filterTag);
    if (searchTerm.trim().length > 2) params.set("search", searchTerm.trim());
    const res = await fetch(`/api/questions?${params}`);
    if (res.ok) setQuestions(await res.json());
    setLoadingQ(false);
  }, [filterSubject, filterYear, filterTag, searchTerm]);

  useEffect(() => { loadMeta(); loadPapers(); }, [loadMeta, loadPapers]);

  useEffect(() => {
    if (tab === "questions") loadQuestions();
  }, [tab, loadQuestions]);

  // Debounced search
  useEffect(() => {
    if (tab !== "questions") return;
    const t = setTimeout(() => loadQuestions(), 400);
    return () => clearTimeout(t);
  }, [searchTerm, filterSubject, filterYear, filterTag, tab, loadQuestions]);

  async function extractTextFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: unknown) => (item as { str: string }).str).join(" ") + "\n";
    }
    return text;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const entries: BulkFile[] = files.map((file) => {
      const parsed = parseFilename(file.name);
      return {
        file,
        filename: file.name,
        parsed,
        subject: parsed ? getSubjectName(parsed.subjectCode) : "",
        status: parsed ? "pending" : "skipped",
        message: parsed ? "" : "Filename not recognised",
        questionCount: 0,
      };
    });
    setBulkFiles(entries);
    setBulkDone(false);
    setPredictions([]);
  }

  async function handleBulkRun() {
    const toProcess = bulkFiles.filter(f => f.status === "pending");
    if (!toProcess.length) return notify("No valid files to process");
    setBulkRunning(true);

    for (let i = 0; i < bulkFiles.length; i++) {
      const entry = bulkFiles[i];
      if (entry.status !== "pending") continue;

      setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "processing", message: "Reading PDF…" } : f));

      try {
        const text = await extractTextFromPDF(entry.file);
        setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, message: "Extracting questions…" } : f));

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, filename: entry.filename, subjectOverride: entry.subject }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setBulkFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f, status: "done",
          message: `✓ ${data.questionCount} questions saved`,
          questionCount: data.questionCount,
        } : f));

        await loadMeta();
        await loadPapers();
      } catch (e: unknown) {
        setBulkFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f, status: "error",
          message: `✗ ${e instanceof Error ? e.message : "Error"}`,
        } : f));
      }
    }

    setBulkRunning(false);
    setBulkDone(true);
  }

  async function handleDeletePaper(id: string) {
    await fetch("/api/papers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await loadMeta();
    await loadPapers();
  }

  async function handleTagEdit(id: string, raw: string) {
    const tags = raw.split(",").map(t => t.trim()).filter(Boolean);
    await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tags }),
    });
    await loadMeta();
  }

  async function handlePredict() {
    setPredicting(true);
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: predictSubject }),
    });
    const data = await res.json();
    if (!res.ok) { notify(data.error); setPredicting(false); return; }
    setPredictions(data.predictions || []);
    setInsights(data.insights || []);
    setPredicting(false);
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  // Tag freq for chart
  const tagFreqData = meta.tags.map(tag => ({
    tag,
    count: questions.filter(q => q.tags?.includes(tag)).length,
  })).filter(t => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 14);
  const maxFreq = tagFreqData[0]?.count || 1;

  // Subject breakdown
  const subjectBreakdown = meta.subjects.map(s => ({
    s,
    count: papers.filter(p => p.subject === s).length,
    qCount: meta.questionCount, // approximate
  }));

  return (
    <div className={styles.app}>
      {notification && <div className={styles.toast}>{notification}</div>}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>PB</span>
          <div>
            <div className={styles.logoTitle}>PaperBank</div>
            <div className={styles.logoSub}>Cambridge Q-Bank</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {([
            ["upload", "↑", "Upload"],
            ["questions", "≡", "Questions"],
            ["predict", "◈", "Predict"],
            ["settings", "⚙", "Settings"],
          ] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} className={`${styles.navBtn} ${tab === id ? styles.active : ""}`} onClick={() => setTab(id)}>
              <span className={styles.navIcon}>{icon}</span>
              {label}
              {id === "questions" && meta.questionCount > 0 && <span className={styles.badge}>{meta.questionCount}</span>}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarStats}>
          <div className={styles.stat}><span className={styles.statNum}>{meta.paperCount}</span><span className={styles.statLabel}>Papers</span></div>
          <div className={styles.stat}><span className={styles.statNum}>{meta.questionCount}</span><span className={styles.statLabel}>Qs</span></div>
          <div className={styles.stat}><span className={styles.statNum}>{meta.subjects.length}</span><span className={styles.statLabel}>Subjects</span></div>
        </div>

        {meta.subjects.length > 0 && (
          <div className={styles.subjectList}>
            {meta.subjects.map(s => (
              <div key={s} className={styles.subjectItem}>
                <span className={styles.subjectName} title={s}>{s}</span>
                <span className={styles.subjectCount}>{papers.filter(p => p.subject === s).length}p</span>
              </div>
            ))}
          </div>
        )}

        <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </aside>

      <main className={styles.main}>

        {tab === "upload" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Bulk Upload</h1>
            <p className={styles.pageDesc}>
              Drop any number of past paper PDFs. Filenames are parsed automatically.<br />
              <span className={styles.formatHint}>Format: <code>9708_s23_qp_22.pdf</code> — subjectcode _ session+year _ qp _ paper+variant</span>
            </p>

            <div className={styles.dropzone} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={handleFileSelect} />
              <div className={styles.dropIcon}>⬆</div>
              <div>Click to select PDFs</div>
              <div className={styles.dropSub}>Select multiple files at once — any mix of subjects and years</div>
            </div>

            {bulkFiles.length > 0 && (
              <>
                <div className={styles.bulkTable}>
                  <div className={styles.bulkHeader}>
                    <span>File</span><span>Parsed as</span><span>Subject (editable)</span><span>Status</span>
                  </div>
                  {bulkFiles.map((entry, i) => (
                    <div key={i} className={styles.bulkRow}>
                      <span className={styles.bulkFilename} title={entry.filename}>{entry.filename}</span>
                      <span className={styles.bulkParsed}>
                        {entry.parsed
                          ? `${entry.parsed.year} ${entry.parsed.session} · P${entry.parsed.paperNumber}`
                          : <span className={styles.parseError}>Unrecognised</span>}
                      </span>
                      <span>
                        {entry.parsed
                          ? <input className={styles.subjectInput} value={entry.subject}
                              onChange={e => setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, subject: e.target.value } : f))}
                              placeholder="e.g. Economics A-Level" list="subject-suggestions" />
                          : "—"}
                      </span>
                      <span className={`${styles.statusLabel} ${styles[`s_${entry.status}`]}`}>
                        {entry.status === "processing" && <span className={styles.spinner} />}
                        {entry.message || entry.status}
                      </span>
                    </div>
                  ))}
                </div>

                <datalist id="subject-suggestions">
                  {Object.values(SUBJECT_CODES).map(s => <option key={s} value={s} />)}
                </datalist>

                <div className={styles.bulkActions}>
                  <button className={styles.primaryBtn} onClick={handleBulkRun} disabled={bulkRunning}>
                    {bulkRunning ? "Processing…" : `Process ${bulkFiles.filter(f => f.status === "pending").length} papers`}
                  </button>
                  {bulkDone && (
                    <button className={styles.secondaryBtn} onClick={() => { setBulkFiles([]); if (fileRef.current) fileRef.current.value = ""; }}>
                      Clear &amp; upload more
                    </button>
                  )}
                </div>
              </>
            )}

            {papers.length > 0 && (
              <div className={styles.paperList}>
                <h2 className={styles.sectionTitle}>Database — {papers.length} papers</h2>
                {papers.map(p => (
                  <div key={p.id} className={styles.paperItem}>
                    <div className={styles.paperInfo}>
                      <span className={styles.paperSubject}>{p.subject}</span>
                      <span className={styles.paperTitle}>{p.year} {p.session} · Paper {p.paper_number}</span>
                      <span className={styles.paperMeta}>{p.filename}</span>
                    </div>
                    <span className={styles.paperQCount}>{p.question_count}q</span>
                    <button className={styles.deleteBtn} onClick={() => handleDeletePaper(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "questions" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Question Bank</h1>
            <div className={styles.filters}>
              <input placeholder="Search questions or tags…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.searchInput} />
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                <option value="All">All subjects</option>
                {meta.subjects.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                <option value="All">All years</option>
                {meta.years.map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="All">All topics</option>
                {meta.tags.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {loadingQ ? (
              <div className={styles.loadingRow}>Loading…</div>
            ) : (
              <>
                <div className={styles.resultCount}>{questions.length} question{questions.length !== 1 ? "s" : ""}</div>
                <div className={styles.questionList}>
                  {questions.length === 0 && <div className={styles.empty}>No questions match. Try changing the filters or upload papers first.</div>}
                  {questions.map(q => (
                    <div key={q.id} className={styles.questionCard}>
                      <div className={styles.qMeta}>
                        <span className={styles.qSubject}>{q.subject}</span>
                        <span className={styles.qRef}>{q.year} {q.session} · P{q.paper_number} · Q{q.question_number}</span>
                        {q.marks && <span className={styles.qMarks}>[{q.marks}m]</span>}
                      </div>
                      <p className={styles.qText}>{q.text}</p>
                      <div className={styles.qTagRow}>
                        <div className={styles.tagChips}>
                          {(q.tags || []).map(t => <span key={t} className={styles.tagChip}>{t}</span>)}
                        </div>
                        <input
                          className={styles.tagInput}
                          defaultValue={(q.tags || []).join(", ")}
                          placeholder="Edit tags (comma separated)"
                          onBlur={e => handleTagEdit(q.id, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleTagEdit(q.id, (e.target as HTMLInputElement).value); }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "predict" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Predict &amp; Analyse</h1>
            <div className={styles.predictControls}>
              <label className={styles.label}>Subject:</label>
              <select value={predictSubject} onChange={e => { setPredictSubject(e.target.value); setPredictions([]); }} style={{ maxWidth: 280 }}>
                <option value="All">All subjects</option>
                {meta.subjects.map(s => <option key={s}>{s}</option>)}
              </select>
              <button className={styles.primaryBtn} onClick={handlePredict} disabled={predicting}>
                {predicting ? "Analysing…" : "Generate Predictions"}
              </button>
            </div>

            {meta.tags.length > 0 && (
              <div className={styles.chartSection}>
                <h2 className={styles.sectionTitle}>Topic Frequency (loaded questions)</h2>
                {tagFreqData.length === 0
                  ? <p className={styles.muted}>Load some questions in the Questions tab first to see the chart.</p>
                  : <div className={styles.barChart}>
                    {tagFreqData.map(({ tag, count }) => (
                      <div key={tag} className={styles.barRow}>
                        <span className={styles.barLabel}>{tag}</span>
                        <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(count / maxFreq) * 100}%` }} /></div>
                        <span className={styles.barCount}>{count}</span>
                      </div>
                    ))}
                  </div>}
              </div>
            )}

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

        {tab === "settings" && (
          <div className={styles.panel}>
            <h1 className={styles.pageTitle}>Settings</h1>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Environment Variables</h2>
              <p className={styles.settingsDesc}>Set these in Vercel → Project → Settings → Environment Variables</p>
              <div className={styles.envTable}>
                {[
                  ["NEXT_PUBLIC_SUPABASE_URL", "Your Supabase project URL"],
                  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon/public API key"],
                  ["ANTHROPIC_API_KEY", "Your Anthropic API key"],
                  ["APP_PASSWORD", "The password to access this app"],
                  ["JWT_SECRET", "Random 32-char string for session tokens"],
                ].map(([key, desc]) => (
                  <div key={key} className={styles.envRow}>
                    <code className={styles.envKey}>{key}</code>
                    <span className={styles.envDesc}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Supported Subject Codes</h2>
              <div className={styles.codeTable}>
                {Object.entries(SUBJECT_CODES).map(([code, name]) => (
                  <div key={code} className={styles.codeRow}>
                    <code className={styles.code}>{code}</code>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
