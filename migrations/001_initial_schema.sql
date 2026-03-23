-- ============================================================
-- NAPKIN DATABASE SCHEMA — Supabase Migration
-- Run this in the Supabase SQL Editor (or via CLI migration)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram for fuzzy search

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT,
    avatar_url      TEXT,
    org_id          UUID,
    role            TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    onboarding_done BOOLEAN DEFAULT FALSE,
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. ORGANIZATIONS
-- ============================================================
CREATE TABLE public.organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.org_members (
    org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role            TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (org_id, user_id)
);

-- ============================================================
-- 3. PROJECTS (a product/repo being worked on)
-- ============================================================
CREATE TABLE public.projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    repo_url        TEXT,
    repo_provider   TEXT CHECK (repo_provider IN ('github', 'gitlab', 'bitbucket')),
    settings        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON public.projects(org_id);

-- ============================================================
-- 4. FEEDBACK SOURCES (integration configs)
-- ============================================================
CREATE TABLE public.feedback_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL CHECK (source_type IN (
                        'manual_paste', 'file_upload', 'intercom', 'zendesk',
                        'slack', 'notion', 'linear', 'csv', 'google_forms',
                        'typeform', 'hubspot', 'api'
                    )),
    config          JSONB DEFAULT '{}',   -- connection credentials, filters, etc.
    last_synced_at  TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. FEEDBACK ITEMS (the raw signal — the atomic unit)
-- ============================================================
CREATE TABLE public.feedback_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    source_id       UUID REFERENCES public.feedback_sources(id) ON DELETE SET NULL,
    session_id      UUID,  -- which napkin session ingested this

    -- Content
    raw_text        TEXT NOT NULL,
    cleaned_text    TEXT,
    language        TEXT DEFAULT 'en',

    -- Structured extraction (filled by Signal Extractor)
    pain            TEXT,
    request         TEXT,
    context         TEXT,
    emotion         TEXT CHECK (emotion IN (
                        'frustrated', 'confused', 'delighted', 'neutral',
                        'angry', 'hopeful', 'disappointed', NULL
                    )),
    jtbd_hint       TEXT,                -- job-to-be-done hint
    segment_guess   TEXT,                -- user segment guess

    -- Metadata
    author_name     TEXT,
    author_role     TEXT,
    author_company  TEXT,
    feedback_date   TIMESTAMPTZ,
    external_id     TEXT,                -- ID from source system
    metadata        JSONB DEFAULT '{}',

    -- Embeddings
    embedding       vector(1536),

    -- Processing state
    status          TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processed', 'error', 'archived')),
    processed_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_project ON public.feedback_items(project_id);
CREATE INDEX idx_feedback_session ON public.feedback_items(session_id);
CREATE INDEX idx_feedback_status ON public.feedback_items(status);
CREATE INDEX idx_feedback_embedding ON public.feedback_items
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- 6. SESSIONS (the core napkin session — one run of the agent pipeline)
-- ============================================================
CREATE TYPE session_stage AS ENUM (
    'intake',
    'synthesis',
    'four_questions',
    'spec_building',
    'review',
    'done',
    'error'
);

CREATE TABLE public.sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES public.profiles(id),

    -- State machine
    stage           session_stage DEFAULT 'intake',
    stage_history   JSONB DEFAULT '[]',   -- [{stage, entered_at, exited_at}]

    -- User inputs (structured)
    intake_summary  JSONB,                -- output of Intake Structurer
    four_q_answers  JSONB,                -- the 4 strategic question answers

    -- Agent outputs
    pattern_report  JSONB,                -- output of Signal Synthesis Agent
    decision_object JSONB,                -- output of Opportunity Prioritizer
    spec_object     JSONB,                -- output of Spec Builder
    cursor_prompt   TEXT,                 -- final Cursor-ready prompt
    task_plan       JSONB,                -- output of Task Planner

    -- Quality gates
    gate_results    JSONB DEFAULT '{}',   -- {evidence: pass/fail, constraints: ..., grounding: ...}
    ambiguity_score FLOAT,

    -- Metadata
    title           TEXT,                 -- auto-generated session title
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error', 'abandoned')),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Conversation history (full langgraph state)
    messages        JSONB DEFAULT '[]',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_project ON public.sessions(project_id);
