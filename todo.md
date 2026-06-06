# Change now:
## Patient View
- [x] Get rid of the words in the circle -- "Take It Easy" is cut off
- [x] Is the "we noticed something"/check-in supposed to be the anomaly detection? Would it be there if there was no anomaly? Maybe it could always be there with a please tell us how you are feeling at the moment. And could it have a place for text? something along the lines of "Describe if anything is happening?" And get rid of the emojis
- [x] We still want to ping them when there is an anamoly but less frightening with we noticed something
- [x] "How am I doing" should be phrased a bit more clinical 
- [x] let's change the metrics 1-5 where 1 is worst (most fatigued, least attentive, least relaxed) and 5 is the best
- [x] Remove the whole activity tab
- [x] Medicine tab: add a dropdown of previous medications 
- [x] Does the messages work? 
## Caretaker view
- [x] what determines the condition of the patients? 
- [x] let's add the simple metrics to the patient overview screen (fatigue, etc)
- [x] Instead of a bar plot, could the metrics be a line graph because they will be updated in real time? 
- [x] we are changing it 1-5 here too
- [x] let's change the scale to the last hour (sliding window)
- [x] let's remove the frequency bands 
- [x] in Alerts - resolved should be toggled away 
- [x] Can you update the labels to match the readme and we see all the past added labels too? 
- [x] And add a place to add labels from the caretaker


### Anomaly/event labeler 
Idea is to pull UMAPs from the database where we can see in real time the patient's embedding for different classifier (in the caretaker's view). An example of this classifier is where the neural data falls on the AD/Healthy cluster. When there is an anomaly or some deviation from the current cluster, someone should be notified so that a label or description can be added. 

Things to consider:
- The output/label with embedding needs to be saved/sent to backend 
- A tab for real time viewing of the embedding space per label (backend provides data, we need to visualize) 
- There should be a drop down for different features/labels that can be viewed. These features will eventually be customizable once enough labels are generated for a feature

---

## Summary / decisions (discussion 2026-06-06)

**The "real-time projection" constraint (important):**
Projections must be FIT OFFLINE on a dataset, then FROZEN. New streaming points
are projected into that fixed space — never re-fit per update (re-fitting
reshuffles the whole map and looks broken on screen).
- UMAP: has `.transform()` to project new points into a frozen space → preferred.
- Plain t-SNE: NO out-of-sample transform → must re-fit every time → not usable
  for streaming. (Parametric t-SNE / openTSNE add a transform but cost complexity.)
- PCA: most stable + trivially projects new points, but separates clusters less
  cleanly → good fallback / sanity check.
- Regardless of method, the contract is the same: frozen projector + transform in.

**One projection per feature (decided):** each feature/label has its OWN
projection space (AD/Healthy UMAP ≠ fatigue UMAP). The dropdown swaps the entire
projection + reference cloud + clusters — not just recoloring points.

**Anomaly / "deviation from cluster" = backend:** backend computes the
out-of-distribution / distance-from-centroid signal and flags the point.
Frontend just receives the flag and highlights it.

**Data contract frontend needs from backend (per feature):**
- reference cloud: `[{ x, y, cluster }]`  (static background)
- clusters: `[{ id, name, centroid, color }]`  (legend)
- live point stream: `{ x, y, segment_id, timestamp, anomaly? }`  (same frozen space)
- frontend → backend on label: `{ segment_id, feature, label, description }`

**Frontend placement:** new "Embedding" tab in the caregiver Patient Detail
(Metrics / Alerts / Messages / Labels / Embedding). Feature dropdown + scatter
plot, tap a point → label sheet.

**Charting dependency:** react-native-svg (+ victory-native) for hundreds of
points; react-native-skia if thousands need to stream smoothly.

**Hackathon cut:** one precomputed feature (AD/Healthy), static cloud + a
*replayed* point path + tap-to-label. No live pipeline needed; real-time is a
later swap. Frame AD/Healthy as a *research* feature (see HONESTY.md).

---

## Signal pipeline & classifiers

Two PARALLEL tracks off the same raw stream, converging at the store the
frontend reads. (Raw stream ingestion: TBD — someone else owns it.)

**Track A — Continuous metrics (FFT / DSP, no learning):**
```
raw EEG → short windows (1–2s) → FFT/PSD → band powers (δ θ α β γ)
        → fixed formulas/ratios → attention, fatigue, (mood*) → smoothed
```
- Does NOT go through embeddings. Cheap, interpretable, validated, works day-1.
- This is what existing neurotech (NeuroSky / Muse / Emotiv / SmartCap) does.
- Example proxies (exact formulas vary by vendor):
  - attention / engagement ≈ `beta / (alpha + theta)`  (Pope engagement index)
  - fatigue / drowsiness  ≈ `(theta + alpha) / beta`  (theta dominance ↑ when drowsy)
  - *mood: weakly proxied by frontal alpha asymmetry — SOFT, flag in HONESTY.md.

**Track B — Embedding pipeline (learned, the differentiator):**
```
raw EEG → foundation model → embeddings → classifiers (events, anomalies,
                                          personalized labels)
                                       └→ dim-reduction (UMAP) → embedding viz
```
- The novel layer: event detection (microsleep), anomaly / out-of-distribution,
  personalized labeled concepts, and the embedding visualization above.

**Convergence:** both tracks write to the store the frontend reads —
Track A → metric timeline tiles; Track B → event markers + embedding tab.

**Decision:** keep them SEPARATE. DSP = always-on vitals (no training,
trustworthy); embeddings = rich/personalized/event layer. Don't reimplement
attention/fatigue as learned heads — you'd need labels and lose interpretability.

**Optional cross-feeds (later, not now):**
- concatenate band-power features with embeddings to help classifiers
- attention/fatigue *could* become learned heads on embeddings once labels exist
