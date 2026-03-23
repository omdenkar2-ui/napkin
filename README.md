# napkin — backend

> The intelligence layer between customer reality and code.  
> Cursor builds what you tell it to build. Napkin figures out what that should be.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        FastAPI (REST)                          │
│  /api/v1/auth  /api/v1/sessions  /api/v1/projects  /api/v1/   │
├────────────────────────────────────────────────────────────────┤
│                     Session Service                            │
│            (orchestrates pipeline + persistence)               │
├────────────────────────────────────────────────────────────────┤
│                   LangGraph State Machine                      │
│                                                                │
│   ┌─────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐  │
│   │ INTAKE  │──▶│ SYNTHESIS │──▶│   4 Q's  │──▶│  SPEC    │  │
│   │Structurer│  │ Patterns  │   │ Socratic │   │ Builder  │  │
│   └─────────┘   └───────────┘   └──────────┘   └──────────┘  │
│                                       ▲              │         │
│                                       │         ┌────▼─────┐  │
│                                       └─────────│  REVIEW  │  │
│                                    (if gates    │  Gates   │  │
│                                     fail)       └──────────┘  │
├────────────────────────────────────────────────────────────────┤
│                      Supabase (PostgreSQL)                     │
│  profiles │ orgs │ projects │ feedback_items │ sessions │ specs│
│                     + pgvector embeddings                      │
└────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer          | Technology                          |
|---------------|-------------------------------------|
| API           | FastAPI + Pydantic v2               |
| Database      | Supabase (PostgreSQL + pgvector)    |
| Auth          | Supabase Auth (JWT)                 |
| Agent Engine  | LangGraph + LangChain               |
| LLM           | Anthropic Claude (Sonnet + Haiku)  |
| Embeddings    | HuggingFace all-MiniLM-L6-v2 (local)|
| Background    | Celery + Redis                      |
| Logging       | structlog + Sentry                  |

## Project Structure

```
napkin-backend/
├── app/
│   ├── main.py                    # FastAPI app factory
│   ├── core/
│   │   ├── config.py              # Pydantic Settings
│   │   └── llm.py                 # LLM provider abstraction
│   ├── models/
│   │   ├── entities.py            # Database entity models
│   │   └── agent_state.py         # LangGraph state types
│   ├── schemas/
│   │   └── api.py                 # Request/Response DTOs
│   ├── api/
│   │   ├── deps/
│   │   │   └── auth.py            # Auth dependencies
│   │   └── routes/
│   │       ├── auth.py            # Auth endpoints
│   │       ├── sessions.py        # Core session endpoints
│   │       ├── projects.py        # Projects + Feedback
│   │       ├── specs.py           # Specs + Artifacts
│   │       └── health.py          # Health check
│   ├── services/
│   │   ├── session_service.py     # Session lifecycle manager
│   │   ├── agents/
│   │   │   ├── prompts.py         # All prompt templates
│   │   │   └── mvp/
│   │   │       ├── orchestrator.py # LangGraph state machine
│   │   │       ├── intake.py       # Intake Structurer
│   │   │       ├── synthesis.py    # Signal Synthesis
│   │   │       ├── socratic.py     # 4 Strategic Questions
│   │   │       └── spec_builder.py # Spec + Cursor Prompt
│   │   └── ingestion/
│   │       └── service.py         # Feedback ingestion + embedding
│   └── db/
│       └── client.py              # Supabase client
├── migrations/
│   └── 001_initial_schema.sql     # Full database schema
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
└── .env.example
```

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Supabase project (free tier works)
- Anthropic API key
- Redis (for background jobs)

### 2. Setup

```bash
# Clone and enter
cd napkin-backend

# Create environment
cp .env.example .env
# Edit .env with your Supabase + LLM credentials

# Install dependencies
pip install -e ".[dev]"

# Run database migration
# Copy migrations/001_initial_schema.sql → Supabase SQL Editor → Run

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 3. With Docker
```bash
docker-compose up
```

## API Quick Reference

### Auth
```
POST /api/v1/auth/signup          # Create account
POST /api/v1/auth/login           # Get JWT
POST /api/v1/auth/login/google    # OAuth URL
GET  /api/v1/auth/me              # Current user
```

### Sessions (Core Loop)
```
POST /api/v1/sessions                    # Start session
POST /api/v1/sessions/{id}/message       # Send message (routes by stage)
POST /api/v1/sessions/{id}/feedback      # Add feedback
GET  /api/v1/sessions/{id}               # Get session state
GET  /api/v1/sessions/{id}/spec          # Get generated spec
GET  /api/v1/sessions/{id}/cursor-prompt # Get Cursor prompt
GET  /api/v1/sessions?project_id=...     # List sessions
```

### Projects & Feedback
```
POST /api/v1/projects               # Create project
GET  /api/v1/projects               # List projects
POST /api/v1/feedback/paste          # Paste feedback
POST /api/v1/feedback/upload         # Upload file
GET  /api/v1/feedback?project_id=... # List feedback
```

### Specs
```
GET   /api/v1/specs?project_id=...   # List specs
GET   /api/v1/specs/{id}             # Get spec
PATCH /api/v1/specs/{id}/status      # Update status
PATCH /api/v1/specs/{id}/outcome     # Record outcome
```

### Artifacts
```
GET /api/v1/artifacts/share/{token}  # Public artifact (no auth)
GET /api/v1/artifacts?project_id=... # List artifacts
```

## Session Flow (How It Works)

```
1. User creates a session with project_id
2. User pastes/uploads customer feedback
3. System runs INTAKE → extracts structured signals
4. System auto-advances to SYNTHESIS → discovers patterns
5. System asks 4 STRATEGIC QUESTIONS one at a time:
   Q1: Who is this for? (segment + JTBD)
   Q2: What's the smallest 2-week proof?
   Q3: What are we NOT building?
   Q4: What constraints/risks exist?
6. System builds SPEC (6 sections) + CURSOR PROMPT
7. Quality GATES check: evidence, constraints, ambiguity, completeness
8. If gates pass → DONE. If fail → ask clarifying questions → retry.
```

## Quality Gates

Every spec must pass before delivery:

| Gate           | Checks                                         | Threshold  |
|---------------|------------------------------------------------|------------|
| Evidence      | Decision backed by customer quotes              | ≥1 ref     |
| Constraints   | Non-goals and constraints defined               | ≥1 each    |
| Ambiguity     | No vague words, clear requirements              | Score <0.4 |
| Completeness  | All required sections present                   | 100%       |

## Agents (built)

| Agent | Description |
|-------|-------------|
| **Intake Structurer** | Extracts structured signals from raw feedback |
| **Signal Synthesis** | Clusters signals into themes and patterns |
| **Socratic Questioner** | Asks 4 strategic questions to refine scope |
| **Spec Builder** | Generates 6-section spec + Cursor prompt |
| **Prioritizer** | RICE scoring for opportunities |
| **Spec QA** | Quality gate — evidence, ambiguity, completeness checks |
| **Task Planner** | Breaks spec into sprint-ready tasks |
| **Memory Agent** | Stores decisions and learning loop context |

## Environment Variables

All configuration is managed via environment variables. See [`.env.example`](.env.example) for the full list with descriptions.

```bash
cp .env.example .env
# Edit .env with your Supabase + Anthropic credentials
```

## Running Tests

```bash
pytest
```

## Linting

```bash
ruff check .
```
