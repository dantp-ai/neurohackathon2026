"""End-to-end dementia demo: frozen foundation embeddings + per-task head.

    python demo_dementia.py --synthetic              # no data; verifies the pipeline
    DS004504_ROOT=/path/ds004504 python demo_dementia.py --task ad_vs_cn

Flow: EEG -> EEGEmbedder (frozen) -> 30s-epoch embeddings (cached per subject)
-> subject-grouped train/test split -> TaskHead trained on epoch embeddings ->
evaluated at the subject level (mean probability over a subject's epochs). Then a
continual-learning simulation streams training subjects one at a time into
TaskStore.update() and reports held-out subject accuracy after each — the same
call the database/continual-learning service will make as caregivers confirm
labels.

Embeddings are cached to --cache (npz) so re-runs and task switches are instant.
"""

from __future__ import annotations

import argparse
import os

import numpy as np

from ml import EEGEmbedder, TaskStore, EPOCH_SECONDS
from ml.datasets import TASKS, GROUP_NAMES, iter_subjects


# ---------------------------------------------------------------------------
# Embedding (cached). Cache is task-independent: embeddings + group per epoch.
# ---------------------------------------------------------------------------
def embed_subjects(subject_iter, embedder, stride):
    """subject_iter yields (sub, group, data[C,T], sfreq, ch_names).
    Returns (emb[N,d], sub_ids[N], groups[N])."""
    embs, subs, groups = [], [], []
    for sub, group, data, sfreq, ch_names in subject_iter:
        e = embedder.embed(data, sfreq=sfreq, channel_names=ch_names,
                           stride_seconds=stride)
        embs.append(e)
        subs += [sub] * len(e)
        groups += [group] * len(e)
        print(f"  {sub} [{GROUP_NAMES.get(group, group)}]: {len(e)} epochs")
    return np.vstack(embs), np.array(subs), np.array(groups)


def build_cache(root, cache, dim, stride):
    if os.path.exists(cache):
        d = np.load(cache, allow_pickle=True)
        print(f"Loaded cached embeddings: {d['emb'].shape} from {cache}")
        return d["emb"], d["subs"], d["groups"]
    print(f"Embedding ds004504 from {root} (dim={dim}, stride={stride}s)...")
    embedder = EEGEmbedder(dim=dim)
    emb, subs, groups = embed_subjects(iter_subjects(root), embedder, stride)
    np.savez(cache, emb=emb, subs=subs, groups=groups)
    print(f"Cached {emb.shape} -> {cache}")
    return emb, subs, groups


# ---------------------------------------------------------------------------
# Subject-grouped split + subject-level evaluation (no epoch leakage).
# ---------------------------------------------------------------------------
def label_and_filter(subs, groups, task):
    fn = TASKS[task]
    labels = np.array([fn(g) for g in groups], dtype=object)
    mask = labels != None  # noqa: E711  (drop subjects not in this task)
    return labels, mask


def subject_split(unique_subs, sub_labels, test_frac, seed):
    """Grouped split, stratified by each subject's single label."""
    rng = np.random.default_rng(seed)
    test = []
    for lab in sorted(set(sub_labels.values())):
        members = [s for s in unique_subs if sub_labels[s] == lab]
        rng.shuffle(members)
        test += members[: max(1, int(round(len(members) * test_frac)))]
    test = set(test)
    train = [s for s in unique_subs if s not in test]
    return train, sorted(test)


def subject_eval(store, task, emb, subs, labels, test_subs):
    """Subject-level accuracy via mean probability across each subject's epochs."""
    head = store.get(task, create=False)
    correct = 0
    for s in test_subs:
        idx = subs == s
        proba = head.predict_proba(emb[idx]).mean(0)
        pred = head.classes_[proba.argmax()]
        correct += int(pred == labels[idx][0])
    return correct / len(test_subs)


