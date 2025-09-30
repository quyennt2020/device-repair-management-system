-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a function to generate random UUIDs (alternative to uuid-ossp)
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
BEGIN
  RETURN uuid_generate_v4();
EXCEPTION
  WHEN undefined_function THEN
    RETURN (SELECT ('{' || substr(md5(random()::text), 1, 8) || '-' || 
                    substr(md5(random()::text), 1, 4) || '-4' || 
                    substr(md5(random()::text), 1, 3) || '-' || 
                    (array['8','9','a','b'])[floor(random()*4)::int + 1] || 
                    substr(md5(random()::text), 1, 3) || '-' || 
                    substr(md5(random()::text), 1, 12) || '}')::uuid);
END;
$$ LANGUAGE plpgsql;