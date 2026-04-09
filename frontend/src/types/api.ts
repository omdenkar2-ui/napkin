// TypeScript types mirroring backend Pydantic schemas
// Part 1: Existing backend types (Pydantic mirrors)
// Part 2: Frontend platform UI types (added for backend integration)

export type SessionStage =
  | "intake"
  | "synthesis"
  | "prioritization"
  | "four_questions"
  | "repo_context"
  | "spec_building"
  | "spec_qa"
  | "task_planning"
  | "review"
  | "done"
  | "error";

export type SessionStatus =
  | "active"
  | "paused"
  | "completed"
  | "error"
  | "abandoned";

// Auth
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user?: ProfileResponse;
}

export interface ProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string | null;
  role: string;
  onboarding_done: boolean;
  created_at: string;
}

// Projects
export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  repo_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  repo_url?: string;
}

// Sessions
export interface Session {
  id: string;
  project_id: string;
  stage: SessionStage;
  status: SessionStatus;
  title: string | null;
  gate_results: Record<string, unknown>;
  ambiguity_score: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  // Detail fields
  intake_summary?: Record<string, unknown> | null;
  four_q_answers?: Record<string, unknown> | null;
  pattern_report?: Record<string, unknown> | null;
  decision_object?: Record<string, unknown> | null;
  spec_object?: SpecObject | null;
  cursor_prompt?: string | null;
  task_plan?: SprintPlan | null;
  messages?: Message[];
  exports?: ExportData | null;
}

export interface SessionListItem {
  id: string;
  project_id: string;
  stage: SessionStage;
  status: SessionStatus;
  title: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface SessionCreate {
  project_id: string;
  title?: string;
  initial_feedback?: { texts: string[]; source_label?: string };
}

export interface SessionMessageResponse {
  session_id: string;
  stage: SessionStage;
  agent_message: string;
  questions: string[];
  gate_results: Record<string, unknown> | null;
  is_complete: boolean;
  spec_ready: boolean;
  artifacts: {
    has_pattern_report?: boolean;
    has_spec?: boolean;
    has_sprint_plan?: boolean;
    has_prioritization?: boolean;
    has_exports?: boolean;
    feedback_count?: number;
  };
}

// Messages
export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

// Spec
export interface SpecObject {
  decision?: {
    what: string;
    why: string;
    type?: string;
  };
  ui_changes?: Array<{
    screen: string;
    description: string;
    components?: string[];
  }>;
  data_model?: Array<{
    entity: string;
    fields: string[];
    notes?: string;
  }>;
  task_breakdown?: Array<{
    title: string;
    description: string;
    type: string;
    estimate_hours?: number;
    acceptance_criteria: string[];
    dependencies?: string[];
  }>;
  success_criteria?: Array<{
    metric: string;
    target: string;
    measurement: string;
  }>;
  cursor_prompt?: string;
}

// Sprint Plan
export interface SprintPlan {
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    estimate_hours: number;
    dependencies: string[];
    acceptance_criteria: string[];
    sprint_day?: number;
  }>;
  total_hours?: number;
  critical_path?: string[];
}

// Exports
export interface ExportData {
  tickets?: Ticket[];
  prd_url?: string | null;
  cursor_prompt?: string;
  exported_at?: string;
  errors?: string[];
}

export interface Ticket {
  title: string;
  description: string;
  priority: string;
  effort_estimate: string;
  rice_score: number;
  source_feedback_count: number;
  labels: string[];
  linear_compatible: Record<string, unknown>;
  jira_compatible: Record<string, unknown>;
}

// Pattern Report
export interface PatternCluster {
  id?: string;
  cluster_id?: number;
  label: string;
  pain_summary: string;
  frequency: number;
  severity_score: number; // 0-10 scale
  confidence: number; // 0-1
  evidence_quotes: string[];
  signal_ids: string[];
  affected_segments?: string[];
  recommended_action?: string;
}

export interface PatternReport {
  clusters: PatternCluster[];
  top_pains: string[];
  contradictions: Array<Record<string, unknown>>;
  segments_found: string[];
  total_items_analyzed: number;
  data_quality?: Record<string, unknown>;
  critical_issues?: Array<Record<string, unknown>>;
  valuable_insights?: Array<Record<string, unknown>>;
  future_opportunities?: Array<Record<string, unknown>>;
}

// Prioritization
export interface Opportunity {
  id: string;
  title: string;
  source_patterns: string[];
  rice_score: number;
  effort_weeks: number;
  reach: number;
  impact: number;
  confidence: number;
}

