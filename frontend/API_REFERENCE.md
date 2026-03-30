# Napkin API Reference (Frontend Developer Guide)

## Base URL

- **Dev:** `http://localhost:8000`
- **Config:** `NEXT_PUBLIC_API_URL` env var (falls back to `http://localhost:8000`)
- **All endpoints prefixed with** `/api/v1` (except `/health` and `/`)

The frontend client in [frontend/src/lib/api/client.ts](src/lib/api/client.ts) automatically prepends `/api/v1` to every path.

---

## Authentication

### Dev Mode
Auth is **fully bypassed** in non-production environments. The backend injects a hardcoded test user:
```
user_id: b09cd7f7-8d95-49a5-b928-54eae6c6a6c3
org_id:  00000000-0000-0000-0000-000000000010
email:   omdenkar2@gmail.com
```
No `Authorization` header is needed locally.

### Production
The backend expects a **Supabase JWT** in the `Authorization: Bearer <token>` header. The frontend uses Supabase's client/server SDK to manage auth state — see [frontend/src/providers/auth-provider.tsx](src/providers/auth-provider.tsx).

### CORS Allowed Origins
- `http://localhost:3000`
- `http://localhost:5173`
- `https://usenapkin.com`
- `https://*.usenapkin.com`

---

## Endpoints

### Health

#### `GET /health`
Returns service status. No auth required.

**Response:**
```typescript
{
  status: "ok";
  version: string;         // "0.1.0"
  environment: string;     // "development" | "staging" | "production"
  timestamp: string;       // ISO 8601
}
```

#### `GET /`
Returns app name and docs URL. No auth required.

---

### Auth (`/api/v1/auth`)

#### `POST /api/v1/auth/signup`
Register with email + password. Supabase sends a verification email.

**Request:**
```typescript
{ email: string; password: string }
```
**Response:**
```typescript
{ message: string; user_id: string | null }
```

#### `POST /api/v1/auth/login`
Login with email + password.

**Request:**
```typescript
{ email: string; password: string }
```
**Response:**
```typescript
{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "bearer";
  user: { id: string; email: string };
}
```

#### `POST /api/v1/auth/login/google`
Get Google OAuth redirect URL.

**Response:**
```typescript
{ url: string }
```

#### `POST /api/v1/auth/refresh`
Refresh an expired access token.

**Request:**
```typescript
{ refresh_token: string }
```
**Response:**
```typescript
{ access_token: string; refresh_token: string; expires_in: number }
```

#### `POST /api/v1/auth/logout`
Invalidate the current session. Requires auth.

**Response:**
```typescript
{ message: "Logged out" }
```

#### `GET /api/v1/auth/me`
Get current user profile. Requires auth.

**Response:** `ProfileResponse` (see Key Data Shapes)

#### `PATCH /api/v1/auth/me`
Update current user profile. Requires auth.

**Request:**
```typescript
{
  full_name?: string | null;
  avatar_url?: string | null;
  preferences?: Record<string, unknown> | null;
}
```
**Response:** Updated `ProfileResponse`

---

### Projects (`/api/v1/projects`)

In the UI, "Projects" are called **"Workspaces"**. The frontend uses `getOrCreateDefaultProject()` to transparently create/reuse one project per user so most users never see project management.

#### `POST /api/v1/projects`
Create a new project (workspace). Requires auth.

**Request:**
```typescript
{
  name: string;           // 1–200 chars
  description?: string;
  repo_url?: string;
  repo_provider?: string; // e.g. "github"
}
```
**Response:** `Project` object (see Key Data Shapes)

#### `GET /api/v1/projects`
List all projects for the user's organization. Requires auth.

**Response:** `Project[]`

#### `GET /api/v1/projects/{project_id}`
Get a single project. Requires auth.

**Response:** `Project`

#### `PATCH /api/v1/projects/{project_id}`
Update project settings. Requires auth.

**Request:** Same fields as create, all optional. Plus:
```typescript
{ settings?: Record<string, unknown> }
```
**Response:** Updated `Project`

---

### Feedback (`/api/v1/feedback`)

Feedback is attached to a **project**, not a session directly. Pass `project_id` as a query param.

#### `POST /api/v1/feedback/paste?project_id={uuid}`
Paste raw feedback text. Each string in `texts` becomes one `feedback_item` row.

**Request:**
```typescript
{
  texts: string[];          // 1–5000 items
  source_label?: string;    // e.g. "intercom chat", "user interview"
  metadata?: Record<string, unknown>;
}
```
**Response:**
```typescript
{
  items_created: number;
  items_skipped: number;
  source_id: string | null;
  session_id: string | null;
}
```

#### `POST /api/v1/feedback/upload?project_id={uuid}`
Upload a file (CSV, TXT, DOCX, PDF). Max 10 MB. Multipart form data.

