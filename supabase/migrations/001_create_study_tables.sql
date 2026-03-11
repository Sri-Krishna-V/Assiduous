-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT DEFAULT '📘',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Study sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER / 60
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  target_minutes_per_week INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id)
);

-- Indexes for common queries
CREATE INDEX idx_sessions_subject ON study_sessions(subject_id);
CREATE INDEX idx_sessions_started ON study_sessions(started_at DESC);
CREATE INDEX idx_sessions_active ON study_sessions(ended_at) WHERE ended_at IS NULL;

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Public access policies (for demo/course purposes)
CREATE POLICY "Allow public read on subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Allow public insert on subjects" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on subjects" ON subjects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on subjects" ON subjects FOR DELETE USING (true);

CREATE POLICY "Allow public read on study_sessions" ON study_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on study_sessions" ON study_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on study_sessions" ON study_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on study_sessions" ON study_sessions FOR DELETE USING (true);

CREATE POLICY "Allow public read on goals" ON goals FOR SELECT USING (true);
CREATE POLICY "Allow public insert on goals" ON goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on goals" ON goals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on goals" ON goals FOR DELETE USING (true);

-- Seed some default subjects
INSERT INTO subjects (name, color, icon) VALUES
  ('Cloud Computing', '#3b82f6', '☁️'),
  ('Data Structures', '#ef4444', '🌳'),
  ('Machine Learning', '#8b5cf6', '🤖'),
  ('Operating Systems', '#f59e0b', '⚙️'),
  ('Databases', '#10b981', '🗄️')
ON CONFLICT (name) DO NOTHING;
