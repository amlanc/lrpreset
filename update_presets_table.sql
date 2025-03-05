-- SQL script to update presets table structure
-- First, create a backup of the existing data (optional but recommended)
CREATE TABLE IF NOT EXISTS presets_backup AS SELECT * FROM presets;

-- Drop the existing table and recreate with simplified structure
DROP TABLE IF EXISTS presets;

CREATE TABLE presets (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    xmp_url TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    purchased BOOLEAN DEFAULT FALSE NOT NULL,
    original_filename TEXT
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets (user_id);
CREATE INDEX IF NOT EXISTS presets_created_at_idx ON presets (created_at);

-- Add comment explaining the table
COMMENT ON TABLE presets IS 'Stores preset information including name, image URL, and metadata';