**Form field:** `file` — the uploaded file

**Response:** Same shape as paste response

#### `GET /api/v1/feedback?project_id={uuid}`
List feedback items for a project.

**Query params:**
- `page` (default 1)
- `page_size` (default 50, max 200)
- `status_filter` — `"raw"` | `"processed"` | `"error"` | `"archived"`

**Response:**
```typescript
{
  items: FeedbackItemResponse[];
  total: number;
  page: number;
  page_size: number;
}
```

---

### Sessions (`/api/v1/sessions`)

Sessions are the **core concept**. Each session runs the full Napkin analysis pipeline on a batch of feedback. The pipeline runs as a background task; poll `GET /sessions/{id}` to track progress.

#### `POST /api/v1/sessions`
Start a new session. Optionally include initial feedback. Requires auth.

**Request:**
```typescript
{
  project_id: string;
  title?: string;
  initial_feedback?: {
    texts: string[];
    source_label?: string;
  };
}
```
**Response:** `SessionMessageResponse` — includes the initial agent message and current stage.

#### `GET /api/v1/sessions?project_id={uuid}`
List sessions for a project. Requires auth.

**Query params:**
- `limit` (default 20, max 100)
- `offset` (default 0)

**Response:** `SessionListItem[]`

#### `GET /api/v1/sessions/{session_id}`
Get full session details including all pipeline outputs. **This is the primary polling endpoint.**

**Response:** Full `Session` object (see Key Data Shapes). Poll this until `stage === "done"` or `stage === "error"`.

#### `POST /api/v1/sessions/{session_id}/message`
Send a user message to an active session (e.g. answer to a clarifying question).

**Request:**
```typescript
{
  content: string;             // 1–5000 chars
  stage_hint?: SessionStage;   // optional: request a stage jump
}
```
**Response:** `SessionMessageResponse`

#### `POST /api/v1/sessions/{session_id}/feedback`
Add more feedback text to an in-progress session.

**Request:**
```typescript
{
  texts: string[];
  source_label?: string;
  metadata?: Record<string, unknown>;
}
```
**Response:** `SessionMessageResponse`

#### `POST /api/v1/sessions/{session_id}/repo-files`
Upload repository file contents for deep codebase analysis. Called before the `repo_context` stage.

**Request:**
```typescript
{
  files: Record<string, string>; // { "path/to/file.py": "file content..." }
  // max 500 files, max 10 MB total content
}
```
**Response:**
```typescript
{
  session_id: string;
  files_received: number;
  message: string;
}
```

#### `GET /api/v1/sessions/{session_id}/spec`
Get the generated spec object for a completed session.

**Response:** Full spec dict — same as `session.spec_object`

#### `GET /api/v1/sessions/{session_id}/cursor-prompt`
Get the Cursor-ready AI coding prompt.

**Response:**
```typescript
{ session_id: string; prompt: string }
```

#### `GET /api/v1/sessions/{session_id}/sprint-plan`
Get the generated sprint plan.

**Response:**
```typescript
{ session_id: string; sprint_plan: SprintPlan }
```

#### `GET /api/v1/sessions/{session_id}/prioritization`
Get opportunity prioritization results.

**Response:**
```typescript
{ session_id: string; prioritization: PrioritizationResult }
```

#### `GET /api/v1/sessions/{session_id}/exports`
Get all export artifacts for a completed session.

**Response:** `ExportData` (see Key Data Shapes). Returns 404 if pipeline hasn't finished.

#### `GET /api/v1/sessions/{session_id}/exports/tickets`
Get tickets as JSON (default) or CSV (send `Accept: text/csv` header).

**Response (JSON):** `Ticket[]`
**Response (CSV):** Downloadable file with columns: `title`, `priority`, `effort_estimate`, `source_feedback_count`, `rice_score`

#### `GET /api/v1/sessions/{session_id}/exports/prd`
Get a signed URL to download the PRD PDF (24-hour expiry).

**Response:**
```typescript
{ prd_url: string; expires_in: "24 hours" }
```

---

### Specs (`/api/v1/specs`)

Specs are standalone records persisted from session output. They support a lifecycle: `draft → review → approved → shipped`.

#### `GET /api/v1/specs?project_id={uuid}`
List specs for a project.

**Query params:**
- `status_filter` — `"draft"` | `"review"` | `"approved"` | `"shipped"` | `"abandoned"`
- `limit` (default 20, max 100)

**Response:** `SpecResponse[]`

#### `GET /api/v1/specs/{spec_id}`
Get a specific spec with all sections.

**Response:** `SpecResponse`

#### `PATCH /api/v1/specs/{spec_id}/status`
Advance a spec through its lifecycle.

**Request:**
```typescript
{ status: "draft" | "review" | "approved" | "shipped" | "abandoned" }
```
**Response:** Updated spec

