-- Migration 002: Add columns for agents 5-9 outputs
-- decision_object and task_plan already exist in 001_initial_schema.sql

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS repo_context JSONB;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS spec_qa_report JSONB;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS repo_files JSONB;
