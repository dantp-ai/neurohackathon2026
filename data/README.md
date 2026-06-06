# Sample EEG recording

One real patient recording for development/demo, taken from **OpenNeuro ds004504**
(CC0 — public domain). This is 1 of 88 subjects; the full dataset is streamed from
S3 by the backend (see `backend/ml/datasets.py`).

## This sample — `sub-001`
| | |
|---|---|
| Diagnosis | **Alzheimer's disease (AD)** — group `A` |
| Sex / Age | Female / 57 |
| MMSE | 16 (moderate–severe cognitive impairment; 30 = normal) |
| Channels | 19, 10-20 montage (Fp1 Fp2 F3 F4 C3 C4 P3 P4 O1 O2 F7 F8 T3 T4 T5 T6 Fz Cz Pz) |
| Sampling rate | 500 Hz, µV |
| Task | Eyes-closed resting state |
| Duration | ~10 min (599.8 s) |

## Files
- `sub-001_task-eyesclosed_eeg.set` — the recording (EEGLAB, single-file; ~23 MB)
- `sub-001_task-eyesclosed_channels.tsv`, `..._eeg.json` — BIDS metadata sidecars

## Load + embed (run from `backend/`)
```python
import mne
from ml import EEGEmbedder
raw = mne.io.read_raw_eeglab("../data/sub-001_task-eyesclosed_eeg.set", preload=True)
emb = EEGEmbedder(dim=384).embed(
    raw.get_data(), sfreq=raw.info["sfreq"], channel_names=raw.ch_names)
# emb: [n_30s_windows, 384] L2-normalized embeddings
```

## Trajectory dataset — `interp_trajectory_sub037_sub001.npz`
Precomputed "healthy → dementia" embedding trajectory for the demo: ds004504
**sub-037 (healthy/CN) → sub-001 (Alzheimer's)**. Real 30s EEG windows were blended
in **input space** across alpha=0→1 and **embedded live** with the neuroencoder MRL
model (dim=384), so every point is a genuine model output. Load with `np.load`:

| key | shape | meaning |
|---|---|---|
| `embedding` | `[530, 384]` | L2-normalized embeddings |
| `alpha` | `[530]` | time, 0 = healthy → 1 = dementia (use as color) |
| `is_real` | `[530]` bool | True = real recording window, False = interpolated blend |
| `xy` | `[530, 2]` | 2D UMAP coords for direct plotting |
| `description` | str | provenance |

```python
import numpy as np
d = np.load("data/interp_trajectory_sub037_sub001.npz", allow_pickle=True)
xy, alpha = d["xy"], d["alpha"]   # scatter(xy[:,0], xy[:,1], c=alpha)
```

## Attribution
Miltiadous, A. et al. *A Dataset of Scalp EEG Recordings of Alzheimer's Disease,
Frontotemporal Dementia and Healthy Subjects from Routine EEG.* Data 8(6):95, 2023.
https://doi.org/10.3390/data8060095 · https://openneuro.org/datasets/ds004504
