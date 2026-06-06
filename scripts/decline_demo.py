"""
Standalone demo: render an MP4 of two real patients' raw EEG stitched
together along time, showing the contrast between a healthy brain and an
Alzheimer's-disease brain.

Source: data/neurohackathon_trajectory_full.npz — contains real 30s windows
for ds004504 sub-037 (CN, alpha=0) and sub-001 (AD, alpha=1), 19 channels @
500 Hz. We use only the *real* recording windows (is_real=True) and
concatenate them along the time axis: [sub-037 | sub-001].

Usage:
    uv run python scripts/decline_demo.py
    # produces scripts/decline_demo.mp4
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FFMpegWriter, FuncAnimation
from scipy.signal import resample_poly

# ---------------------------------------------------------------------------
# Paths + constants
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
NPZ_FILE = ROOT / "data" / "neurohackathon_trajectory_full.npz"
OUT_FILE = Path(__file__).parent / "decline_demo.mp4"

PATIENT_SECONDS = 60               # how much of each patient to show
DISPLAY_SFREQ = 100                # downsample for plot performance
WINDOW_S = 5.0                     # rolling window width on x-axis
FPS = 24                           # animation frames per second
RENDER_DPI = 80                    # ~1024×576; avoids retina 2x blow-up

# Match the app's status palette (src/theme/index.ts) so the video reads
# cohesively with the app screens.
PATIENT_COLORS = {
    "A": "#2EA66B",   # statusGood
    "B": "#D64545",   # statusBad
}
PATIENT_LABELS = {
    "A": "Cognitively normal",
    "B": "Alzheimer's disease",
}


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load_real_windows(seconds_per_patient: int) -> tuple[np.ndarray, np.ndarray, int, list[str]]:
    """
    Pull the real recording windows for each endpoint patient out of the npz,
    trim each to ``seconds_per_patient`` of EEG, and return
    (patient_a, patient_b, sfreq, channel_names).

    Each returned recording has shape (n_channels, n_samples).
    """
    print(f"Loading windows from {NPZ_FILE.name}...")
    d = np.load(NPZ_FILE, allow_pickle=True)
    raw = np.asarray(d["raw_windows"])             # (N, n_ch, samples_per_window)
    alpha = np.asarray(d["alpha"])
    is_real = np.asarray(d["is_real"], dtype=bool)
    sfreq = int(d["sfreq"])
    ch_names = [str(c) for c in d["ch_names"]]

    n_samples_per_window = raw.shape[-1]
    window_s = n_samples_per_window / sfreq
    n_windows_needed = max(1, int(np.ceil(seconds_per_patient / window_s)))

    def take(target_alpha: float) -> np.ndarray:
        # Real windows for this endpoint (alpha exactly 0 or 1).
        mask = is_real & np.isclose(alpha, target_alpha)
        windows = raw[mask][:n_windows_needed]      # (n, n_ch, samples)
        if len(windows) == 0:
            raise RuntimeError(f"No real windows at alpha={target_alpha}")
        # Concatenate along time axis and crop to exact length.
        cat = np.concatenate(list(windows), axis=-1)  # (n_ch, total_samples)
        return cat[:, : int(seconds_per_patient * sfreq)]

    a = take(0.0)
    b = take(1.0)
    print(
        f"  Patient A (CN  · alpha=0): {a.shape[0]}ch × {a.shape[1] / sfreq:.1f}s\n"
        f"  Patient B (AD  · alpha=1): {b.shape[0]}ch × {b.shape[1] / sfreq:.1f}s\n"
        f"  sfreq={sfreq} Hz · channels: {', '.join(ch_names)}"
    )
    return a, b, sfreq, ch_names


# ---------------------------------------------------------------------------
# Plot helpers
# ---------------------------------------------------------------------------
def downsample_to(data: np.ndarray, sfreq_in: float, sfreq_out: float) -> np.ndarray:
    """Anti-aliased downsample using polyphase resampling."""
    if sfreq_in == sfreq_out:
        return data
    up, down = int(sfreq_out), int(sfreq_in)
    g = np.gcd(up, down)
    return resample_poly(data, up // g, down // g, axis=-1)


def stack_with_offset(data: np.ndarray, gap_uv: float = 100.0) -> tuple[np.ndarray, np.ndarray]:
    """Convert (n_channels, n_samples) → vertically-offset stacked plot data (in µV)."""
    data_uv = data * 1e6  # V → µV
    n_ch = data_uv.shape[0]
    offsets = np.arange(n_ch) * gap_uv
    stacked = data_uv + offsets[:, None]
    return stacked, offsets


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if not NPZ_FILE.exists():
        raise FileNotFoundError(f"Expected trajectory file at {NPZ_FILE}")

    a, b, sfreq, ch_names = load_real_windows(PATIENT_SECONDS)

    # Downsample each patient for display, then stitch [A | B] along time.
    a_ds = downsample_to(a, sfreq, DISPLAY_SFREQ)
    b_ds = downsample_to(b, sfreq, DISPLAY_SFREQ)
    timeline = np.concatenate([a_ds, b_ds], axis=-1)
    n_per_patient = a_ds.shape[1]
    n_total = timeline.shape[1]
    print(
        f"Timeline: {n_total} samples @ {DISPLAY_SFREQ} Hz "
        f"= {n_total / DISPLAY_SFREQ:.1f}s playback"
    )

    stacked, offsets = stack_with_offset(timeline, gap_uv=100.0)

    # --- Figure setup -----------------------------------------------------
    fig, ax = plt.subplots(figsize=(12.8, 7.2), dpi=100)  # 1280x720
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")
    ax.tick_params(colors="#5C6B7A")
    for spine in ax.spines.values():
        spine.set_color("#DCE2E8")

    # One Line2D per channel.
    window_samples = int(WINDOW_S * DISPLAY_SFREQ)
    t_window = np.arange(window_samples) / DISPLAY_SFREQ
    lines = []
    for _ in range(stacked.shape[0]):
        (ln,) = ax.plot(
            t_window,
            np.zeros(window_samples),
            color="#16202A",
            linewidth=0.7,
            alpha=0.95,
        )
        lines.append(ln)

    ax.set_xlim(0, WINDOW_S)
    ax.set_ylim(-100, offsets[-1] + 100)
    ax.set_yticks(offsets)
    ax.set_yticklabels(ch_names, color="#16202A", fontsize=8)
    ax.set_xlabel("time (s)", color="#5C6B7A")
    ax.invert_yaxis()  # Fp1 at top, Pz at bottom (clinical convention)

    stage_text = ax.text(
        0.5, 1.05, "",
        transform=ax.transAxes,
        ha="center", va="bottom",
        fontsize=24, fontweight="bold",
        color=PATIENT_COLORS["A"],
    )

    fig.subplots_adjust(left=0.07, right=0.98, top=0.86, bottom=0.08)

    # --- Animation --------------------------------------------------------
    n_frames = int((n_total / DISPLAY_SFREQ) * FPS)
    samples_per_frame = max(1, DISPLAY_SFREQ // FPS)

    def patient_for(sample_idx: int) -> str:
        return "A" if sample_idx < n_per_patient else "B"

    def init():
        return [*lines, stage_text]

    def update(frame: int):
        cursor = min((frame + 1) * samples_per_frame, n_total)
        start = max(0, cursor - window_samples)
        view = stacked[:, start:cursor]

        if view.shape[1] < window_samples:
            pad = window_samples - view.shape[1]
            view = np.concatenate(
                [np.full((view.shape[0], pad), np.nan), view], axis=-1,
            )

        for ch, ln in enumerate(lines):
            ln.set_ydata(view[ch])

        p = patient_for(cursor - 1)
        stage_text.set_text(PATIENT_LABELS[p])
        stage_text.set_color(PATIENT_COLORS[p])
        return [*lines, stage_text]

    print(f"Rendering {n_frames} frames @ {FPS} fps → {OUT_FILE.name}...")
    anim = FuncAnimation(
        fig, update, init_func=init, frames=n_frames, interval=1000 / FPS, blit=True,
    )

    writer = FFMpegWriter(
        fps=FPS,
        bitrate=2000,
        codec="libx264",
        extra_args=["-preset", "ultrafast", "-pix_fmt", "yuv420p"],
    )
    anim.save(str(OUT_FILE), writer=writer, dpi=RENDER_DPI)
    plt.close(fig)
    print(f"Done. Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
