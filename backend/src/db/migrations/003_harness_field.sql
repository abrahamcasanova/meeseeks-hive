-- Add harness column to meeseeks table to track which plugin evaluates the agent's code
ALTER TABLE meeseeks ADD COLUMN IF NOT EXISTS harness TEXT NOT NULL DEFAULT 'js-api';
