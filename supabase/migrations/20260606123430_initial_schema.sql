-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- Users (mirrors Supabase Auth, one row per auth.users entry)
-- ------------------------------------------------------------
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('patient', 'caregiver')),
  display_name TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Care relationships
-- ------------------------------------------------------------
CREATE TABLE care_relationships (
  caregiver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship   TEXT NOT NULL CHECK (relationship IN ('family', 'clinician', 'other')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (caregiver_id, patient_id)
);

-- ------------------------------------------------------------
-- EEG segments (written by backend, read by frontend)
-- ------------------------------------------------------------
CREATE TABLE eeg_segments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id        TEXT NOT NULL,
  timestamp_start  TIMESTAMPTZ NOT NULL,
  duration_s       INTEGER NOT NULL DEFAULT 30,
  fatigue          FLOAT NOT NULL CHECK (fatigue BETWEEN 0 AND 1),
  attention        FLOAT NOT NULL CHECK (attention BETWEEN 0 AND 1),
  mood             FLOAT NOT NULL CHECK (mood BETWEEN 0 AND 1),
  anomaly_score    FLOAT NOT NULL CHECK (anomaly_score BETWEEN 0 AND 1),
  embedding        VECTOR(384)
);

CREATE INDEX idx_eeg_segments_patient_time
  ON eeg_segments (patient_id, timestamp_start DESC);

-- ------------------------------------------------------------
-- Events (anomaly alerts, written by backend)
-- ------------------------------------------------------------
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_id   UUID REFERENCES eeg_segments(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type         TEXT NOT NULL CHECK (type IN ('anomaly', 'manual', 'scheduled')),
  severity     TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX idx_events_patient_time
  ON events (patient_id, triggered_at DESC);

-- ------------------------------------------------------------
-- Labels (written by backend LLM, confirmed by caregiver)
-- ------------------------------------------------------------
CREATE TABLE labels (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_id              UUID REFERENCES eeg_segments(id) ON DELETE SET NULL,
  event_id                UUID REFERENCES events(id) ON DELETE SET NULL,
  activity                TEXT,
  medications             TEXT[],
  subjective_state        TEXT,
  event_type              TEXT,
  resolution              TEXT,
  extraction_method       TEXT NOT NULL CHECK (extraction_method IN ('llm_auto', 'caregiver_manual')),
  confidence              FLOAT CHECK (confidence BETWEEN 0 AND 1),
  confirmed_by_caregiver  BOOLEAN NOT NULL DEFAULT false,
  confirmed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Check-in responses (written by frontend patient)
-- ------------------------------------------------------------
CREATE TABLE checkin_responses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  response       TEXT NOT NULL CHECK (response IN ('ok', 'not_great', 'help')),
  voice_note_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Activity logs (written by frontend patient)
-- ------------------------------------------------------------
CREATE TABLE activity_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity   TEXT NOT NULL CHECK (activity IN ('sleeping', 'eating', 'walking', 'resting', 'social', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Medication logs (written by frontend patient)
-- ------------------------------------------------------------
CREATE TABLE medication_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  taken_at        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Messages (written by both patient and caregiver)
-- ------------------------------------------------------------
CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        TEXT,
  voice_note_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (content IS NOT NULL OR voice_note_url IS NOT NULL)
);

CREATE INDEX idx_messages_thread
  ON messages (patient_id, caregiver_id, created_at DESC);

-- ------------------------------------------------------------
-- Push tokens (written by frontend on app launch)
-- ------------------------------------------------------------
CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
