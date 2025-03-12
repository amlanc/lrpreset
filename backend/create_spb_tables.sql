-- Create all tables for LR Preset project
-- This script creates all necessary tables with proper relationships

-- Create users table (if not already created by Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_credits table for tracking credit balances
CREATE TABLE IF NOT EXISTS user_credits (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create admin_users table for tracking admin privileges
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- Create test_accounts table for tracking test accounts
CREATE TABLE IF NOT EXISTS test_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- Create credit_transactions table for tracking credit history
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    description TEXT,
    transaction_type TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create presets table for storing preset information
CREATE TABLE IF NOT EXISTS presets (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    filename TEXT NOT NULL,
    preview_url TEXT,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preset_type TEXT DEFAULT 'lightroom',
    tags TEXT[]
);

-- Insert default admin user
INSERT INTO admin_users (email, created_by)
VALUES ('amlanc@gmail.com', 'system_initialization')
ON CONFLICT (email) DO NOTHING;

-- Insert default test account
INSERT INTO test_accounts (email, created_by)
VALUES ('amlanc@gmail.com', 'system_initialization')
ON CONFLICT (email) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_presets_user_id ON presets(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_test_accounts_email ON test_accounts(email);
