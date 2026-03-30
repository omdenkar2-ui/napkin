# napkin

> The intelligence layer between customer reality and code.
> Cursor builds what you tell it to build. Napkin figures out what that should be.

---

## What It Does

Napkin transforms raw customer feedback into executable product specs. Feed it user interviews, support tickets, or any feedback text — it runs through a multi-stage AI pipeline and outputs a structured 6-section spec + a Cursor-ready prompt, ready to hand straight to an engineer.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      Next.js 16 Frontend                          │
│              Project-scoped sessions · Analysis UI                │
├───────────────────────────────────────────────────────────────────┤
│                       FastAPI (REST)                              │
│   /api/v1/auth   /sessions   /projects   /feedback   /specs       │
├───────────────────────────────────────────────────────────────────┤
│                   LangGraph State Machine                         │
│                                                                   │
│  INTAKE → SYNTHESIS → PRIORITIZE → 4 QUESTIONS → REPO CONTEXT    │
│              ↓                                                    │
│        SPEC BUILD → SPEC QA → TASK PLAN → DONE                   │
│                         ↑                                        │
│                    (retry if gates fail)                          │
├───────────────────────────────────────────────────────────────────┤
│                   Supabase (PostgreSQL + pgvector)                │
│   profiles · orgs · projects · feedback_items · sessions · specs  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| API | FastAPI 0.115+ + Pydantic v2 |
| Language | Python 3.11+ |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (JWT) |
| Agent Engine | LangGraph 0.2+ + LangChain |
| LLM | Anthropic Claude (Sonnet 4 + Haiku) |
| Embeddings | HuggingFace all-MiniLM-L6-v2 (local, 384-dim) |
| Background Jobs | Celery + Redis 7 |
| Analytics | pandas + matplotlib + scikit-learn |
| Logging | structlog + Sentry (optional) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 |
| Language | TypeScript 5 + React 19 |
| Styling | Tailwind CSS 4 |
| State | TanStack React Query 5 |
| Auth Client | @supabase/ssr |
| Markdown | react-markdown 10 |
| Toasts | sonner 2 |

---

## Project Structure

```
napkin/
├── app/
│   ├── main.py                        # FastAPI app factory
│   ├── core/
│   │   ├── config.py                  # Pydantic Settings
│   │   └── llm.py                     # LLM provider abstraction
│   ├── models/
│   │   ├── entities.py                # DB entity models
│   │   └── agent_state.py             # LangGraph state types (NapkinState)
│   ├── schemas/
│   │   └── api.py                     # Request/Response DTOs
│   ├── api/
│   │   ├── deps/auth.py               # JWT auth dependencies
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── sessions.py
│   │       ├── projects.py
│   │       ├── specs.py
│   │       └── health.py
│   ├── services/
│   │   ├── session_service.py         # Session lifecycle manager
│   │   ├── agents/
│   │   │   ├── prompts.py             # All LLM prompt templates
│   │   │   ├── mvp/
│   │   │   │   ├── orchestrator.py    # LangGraph state machine (543 lines)
│   │   │   │   ├── intake.py          # Intake Structurer
│   │   │   │   ├── synthesis.py       # Signal Synthesis
│   │   │   │   ├── socratic.py        # 4 Strategic Questions
│   │   │   │   └── spec_builder.py    # Spec + Cursor Prompt builder
│   │   │   └── final/
│   │   │       ├── prioritizer.py     # RICE scoring
│   │   │       ├── spec_qa.py         # Quality gate checks
│   │   │       ├── task_planner.py    # Sprint task breakdown
│   │   │       ├── repo_context.py    # Codebase structure extraction
│   │   │       └── memory_agent.py    # Decision storage
│   │   ├── ingestion/
│   │   │   └── service.py             # Feedback ingestion + embedding
│   │   ├── export/
│   │   │   └── export_service.py      # PRD + ticket exports
│   │   └── analytics/
│   │       └── visualizer.py          # 10 session analytics charts
│   └── db/
│       └── client.py                  # Supabase client
├── frontend/
│   ├── src/
│   │   ├── app/                       # Next.js App Router pages
│   │   ├── components/                # React components
│   │   ├── providers/                 # Auth + Query providers
│   │   └── types/                     # TypeScript types
│   ├── package.json
│   └── tailwind.config.ts
├── migrations/
│   └── 001_initial_schema.sql         # Full DB schema (pgvector, tables, indexes)
├── tests/                             # 14 pytest test files
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
└── .env.example
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project (free tier works)
- Anthropic API key
- Redis (for background jobs)

### 1. Backend

```bash
# Copy and fill in environment variables
cp .env.example .env

# Install Python dependencies
pip install -e ".[dev]"

# Run DB migration
# → Copy migrations/001_initial_schema.sql into Supabase SQL Editor and run

# Start the API
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 3. Docker (all-in-one)

```bash
docker-compose up
# API → http://localhost:8000
# Redis → localhost:6379
# Worker → Celery background processor
```

