-- Crew roster (dimension)
CREATE TABLE IF NOT EXISTS crew (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  deck_zone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Indexes (unique constraints, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS crew_name_unique ON crew(name);