CREATE INDEX idx_sessions_user ON public.sessions(created_by);
CREATE INDEX idx_sessions_status ON public.sessions(status);

-- ============================================================
-- 7. PATTERN CLUSTERS (persisted themes from synthesis)
-- ============================================================
CREATE TABLE public.pattern_clusters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    label           TEXT NOT NULL,
    description     TEXT,
    pain_summary    TEXT,
    frequency       INTEGER DEFAULT 0,       -- how many items map to this
    severity_score  FLOAT,                    -- 0-10
    confidence      FLOAT,                    -- 0-1
    urgency         TEXT CHECK (urgency IN ('critical', 'high', 'medium', 'low')),

    -- Evidence
    quote_ids       UUID[] DEFAULT '{}',      -- feedback_item IDs used as evidence
    top_quotes      JSONB DEFAULT '[]',       -- [{text, source_id, author}]

    -- Relationships
    contradicts     UUID[],                   -- cluster IDs that conflict
    related_to      UUID[],                   -- cluster IDs that relate

    rank            INTEGER,                  -- position in "top pains" list

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clusters_session ON public.pattern_clusters(session_id);
CREATE INDEX idx_clusters_project ON public.pattern_clusters(project_id);

-- ============================================================
-- 8. SPEC OBJECTS (the final deliverable)
-- ============================================================
CREATE TABLE public.specs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES public.profiles(id),

    -- The 6 sections
    decision        JSONB NOT NULL,           -- {what, why, evidence_refs[], segment}
    ui_changes      JSONB,                    -- {screens[], components[], flows[]}
    data_model      JSONB,                    -- {entities[], migrations[], relations[]}
    task_breakdown  JSONB,                    -- {tasks[{title, type:FE/BE/DB, estimate, deps}]}
    success_criteria JSONB,                   -- {metrics[{name, target, timeframe}]}
    cursor_prompt   TEXT,                     -- the stepwise prompt

    -- Quality
    lint_results    JSONB DEFAULT '{}',
    ambiguity_score FLOAT,
    completeness    FLOAT,                    -- 0-1
    grounding_score FLOAT,                    -- 0-1 how well it references real repo entities

    -- Versioning
    version         INTEGER DEFAULT 1,
    parent_spec_id  UUID REFERENCES public.specs(id),  -- previous version

    -- Status
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'shipped', 'abandoned')),

    -- Outcome tracking
    outcome         JSONB,                    -- {shipped: bool, shipped_at, outcome_notes, success_metrics_met}

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specs_session ON public.specs(session_id);
CREATE INDEX idx_specs_project ON public.specs(project_id);
CREATE INDEX idx_specs_status ON public.specs(status);

-- ============================================================
-- 9. REPO CONTEXT (cached codebase understanding)
-- ============================================================
CREATE TABLE public.repo_contexts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Detected info
    stack           JSONB,                    -- {frontend, backend, database, orm, hosting}
    entities        JSONB,                    -- [{name, fields[], relations[]}]
    routes          JSONB,                    -- [{method, path, handler, description}]
    auth_model      JSONB,                    -- {strategy, roles[], permissions[]}
    ui_surfaces     JSONB,                    -- [{name, path, components[]}]
    conventions     JSONB,                    -- {folder_structure, naming, test_patterns}

    -- Raw snapshots
    readme_content  TEXT,
    schema_snapshot TEXT,

    -- Freshness
    repo_sha        TEXT,                     -- last commit SHA indexed
    indexed_at      TIMESTAMPTZ DEFAULT NOW(),
    is_stale        BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_repo_context_project ON public.repo_contexts(project_id);

-- ============================================================
-- 10. DECISION LOG (memory for compounding)
-- ============================================================
CREATE TABLE public.decision_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES public.sessions(id),
    spec_id         UUID REFERENCES public.specs(id),

    decision_type   TEXT CHECK (decision_type IN ('build', 'defer', 'kill', 'investigate')),
    summary         TEXT NOT NULL,
    reasoning       TEXT,
    evidence_refs   JSONB DEFAULT '[]',
    alternatives    JSONB DEFAULT '[]',       -- [{option, why_not}]

    -- Outcome
    outcome_status  TEXT CHECK (outcome_status IN ('pending', 'shipped', 'validated', 'failed', 'reverted')),
    outcome_notes   TEXT,
    outcome_date    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_log_project ON public.decision_log(project_id);

