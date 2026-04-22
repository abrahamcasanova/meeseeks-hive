ALTER TABLE learned_strategies ADD COLUMN IF NOT EXISTS source_meeseeks_id UUID;
ALTER TABLE learned_strategies ADD COLUMN IF NOT EXISTS learned_from_id UUID;
