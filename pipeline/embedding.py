"""
PLACEHOLDER — EEG embedding model and anomaly detector.

Replace run_embedding() with your team's trained model (PyTorch / ONNX / etc.)
Replace run_anomaly_detection() with your trained detector (IsolationForest, etc.)

Do not change the function signatures — daemon.py depends on them.

Expected shapes:
    run_embedding:        (n_channels, n_samples) -> (EMBEDDING_DIM,) float32
    run_anomaly_detection: (EMBEDDING_DIM,), list[(EMBEDDING_DIM,)] -> float [0, 1]
"""

import numpy as np

EMBEDDING_DIM = 384  # must match the vector(384) column in eeg_segments


def run_embedding(data: np.ndarray, sfreq: float) -> np.ndarray:
    """
    Compute a fixed-length embedding for one EEG window.

    Args:
        data:  (n_channels, n_samples) float32
        sfreq: sampling rate in Hz

    Returns:
        Unit-norm float32 vector of shape (EMBEDDING_DIM,).

    TODO: load and call your model here, e.g.
        import onnxruntime as ort
        session = ort.InferenceSession("model.onnx")
        output = session.run(None, {"input": data[None]})[0][0]
        return output / (np.linalg.norm(output) + 1e-8)
    """
    # Deterministic placeholder derived from signal statistics so that
    # similar EEG windows produce similar "embeddings" for demo purposes.
    rng = np.random.default_rng(int(abs(data.mean()) * 1e6) % (2**31))
    vec = rng.standard_normal(EMBEDDING_DIM).astype(np.float32)
    vec /= np.linalg.norm(vec) + 1e-8
    return vec


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

    TODO: replace with your trained detector, e.g.
        from sklearn.ensemble import IsolationForest
        clf = IsolationForest(...)  # loaded/trained offline
        score = -clf.score_samples(embedding[None])[0]  # higher = more anomalous
        return float(np.clip(score, 0, 1))
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
