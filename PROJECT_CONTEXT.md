# Project Context: EEG Elderly Monitoring App
### EuroTech / Hong Kong Hackathon — HealthTech Track
### 23-hour build starting 2026-06-06

---

## What We're Building

A mobile-first app (React Native + Expo) that allows care teams to continuously monitor the
cognitive and physical wellbeing of elderly users via EEG and wearable data. When the system
detects something unusual, it checks in with the patient and alerts the caregiver. Every
interaction creates structured labels on the underlying neural data, building a longitudinal
dataset for future diagnostics.

**The core loop:**
> Continuous EEG monitoring → anomaly detected → patient check-in → caregiver alert if needed
> → conversation → auto-extracted label → human-confirmed ground truth

---

## Team Structure

| Area | Responsibility |
|---|---|
| **Backend / Data** | EEG ingestion, embedding model, anomaly detection, label extraction (Claude API), database schema |
| **Frontend** | React Native / Expo app, role-based UI, push notifications, real-time updates |

---

## App Architecture

**One app, two roles.** Patients and caregivers log into the same React Native / Expo app.
After authentication, the app renders a completely different experience based on the user's role.
The app works on both mobile and web (Expo Router with universal links).

### Authentication & Roles
- Auth via Supabase Auth (email/password or magic link)
- Each user has a `role` field: `patient` or `caregiver`
- Caregivers are linked to one or more patients via a `care_relationships` table
- On login, the app reads the user's role and routes to the appropriate view

---

## Patient View

Designed for elderly users: **large text, minimal interactions, clear colors.**

### Screens

**1. Home / Status Screen**
- Displays a simple wellness indicator (colored ring or card): green / yellow / red
- Shows three metric tiles: **Fatigue · Attention · Mood** (0–100 scale, pulled from latest
  EEG segment)
- "How am I doing?" framing — not clinical language

**2. Check-In Screen** (triggered by push notification on anomaly)
- Full-screen modal: "We noticed something. How are you feeling?"
- Three large buttons: ✅ "I'm okay" · 😐 "Not great" · 🆘 "I need help"
- Optional: record a short voice note (10–30 seconds)
- Submitting dismisses the alert and logs the response as an event

**3. Activity Log**
- Tap to log current activity: Sleeping · Eating · Walking · Resting · Socializing · Other
- Shown as a simple list of recent logs with timestamps

**4. Medication Log**
- Quick-add: type or select a medication name + time taken
- List of recent medication entries

**5. Messages**
- Threaded conversation with each caregiver on their care team
- Text messages + ability to send a voice note
- Simple, WhatsApp-style UI

---

## Caregiver View

Designed for family members or healthcare professionals monitoring multiple patients.

### Screens

**1. Patient List (Home)**
- Cards for each patient showing: name, photo, current status color, last updated time
- Badge on card if there is an unacknowledged alert
- Tap a card to open the patient detail view

**2. Patient Detail View**
- **Metrics tab**: 24-hour timeline of fatigue, attention, and mood; event markers on the
  timeline (anomaly spikes, check-in responses)
