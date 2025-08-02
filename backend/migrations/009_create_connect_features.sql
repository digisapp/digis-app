-- Migration: Create Connect Features Tables
-- This migration creates tables for the Creator Connect page features

-- Creator profiles for Connect page
CREATE TABLE IF NOT EXISTS creator_connect_profiles (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    specialties TEXT[] DEFAULT '{}',
    collaboration_interests TEXT[] DEFAULT '{}',
    experience_level VARCHAR(50) DEFAULT 'Beginner', -- Beginner, Intermediate, Advanced, Expert
    show_success_metrics BOOLEAN DEFAULT true,
    bio TEXT,
    available_for_collab BOOLEAN DEFAULT true,
    available_for_mentorship BOOLEAN DEFAULT false,
    available_for_travel BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(creator_id)
);

-- Collaboration posts
CREATE TABLE IF NOT EXISTS collaborations (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- gaming, music, art, cooking, fitness, tech, business
    collaboration_type VARCHAR(50) NOT NULL, -- co-streaming, content-series, cross-promotion, skill-exchange
    requirements TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, filled, cancelled
    max_participants INTEGER DEFAULT 1,
    current_participants INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaboration applications
CREATE TABLE IF NOT EXISTS collaboration_applications (
    id SERIAL PRIMARY KEY,
    collaboration_id INTEGER NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collaboration_id, applicant_id)
);

-- Creator trips
CREATE TABLE IF NOT EXISTS creator_trips (
    id SERIAL PRIMARY KEY,
    organizer_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    content_focus VARCHAR(255),
    estimated_cost DECIMAL(10, 2),
    max_participants INTEGER DEFAULT 10,
    activities TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'planning', -- planning, confirmed, ongoing, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip participants
CREATE TABLE IF NOT EXISTS trip_participants (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES creator_trips(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'interested', -- interested, confirmed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trip_id, participant_id)
);

-- Local meetups
CREATE TABLE IF NOT EXISTS creator_meetups (
    id SERIAL PRIMARY KEY,
    organizer_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    meetup_date TIMESTAMP WITH TIME ZONE NOT NULL,
    max_attendees INTEGER DEFAULT 20,
    category VARCHAR(50),
    status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, ongoing, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetup attendees
CREATE TABLE IF NOT EXISTS meetup_attendees (
    id SERIAL PRIMARY KEY,
    meetup_id INTEGER NOT NULL REFERENCES creator_meetups(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered', -- registered, attended, no-show, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meetup_id, attendee_id)
);

-- Mentorship profiles
CREATE TABLE IF NOT EXISTS mentorship_profiles (
    id SERIAL PRIMARY KEY,
    mentor_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    expertise VARCHAR(255) NOT NULL,
    specialties TEXT[] DEFAULT '{}',
    experience_years INTEGER DEFAULT 0,
    availability VARCHAR(100), -- weekly, bi-weekly, monthly, on-demand
    max_mentees INTEGER DEFAULT 5,
    current_mentees INTEGER DEFAULT 0,
    bio TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id)
);

-- Mentorship relationships
CREATE TABLE IF NOT EXISTS mentorships (
    id SERIAL PRIMARY KEY,
    mentor_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed, cancelled
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, mentee_id)
);

-- Mentorship sessions
CREATE TABLE IF NOT EXISTS mentorship_sessions (
    id SERIAL PRIMARY KEY,
    mentorship_id INTEGER NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
    session_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forum categories
CREATE TABLE IF NOT EXISTS forum_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(20) DEFAULT 'purple',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forum topics
CREATE TABLE IF NOT EXISTS forum_topics (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forum replies
CREATE TABLE IF NOT EXISTS forum_replies (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_solution BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default forum categories
INSERT INTO forum_categories (name, slug, description, color, sort_order) VALUES
    ('Tips & Tricks', 'tips-tricks', 'Share your best practices and learn from others', 'purple', 1),
    ('Success Stories', 'success-stories', 'Celebrate your wins and inspire others', 'green', 2),
    ('Collaborations', 'collaborations', 'Find partners for your next project', 'pink', 3),
    ('Technical Help', 'technical-help', 'Get help with streaming, equipment, and setup', 'blue', 4),
    ('General Discussion', 'general', 'Chat about anything creator-related', 'gray', 5);

-- Indexes for performance
CREATE INDEX idx_creator_connect_profiles_creator_id ON creator_connect_profiles(creator_id);
CREATE INDEX idx_collaborations_creator_id ON collaborations(creator_id);
CREATE INDEX idx_collaborations_status ON collaborations(status);
CREATE INDEX idx_collaboration_applications_collaboration_id ON collaboration_applications(collaboration_id);
CREATE INDEX idx_creator_trips_organizer_id ON creator_trips(organizer_id);
CREATE INDEX idx_creator_trips_dates ON creator_trips(start_date, end_date);
CREATE INDEX idx_creator_meetups_location ON creator_meetups(location);
CREATE INDEX idx_creator_meetups_date ON creator_meetups(meetup_date);
CREATE INDEX idx_mentorship_profiles_mentor_id ON mentorship_profiles(mentor_id);
CREATE INDEX idx_mentorships_mentor_mentee ON mentorships(mentor_id, mentee_id);
CREATE INDEX idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX idx_forum_topics_author ON forum_topics(author_id);
CREATE INDEX idx_forum_replies_topic ON forum_replies(topic_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_creator_connect_profiles_updated_at BEFORE UPDATE ON creator_connect_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborations_updated_at BEFORE UPDATE ON collaborations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaboration_applications_updated_at BEFORE UPDATE ON collaboration_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_trips_updated_at BEFORE UPDATE ON creator_trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_meetups_updated_at BEFORE UPDATE ON creator_meetups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentorship_profiles_updated_at BEFORE UPDATE ON mentorship_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_topics_updated_at BEFORE UPDATE ON forum_topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_replies_updated_at BEFORE UPDATE ON forum_replies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();