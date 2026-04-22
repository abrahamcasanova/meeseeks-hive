-- Up Migration: Learned strategies for cross-task learning

-- Stores successful strategies that can be reused across meeseeks
CREATE TABLE learned_strategies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_pattern    TEXT NOT NULL,                          -- e.g., "fetchWithRetry", "rateLimiter"
  strategy_name   TEXT NOT NULL,                          -- Name of the strategy
  strategy_params JSONB NOT NULL DEFAULT '{}',            -- {retries, cacheTTL, backoff}
  code_template   TEXT NOT NULL,                          -- Full working code
  avg_score       REAL NOT NULL DEFAULT 0,                -- Running average of scores
  success_count   INT NOT NULL DEFAULT 1,                 -- Times this strategy succeeded
  env_scores      JSONB NOT NULL DEFAULT '{}',            -- {"easy": 10, "medium": 8}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_pattern, strategy_name)
);

-- Index for fast lookups by task pattern
CREATE INDEX idx_learned_pattern ON learned_strategies(task_pattern);

-- Index for finding best strategies
CREATE INDEX idx_learned_score ON learned_strategies(avg_score DESC);

-- Function to update timestamp on modification
CREATE OR REPLACE FUNCTION update_learned_strategies_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_learned_strategies_updated
  BEFORE UPDATE ON learned_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_learned_strategies_timestamp();
