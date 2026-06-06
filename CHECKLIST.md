# NeuroMonitor — Build Checklist

Two app experiences from one codebase:
- **Demo version** — streaming embedding showcase (points stream in over accelerating time, healthy→unhealthy color), for presenting.
- **Full version** — the current app with all tabs (patient + caregiver), live functionality.

## Foundation (the 3 points)
- [ ] **1. Tie everything together cleanly** — one embedding source of truth (real `EEGEmbedder` everywhere), consistent UMAP story, scripts import shared code.
- [ ] **2. Clean up redundancies** — unify seed embeddings (drop band-power placeholder), reuse `pipeline/band_power`, reconcile `seed_trajectory.py` ↔ `decline_demo.py`, gitignore hygiene.
- [ ] **3. Check everything works end-to-end** — supabase up ✅; daemon live insert (real embed + umap); label loop (`write_label`→`continual_runner`); backend tests; app reads seeded data.

## Feature requests
- [ ] **F1. Realtime messages** — messages uploaded to server and served to the other party (patient ↔ caregiver) **instantly** (Supabase Realtime).
- [ ] **F2. Patient voice messages** — record voice (check-in or chat); if in response to an anomaly event, **auto-transcribe → create a label** visible in the caregiver Labels tab.
- [ ] **F3. Ingestion pipeline** — raw data → **real embedder** → **precompute + save UMAP coords** for visualization.
- [ ] **F4. Two app versions + embedding interface** — full app (all tabs) + demo; embedding point interface is **snappy & blobby** (spring/bounce-in enter animations), with a **graph** drawn around points; points **streamed in** (demo: slow→fast as "time speeds up"); colors **healthy→unhealthy** (ds004504 trajectory). Use current best React libs.
- [ ] **F5. i18n** — English + **Simplified Mandarin (zh-Hans)**, live toggle.
- [ ] **F6. Streaming controls** — start/stop for EEG data streaming; same for Heart Rate / other vitals (start/stop with streaming).
- [ ] **F7. Clinical UI polish** — looks good & clinical; screenshot → review → iterate; use best existing packages, don't reinvent.
- [ ] **F8. neurodsp fake data** — option to stream simulated EEG via `neurodsp`, part of the streaming controls.
- [ ] **F9. Demo users & choreography** — example users showcase patient ↔ caregiver interaction for the demo.
- [ ] **F10. Final review** — read everything back, verify nothing important missed.

## Status log
- Supabase verified working (local stack, migrations, seed_eeg/compute_umap/seed_trajectory). 568 segments, 5 users.
- Research workflow (RN viz, i18n, realtime, voice STT, neurodsp, clinical UI) launched.
