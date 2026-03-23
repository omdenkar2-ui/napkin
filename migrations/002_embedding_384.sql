-- ============================================================
-- Migration 002: Switch embeddings from OpenAI (1536-dim) to
-- HuggingFace all-MiniLM-L6-v2 (384-dim)
-- ============================================================

-- Drop the old index (can't alter vector dimensions with index in place)
DROP INDEX IF EXISTS idx_feedback_embedding;

-- Change the column dimension
ALTER TABLE public.feedback_items
    ALTER COLUMN embedding TYPE vector(384);

-- Recreate the index with new dimensions
CREATE INDEX idx_feedback_embedding ON public.feedback_items
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update the similarity search function
CREATE OR REPLACE FUNCTION public.match_feedback(
    query_embedding vector(384),
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
