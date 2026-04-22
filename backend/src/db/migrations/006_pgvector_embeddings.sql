-- Migration 006: Semantic embeddings for task similarity search
-- Requires pgvector extension (already enabled in init.sql)

-- Store the original task text alongside each learned strategy
ALTER TABLE learned_strategies
  ADD COLUMN IF NOT EXISTS task_text TEXT,
  ADD COLUMN IF NOT EXISTS task_embedding vector(1024);

-- HNSW index: no training phase needed, handles incremental inserts well,
-- and outperforms IVFFlat at recall for < 1M rows.
-- vector_cosine_ops matches the cosine similarity we use in queries.
CREATE INDEX IF NOT EXISTS idx_learned_embedding_hnsw
  ON learned_strategies
  USING hnsw (task_embedding vector_cosine_ops);
