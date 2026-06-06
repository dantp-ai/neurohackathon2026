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

## Attribution
Miltiadous, A. et al. *A Dataset of Scalp EEG Recordings of Alzheimer's Disease,
Frontotemporal Dementia and Healthy Subjects from Routine EEG.* Data 8(6):95, 2023.
https://doi.org/10.3390/data8060095 · https://openneuro.org/datasets/ds004504
