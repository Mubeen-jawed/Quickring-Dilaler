-- Run this once on your PostgreSQL server
-- sudo -u postgres psql

-- CREATE USER dialer WITH PASSWORD 'dialer_secret';
-- CREATE DATABASE dialer OWNER dialer;
-- \c dialer

CREATE TABLE IF NOT EXISTS kc_agents (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone_number  VARCHAR(20),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add phone_number column if upgrading from older schema
ALTER TABLE kc_agents ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add TOTP secret column for authenticator app
ALTER TABLE kc_agents ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);

CREATE TABLE IF NOT EXISTS kc_call_logs (
  id           SERIAL PRIMARY KEY,
  agent_id     INTEGER REFERENCES kc_agents(id),
  call_sid     VARCHAR(64),
  phone_number VARCHAR(20) NOT NULL,
  direction    VARCHAR(10) DEFAULT 'outbound',
  status       VARCHAR(20) DEFAULT 'initiated',
  duration     INTEGER DEFAULT 0,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ
);

-- Add recording columns if upgrading from older schema
ALTER TABLE kc_call_logs ADD COLUMN IF NOT EXISTS recording_sid VARCHAR(64);
ALTER TABLE kc_call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT;

CREATE INDEX IF NOT EXISTS idx_kc_call_logs_agent ON kc_call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_kc_call_logs_started ON kc_call_logs(started_at DESC);
