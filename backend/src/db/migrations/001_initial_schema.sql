-- Up Migration: Initial schema for Meeseeks Hive

-- Meeseeks instances
CREATE TABLE meeseeks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'dying', 'dead')),
  role            TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'manager')),
  model           TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  strategy        TEXT,
  parent_id       UUID REFERENCES meeseeks(id) ON DELETE SET NULL,
  spawn_depth     INT NOT NULL DEFAULT 0,
  stress          REAL NOT NULL DEFAULT 0,
  failed_attempts INT NOT NULL DEFAULT 0,
  lost_race       BOOLEAN NOT NULL DEFAULT false,
  inherited_strategy_failed BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  died_at         TIMESTAMPTZ,
  death_reason    TEXT,
  total_tokens    INT NOT NULL DEFAULT 0,
  total_cost      REAL NOT NULL DEFAULT 0
);

CREATE INDEX idx_meeseeks_status ON meeseeks(status);
CREATE INDEX idx_meeseeks_parent ON meeseeks(parent_id);

-- Message history (separate table, lazy-loaded)
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeseeks_id     UUID NOT NULL REFERENCES meeseeks(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  tokens_used     INT NOT NULL DEFAULT 0,
  cost            REAL NOT NULL DEFAULT 0,
  model           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_meeseeks_time ON messages(meeseeks_id, created_at DESC);

-- Event sourcing table
CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,
  meeseeks_id     UUID NOT NULL REFERENCES meeseeks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_meeseeks_time ON events(meeseeks_id, created_at);

-- Embeddings for competition detection (pgvector)
CREATE TABLE embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeseeks_id     UUID NOT NULL REFERENCES meeseeks(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  embedding       vector(1536) NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Cost ledger for detailed token tracking
CREATE TABLE cost_ledger (
  id              BIGSERIAL PRIMARY KEY,
  meeseeks_id     UUID NOT NULL REFERENCES meeseeks(id) ON DELETE CASCADE,
  model           TEXT NOT NULL,
  input_tokens    INT NOT NULL,
  output_tokens   INT NOT NULL,
  cost            REAL NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_meeseeks ON cost_ledger(meeseeks_id);