def run(emb, subs, groups, task, test_frac, seed, store_root):
    labels, mask = label_and_filter(subs, groups, task)
    emb, subs, labels = emb[mask], subs[mask], labels[mask]
    sub_labels = {s: labels[subs == s][0] for s in np.unique(subs)}
    unique_subs = sorted(sub_labels)
    print(f"\nTask '{task}': {len(unique_subs)} subjects, {len(emb)} epochs, "
          f"classes={sorted(set(sub_labels.values()))}")

    train_subs, test_subs = subject_split(unique_subs, sub_labels, test_frac, seed)
    print(f"Split: {len(train_subs)} train / {len(test_subs)} test subjects")

    store = TaskStore(root=store_root)

    # Continual-learning simulation: stream one training subject at a time.
    print("\nContinual learning (held-out subject accuracy after each update):")
    rng = np.random.default_rng(seed)
    order = list(train_subs)
    rng.shuffle(order)
    for i, s in enumerate(order, 1):
        idx = subs == s
        store.update(task, emb[idx], labels[idx])
        head = store.get(task)
        if head.ready and i % 5 == 0 or i == len(order):
            acc = subject_eval(store, task, emb, subs, labels, test_subs) if head.ready else float("nan")
            print(f"  +{i:2d} subjects ({head.n_seen:4d} epochs) -> test acc {acc:.3f}")

    final = subject_eval(store, task, emb, subs, labels, test_subs)
    print(f"\nFinal subject-level test accuracy: {final:.3f} "
          f"(chance ~{1/len(set(sub_labels.values())):.3f})")
    return final


# ---------------------------------------------------------------------------
# Synthetic mode: two spectrally-distinct EEG "groups", no data download needed.
# ---------------------------------------------------------------------------
def synthetic_subjects(n_per_class=10, seconds=120, sfreq=250, seed=0):
    """Yield fake subjects: class 'A' = stronger 6 Hz (slowing, dementia-like),
    class 'C' = stronger 10 Hz alpha. 8 canonical-region channels."""
    rng = np.random.default_rng(seed)
    t = np.arange(seconds * sfreq) / sfreq
    for cls, peak in (("A", 6.0), ("C", 10.0)):
        for k in range(n_per_class):
            phase = rng.uniform(0, 2 * np.pi, size=8)[:, None]
            sig = (np.sin(2 * np.pi * peak * t + phase) * (8 if True else 1)
                   + 0.6 * rng.standard_normal((8, t.size)))
            yield f"sub-{cls}{k:02d}", cls, sig.astype(np.float32), float(sfreq), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", default="ad_vs_cn", choices=list(TASKS))
    ap.add_argument("--root", default=os.environ.get("DS004504_ROOT", "ds004504"))
    ap.add_argument("--cache", default="emb_ds004504.npz")
    ap.add_argument("--dim", type=int, default=192)
    ap.add_argument("--stride", type=float, default=EPOCH_SECONDS)
    ap.add_argument("--test-frac", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--synthetic", action="store_true",
                    help="run on synthetic EEG (no dataset / smoke test)")
    args = ap.parse_args()

    if args.synthetic:
        print("SYNTHETIC mode: spectrally-distinct fake EEG (no dataset).")
        embedder = EEGEmbedder(dim=args.dim)
        emb, subs, groups = embed_subjects(synthetic_subjects(seed=args.seed),
                                           embedder, args.stride)
        run(emb, subs, groups, "ad_vs_cn", args.test_frac, args.seed, "task_heads_synth")
        return

    if not os.path.exists(args.root) and not os.path.exists(args.cache):
        raise SystemExit(
            f"Dataset not found at '{args.root}' and no cache '{args.cache}'.\n"
            f"Download ds004504 (see ml/datasets.py) or run with --synthetic."
        )
    emb, subs, groups = build_cache(args.root, args.cache, args.dim, args.stride)
    run(emb, subs, groups, args.task, args.test_frac, args.seed, "task_heads")


if __name__ == "__main__":
    main()
