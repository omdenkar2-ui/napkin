-- ============================================================
-- Socratic mode tracking: guided vs autopilot
-- ============================================================

-- Track how the 4Q answers were generated
-- 'guided' = manual socratic session, 'autopilot' = auto-inferred, 'autopilot_fallback' = fallback
-- Note: four_q_answers JSONB column already exists on sessions, so the answers
-- themselves include a _mode field. This column is for quick filtering.
-- Not adding a separate column since the _mode is already in the JSONB.
-- This migration is a no-op placeholder for documentation.

-- If you need to query sessions by mode efficiently:
-- CREATE INDEX IF NOT EXISTS idx_sessions_trigger ON public.sessions(trigger);