#### `PATCH /api/v1/specs/{spec_id}/outcome`
Record what happened after shipping.

**Request:**
```typescript
{
  shipped: boolean;
  outcome_notes?: string;
  success_metrics_met?: Record<string, boolean>;
}
```
**Response:** Updated spec

---

### Artifacts (`/api/v1/artifacts`)

Shareable public "napkin" artifacts for virality.

#### `GET /api/v1/artifacts/share/{share_token}`
Get a publicly shared artifact. **No auth required.** Increments view count.

**Response:** Artifact object

#### `GET /api/v1/artifacts?project_id={uuid}`
List artifacts for a project. Requires auth.

**Query params:** `limit` (default 20, max 100)

**Response:** Artifact array

---

## Key Data Shapes

### Session (full — from `GET /sessions/{id}`)

```typescript
interface Session {
  // Core
  id: string;
  project_id: string;
  stage: SessionStage;         // current pipeline stage
  status: SessionStatus;       // "active" | "paused" | "completed" | "error" | "abandoned"
  title: string | null;
  ambiguity_score: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;

  // Pipeline outputs (null until that stage completes)
  intake_summary: Record<string, unknown> | null;
  four_q_answers: Record<string, unknown> | null;
  pattern_report: PatternReport | null;
  decision_object: PrioritizationResult | null;
  spec_object: SpecObject | null;
  cursor_prompt: string | null;
  task_plan: SprintPlan | null;

  // Gate results accumulate stage-by-stage
  gate_results: {
    intake?: Record<string, unknown>;
    synthesis?: Record<string, unknown>;
    prioritization?: Record<string, unknown>;
    // ... each stage adds its key
    exports?: ExportData;        // final exports live HERE, not at top level
  };

  messages: Message[];          // full conversation history
  exports?: ExportData | null;  // convenience alias for gate_results.exports
}
```

> **Important:** Exports are stored inside `gate_results.exports`, not as a separate top-level field. The `session.exports` shortcut may not always be populated — prefer reading from `session.gate_results.exports`.

### Session List Item (from `GET /sessions`)

```typescript
interface SessionListItem {
  id: string;
  project_id: string;
  stage: SessionStage;
  status: SessionStatus;
  title: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  // Note: no pipeline output fields — those only come from GET /sessions/{id}
}
```

### Pattern Report (`session.pattern_report`)

```typescript
interface PatternReport {
  clusters: PatternCluster[];
  top_pains: string[];
  contradictions: Array<Record<string, unknown>>;
  segments_found: string[];
  total_signals_analyzed: number;
  confidence_summary: string;
}

interface PatternCluster {
  id: string;
  label: string;
  pain_summary: string;
  frequency: number;
  severity_score: number;
  confidence: number;
  evidence_quotes: Array<{ text: string; signal_id: string }>;
  signal_ids: string[];
}
```

### Spec Object (`session.spec_object`)

```typescript
interface SpecObject {
  decision?: {
    what: string;    // what to build
    why: string;     // why this decision
    type?: string;   // "build" | "defer" | "kill" | "investigate"
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
```

### Prioritization (`session.decision_object`)

```typescript
interface PrioritizationResult {
  opportunities: Opportunity[];
  recommended: string;   // ID of the top-ranked opportunity
}

interface Opportunity {
  id: string;
  title: string;
  source_patterns: string[];
  rice_score: number;
  effort_weeks: number;
  reach: number;
  impact: number;
  confidence: number;
}
```

### Sprint Plan (`session.task_plan`)

```typescript
interface SprintPlan {
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
```

### Exports (`session.gate_results.exports`)

```typescript
interface ExportData {
  tickets?: Ticket[];
  prd_url?: string | null;      // signed Supabase Storage URL, 24h expiry
  cursor_prompt?: string;
  exported_at?: string;
  errors?: string[];            // non-fatal export errors
}

interface Ticket {
  title: string;
  description: string;
  priority: string;
  effort_estimate: string;
  rice_score: number;
  source_feedback_count: number;
  labels: string[];
  linear_compatible: Record<string, unknown>;  // ready to POST to Linear API
  jira_compatible: Record<string, unknown>;    // ready to POST to Jira API
}
```

### Profile (`GET /auth/me`)

```typescript
interface ProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string | null;
  role: "owner" | "admin" | "member";
  onboarding_done: boolean;
  created_at: string;
}
```

### Project

```typescript
interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  repo_provider: string | null;  // e.g. "github"
  created_at: string;
  updated_at: string;
}
```

---

## Enums

### `SessionStage`
The pipeline stages, in execution order:

