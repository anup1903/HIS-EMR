import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import { fetchJson, postJson } from "./lib/api";
import type {
  GoalRequest,
  Plan,
  PlanRequest,
  RagQueryRequest,
  RagQueryResponse,
  RagSource,
  SessionDetail,
  SessionSummary,
} from "./types";

const presetQuestion = "What does the audit middleware do?";

/* ── RAG Panel ──────────────────────────────────────────────────────────── */

function RAGPanel() {
  const [question, setQuestion] = useState(presetQuestion);
  const [collection, setCollection] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<RagSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer("");
    setSources([]);
    try {
      const payload: RagQueryRequest = {
        question,
        collection: collection || undefined,
      };
      const res = await postJson<RagQueryResponse>("/api/v1/rag/query", payload);
      setAnswer(res.answer);
      setSources(res.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <header>
        <div className="eyebrow">Retrieval</div>
        <h2>Ask the Knowledge Base</h2>
        <p>Runs RAG over your ingested sources and returns an answer with citations.</p>
      </header>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            required
          />
        </label>
        <label className="field">
          <span>Collection (optional)</span>
          <input
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="default"
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? "Running..." : "Run RAG"}
          </button>
        </div>
      </form>
      {error && <div className="alert error">{error}</div>}
      {answer && (
        <div className="panel">
          <div className="panel-title">Answer</div>
          <p className="answer">{answer}</p>
        </div>
      )}
      {sources.length > 0 && (
        <div className="panel">
          <div className="panel-title">Sources</div>
          <ul className="sources">
            {sources.map((s, i) => (
              <li key={`${s.source}-${i}`}>
                <div className="source-name">
                  {s.index ?? i + 1}. {s.source}
                  {s.start_line && <>:{s.start_line}-{s.end_line ?? s.start_line}</>}
                </div>
                {s.score !== undefined && (
                  <div className="source-score">score: {s.score.toFixed(3)}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── Planner Panel ──────────────────────────────────────────────────────── */

function PlannerPanel() {
  const [title, setTitle] = useState("Implement RAG query endpoint");
  const [description, setDescription] = useState(
    "Expose a POST /api/v1/rag/query endpoint that runs retrieval and returns citations."
  );
  const [context, setContext] = useState("");
  const [constraints, setConstraints] = useState("Return JSON only\nInclude sources");
  const [criteria, setCriteria] = useState("Plan validates DAG\nIncludes test tasks");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const payload: PlanRequest = {
        title,
        description,
        context,
        constraints: constraints
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        acceptance_criteria: criteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await postJson<Plan>("/api/v1/planner/plan", payload);
      setPlan(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const tasks = useMemo(() => plan?.tasks ?? [], [plan]);

  return (
    <section className="card">
      <header>
        <div className="eyebrow">Planning</div>
        <h2>Generate a Plan</h2>
        <p>Uses the reasoning model (DeepSeek-R1 tier) with RAG context to build a task DAG.</p>
      </header>
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Context (optional)</span>
          <textarea rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
        <label className="field">
          <span>Constraints (one per line)</span>
          <textarea
            rows={2}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Acceptance Criteria (one per line)</span>
          <textarea rows={2} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        </label>
        <div className="actions">
          <button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate Plan"}
          </button>
        </div>
      </form>
      {error && <div className="alert error">{error}</div>}
      {plan && (
        <div className="panel">
          <div className="panel-title">Tasks ({tasks.length})</div>
          <div className="table">
            <div className="table-head">
              <span>Name</span>
              <span>Type</span>
              <span>Risk</span>
              <span>Depends</span>
            </div>
            {tasks.map((t) => (
              <div className="table-row" key={t.task_id}>
                <span className="task-name">{t.name}</span>
                <span>{t.task_type}</span>
                <span className={`pill pill-${t.risk_level}`}>{t.risk_level}</span>
                <span>{t.depends_on?.length ?? 0}</span>
              </div>
            ))}
          </div>
          {plan.reasoning && (
            <details className="reasoning">
              <summary>LLM reasoning</summary>
              <pre>{plan.reasoning}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Agent Panel ────────────────────────────────────────────────────────── */

const STATE_COLORS: Record<string, string> = {
  planning: "#0ea5e9",
  awaiting_approval: "#f59e0b",
  executing: "#8b5cf6",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#6b7280",
  paused: "#f59e0b",
  rolling_back: "#ef4444",
};

function AgentPanel() {
  const [title, setTitle] = useState("Fix authentication timeout bug");
  const [description, setDescription] = useState(
    "Users report auth tokens expiring after 30 seconds instead of 30 minutes."
  );
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetchJson<SessionSummary[]>("/api/v1/agent/sessions");
      setSessions(res);
    } catch {
      /* ignore background refresh errors */
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const submitGoal = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: GoalRequest = { title, description };
      const res = await postJson<{ session_id: string }>("/api/v1/agent/goals", payload);
      await loadSessions();
      const detail = await fetchJson<SessionDetail>(
        `/api/v1/agent/sessions/${res.session_id}`
      );
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const viewSession = async (id: string) => {
    try {
      const detail = await fetchJson<SessionDetail>(`/api/v1/agent/sessions/${id}`);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const approvePlan = async (planId: string) => {
    setLoading(true);
    try {
      await postJson(`/api/v1/agent/plans/${planId}/approve`, {
        approved_by: "console-user",
      });
      if (selected) {
        const detail = await fetchJson<SessionDetail>(
          `/api/v1/agent/sessions/${selected.session_id}`
        );
        setSelected(detail);
      }
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card card-wide">
      <header>
        <div className="eyebrow">Agent Orchestrator</div>
        <h2>Submit Goals &amp; Monitor Execution</h2>
        <p>
          Submit a goal for the agent to plan and execute. The agent decomposes it into a task
          DAG, requests approval, then executes each step.
        </p>
      </header>

      <form className="form-grid" onSubmit={submitGoal}>
        <div className="form-row">
          <label className="field" style={{ flex: 2 }}>
            <span>Goal title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field" style={{ flex: 3 }}>
            <span>Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Goal"}
          </button>
        </div>
      </form>

      {error && <div className="alert error">{error}</div>}

      <div className="agent-layout">
        <div className="session-list">
          <div className="panel-title">Sessions ({sessions.length})</div>
          {sessions.length === 0 && (
            <p className="muted">No sessions yet. Submit a goal above.</p>
          )}
          {sessions.map((s) => (
            <button
              type="button"
              key={s.session_id}
              className={`session-item ${selected?.session_id === s.session_id ? "active" : ""}`}
              onClick={() => viewSession(s.session_id)}
            >
              <div className="session-title">{s.goal_title}</div>
              <div className="session-meta">
                <span
                  className="state-badge"
                  style={{ background: STATE_COLORS[s.state] ?? "#6b7280" }}
                >
                  {s.state}
                </span>
                <span className="progress-text">
                  {s.completed_count}/{s.task_count} tasks
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${s.progress_pct}%` }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="session-detail">
          {!selected ? (
            <p className="muted">Select a session to view details.</p>
          ) : (
            <>
              <div className="detail-header">
                <h3>{selected.goal.title}</h3>
                <span
                  className="state-badge"
                  style={{
                    background: STATE_COLORS[selected.state] ?? "#6b7280",
                  }}
                >
                  {selected.state}
                </span>
              </div>
              <p className="muted">{selected.goal.description}</p>

              <div className="progress-bar-container" style={{ height: 8 }}>
                <div
                  className="progress-bar-fill"
                  style={{ width: `${selected.progress_pct}%` }}
                />
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {selected.progress_pct.toFixed(0)}% complete
              </div>

              {selected.state === "awaiting_approval" && selected.plan && (
                <div className="actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => approvePlan(selected.plan!.plan_id)}
                    disabled={loading}
                    className="btn-approve"
                  >
                    {loading ? "Approving..." : "Approve Plan"}
                  </button>
                </div>
              )}

              {selected.error && (
                <div className="alert error">{selected.error}</div>
              )}

              {selected.plan && selected.plan.tasks.length > 0 && (
                <div className="panel">
                  <div className="panel-title">Plan Tasks</div>
                  <div className="table">
                    <div className="table-head">
                      <span>Name</span>
                      <span>Type</span>
                      <span>Risk</span>
                      <span>Depends</span>
                    </div>
                    {selected.plan.tasks.map((t) => (
                      <div className="table-row" key={t.task_id}>
                        <span className="task-name">{t.name}</span>
                        <span>{t.task_type}</span>
                        <span className={`pill pill-${t.risk_level}`}>
                          {t.risk_level}
                        </span>
                        <span>{t.depends_on?.length ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.execution_log.length > 0 && (
                <details className="reasoning" open>
                  <summary>Execution log ({selected.execution_log.length} events)</summary>
                  <div className="log-entries">
                    {selected.execution_log.map((entry, i) => (
                      <div key={i} className="log-entry">
                        <span className="log-event">{entry.event}</span>
                        <span className="log-time">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── App ────────────────────────────────────────────────────────────────── */

function App() {
  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">AegisForge</p>
          <h1>Enterprise AI agent console</h1>
          <p className="lede">
            Query your knowledge base with RAG, generate execution plans, and orchestrate
            autonomous agents — all self-hosted.
          </p>
        </div>
      </header>

      <AgentPanel />

      <main className="grid" style={{ marginTop: 20 }}>
        <RAGPanel />
        <PlannerPanel />
      </main>
    </div>
  );
}

export default App;
