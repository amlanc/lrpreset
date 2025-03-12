-- Delete all data from tables while preserving structure
-- This script safely removes all data without dropping tables

-- Disable triggers temporarily to avoid foreign key constraint issues
SET session_replication_role = 'replica';

-- Clear data from all tables in the correct order to respect dependencies
TRUNCATE TABLE credit_transactions CASCADE;
TRUNCATE TABLE presets CASCADE;
TRUNCATE TABLE user_credits CASCADE;
TRUNCATE TABLE admin_users CASCADE;
TRUNCATE TABLE test_accounts CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Re-insert default admin user
INSERT INTO admin_users (email, created_by)
VALUES ('amlanc@gmail.com', 'system_initialization')
ON CONFLICT (email) DO NOTHING;

-- Re-insert default test account
INSERT INTO test_accounts (email, created_by)
VALUES ('amlanc@gmail.com', 'system_initialization')
ON CONFLICT (email) DO NOTHING;
