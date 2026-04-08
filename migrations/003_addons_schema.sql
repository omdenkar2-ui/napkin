-- ============================================================
-- NAPKIN ADD-ONS SCHEMA — Integrations, Chat, Business Context
-- ============================================================

-- ============================================================
-- 1. INTEGRATIONS (OAuth connections for scrapers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),
    provider        TEXT NOT NULL CHECK (provider IN (
                        'gmail', 'whatsapp', 'ga4', 'github', 'website'
                    )),
    status          TEXT DEFAULT 'disconnected' CHECK (status IN (
                        'connected', 'disconnected', 'error', 'syncing'
                    )),

    -- OAuth tokens (encrypted at rest by Supabase)
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Provider-specific config
    config          JSONB DEFAULT '{}',
    -- e.g. gmail: {labels_filter: [], keyword_filter: []}
    -- e.g. ga4: {property_id: "...", metrics: [...]}
    -- e.g. whatsapp: {phone_number_id: "...", verify_token: "..."}
    -- e.g. github: {repo_owner: "...", repo_name: "...", installation_id: "..."}
    -- e.g. website: {url: "...", pages_scraped: [...]}

    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT,
    sync_count      INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, provider)
);

CREATE INDEX idx_integrations_project ON public.integrations(project_id);

-- ============================================================
-- 2. CHAT MESSAGES (conversational AI history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),
    session_id      UUID REFERENCES public.sessions(id) ON DELETE SET NULL,

    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    -- metadata stores: referenced_sessions, referenced_clusters, tool_calls, etc.

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_project ON public.chat_messages(project_id, created_at);

-- ============================================================
-- 3. BUSINESS CONTEXT (from website scraping)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_contexts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    url             TEXT NOT NULL,
    product_name    TEXT,
    core_value_prop TEXT,
    target_customer TEXT,
    key_features    JSONB DEFAULT '[]',
    pricing_model   TEXT,
    competitors     JSONB DEFAULT '[]',
    tone            TEXT,
    raw_pages       JSONB DEFAULT '{}',

    scraped_at      TIMESTAMPTZ DEFAULT NOW(),
    is_stale        BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id)
);

-- ============================================================
-- 4. GENERATED ACTIONS (one-click outputs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_actions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),

    action_type     TEXT NOT NULL CHECK (action_type IN (
                        'github_issue', 'prd_snippet', 'slack_message', 'sprint_ticket'
                    )),
    title           TEXT NOT NULL,
    content         JSONB NOT NULL,
    -- github_issue: {title, body, labels[], repo_owner, repo_name}
    -- prd_snippet: {title, sections[]}
    -- slack_message: {channel, text, blocks[]}
    -- sprint_ticket: {title, description, story_points, priority, labels[]}

    status          TEXT DEFAULT 'draft' CHECK (status IN (
                        'draft', 'sent', 'failed'
                    )),
    external_url    TEXT,          -- URL of created GitHub issue, Slack message, etc.
    sent_at         TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_actions_session ON public.generated_actions(session_id);

-- ============================================================
-- RLS for new tables
-- ============================================================
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members manage integrations"
    ON public.integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = integrations.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

CREATE POLICY "Project members manage chat"
    ON public.chat_messages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = chat_messages.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

CREATE POLICY "Project members view business context"
    ON public.business_contexts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = business_contexts.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

CREATE POLICY "Project members manage actions"
    ON public.generated_actions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = generated_actions.project_id
            AND public.user_belongs_to_org(p.org_id)
        )
    );

-- Add source_type values for new scrapers to feedback_sources
ALTER TABLE public.feedback_sources DROP CONSTRAINT IF EXISTS feedback_sources_source_type_check;
ALTER TABLE public.feedback_sources ADD CONSTRAINT feedback_sources_source_type_check
    CHECK (source_type IN (
        'manual_paste', 'file_upload', 'intercom', 'zendesk',
        'slack', 'notion', 'linear', 'csv', 'google_forms',
        'typeform', 'hubspot', 'api',
        'gmail', 'whatsapp', 'ga4', 'website'
    ));
