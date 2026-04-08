-- ============================================================
-- Session Lifecycle: archive, pattern resolution, decision tracking
-- ============================================================

-- Session archiving
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Pattern resolution tracking
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved_by_spec_id UUID REFERENCES public.specs(id);
ALTER TABLE public.pattern_clusters ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Decision log: link to pattern and shipping date
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS pattern_cluster_id UUID REFERENCES public.pattern_clusters(id);
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- Indexes for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_sessions_archived
    ON public.sessions(project_id, archived_at) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patterns_unresolved
    ON public.pattern_clusters(session_id, resolved) WHERE resolved = FALSE;
