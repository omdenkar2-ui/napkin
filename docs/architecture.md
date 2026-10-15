# Architecture

This describes the current public base. It is a source map for reviewing the implementation, separate from the later client-specific systems.

## Request and session flow

```text
Next.js interface → authenticated FastAPI routes → Supabase session
                                              ↓
intake → synthesis → prioritization → strategic context
                                              ↓
                         spec → task plan → exports → completed
```

[`orchestrator.py`](../app/services/agents/orchestrator.py) executes the stages as an asynchronous function and persists progress to the session row. The frontend polls that row. Independent cluster analyses run concurrently; CPU embedding and KMeans work run outside the event loop.

The main pipeline uses LangChain model wrappers and structured Pydantic output. It does not instantiate a LangGraph graph. Older state types and agent helpers in the repository do not imply that the active pipeline executes them.

## Where the behavior lives

| Responsibility | Source | Behavior |
|---|---|---|
| Session API and ownership checks | [`sessions.py`](../app/api/routes/sessions.py), [`session_service.py`](../app/services/session_service.py) | Creates sessions, stores inputs, starts background analysis, exposes results and retry operations. |
| Intake | [`intake.py`](../app/services/agents/intake.py) | Extracts pain, requests, context, and source snippets in batches of 50 with at most 5 concurrent extraction calls. Embedding similarity removes near-duplicate signals. |
| Pattern discovery | [`synthesis.py`](../app/services/agents/synthesis.py) | Selects an analysis strategy by signal count; validates grouping membership and embedding shape. |
| Opportunity ranking | [`prioritizer.py`](../app/services/agents/prioritizer.py) | Requests supported candidates, then calculates `(reach × impact × confidence) / effort`. Estimates require review. |
| Strategic context | [`socratic.py`](../app/services/agents/socratic.py), [`context_inferrer.py`](../app/services/agents/context_inferrer.py) | Infers the product team's strategic constraints from available context. Automated runs can include richer project history. The default pipeline does not pause at four interactive questions. |
| Specifications | [`spec_builder.py`](../app/services/agents/spec_builder.py) | Drafts a spec, performs deterministic linting, and produces an implementation prompt. Lint output is not an enforced approval gate. |
| Task planning | [`task_planner.py`](../app/services/agents/task_planner.py) | Normalizes task estimates, calculates dependency ordering and critical paths, and flags capacity risks. |
| Exports | [`export_service.py`](../app/services/export/export_service.py) | Produces report artifacts from session output. |
| Background work | [`main.py`](../app/main.py), [`auto_pipeline.py`](../app/services/workers/auto_pipeline.py) | APScheduler runs sync, automatic analysis, weekly briefs, and GitHub issue checks inside the API process. |

`spec_qa.py` and the ReAct helper exist as separately tested components. The main orchestrator does not currently invoke a spec-QA retry loop. Celery and Redis appear in dependencies/configuration, but the current scheduler is APScheduler.

## Embeddings and clustering

The default embedding model is `all-MiniLM-L6-v2`, configured in [`config.py`](../app/core/config.py) and loaded by [`llm.py`](../app/core/llm.py). It runs on CPU and produces 384-dimensional vectors. The database migration [`002_embedding_384.sql`](../migrations/002_embedding_384.sql) aligns the feedback vector column and search function with that model.

| Signals after intake | Strategy |
|---|---|
| 0 | Empty report; no fabricated categories. |
| 1–5 | Direct structured LLM analysis. |
| 6–15 | LLM grouping; each signal must appear in exactly one non-empty group. |
| More than 15 | Local embeddings and KMeans; `k = min(12, max(3, signal_count // 5))`, capped by the number of distinct vectors. |

KMeans uses `random_state=42` and `n_init=10`. These are engineering heuristics for this demo, not empirically validated optimal thresholds. [`test_synthesis_reliability.py`](../tests/test_synthesis_reliability.py) checks repeatability on a small separated dataset, invalid vectors, embedding outages, malformed groups, and unsupported categories. It does not establish clustering accuracy on customer data.

The model performs embedding inference; KMeans fits clusters for each batch. There is no custom neural-network training or fine-tuning pipeline here. Confidence fields are model estimates, not calibrated probabilities; more input alone does not establish representative or accurate conclusions.

## Failure and recovery behavior

- Embedding, grouping, cluster-analysis, or categorization failures stop synthesis. They do not create random vectors, arbitrary groups, or placeholder findings.
- Empty categories are accepted. Prioritization can return no supported opportunity; the pipeline then completes without generating a spec.
- A stage error marks the session as failed with a generic retry message. Stored feedback is marked processed only after a successful run, and only for input records actually included.
- Retries start a new execution using retained input. They are not durable per-node graph checkpoints.
- Memory storage and downstream action generation are best-effort. Some drafting components retain fallback behavior; a completed session is not proof that every optional integration succeeded.
- Startup recovery marks interrupted sessions as errors. Run a single API instance; a durable queue and distributed locking would be needed before horizontal scaling.

## Validation boundary

Automated tests cover deterministic behavior and mocked service boundaries. They do not connect to production Supabase, Anthropic, OAuth providers, email, Slack, WhatsApp, or customer systems. Before a real deployment, validate a full authenticated flow against a fresh migrated database and test each enabled integration with a controlled account.

The frontend's unconnected query hooks are listed in the root README. They must be completed before presenting those screens as functioning capabilities of a hosted product. Account signup creates a profile, but workspace membership needs administrator provisioning in this demo; onboarding and team screens do not implement that lifecycle.
