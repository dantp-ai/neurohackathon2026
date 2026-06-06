"""Base ML layer: frozen EEG foundation embeddings + per-task continual-learning heads.

Design (the whole point):

    raw EEG ──► EEGEmbedder (FROZEN neuroencoder MRL) ──► embedding [dim]
                                                            │
                          per-task heads ◄──────────────────┘
                          TaskHead('ad_vs_cn'), TaskHead('fall_risk'), ...
                          (lightweight, retrained as labels arrive)

The foundation model (neuroencoder, Hiera-Base + Matryoshka projector distilled
from EPI-250k) is never trained here — we only read embeddings from it. All
learning happens in small per-task classifier heads on top of those embeddings.

Because embeddings are frozen and tiny (dim floats), the continual-learning loop
is cheap and forgetting-free: every caregiver-confirmed (segment, label) pair in
the database becomes one `TaskStore.update(task, embedding, label)` call, which
appends to that task's replay buffer and refits its head. One head per task; new
tasks are created on first label. The DB/continual-learning service plugs in here
— it owns *when* to call update(); this layer owns the model.

Demo target: dementia EEG classification (OpenNeuro ds004504). See datasets.py.
"""

from .embedder import EEGEmbedder, DEFAULT_DIM, EPOCH_SECONDS
from .head import TaskHead
from .store import TaskStore

__all__ = ["EEGEmbedder", "TaskHead", "TaskStore", "DEFAULT_DIM", "EPOCH_SECONDS"]
