"""
EEG embedding model + anomaly detector.

run_embedding() returns the team's frozen EEG foundation-model embedding
(neuroencoder MRL, 384-d, L2-normalized — see backend/ml). The model loads once
on first call and is reused. run_anomaly_detection() is an unsupervised
cosine-drift score that works directly on these normalized embeddings.

Signatures are unchanged so daemon.py keeps working. Channel names aren't part of
the run_embedding signature, so call set_channel_names() once at startup with the
stream's montage — the model averages channels into 8 brain regions and needs the
10-20 labels to do that correctly. Without them it falls back to assuming the
data is already in canonical region order.

Expected shapes:
    run_embedding:        (n_channels, n_samples), sfreq -> (EMBEDDING_DIM,) float32
    run_anomaly_detection: (EMBEDDING_DIM,), list[(EMBEDDING_DIM,)] -> float [0, 1]
"""

import numpy as np

EMBEDDING_DIM = 384  # must match the vector(384) column in eeg_segments

_embedder = None       # lazy EEGEmbedder singleton (foundation model loads once)
_channel_names = None  # set via set_channel_names() for correct region mapping


def set_channel_names(names) -> None:
    """Register the stream's channel names (10-20 labels) for region mapping.
    Call once at startup, e.g. set_channel_names(stream.channel_names)."""
    global _channel_names
    _channel_names = list(names) if names else None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from backend.ml import EEGEmbedder
        _embedder = EEGEmbedder(dim=EMBEDDING_DIM)
    return _embedder


def run_embedding(data: np.ndarray, sfreq: float) -> np.ndarray:
    """
    Compute the foundation-model embedding for one EEG window.

    Args:
        data:  (n_channels, n_samples) float32
        sfreq: sampling rate in Hz

    Returns:
        Unit-norm float32 vector of shape (EMBEDDING_DIM,).
    """
    emb = _get_embedder().embed(
        np.asarray(data, dtype=np.float32),
        sfreq=float(sfreq),
        channel_names=_channel_names,
        stride_seconds=30.0,   # one ~30s window in -> one embedding out
    )
    vec = emb.mean(axis=0)                  # ~30s window -> 1 row; mean is a safeguard
    vec /= np.linalg.norm(vec) + 1e-8
    return vec.astype(np.float32)


def run_anomaly_detection(
    embedding: np.ndarray,
    history: list[np.ndarray],
) -> float:
    """
    Score how anomalous the current embedding is relative to recent history.

    Args:
        embedding: (EMBEDDING_DIM,) float32 — current window
        history:   list of previous embeddings for this patient (may be empty)

    Returns:
        Anomaly score in [0, 1]. Higher = more anomalous.

    Unsupervised cosine drift from the patient's recent baseline — fits the
    foundation embeddings directly (they're L2-normalized). Swap for a trained
    detector later if wanted.
    """
    if len(history) < 5:
        # Not enough history to judge — return neutral score
        return 0.0

    # Cosine distance from the centroid of the 20 most recent embeddings
    recent = np.stack(history[-20:])
    centroid = recent.mean(axis=0)
    norm = np.linalg.norm(centroid)
    if norm < 1e-8:
        return 0.0
    centroid /= norm

    cosine_sim = float(np.dot(embedding, centroid))
    # cosine_sim ∈ [-1, 1] → anomaly score ∈ [0, 1]
    return float(np.clip((1.0 - cosine_sim) / 2.0, 0.0, 1.0))