| Value | Label | Description |
|-------|-------|-------------|
| `intake` | Intake | Processing raw feedback texts |
| `synthesis` | Synthesis | Clustering patterns across feedback |
| `prioritization` | Prioritization | RICE scoring opportunities |
| `four_questions` | Context | Inferring strategic context |
| `repo_context` | Repo Analysis | Reviewing codebase (if files uploaded) |
| `spec_building` | Spec Building | Writing the product spec |
| `spec_qa` | QA | Running spec quality checks |
| `task_planning` | Task Planning | Creating the sprint plan |
| `export` | Export | Generating tickets, PRD, Cursor prompt |
| `done` | Done | Session complete — all outputs ready |
| `error` | Error | Pipeline failed |

### `SessionStatus`
`"active"` | `"paused"` | `"completed"` | `"error"` | `"abandoned"`

### `SpecStatus`
`"draft"` → `"review"` → `"approved"` → `"shipped"` (or `"abandoned"`)

### `DecisionType`
`"build"` | `"defer"` | `"kill"` | `"investigate"`

---

## Frontend–Backend Mapping

### Naming Conventions
| Frontend UI Label | Backend Name |
|-------------------|--------------|
| Workspace | Project |
| Analysis / Session | Session |
| Results | gate_results |
| Tickets | exports.tickets |
| PRD | exports.prd_url |

### `getOrCreateDefaultProject()` Pattern
Most UI flows don't expose project management. The frontend transparently:
1. Checks `localStorage` for a cached project ID
2. Tries to fetch that project (falls back if 404)
3. Lists existing projects and uses the first one
4. Creates a new "My Workspace" project if none exist
5. Caches the ID in `localStorage`

Source: [frontend/src/lib/api/projects.ts](src/lib/api/projects.ts) — `getOrCreateDefaultProject()`

### How the Pipeline Runs
1. Call `POST /sessions` with feedback → pipeline starts as a background task
2. The response is a `SessionMessageResponse` — check `stage` for where the pipeline is
3. **Poll** `GET /sessions/{id}` — interval adapts by stage (2s normal, 5s for slow stages: synthesis, spec_building, task_planning, export)
4. When `stage === "done"`, all outputs are populated in the session object
5. If `stage === "error"`, show an error state

The `useSession` hook ([frontend/src/hooks/use-session.ts](src/hooks/use-session.ts)) handles polling automatically via React Query's `refetchInterval`.

### How to Read Exports
Exports are stored inside `gate_results.exports`, not as a separate column. The `Session` type exposes `session.exports` as a convenience but it's derived from `gate_results`.

To access exports after a session completes:
```typescript
// Preferred: poll session and read gate_results
const session = await getSession(sessionId);
const exports = session.gate_results?.exports as ExportData;

// Or: dedicated endpoint
const exports = await getExports(sessionId); // GET /sessions/{id}/exports
```

---

## Existing Frontend Architecture

| Concern | Location |
|---------|----------|
| API client (base fetch wrapper) | [frontend/src/lib/api/client.ts](src/lib/api/client.ts) |
| Session API functions | [frontend/src/lib/api/sessions.ts](src/lib/api/sessions.ts) |
| Project API functions | [frontend/src/lib/api/projects.ts](src/lib/api/projects.ts) |
| TypeScript types (API) | [frontend/src/types/api.ts](src/types/api.ts) |
| TypeScript types (session stages) | [frontend/src/types/session.ts](src/types/session.ts) |
| Auth provider (Supabase client) | [frontend/src/providers/auth-provider.tsx](src/providers/auth-provider.tsx) |
| Supabase browser client | [frontend/src/lib/supabase/client.ts](src/lib/supabase/client.ts) |
| Supabase server client | [frontend/src/lib/supabase/server.ts](src/lib/supabase/server.ts) |
| Session state + polling hook | [frontend/src/hooks/use-session.ts](src/hooks/use-session.ts) |
| Root layout + fonts | [frontend/src/app/layout.tsx](src/app/layout.tsx) |
| Design tokens (CSS vars) | [frontend/src/app/globals.css](src/app/globals.css) |

### Design Tokens (globals.css)
```
--background:         #000000
--foreground:         rgba(255,255,255,0.85)
--muted:              rgba(255,255,255,0.40)
--surface:            rgba(255,255,255,0.07)
--border:             rgba(255,255,255,0.10)
--accent:             #1B4D4A
--accent-light:       #267A75
--accent-action:      #E87B35
--accent-action-hover:#D06A28
--destructive:        #ef4444
--success:            #22c55e
--warning:            #eab308
```

### Fonts
- `--font-sans` → Inter (`var(--font-inter)`)
- `--font-serif` → Instrument Serif (`var(--font-instrument-serif)`)
- `--font-handwritten` → Caveat (`var(--font-caveat)`)

### Tech Stack
- **Framework:** Next.js App Router
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Server state:** React Query (`@tanstack/react-query`)
- **Auth:** Supabase SSR + client-side SDK (`@supabase/ssr`)
- **Toasts:** Sonner
- **API base:** Custom fetch wrapper — no Axios/SWR
