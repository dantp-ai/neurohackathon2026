# BetterNǎo

Links:

- Business video link: [https://youtu.be/-UXYmAW1FtU](https://youtu.be/-UXYmAW1FtU)

- Technical video link: [https://www.youtube.com/watch?v=-UN_MN14Gjw](https://www.youtube.com/watch?v=-UN_MN14Gjw)


EEG wellbeing monitoring for care teams. Built at the Neurohackathon 2026 (Hong Kong, HealthTech track).

BetterNǎo turns continuous EEG into something a family or care team can actually
read. A clinical-grade EEG **foundation model** embeds each window of brain
activity; the app shows that as a calm wellness signal for the patient and a
detailed, labelable monitoring view for the clinician — in English and 简体中文.

> What is real vs. simulated in this demo is documented in [`HONESTY.md`](./HONESTY.md).

## What it does

**Patient app** — a calm, large-type home screen:
- A living **wellness orb** reflecting current brain state (no scary numbers).
- **Check-in**: tap and speak ("I feel a little dizzy") — a small LLM turns it into a clinical label for the care team.
- **Medicine** logging and a realtime **chat** with the care team.

**Caregiver app** — a clinical monitoring view per patient:
- **Metrics** — live EEG + heart-rate waveforms and vitals.
- **Map** — the patient's EEG embeddings over time as an interactive map (pan / zoom), colored by time, with outlier / anomaly detection.
- **Labels** — review the label history and add labels by voice or tap, pinned to a point on the map.
- **Alerts** and realtime **chat** with the patient.

**Streaming demo (`/demo`)** — watch a brain drift from **healthy → dementia**.
Each point is a 30-second window of **real clinical EEG**, embedded live by the
foundation model.

## Run it

**You need**
- **Node ≥ 20** (`.nvmrc`) + npm
- **Docker Desktop** + **Supabase CLI** (`brew install supabase/tap/supabase`) — local backend
- **uv** (`brew install uv`) — Python pipeline + seed scripts
- An **OpenRouter API key** for voice → label (already in `.env.example` for the team)
- *(optional)* **neuroencoder model weights** (gated Hugging Face repo) — only to (re)generate embeddings; not needed to run against the seeded DB

**Setup (once)**
```bash
nvm use && npm ci                 # app dependencies
npx setup-skia-web public         # CanvasKit WASM for web -> public/canvaskit.wasm
cp .env.example .env.local        # fill SUPABASE keys from `supabase status`
```

**Run**
```bash
npm run setup     # fresh clone: supabase + seed all demo data + app + live stream
npm run dev       # later runs: supabase + app + live stream
```

Press **`w`** for the web app, then open `/demo`. For a phone, build a **dev
client** (`npx expo run:ios` / `run:android`) — Skia and `expo-audio` aren't in
Expo Go — and keep the phone on the same Wi-Fi (the Supabase host auto-resolves,
no manual IP).

**Demo logins** (one tap on the login screen):
**Margaret Chen** (patient) · **Dr. Mei Nguyen** (caregiver).

Browse the database at Supabase Studio: <http://127.0.0.1:54323>

## How it's built

- **App** — React Native + Expo (Expo Router), Skia (waveforms + maps), Reanimated + Gesture Handler, i18next (EN / 简体中文).
- **Backend** — Supabase (Postgres + Auth + Realtime) for chat, labels, and segments.
- **Pipeline** (`pipeline/`, `backend/`) — EEG foundation model + UMAP projection + anomaly detection, with a neurodsp live stream.
- **Seeds** (`scripts/`) — `seed_trajectory.py` (the `/demo` trajectory from real data), `seed_eeg.py` (demo patients + segments through the model), `compute_umap.py`. All idempotent; `npm run setup` runs them in order.

Older planning notes live in [`docs/`](./docs).
