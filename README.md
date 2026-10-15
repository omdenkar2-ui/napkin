<p><img src="frontend/public/logo_clean_final.png" width="64" alt="Napkin logo"></p>

# Napkin

**Turn scattered customer feedback into product decisions.**

Napkin groups feedback, surfaces supported patterns, and drafts specifications and implementation tasks for a person to review. We built this public base while exploring how product teams could spend less time sorting feedback and more time deciding what to do with it.

This repository contains the **base/demo we iterated from**. Later, tailored client implementations are separate. [Product landing page ↗](https://www.usenapkin.com/)

## Start here

- **Follow the workflow:** [`orchestrator.py`](app/services/agents/orchestrator.py) coordinates intake, synthesis, prioritization, context, specs, tasks, and exports.
- **Inspect the ML:** [`synthesis.py`](app/services/agents/synthesis.py) combines local sentence embeddings, deterministic KMeans, and structured LLM analysis. Small batches use direct analysis or LLM grouping.
- **Check the boundaries:** failures preserve feedback for retry; unsupported categories can stay empty. [`tests/`](tests/) covers clustering, stage failures, authorization, and the surrounding services.

The stack is **Python · FastAPI · LangChain · scikit-learn · Supabase · Next.js · TypeScript**. The active orchestrator is a direct asynchronous pipeline. LangGraph remains in the dependency set, but this checkout does not implement a LangGraph state machine.

[Architecture and tradeoffs](docs/architecture.md) · [Security and validation scope](docs/security.md)

## Run locally

Use **Python 3.11+**, [uv](https://docs.astral.sh/uv/getting-started/installation/), **Node.js 22.12+**, a Supabase project, and an Anthropic API key. The first embedding run downloads `all-MiniLM-L6-v2` from Hugging Face and runs it locally on CPU.

### Backend

```bash
cp .env.example .env
# Fill in your Supabase credentials, APP_SECRET_KEY and ANTHROPIC_API_KEY.
uv sync --locked --extra dev --python 3.11
```

For a **new, empty Supabase project**, run these SQL files in order in its SQL editor:

```text
001_initial_schema.sql
002_add_agent_columns.sql
002_embedding_384.sql
003_addons_schema.sql
004_session_trigger.sql
005_session_lifecycle.sql
006_socratic_mode.sql
007_github_tracking.sql
008_profile_authorization.sql
```

All files are in [`migrations/`](migrations/). Both `002` files are required. `RUN_THIS_NOW.sql` is a historical repair script, not part of this setup. The resulting feedback vectors use **384 dimensions**. Existing databases need a migration review and re-embedding plan before changing vector dimensions.

Configure Supabase Auth with an **ES256 signing key** and add `http://localhost:3000/callback` to its redirect URLs; the API verifies JWTs against the project's JWKS. Set the backend `FRONTEND_URL=http://localhost:3000` and configure a Google provider only if using Google sign-in.

```bash
uv run uvicorn app.main:app --reload --port 8000 --workers 1
```

API documentation: `http://localhost:8000/docs`. Run one API process: its scheduler runs in-process and multiple replicas would duplicate scheduled work.

### Frontend

In a second terminal:

```bash
cd frontend
cp .env.local.example .env.local
# Fill in the same Supabase URL and its public anon/publishable key.
npm ci
npm run dev
```

Open `http://localhost:3000`, create an account, and confirm its email. A database administrator must then run [`scripts/provision_demo_workspace.sql`](scripts/provision_demo_workspace.sql) in the Supabase SQL editor. Replace `target_user_id` with the user's UUID from **Authentication → Users**, and optionally change `workspace_name`. The script creates the workspace, owner membership, and a default project; it refuses to reassign an existing member.

The onboarding screens do not provision membership; self-service organizations and invitations are unfinished.

Once provisioned, sign in and create a session with sample feedback. API calls use your Supabase session; service-role credentials belong only in the backend environment.

## Verify changes

Backend tests mock service calls and use test credentials; they do not need a live database, model download, or paid API call:

```bash
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 ANTHROPIC_API_KEY=test-placeholder \
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 uv run pytest -q
```

Frontend checks, from `frontend/` with its environment configured:

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

The Next.js build downloads Google Fonts. [CI](.github/workflows/ci.yml) runs the test suites and frontend checks with placeholder configuration. These checks establish code behavior with fixtures; live login, database policies, model quality, and external integrations need separate end-to-end validation.

## Current demo scope

Sessions and project chat have backend connections. Dashboard statistics/activity, the standalone tasks board, workflows, team management, and generic integration hooks remain unfinished UI paths; see [`use-api.ts`](frontend/src/hooks/use-api.ts). Tasks generated inside a session are distinct from that standalone board.

Outputs are drafts for human review. RICE inputs and model confidence are estimates, not measured business outcomes. The ML in this base is embedding inference and unsupervised clustering; this repository does not claim a custom-trained or fine-tuned model.
