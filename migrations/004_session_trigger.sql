-- ============================================================
-- Add trigger column to sessions (manual / auto / webhook)
-- ============================================================

-- Track how a session was initiated
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS trigger TEXT DEFAULT 'manual';
-- Values: 'manual' (user-initiated), 'auto' (scheduled worker), 'webhook' (real-time scraper)

-- Add prioritization and task_planning to session_stage enum if missing
-- (the orchestrator uses these stages but they may not be in the original enum)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prioritization' AND enumtypid = 'session_stage'::regtype) THEN
        ALTER TYPE session_stage ADD VALUE IF NOT EXISTS 'prioritization' AFTER 'intake';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'task_planning' AND enumtypid = 'session_stage'::regtype) THEN
        ALTER TYPE session_stage ADD VALUE IF NOT EXISTS 'task_planning' AFTER 'spec_building';
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
