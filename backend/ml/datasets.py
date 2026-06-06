"""Loader for OpenNeuro ds004504 — resting-state EEG for dementia.

88 subjects: 36 Alzheimer's (A), 23 frontotemporal dementia (F), 29 control (C).
19-channel 10-20, eyes-closed, 500 Hz, ~13 min/subject.

We don't ship the data. Download the BIDS root and point DS004504_ROOT at it:
    pip install openneuro-py && openneuro-py download --dataset ds004504
    # or: aws s3 sync --no-sign-request s3://openneuro.org/ds004504 ds004504

Each task maps the raw group code to a label (or None to drop the subject):
    ad_vs_cn        A->AD,            C->CN        (F dropped)   binary
    dementia_vs_cn  A->dementia, F->dementia, C->CN              binary
    ad_vs_ftd_vs_cn A->AD, F->FTD,    C->CN                      3-class
"""

from __future__ import annotations

import csv
import os

GROUP_NAMES = {"A": "Alzheimer", "F": "FTD", "C": "Control"}

TASKS = {
    "ad_vs_cn":        lambda g: {"A": "AD", "C": "CN"}.get(g),
    "dementia_vs_cn":  lambda g: {"A": "dementia", "F": "dementia", "C": "CN"}.get(g),
    "ad_vs_ftd_vs_cn": lambda g: {"A": "AD", "F": "FTD", "C": "CN"}.get(g),
}


def read_participants(root: str) -> dict[str, dict]:
    with open(os.path.join(root, "participants.tsv")) as f:
        return {r["participant_id"]: r for r in csv.DictReader(f, delimiter="\t")}


def _find_set(root: str, sub: str) -> str | None:
    rel = os.path.join(sub, "eeg", f"{sub}_task-eyesclosed_eeg.set")
    for base in (root, os.path.join(root, "derivatives")):
        path = os.path.join(base, rel)
        if os.path.exists(path):
            return path
    return None


def iter_subjects(root: str):
    """Yield (subject_id, group_code, data[C,T], sfreq, ch_names) per subject.

    Lazy: one subject is loaded into memory at a time.
    """
    import mne

    parts = read_participants(root)
    for sub in sorted(parts):
        group = parts[sub].get("Group") or parts[sub].get("group")
        setf = _find_set(root, sub)
        if setf is None:
            continue
        raw = mne.io.read_raw_eeglab(setf, preload=True, verbose="ERROR")
        yield sub, group, raw.get_data(), float(raw.info["sfreq"]), raw.ch_names