-- ============================================================
-- 11. NAPKIN ARTIFACTS (virality layer — shareable drops)
-- ============================================================
CREATE TABLE public.napkin_artifacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    session_id      UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES public.profiles(id),

    -- Content
    title           TEXT NOT NULL,
    summary         TEXT,
    stroke_variant  TEXT,                     -- the "living logo" stroke type
    milestone_type  TEXT CHECK (milestone_type IN (
                        'first_spec', 'first_validated_feature', 'first_synthesis',
                        'first_cursor_prompt', 'ten_sessions', 'custom'
                    )),

    -- Rendering
    template_id     TEXT DEFAULT 'default',
    render_data     JSONB DEFAULT '{}',
    image_url       TEXT,                     -- S3/Supabase Storage URL

    -- Sharing
    share_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_public       BOOLEAN DEFAULT TRUE,
    view_count      INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artifacts_share ON public.napkin_artifacts(share_token);

-- ============================================================
-- 12. API KEYS (for programmatic access)
-- ============================================================
CREATE TABLE public.api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES public.profiles(id),
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL,             -- bcrypt hash of the key
    prefix          TEXT NOT NULL,             -- first 8 chars for identification
    scopes          TEXT[] DEFAULT '{read,write}',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. USAGE TRACKING
-- ============================================================
CREATE TABLE public.usage_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES public.organizations(id),
    user_id         UUID REFERENCES public.profiles(id),
    project_id      UUID REFERENCES public.projects(id),
    session_id      UUID REFERENCES public.sessions(id),

    event_type      TEXT NOT NULL,             -- 'session_start', 'synthesis_run', 'spec_generated', etc.
    event_data      JSONB DEFAULT '{}',
    tokens_used     INTEGER DEFAULT 0,
    model_used      TEXT,
    latency_ms      INTEGER,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_org ON public.usage_events(org_id, created_at);
CREATE INDEX idx_usage_event ON public.usage_events(event_type, created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.napkin_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Helper: check org membership
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(org UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.org_members
        WHERE org_id = org AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users see own profile
CREATE POLICY "Users view own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- Org members: see members of your orgs
CREATE POLICY "View org members"
    ON public.org_members FOR SELECT
    USING (public.user_belongs_to_org(org_id));

-- Projects: org members see projects
CREATE POLICY "Org members view projects"
    ON public.projects FOR SELECT
    USING (public.user_belongs_to_org(org_id));

CREATE POLICY "Org members create projects"
    ON public.projects FOR INSERT
    WITH CHECK (public.user_belongs_to_org(org_id));

CREATE POLICY "Org members update projects"
    ON public.projects FOR UPDATE
    USING (public.user_belongs_to_org(org_id));

-- Feedback items: project-scoped
CREATE POLICY "Project members view feedback"
    ON public.feedback_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = feedback_items.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

CREATE POLICY "Project members insert feedback"
    ON public.feedback_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = feedback_items.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

-- Sessions: project-scoped
CREATE POLICY "Project members view sessions"
    ON public.sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = sessions.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

CREATE POLICY "Project members manage sessions"
    ON public.sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = sessions.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

-- Specs: project-scoped
CREATE POLICY "Project members view specs"
    ON public.specs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = specs.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

-- Artifacts: public ones are viewable by all, private by org
CREATE POLICY "Public artifacts viewable by all"
    ON public.napkin_artifacts FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY "Org members manage artifacts"
    ON public.napkin_artifacts FOR ALL
    USING (
        project_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = napkin_artifacts.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
            t, t
        );
    END LOOP;
END $$;

-- ============================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_feedback(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    raw_text TEXT,
    pain TEXT,
    request TEXT,
    segment_guess TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fi.id,
        fi.raw_text,
        fi.pain,
        fi.request,
        fi.segment_guess,
        1 - (fi.embedding <=> query_embedding) AS similarity
    FROM public.feedback_items fi
    WHERE
        (filter_project_id IS NULL OR fi.project_id = filter_project_id)
        AND fi.embedding IS NOT NULL
        AND 1 - (fi.embedding <=> query_embedding) > match_threshold
    ORDER BY fi.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
