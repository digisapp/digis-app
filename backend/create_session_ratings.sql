-- Create session_ratings table
CREATE TABLE IF NOT EXISTS session_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_ratings_creator_id ON session_ratings(creator_id);
CREATE INDEX IF NOT EXISTS idx_session_ratings_user_id ON session_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_session_ratings_session_id ON session_ratings(session_id);

-- Add RLS
ALTER TABLE session_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read all ratings" ON session_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can create own ratings" ON session_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON session_ratings
    FOR UPDATE USING (auth.uid() = user_id);
