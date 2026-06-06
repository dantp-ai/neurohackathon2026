"""Frozen EEG foundation-model embedder (wraps neuroencoder MRL).

The model is loaded once and only ever queried for embeddings. Amplitude/units
are irrelevant: the temporal-matrix preprocessing min-max normalizes every epoch,
so raw volts vs microvolts make no difference.
"""

from __future__ import annotations

import numpy as np

DEFAULT_DIM = 192          # Matryoshka truncation; one of [768, 384, 192, 48, 16]
EPOCH_SECONDS = 30.0       # foundation model's native epoch length


class EEGEmbedder:
    """raw EEG -> L2-normalized embeddings. Frozen; safe to share across tasks."""

    def __init__(self, dim: int = DEFAULT_DIM, device: str | None = None):
        from neuroencoder import MRL, MRL_DIMS
        if dim not in MRL_DIMS:
            raise ValueError(f"dim must be one of {MRL_DIMS}, got {dim}")
        self.dim = dim
        self.model = MRL.from_pretrained(device=device)
        self.device = next(self.model.parameters()).device

    def embed(
        self,
        eeg,
        sfreq: float,
        channel_names=None,
        stride_seconds: float = EPOCH_SECONDS,
        filter: bool = True,
        batch_size: int = 64,
    ) -> np.ndarray:
        """Embed continuous `[C, T]` (or pre-epoched `[N, C, T]`) EEG.

        stride_seconds defaults to 30s (non-overlapping epochs) — what
        classification with epoch-level labels wants. Pass a smaller stride for
        a denser sliding window. Returns `[N, dim]` L2-normalized float32.
        """
        return self.model.embed(
            eeg,
            sfreq=sfreq,
            channel_names=channel_names,
            dim=self.dim,
            filter=filter,
            stride_seconds=stride_seconds,
            batch_size=batch_size,
        )

    def __repr__(self) -> str:
        return f"EEGEmbedder(dim={self.dim}, device={self.device})"