export interface PrioritizationResult {
  opportunities: Opportunity[];
  recommended: string;
}

// ============================================
// PART 2: FRONTEND PLATFORM UI TYPES
// ============================================

// ============================================
// WORKSPACE
// ============================================
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

// ============================================
// USER / TEAM
// ============================================
export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  title?: string;
  product_areas: string[];
  tools: string[];
  avatar_url?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "pending" | "deactivated";
  profile: Profile;
  created_at: string;
}

// ============================================
// INTEGRATIONS / SOURCES
// ============================================
export interface Integration {
  id: string;
  workspace_id: string;
  type: "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet";
  status: "connected" | "disconnected" | "error";
  config: Record<string, unknown>;
  item_count: number;
  last_sync_at?: string;
  created_at: string;
}

// ============================================
// PLATFORM SESSION (UI-facing)
// ============================================
export interface PlatformSession {
  id: string;
  workspace_id: string;
  name: string;
  status: "processing" | "completed" | "failed";
  sources: string[];
  uploaded_files: PlatformUploadedFile[];
  data_point_count: number;
  summary: string;
  patterns: Pattern[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sentiment_change: number;
  created_at: string;
  completed_at?: string;
}

export interface Pattern {
  id: string;
  session_id: string;
  name: string;
  description: string;
  feedback_count: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  confidence: "high" | "medium" | "low";
  evidence: EvidenceItem[];
}

export interface EvidenceItem {
  id: string;
  source: string;
  source_channel?: string;
  content: string;
  customer_name?: string;
  sentiment: "positive" | "neutral" | "negative";
  created_at: string;
}

export interface PlatformUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploaded" | "processing" | "processed" | "error";
  created_at: string;
}

// ============================================
// TASKS
// ============================================
export interface PlatformTask {
  id: string;
  workspace_id: string;
  session_id: string;
  pattern_id: string;
  title: string;
  description: string;
  assignee: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  priority: "p0" | "p1" | "p2" | "p3";
  status: "pending" | "approved" | "sent" | "discarded";
  destination?: "linear" | "google_sheets" | "csv";
  labels: string[];
  evidence_count: number;
  source_pattern: string;
  created_at: string;
  sent_at?: string;
}

// ============================================
// WORKFLOWS
// ============================================
export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  sources: string[];
  schedule_frequency: "daily" | "weekly" | "monthly" | "manual";
  schedule_day?: number;
  schedule_time?: string;
  schedule_timezone: string;
  options: {
    identify_patterns: boolean;
    analyze_sentiment: boolean;
    auto_generate_tasks: boolean;
    notify_team: boolean;
  };
  status: "active" | "paused";
  last_run_at?: string;
  created_at: string;
}

// ============================================
// CHAT
// ============================================
export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tasks?: { title: string; priority: string }[];
  created_at: string;
}

// ============================================
// ACTIVITY
// ============================================
export interface ActivityItem {
  id: string;
  workspace_id: string;
  type: "session_completed" | "tasks_approved" | "source_synced" | "tasks_done" | "session_scheduled" | "source_connected";
  description: string;
  created_at: string;
}

// ============================================
// DASHBOARD STATS
// ============================================
export interface DashboardStats {
  data_points: { value: number; trend_percent: number };
  active_sources: { value: number; total: number };
  sessions: { value: number; trend: number };
  pending_tasks: { value: number };
}

// ============================================
// API REQUEST TYPES
// ============================================
export interface CreatePlatformSessionRequest {
  name: string;
  sources: string[];
  files: File[];
  context_text?: string;
  options: {
    identify_patterns: boolean;
    analyze_sentiment: boolean;
    auto_generate_tasks: boolean;
  };
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assignee_id?: string;
  priority?: "p0" | "p1" | "p2" | "p3";
  status?: "pending" | "approved" | "sent" | "discarded";
  labels?: string[];
}

export interface SendTasksRequest {
  task_ids: string[];
  destination: "linear" | "google_sheets" | "csv";
}

export interface InviteMemberRequest {
  email: string;
  role: "admin" | "member" | "viewer";
  message?: string;
}

export interface CreateWorkflowRequest {
  name: string;
  sources: string[];
  schedule_frequency: "daily" | "weekly" | "monthly" | "manual";
  schedule_day?: number;
  schedule_time?: string;
  schedule_timezone: string;
  options: {
    identify_patterns: boolean;
    analyze_sentiment: boolean;
    auto_generate_tasks: boolean;
    notify_team: boolean;
  };
}

export interface SendChatMessageRequest {
  session_id: string;
  content: string;
}
