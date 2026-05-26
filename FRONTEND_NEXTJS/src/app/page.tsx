"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileQuestion,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Upload
} from "lucide-react";

type Subject = {
  id: string;
  name: string;
  branch: string;
  semester: string;
};

type DocumentRow = {
  id: string;
  title: string;
  type: "PYQ" | "SLIDE" | "NOTE";
  fileName: string;
  year?: string | null;
  status: "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";
  errorMessage?: string | null;
  createdAt: string;
  subject: Subject;
  _count: { chunks: number };
};

type AnswerResponse = {
  answer: string;
  sources: Array<{
    sourceNo: number;
    documentTitle: string;
    fileName: string;
    pageNumber: number | null;
    similarity: number;
  }>;
};

const initialUpload = {
  title: "",
  documentType: "SLIDE",
  subjectName: "",
  branch: "",
  semester: "",
  year: "",
  uploaderName: ""
};

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [uploadForm, setUploadForm] = useState(initialUpload);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState("");

  const processedCount = useMemo(
    () => documents.filter((doc) => doc.status === "PROCESSED").length,
    [documents]
  );

  async function loadDocuments() {
    setLoadingDocs(true);
    const response = await fetch("/api/documents");
    const data = await response.json();
    setSubjects(data.subjects || []);
    setDocuments(data.documents || []);
    setLoadingDocs(false);
  }

  useEffect(() => {
    loadDocuments().catch(() => setLoadingDocs(false));
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setNotice("Please select a file first.");
      return;
    }

    setUploading(true);
    setNotice("");

    const formData = new FormData();
    Object.entries(uploadForm).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append("file", selectedFile);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      setNotice(data.error || "Upload failed.");
    } else {
      setNotice("Upload complete. The document is processed and ready for AI answers.");
      setUploadForm(initialUpload);
      setSelectedFile(null);
      await loadDocuments();
    }

    setUploading(false);
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsking(true);
    setNotice("");
    setAnswer(null);

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        subjectId: subjectId || undefined
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setNotice(data.error || "The answer could not be generated.");
    } else {
      setAnswer(data);
    }

    setAsking(false);
  }

  async function openDocument(documentId: string) {
    setNotice("");
    const response = await fetch(`/api/documents/${documentId}/download`);
    const data = await response.json();

    if (!response.ok) {
      setNotice(data.error || "The file could not be opened.");
      return;
    }

    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#222725]">
      <section className="border-b border-[#d8ded6] bg-[#fbfbf8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-[#58756b]">
              <BookOpen size={18} />
              Exam Slides Preparation AI
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
              PYQ library and slide-based AI answers, in one place.
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Subjects" value={subjects.length} />
            <Metric label="Files" value={documents.length} />
            <Metric label="Ready" value={processedCount} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[380px_1fr]">
        <form className="panel space-y-4" onSubmit={handleUpload}>
          <div className="flex items-center justify-between">
            <h2 className="section-title">Upload Material</h2>
            <Upload size={20} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="field col-span-2">
              <span>Title</span>
              <input
                value={uploadForm.title}
                onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })}
                placeholder="Unit 2 DBMS Slides"
                required
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select
                value={uploadForm.documentType}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, documentType: event.target.value })
                }
              >
                <option value="SLIDE">Slides</option>
                <option value="PYQ">PYQ</option>
                <option value="NOTE">Notes</option>
              </select>
            </label>

            <label className="field">
              <span>Year</span>
              <input
                value={uploadForm.year}
                onChange={(event) => setUploadForm({ ...uploadForm, year: event.target.value })}
                placeholder="2024"
              />
            </label>

            <label className="field col-span-2">
              <span>Subject</span>
              <input
                value={uploadForm.subjectName}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, subjectName: event.target.value })
                }
                placeholder="Database Management System"
                required
              />
            </label>

            <label className="field">
              <span>Branch</span>
              <input
                value={uploadForm.branch}
                onChange={(event) => setUploadForm({ ...uploadForm, branch: event.target.value })}
                placeholder="CSE"
                required
              />
            </label>

            <label className="field">
              <span>Semester</span>
              <input
                value={uploadForm.semester}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, semester: event.target.value })
                }
                placeholder="5"
                required
              />
            </label>

            <label className="field col-span-2">
              <span>Uploader</span>
              <input
                value={uploadForm.uploaderName}
                onChange={(event) =>
                  setUploadForm({ ...uploadForm, uploaderName: event.target.value })
                }
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="file-drop">
            <FileText size={22} />
            <span>{selectedFile ? selectedFile.name : "Choose a PDF, PPTX, DOCX, or TXT file"}</span>
            <input
              type="file"
              accept=".pdf,.pptx,.docx,.txt"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              required
            />
          </label>

          <button className="primary-button" disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            {uploading ? "Uploading" : "Upload"}
          </button>
        </form>

        <div className="grid gap-5">
          <form className="panel space-y-4" onSubmit={handleAsk}>
            <div className="flex items-center justify-between">
              <h2 className="section-title">Ask From Uploaded Slides</h2>
              <MessageSquareText size={21} />
            </div>

            <label className="field">
              <span>Subject filter</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.branch} Sem {subject.semester} - {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Question</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Explain the normalization question from the 2023 PYQ using slide references"
                rows={4}
                required
              />
            </label>

            <button className="primary-button" disabled={asking}>
              {asking ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {asking ? "Finding references" : "Ask AI"}
            </button>

            {answer && (
              <div className="answer-box">
                <p>{answer.answer}</p>
                {answer.sources.length > 0 && (
                  <div className="source-list">
                    {answer.sources.map((source) => (
                      <div key={`${source.sourceNo}-${source.fileName}`} className="source-item">
                        <strong>Source {source.sourceNo}</strong>
                        <span>
                          {source.documentTitle}
                          {source.pageNumber ? `, slide/page ${source.pageNumber}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>

          <section className="panel">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Recent Uploads</h2>
              <button className="icon-button" onClick={loadDocuments} type="button">
                {loadingDocs ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>

            <div className="document-list">
              {documents.map((document) => (
                <article className="document-row" key={document.id}>
                  <div className="document-icon">
                    {document.type === "PYQ" ? <FileQuestion size={20} /> : <FileText size={20} />}
                  </div>
                  <div>
                    <h3>{document.title}</h3>
                    <p>
                      {document.subject.branch} Sem {document.subject.semester} -{" "}
                      {document.subject.name}
                    </p>
                    <p>
                      {document.fileName} | {document._count.chunks} chunks
                    </p>
                    {document.errorMessage && <p className="error-text">{document.errorMessage}</p>}
                  </div>
                  <span className={`status status-${document.status.toLowerCase()}`}>
                    {document.status}
                  </span>
                  <button
                    className="small-button"
                    onClick={() => openDocument(document.id)}
                    type="button"
                  >
                    Open
                  </button>
                </article>
              ))}

              {!loadingDocs && documents.length === 0 && (
                <div className="empty-state">No files have been uploaded yet.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
