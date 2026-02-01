-- Initial database setup
-- This runs automatically when the PostgreSQL container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE energy_db TO postgres;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully';
END
$$;
