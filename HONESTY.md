# HONESTY.md

> Mandatory disclosure for the hackathon. This file lives at the root of your repository. Judges cross-check it against your code and your technical video.
>
> **The deal:** disclosed shortcuts are **not** penalized — that is the entire point of this file. Hidden ones are. Undisclosed pre-built code is heavily penalized, each undisclosed mock carries a small penalty, and a faked demo is heavily penalized. Telling the truth here costs you nothing.

---

## 1. Team — who did what
Judges compare this against `git shortlog -sn`, so keep it honest. Exact split is in `git log`.

| Member | GitHub handle | Main contributions |
|---|---|---|
| Maximilian Kalcher | `avocardio` | EEG foundation model (pre-existing, see §5), app frontend, embedding maps & visualizations |
| Daniel Plop | `dantp-ai` | Backend pipeline, Supabase, infra, seeding scripts |
| Joelle Faybishenko | `jjjoelle` | Frontend, UX |
| Aidan Truel | `atruel` | Pipeline & data |

---

## 2. What is fully working
Features that run end-to-end on the live app, with real data and real logic.

- **Cognitive-decline streaming demo (`/demo`)** — input: real clinical EEG recordings (OpenNeuro `ds004504`, Alzheimer's + control subjects). Each 30-second window is embedded **live by our EEG foundation model**; UMAP projects it to 2-D. Output: an animated map of a brain drifting healthy → dementia. The dementia data and the embeddings are real. The model reaches ~71% AD-vs-control on this dataset.
- **Voice → clinical label** — input: a recorded voice note (clinician on the Labels tab, or patient on Check-in). A small LLM (OpenRouter, `google/gemini-2.5-flash-lite`) transcribes it and categorizes it into a clinical label. Output: a real label row written to Supabase, attached to a point on the map. Real API calls, EN + 中文.
- **Realtime chat** — patient ↔ care team over Supabase Realtime (Postgres changes). Messages persist and stream live both ways.
- **Bilingual UI** — full English / 简体中文 with a live toggle (i18next).
- **Interactive embedding map** — pan/zoom, time-colormap, point selection, outlier/anomaly scoring, label-history review.

---

## 3. What is mocked, stubbed, or hardcoded
**Undisclosed mocks carry a small penalty each. Anything you list here = free.**

| What is faked | Where (file:line or folder) | Why we mocked it | What the real version would do |
|---|---|---|---|
| Per-patient embedding maps (caregiver **Map** tab) | `src/lib/blob.ts` | No live EEG headset per demo patient; we generate a stable random Gaussian cluster + stream new points (some outliers) | Stream real embeddings from that patient's live EEG — exactly as the `/demo` tab already does with recorded data |
| ECG / heart-rate waveform | `src/components/LiveWaveformView.tsx` | No wearable connected | Read PQRST / heart rate from a real pulse/ECG sensor |
| Patient metrics: attention / relaxation / energy | `src/mock/data.ts` | Display-only wellness tiles | Derive from EEG band-power features computed in the pipeline |
| EEG "live" stream | `pipeline/stream.py` (neurodsp) | Faux-streamed from a recorded dataset, not an online headset | Same data type, streamed online from a real EEG device |
| Login / accounts | `src/mock/accounts.ts` | Demo tap-to-login, no real password check; RLS off | Real Supabase Auth + row-level security |

The clinical dementia **data itself is real** — only the per-patient live nature, the ECG, and the wellness tiles are simulated.

---

## 4. External APIs, services & data sources

| Service / API / dataset | Used for | Real call or mocked? | Auth |
|---|---|---|---|
| OpenRouter (`google/gemini-2.5-flash-lite`) | Voice transcription + label categorization | **Real** | API key |
| Supabase (local, Docker) | Postgres + Auth + Realtime (chat, labels, segments) | **Real** (local) | Local keys |
| Hugging Face | EEG foundation-model weights (gated, open-weight) | **Real** download | HF token |
| OpenNeuro `ds004504` | Real clinical EEG (Alzheimer's + control) for the `/demo` trajectory | **Real** data | None |

---

## 5. Pre-existing code
**Undisclosed pre-built code is heavily penalized. Anything you list here = free.**

| Item | Source | Roughly how much | License |
|---|---|---|---|
| **EEG neurological foundation model** (the "backbone") | Trained **before** the hackathon by Maximilian Kalcher for his ETH Zurich MSc thesis — a large foundation model for clinical EEG data, **open-weight and available on Hugging Face**. We call it for inference only (frozen). | Model weights + inference wrapper | Open weights |
| Expo / `create-expo-app` starter | Standard Expo Router boilerplate | Small scaffold | MIT |

**Everything else in this repo was built during the hackathon.** The only pre-built piece is the frozen foundation model above — all app code, the backend pipeline, the Supabase schema, the visualizations, voice→label, chat, and the demo were written today.

---

## 6. Known limitations & next steps

- Wire the per-patient **Map** to live headset embeddings (replace the simulated blob in `src/lib/blob.ts` — the `/demo` tab already proves the real path).
- Integrate a real wearable for **ECG / vitals** instead of synthesized waveforms.
- Compute **attention / relaxation / energy** from real EEG band-power instead of fixtures.
- Real **auth + row-level security** (currently demo accounts, RLS off for the hackathon).
- On-device / real-time inference for the foundation model rather than batch embedding.
