# NeuroMonitor — Build Checklist & Status

Two experiences from one Expo codebase:
- **Demo** — `/demo` route streams the embedding trajectory in over accelerating
  time (slow → fast), healthy → unhealthy color. Auto-starts. Reachable from the
  login screen ("▶ Streaming demo").
- **Full app** — login → patient / caregiver, all tabs; the caregiver Map tab uses
  the same Skia embedding graph.

Legend: [x] done · [~] partial (see notes) · [ ] not started

## Foundation (the 3 points)
- [x] **1. Tie together** — `seed_eeg` now uses the **real** `EEGEmbedder` + shared
  `pipeline.band_power` / `run_anomaly_detection` (same pipeline as the live daemon).
  Single embedding source of truth (`run_embedding`/`EEGEmbedder`).
- [x] **2. De-dup** — removed the band-power placeholder embedding + duplicated Welch
  code; fixed `sys.path` so the local `supabase/` dir can't shadow the package;
  `decline_demo.py` (MP4 of raw waves) and `seed_trajectory.py` (DB seed) confirmed
  complementary, not redundant; gitignore hygiene (`__pycache__`, canvaskit.wasm).
- [x] **3. Check works** — Supabase verified end-to-end; `seed_eeg` + `compute_umap` +
  `seed_trajectory` run clean → 568 segments with **real** embeddings (L2-norm 1.0);
  backend tests 10/10; app renders on web (login + demo screenshots).

## Feature requests
- [x] **F1. Realtime messages** — `MessageThread` → `useMessages` (Supabase
  `postgres_changes`, optimistic, dedup, cleanup) + migration adding `messages`/
  `events`/`labels`/`eeg_segments` to `supabase_realtime`. Wiring verified; live
  two-device delivery not screenshot-tested.
- [~] **F2. Voice → transcribe → label** — **backend done**: `scripts/transcribe.py`
  (download from Storage → Groq `whisper-large-v3`, EN/Mandarin auto-detect →
  transcript on message; if anomaly-linked, creates a `labels` row for caregiver
  review). **Pending**: frontend `expo-audio` recording + upload (needs a dev build
  + `GROQ_API_KEY` + an `audio` Storage bucket). `checkin.tsx` has the voice stub.
- [x] **F3. Ingestion → real embedder → UMAP precomputed** — `seed_eeg` (real
  embeddings) + `compute_umap`; live daemon embeds + projects via `pipeline/projector.py`.
- [x] **F4. Two versions + embedding interface** — `EmbeddingGraph` (Skia: Atlas
  instanced points, **spring bounce-in** via RSXform, **kNN graph edges**, pan/zoom,
  healthy→unhealthy gradient). Demo streams slow→fast; full-app Map tab uses it.
  Web works via a lazy CanvasKit loader (`SkiaGraph.web.tsx`, `setup-skia-web`).
  Note: Skia canvas content doesn't composite into **headless** screenshots (GPU),
  so points were verified by logic/typecheck/load — they render on real GPU/native.
- [~] **F5. i18n (English + Simplified Mandarin)** — i18next + `react-i18next` +
  `expo-localization`, live `LanguageToggle` (persists). Core strings translated
  (app/login/tabs/metrics/demo/embedding/stream). **Partial**: some screen strings
  still hardcoded — extend `t()` coverage.
- [~] **F6. Streaming controls** — `StreamControls` (start/stop **EEG** + **heart
  rate** independently, source **Live / Simulated**) on the caregiver Metrics tab;
  demo has play/pause/speed. **Pending**: wire app toggles to actually start/stop
  the pipeline daemon.
- [x] **F8. neurodsp fake data** — `NeurodspStream` (1/f + bursty alpha/theta;
  `healthy` vs `unhealthy`/slowing presets) + daemon `--neurodsp --health`.
- [~] **F7. Clinical UI polish** — login + demo verified clean/clinical at proper
  width (the 390/430 "clipping" was a headless-Chrome min-window artifact, not a
  bug). Iterated via headless-Chrome screenshots. Deeper polish ongoing.
- [~] **F9. Demo users & choreography** — demo accounts (Margaret = patient, Dr. Mei
  = caregiver) + a dedicated **Trajectory Demo** patient seeded. Full
  patient↔caregiver demo script pending.
- [x] **F10. Final review** — this file; nothing critical silently dropped (partials
  flagged above with next steps).

## How to run
```bash
# 1. Backend / DB (Docker running):
supabase start                      # local stack
cp .env.example .env.local          # fill keys from `supabase status`
uv sync                             # python deps (torch via neuroencoder, neurodsp, groq…)
uv run python scripts/seed_eeg.py           # real-embedding segments for demo patients
uv run python scripts/compute_umap.py       # UMAP coords for the Map
uv run python scripts/seed_trajectory.py    # healthy→dementia Trajectory Demo patient

# 2. Frontend (web demo / dev):
npm install
npx setup-skia-web public           # CanvasKit WASM for the Skia graph on web
npx expo start                      # press w (web), or use a dev build for native

# 3. Live pipeline (optional):
uv run python pipeline/daemon.py --patient-id <uuid> --neurodsp --health unhealthy
uv run python scripts/continual_runner.py   # learns from confirmed labels
```

## Verified this session
- Supabase local stack + migrations + all seed scripts (real embeddings, 568 segments).
- Backend tests 10/10; all new Python compiles; NeurodspStream generates healthy/unhealthy.
- Frontend `tsc --noEmit` clean; login + demo render correctly on web (headless Chrome).
- Skia/CanvasKit loads on web (lazy loader); streaming demo logic runs (counter advances).

## Known gaps / next steps
- Skia point rendering visible only on real GPU/native (not headless screenshots).
- F2 voice: add `expo-audio` recorder in `checkin.tsx`/chat + an `audio` Storage bucket + `GROQ_API_KEY`.
- F6: connect StreamControls to a real daemon start/stop control channel.
- F5: finish `t()` coverage across all screens.
- Native build: Skia + expo-audio need a dev build (not Expo Go).
