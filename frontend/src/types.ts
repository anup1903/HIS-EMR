export type RagSource = {
  index?: number;
  source: string;
  start_line?: number;
  end_line?: number;
  score?: number;
};

export type RagQueryRequest = {
  question: string;
  collection?: string;
};

export type RagQueryResponse = {
  answer: string;
  sources: RagSource[];
  chunks_used: number;
};

export type PlanRequest = {
  title: string;
  description: string;
  context?: string;
  constraints?: string[];
  acceptance_criteria?: string[];
  collection?: string;
};

export type TaskNode = {
  task_id: string;
  name: string;
  description: string;
  task_type: string;
  risk_level: string;
  depends_on: string[];
};

export type Plan = {
  plan_id: string;
  goal: {
    title: string;
    description: string;
  };
  tasks: TaskNode[];
  reasoning?: string;
};

export type SessionSummary = {
  session_id: string;
  state: string;
  goal_title: string;
  progress_pct: number;
  task_count: number;
  completed_count: number;
  created_at: string;
  error: string | null;
};

export type SessionDetail = {
  session_id: string;
  state: string;
  goal: { title: string; description: string };
  plan: {
    plan_id: string;
    tasks: TaskNode[];
    reasoning?: string;
  } | null;
  progress_pct: number;
  execution_log: Array<{ event: string; timestamp: string; data?: Record<string, unknown> }>;
  pending_approvals: Array<{ approval_id: string; description: string }>;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

export type GoalRequest = {
  title: string;
  description: string;
  context?: string;
  constraints?: string[];
  acceptance_criteria?: string[];
  priority?: number;
};
