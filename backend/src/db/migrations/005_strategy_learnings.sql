CREATE TABLE IF NOT EXISTS strategy_learnings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id   UUID REFERENCES learned_strategies(id) ON DELETE CASCADE,
  learner_id    UUID NOT NULL,
  source_id     UUID,             -- quien creó la estrategia originalmente (NULL = soy el primero)
  task_pattern  TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  score         REAL NOT NULL,
  learned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_learnings_learner ON strategy_learnings(learner_id);
CREATE INDEX IF NOT EXISTS idx_strategy_learnings_source  ON strategy_learnings(source_id);