- **Alerts tab**: chronological list of anomaly events; each shows:
  - Time and severity
  - Patient's check-in response (or "No response")
  - One-line auto-extracted summary (e.g., "Patient reported dizziness, mentioned blood
    pressure medication")
  - Status: Resolved / Needs Follow-Up
- **Messages tab**: conversation thread with the patient (same as patient's Messages screen,
  mirrored)
- **Labels tab**: auto-extracted labels from conversations, shown as structured cards with a
  Confirm / Edit button per label

**3. Label Review Panel** (accessible from Alerts or Labels tab)
- Shows extracted label fields: Activity · Medications · Subjective State · Event Type · Resolution
- Caregiver can edit any field and press Confirm
- Confirmed labels are marked as ground truth in the database

---

## Notifications

When the backend detects an anomaly:
1. Backend writes a new row to the `events` table (see Data Model below)
2. Frontend subscribes to `events` via Supabase Realtime
3. On new event: frontend sends a push notification to the patient's device via
   Expo Push Notification Service (using the token stored in `push_tokens`)
4. If patient does not respond within 5 minutes: frontend sends a push notification
   to all caregivers linked to that patient

**Push token registration**: On app launch, each device registers its Expo push token,
stored in the `push_tokens` table linked to the user.

---

## Data Model

The backend team owns the schema. The frontend reads and writes the following tables:

### Tables the frontend READS (backend writes these)

```
eeg_segments
  id, patient_id, device_id
  timestamp_start          -- UTC ISO string
  duration_s               -- typically 30
  fatigue FLOAT            -- 0.0 to 1.0
  attention FLOAT          -- 0.0 to 1.0
  mood FLOAT               -- 0.0 to 1.0
  anomaly_score FLOAT      -- 0.0 to 1.0; threshold TBD with backend team
  embedding VECTOR(n)      -- pgvector; frontend does not use directly

events
  id, patient_id, segment_id
  triggered_at             -- UTC ISO string
  type                     -- 'anomaly' | 'manual' | 'scheduled'
  severity                 -- 'low' | 'medium' | 'high'
  resolved                 -- boolean
  resolved_at              -- nullable

labels (tentative, before caregiver confirmation)
  id, patient_id, segment_id, event_id
  activity                 -- string
  medications              -- string[]
  subjective_state         -- string
  event_type               -- string
  resolution               -- string
  extraction_method        -- 'llm_auto' | 'caregiver_manual'
  confidence               -- 0.0 to 1.0
  confirmed_by_caregiver   -- boolean (false until frontend confirms)
  confirmed_at             -- nullable
```

### Tables the frontend WRITES (backend reads these for labeling)

```
checkin_responses
  id, patient_id, event_id
  response                 -- 'ok' | 'not_great' | 'help'
  voice_note_url           -- nullable; URL to file in Supabase Storage
  created_at

activity_logs
  id, patient_id
  activity                 -- 'sleeping' | 'eating' | 'walking' | 'resting' | 'social' | 'other'
  created_at

medication_logs
  id, patient_id
  medication_name          -- free text
  taken_at                 -- UTC ISO string

messages
  id, patient_id, caregiver_id, sender_id
  content                  -- text; nullable if voice_note_url set
  voice_note_url           -- nullable
  created_at

push_tokens
  id, user_id
  token                    -- Expo push token string
  platform                 -- 'ios' | 'android' | 'web'
  updated_at
```

### Tables shared (both teams read/write)

```
users
  id (Supabase Auth UID)
  role                     -- 'patient' | 'caregiver'
  display_name, avatar_url

care_relationships
  caregiver_id, patient_id
  relationship             -- 'family' | 'clinician' | 'other'
  created_at
```

---

## Label Extraction Flow (backend responsibility)

When a `checkin_responses` row is written and/or new `messages` are added after an event:

1. Backend collects the conversation thread: patient check-in response + voice transcript
   (if any) + subsequent messages
2. Calls Claude API with a structured extraction prompt:
   ```
   Given this conversation after a health alert, extract:
   - activity: what the patient was doing at the time
   - medications: any medications mentioned
   - subjective_state: how the patient described feeling
   - event_type: what kind of event occurred
   - resolution: how it was resolved
   Return JSON only.
   ```
3. Writes result to `labels` table with `confirmed_by_caregiver = false`
4. Frontend displays the tentative label for caregiver review

---

## Tech Stack

| Layer | Choice |
|---|---|
| App framework | React Native + Expo (SDK 52+) |
| Navigation | Expo Router (file-based, universal) |
| Backend / DB | Supabase (Postgres + pgvector + Auth + Realtime + Storage) |
| Push notifications | Expo Push Notification Service |
| Styling | NativeWind (Tailwind for React Native) or StyleSheet |
| State management | Zustand or React Query + Supabase client |
| Voice recording | Expo AV |
| Voice transcription | Whisper API (backend handles) or Expo Speech (on-device) |
| Label extraction | Claude API — claude-sonnet-4-6 (backend handles) |
| EEG simulation (demo) | Python script (backend runs) |

---

## Open Questions / Team Alignment Needed

- [ ] **Anomaly threshold**: what `anomaly_score` value triggers an event? Backend to define.
- [ ] **Check-in timeout**: 5 minutes before caregiver alert — confirm with team.
- [ ] **Voice transcription**: who handles it? Backend (Whisper API) or on-device (Expo Speech)?
- [ ] **Supabase project**: backend team to create and share the URL + anon key.
- [ ] **Realtime subscriptions**: confirm Supabase Realtime is enabled on `events` table.
- [ ] **RLS policies**: backend to set Row Level Security so patients only see their own data
  and caregivers only see linked patients.
- [ ] **Demo data**: backend to seed realistic simulated EEG data for the demo.
