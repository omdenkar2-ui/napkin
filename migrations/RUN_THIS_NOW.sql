-- ============================================================
-- NAPKIN — Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- Go to: SQL Editor > New Query > Paste this > Run
-- ============================================================

-- 1. GENERATED ACTIONS (one-click outputs: GitHub issues, PRDs, Slack, tickets)
CREATE TABLE IF NOT EXISTS public.generated_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),
    action_type     TEXT NOT NULL CHECK (action_type IN ('github_issue', 'prd_snippet', 'slack_message', 'sprint_ticket')),
    title           TEXT NOT NULL,
    content         JSONB NOT NULL,
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
    external_url    TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_actions_session ON public.generated_actions(session_id);

-- 2. INTEGRATIONS (OAuth connections for scrapers)
CREATE TABLE IF NOT EXISTS public.integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),
    provider        TEXT NOT NULL CHECK (provider IN ('gmail', 'whatsapp', 'ga4', 'github', 'website', 'intercom')),
    status          TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing', 'active')),
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    config          JSONB DEFAULT '{}',
    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT,
    sync_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integrations_project ON public.integrations(project_id);

-- 3. CHAT MESSAGES (Ask Napkin conversation history)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id),
    session_id      UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_project ON public.chat_messages(project_id, created_at);

-- 4. BUSINESS CONTEXTS (website scraping results)
CREATE TABLE IF NOT EXISTS public.business_contexts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 5. SESSION LIFECYCLE columns
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS trigger TEXT DEFAULT 'manual';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 6. PATTERN RESOLUTION columns
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved_by_spec_id UUID;
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 7. DECISION LOG tracking columns
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS pattern_cluster_id UUID;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_url TEXT;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_state TEXT DEFAULT 'open';
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS auto_shipped BOOLEAN DEFAULT FALSE;

-- 8. INDEXES
CREATE INDEX IF NOT EXISTS idx_sessions_archived ON public.sessions(project_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patterns_unresolved ON public.pattern_clusters(session_id, resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_decision_log_open_issues ON public.decision_log(project_id, github_issue_state) WHERE github_issue_state = 'open';

-- 9. RLS for new tables
ALTER TABLE public.generated_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_contexts ENABLE ROW LEVEL SECURITY;

-- Drop policies first if they exist, then recreate
DO $$ BEGIN
    DROP POLICY IF EXISTS "Project members manage actions" ON public.generated_actions;
    DROP POLICY IF EXISTS "Project members manage integrations" ON public.integrations;
    DROP POLICY IF EXISTS "Project members manage chat" ON public.chat_messages;
    DROP POLICY IF EXISTS "Project members view business context" ON public.business_contexts;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Project members manage actions" ON public.generated_actions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = generated_actions.project_id AND public.user_belongs_to_org(p.org_id)));

CREATE POLICY "Project members manage integrations" ON public.integrations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = integrations.project_id AND public.user_belongs_to_org(p.org_id)));

CREATE POLICY "Project members manage chat" ON public.chat_messages FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = chat_messages.project_id AND public.user_belongs_to_org(p.org_id)));

CREATE POLICY "Project members view business context" ON public.business_contexts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = business_contexts.project_id AND public.user_belongs_to_org(p.org_id)));
