"""Simulate the continual-learning loop on the dementia dataset.

We don't have real 'falling'/'noise' labelled EEG, so we keep the base dataset
fixed (ds004504) and stream its windows in as if caregiver-confirmed labels were
arriving over time. The ContinualTrainer refits each task's head every
--update-every new labels; held-out subject accuracy is printed after each update
so you can watch the classifiers improve as labels accumulate. Two tasks run at
once (same windows, different label mappings) to show multi-task orchestration —
a real 'falling' or 'noise' task plugs in identically (just push labels with that
task name).

    python simulate_continual.py --update-every 10
    python simulate_continual.py --update-every 50
"""

from __future__ import annotations

import argparse
import shutil

import numpy as np

from ml import TaskStore
from ml.continual import InMemoryLabelSource, ContinualTrainer
from ml.datasets import TASKS

SIM_TASKS = ["ad_vs_cn", "dementia_vs_cn"]
STORE_ROOT = "task_heads_sim"


def split_subjects(subs, groups, seed, test_frac=0.3):
    rng = np.random.default_rng(seed)
    sub_group = {s: groups[subs == s][0] for s in np.unique(subs)}
    test = []
    for g in sorted(set(sub_group.values())):
        members = [s for s in sub_group if sub_group[s] == g]
        rng.shuffle(members)
        test += members[: max(1, round(len(members) * test_frac))]
    test = set(test)
    train = [s for s in sub_group if s not in test]
    return train, sorted(test), sub_group


def subject_eval(store, task, emb, subs, sub_group, test_subs):
    """Subject-level accuracy: mean probability over each test subject's windows."""
    head = store.get(task, create=False)
    fn = TASKS[task]
    correct = total = 0
    for s in test_subs:
        lab = fn(sub_group[s])
        if lab is None:
            continue
        idx = subs == s
        pred = head.classes_[head.predict_proba(emb[idx]).mean(0).argmax()]
        correct += pred == lab
        total += 1
    return correct / total if total else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-every", type=int, default=10)
    ap.add_argument("--chunk", type=int, default=25, help="windows streamed per step")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--cache", default="emb_ds004504.npz")
    args = ap.parse_args()

    d = np.load(args.cache, allow_pickle=True)
    emb, subs, groups = d["emb"], d["subs"], d["groups"]

    train_subs, test_subs, sub_group = split_subjects(subs, groups, args.seed)
    tr_idx = np.where(np.isin(subs, train_subs))[0]
    np.random.default_rng(args.seed).shuffle(tr_idx)

    shutil.rmtree(STORE_ROOT, ignore_errors=True)   # fresh run
    store = TaskStore(root=STORE_ROOT)
    source = InMemoryLabelSource()
    trainer = ContinualTrainer(store, source, update_every=args.update_every)

    print(f"Continual-learning simulation on ds004504 "
          f"({len(train_subs)} train / {len(test_subs)} test subjects)")
    print(f"update_every={args.update_every}, tasks={SIM_TASKS}\n")

    n_updates = {t: 0 for t in SIM_TASKS}
    seen = 0
    for i in range(0, len(tr_idx), args.chunk):
        for w in tr_idx[i:i + args.chunk]:
            g = groups[w]
            for task in SIM_TASKS:
                lab = TASKS[task](g)
                if lab is not None:
                    source.push(emb[w], task, lab)
        seen += len(tr_idx[i:i + args.chunk])
        for ev in trainer.step():
            t = ev["task"]; n_updates[t] += 1
            acc = subject_eval(store, t, emb, subs, sub_group, test_subs)
            print(f"  ~{seen:4d} windows seen | {t:14s} update #{n_updates[t]:2d} "
                  f"(+{ev['n_new']} new, buffer {ev['n_buffer']:4d}) -> test acc {acc:.3f}")

    for ev in trainer.flush_all():
        t = ev["task"]; n_updates[t] += 1
        acc = subject_eval(store, t, emb, subs, sub_group, test_subs)
        print(f"  [flush]              | {t:14s} update #{n_updates[t]:2d} "
              f"(+{ev['n_new']} new) -> test acc {acc:.3f}")

    print("\nFinal:")
    for t in SIM_TASKS:
        print(f"  {t:14s}: {n_updates[t]} updates, "
              f"final test acc {subject_eval(store, t, emb, subs, sub_group, test_subs):.3f}")


if __name__ == "__main__":
    main()
