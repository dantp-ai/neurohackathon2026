# NeuroMonitor — EEG Elderly Monitoring App

Repo for the (N)eurohackathon 2026, Hong Kong — HealthTech track.

A mobile-first app (React Native + Expo) that lets care teams continuously
monitor the cognitive and physical wellbeing of elderly users via EEG and
wearable data. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the full
product spec and data model.

## Status

Frontend scaffold + all basic screens are in, running against **mock data**
(no backend yet). One app, two roles: **patient** and **caregiver**.

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
npm start
```

Then press `i` (iOS simulator), `a` (Android), or `w` (web) — or scan the QR
code with the **Expo Go** app on your phone.

> Use `npm ci` (not `npm install`) so everyone gets the exact dependency
> versions from `package-lock.json`. Node is pinned via `.nvmrc` and the
> `engines` field in `package.json`.

### Supabase Studio

Browse tables and data at **http://127.0.0.1:54323** while `supabase start` is
running.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
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