---

## API Reference

All routes are prefixed with `/api/v1`.

### Auth
```
POST   /auth/signup            Create account
POST   /auth/login             Get JWT
POST   /auth/login/google      OAuth redirect URL
GET    /auth/me                Current user profile
```

### Sessions (Core Loop)
```
POST   /sessions                          Start new session
POST   /sessions/{id}/message             Send message (routes by pipeline stage)
POST   /sessions/{id}/feedback            Add feedback to session
GET    /sessions/{id}                     Get session state
GET    /sessions/{id}/spec                Get generated spec
GET    /sessions/{id}/cursor-prompt       Get Cursor-ready prompt
GET    /sessions?project_id=...           List sessions for a project
```

### Projects
```
POST   /projects               Create project
GET    /projects               List all projects
GET    /projects/{id}          Get project details
```

### Feedback
```
POST   /feedback/paste         Paste raw feedback text
POST   /feedback/upload        Upload feedback file
GET    /feedback?project_id=   List feedback items
```

### Specs
```
GET    /specs?project_id=      List specs
GET    /specs/{id}             Get spec
PATCH  /specs/{id}/status      Update status
PATCH  /specs/{id}/outcome     Record outcome
```

### Artifacts
```
GET    /artifacts/share/{token}   Public artifact (no auth required)
GET    /artifacts?project_id=     List artifacts
```

---

## Pipeline Stages

Sessions move through a 9-stage state machine. Stages pause when waiting for user input and resume from DB state.

| Stage | What Happens |
|---|---|
| **INTAKE** | Extracts structured signals from raw feedback (pain points, feature requests, emotions, context) + generates embeddings |
| **SYNTHESIS** | Clusters signals into themes and patterns |
| **PRIORITIZE** | RICE scoring on discovered opportunities |
| **4 QUESTIONS** | Asks one question at a time: Who is this for? Smallest 2-week proof? What's out of scope? What are the risks? |
| **REPO CONTEXT** | Extracts codebase file tree and architecture snapshot |
| **SPEC BUILD** | Generates 6-section spec + Cursor-ready prompt |
| **SPEC QA** | Quality gate validation — retries if failing |
| **TASK PLAN** | Breaks spec into sprint-ready tickets |
| **DONE** | Exports PRD + tickets, marks session complete |

---

## Quality Gates

Every spec must pass all four gates before delivery. If any gate fails, the system asks clarifying questions and retries.

| Gate | Check | Threshold |
|---|---|---|
| Evidence | Decisions backed by customer quotes | ≥1 quote |
| Constraints | Non-goals and constraints defined | ≥1 each |
| Ambiguity | No vague language | Score < 0.4 |
| Completeness | All 6 spec sections present | 100% |

---

## Agents

| Agent | File | Purpose |
|---|---|---|
| Intake Structurer | `mvp/intake.py` | Parses raw feedback into structured signals |
| Signal Synthesis | `mvp/synthesis.py` | Clusters signals into themes |
| Socratic Questioner | `mvp/socratic.py` | 4-question strategic scoping |
| Spec Builder | `mvp/spec_builder.py` | 6-section spec + Cursor prompt |
| Prioritizer | `final/prioritizer.py` | RICE scoring for opportunities |
| Spec QA | `final/spec_qa.py` | Evidence, ambiguity, completeness gates |
| Task Planner | `final/task_planner.py` | Sprint task breakdown |
| Repo Context | `final/repo_context.py` | Codebase architecture extraction |
| Memory Agent | `final/memory_agent.py` | Stores decisions for learning loop |

---

## Analytics

`app/services/analytics/visualizer.py` generates 10 session performance charts using pandas, matplotlib, and scikit-learn — covering stage progression, completion rates, quality gate pass/fail distributions, and more.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key ones:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# LLM
ANTHROPIC_API_KEY=
LLM_DEFAULT_MODEL=claude-sonnet-4-20250514
LLM_TEMPERATURE=0.1

# Embeddings (local)
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Infrastructure
REDIS_URL=redis://localhost:6379/0
APP_ENV=development
```

---

## Testing & Linting

```bash
# Run tests
pytest

# Lint
ruff check .

# Type check
mypy app/
```

---

## Database Schema

Key tables in Supabase (PostgreSQL + pgvector):

| Table | Purpose |
|---|---|
| `profiles` | User accounts (extends auth.users) |
| `organizations` | Teams/orgs with plan tiers |
| `projects` | Products being worked on |
| `feedback_sources` | Integration configs (Intercom, Slack, Notion, etc.) |
| `feedback_items` | Raw signals with 1536-dim embeddings |
| `sessions` | State machine instances with full message history |
| `pattern_clusters` | Synthesized themes with evidence |
| `specs` | Final 6-section deliverables |
| `artifacts` | Exported PRDs, tickets, shareable links |

Feedback items are indexed with IVFFlat for fast approximate nearest-neighbor search.
