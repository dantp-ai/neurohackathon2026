# NeuroMonitor — EEG Elderly Monitoring App

Repo for the (N)eurohackathon 2026, Hong Kong — HealthTech track.

A mobile-first app (React Native + Expo) that lets care teams continuously
monitor the cognitive and physical wellbeing of elderly users via EEG and
wearable data. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the full
product spec and data model.

## Run the full demo

Everything needed to clone this repo and run the whole thing end-to-end.

**You need**

- **Node ≥ 20** (`.nvmrc`) + npm — the Expo app.
- **Docker Desktop** + **Supabase CLI** (`brew install supabase/tap/supabase`) — the local backend (Postgres + auth + realtime).
- **uv** (`brew install uv`) — runs the Python pipeline + seed scripts.
- **neuroencoder model weights** (gated Hugging Face repo) — only to (re)generate EEG embeddings (seeding + the live stream). Not needed to run against an already-seeded DB.
- An **OpenRouter API key** — powers voice → label (clinician labeling + patient check-in); set `EXPO_PUBLIC_OPENROUTER_API_KEY` in `.env.local`.

**One-time setup**

```bash
nvm use && npm ci                 # app dependencies
npx setup-skia-web public         # CanvasKit WASM for the web build -> public/canvaskit.wasm
cp .env.example .env.local        # fill SUPABASE keys from `supabase status`; add EXPO_PUBLIC_OPENROUTER_API_KEY
```

**Run**

```bash
npm run setup     # first run: supabase start + seed all demo data + launch app + neurodsp stream
npm run dev       # later runs: supabase start + launch app + neurodsp stream
```

Then press **`w`** for the web app (open `/demo`), or scan for a **dev build** on a phone.

- **Phone:** needs a **dev build** (`npx expo run:ios` / `run:android`) — Skia + `expo-audio` aren't in Expo Go. Keep the phone and the Mac on the **same Wi-Fi** (the app auto-resolves the Supabase host, so no manual IP).
- **Demo logins** (one tap on the login screen): **Margaret Chen** (patient) · **Dr. Mei Nguyen** (caregiver).
- **Live neurodsp stream** on its own: `npm run stream`.

**Demo data / seed scripts**

- `scripts/seed_trajectory.py` — the `/demo` healthy→dementia trajectory (reads `data/*.npz`; **no model needed**).
- `scripts/seed_eeg.py` — demo patients (Margaret, Harold, Sofia) + EEG segments from the real `sub-001` recording via the foundation model. **Yes, this is used** — it runs inside `npm run setup`.
- `scripts/compute_umap.py` — 2-D UMAP coordinates for the seeded segments.

All seeds are idempotent. `npm run setup` runs them in order; the app then reads everything from Supabase live (chat, labels, and embedding maps update in realtime).

## Status

Full app + local backend: **Supabase** (Postgres + auth + realtime) wired to the
EEG **pipeline** (foundation-model embeddings, UMAP, anomaly detection) plus a
live **neurodsp** stream. One app, two roles — **patient** and **caregiver** —
in English and 简体中文.

## Prerequisites

- **Node** — version pinned in [`.nvmrc`](./.nvmrc). With `nvm`: `nvm use`.
- **Docker Desktop** — required to run Supabase locally. [Download here](https://www.docker.com/products/docker-desktop/).
- **Supabase CLI** — `brew install supabase/tap/supabase`
- **uv** (Python package manager) — `brew install uv`
- No global Expo CLI needed; it runs via `npx`.

## Setup

### 1. Frontend

```bash
nvm use            # match the pinned Node version
npm ci             # install exact, locked dependencies (reproducible)
```

### 2. Local database

Make sure Docker Desktop is running, then:

```bash
supabase start     # pulls containers and applies migrations automatically
```

This starts Postgres + Auth + Realtime + Storage locally. When it's ready it
prints your local URLs and keys. Copy them into your env file:

```bash
cp .env.example .env.local
# open .env.local and fill in the values printed by `supabase start`
```

### 3. Seed demo data

```bash
uv run python scripts/seed_eeg.py
uv run python scripts/compute_umap.py   # 2D projection for the embedding map
```

`seed_eeg.py` loads the real sub-001 recording from `data/`, chunks it into
30-second windows, computes per-channel band-power features (delta/theta/alpha/beta/gamma),
and writes one row per window for both demo patients. The features are zero-padded
to fit the 384-dim `embedding` column — when the real EEG embedder lands, swap
that one function. `compute_umap.py` then fits UMAP over those embeddings and
writes `umap_x`/`umap_y` back per row, which drives the caregiver **Map** tab.
The seed is idempotent — running it twice replaces the existing segments.

Demo credentials (password: `demo1234`):

| Role | Email |
|---|---|
| Patient | `margaret@demo.local` |
| Patient | `harold@demo.local` |
| Caregiver | `sarah@demo.local` |
| Caregiver | `james@demo.local` |

### 4. Start the app

```bash
npm run dev      # supabase start + Expo dev server + neurodsp live stream
```

Then press `i` (iOS simulator), `a` (Android), or `w` (web) — or scan the QR
code with the **Expo Go** app on your phone.

> First-time setup? Use `npm run setup` instead — it starts Supabase, runs the
> seed + UMAP scripts, and launches the dev server, all in one command. After
> that, `npm run dev` is enough for day-to-day work (Supabase comes up if it's
> not already running).

> Use `npm ci` (not `npm install`) so everyone gets the exact dependency
> versions from `package-lock.json`. Node is pinned via `.nvmrc` and the
> `engines` field in `package.json`.

### Supabase Studio

Browse tables and data at **http://127.0.0.1:54323** while `supabase start` is
running.

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | One-shot: `supabase start` + seed + UMAP + Expo dev server. Use on a fresh clone. |
| `npm run dev` | `supabase start` + Expo dev server + neurodsp live stream. Use day-to-day. |
| `npm start` | Just the Expo dev server (assumes Supabase is already running) |
| `npm run ios` / `android` / `web` | Start targeting a specific platform |
| `npm run typecheck` | `tsc --noEmit` — type-check the whole app |
| `npm run lint` | Expo lint |

## Project structure

```
src/
  app/                 # Expo Router routes (file-based)
    _layout.tsx        #   root: providers + stack
    index.tsx          #   dev role switcher (stands in for login)
    checkin.tsx        #   full-screen check-in modal
    patient/           #   patient tabs: Home · Activity · Medicine · Messages
    caregiver/         #   caregiver: patient list -> patient detail
  components/          # shared UI (Button, Card, MetricTile, StatusRing, ...)
  theme/               # design system: colors, spacing, typography
  store/session.tsx    # mock session/role (swap for Supabase Auth later)
  mock/data.ts         # fake-but-correctly-shaped fixtures
  types.ts             # data model types (mirror the Supabase schema)
  utils/               # small helpers (time formatting)
```

### Working as a team

- **Build screens** by composing from `@/components` and reading values from
  `@/theme` — don't hard-code colors or spacing, so the app stays consistent.
- **Data shapes** live in `@/types` and mirror the schema in
  `PROJECT_CONTEXT.md`. When the backend finalizes Supabase, reconcile field
  names there and swap `@/mock/data` reads for live queries — screens shouldn't
  need to change.
- Look for `TODO(backend):` markers where a mock write should become a real
  Supabase mutation.

## Previewing both roles

The first screen is a dev role switcher. Tap **Enter as Patient** or **Enter as
Caregiver** to preview either experience; **Switch** (top-right) returns you.
