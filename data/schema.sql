CREATE TABLE IF NOT EXISTS letters (
  id BIGSERIAL PRIMARY KEY,
  nickname TEXT,
  letter TEXT NOT NULL,
  read_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS letters_created_at_idx ON letters (created_at DESC);
