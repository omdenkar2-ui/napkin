-- ============================================================
-- GitHub issue tracking on decision_log
-- ============================================================

-- Track GitHub issues created by Napkin's action generator
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_url TEXT;
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS github_issue_state TEXT DEFAULT 'open';

-- Auto-shipped flag: TRUE when Napkin detected the issue was closed
ALTER TABLE public.decision_log ADD COLUMN IF NOT EXISTS auto_shipped BOOLEAN DEFAULT FALSE;

-- Index for efficient polling of open issues
CREATE INDEX IF NOT EXISTS idx_decision_log_open_issues
    ON public.decision_log(project_id, github_issue_state)
    WHERE github_issue_state = 'open';
