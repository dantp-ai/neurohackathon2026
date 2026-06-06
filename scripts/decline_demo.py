"""
Standalone demo: render a ~3-minute MP4 that walks through three stages of
cognitive decline (healthy → MCI → AD) using real EEG from data/sub-001.

We synthesize the three stages from one real AD recording by applying scipy
filters: aggressively suppressing slow waves (and adding posterior alpha)
gives a plausible "healthy" baseline; lighter suppression yields the MCI
intermediate; the untouched recording is the AD stage.

Usage:
    uv run python scripts/decline_demo.py
    # produces scripts/decline_demo.mp4
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import mne
import numpy as np
from matplotlib.animation import FFMpegWriter, FuncAnimation
from scipy.signal import butter, filtfilt, resample_poly

# ---------------------------------------------------------------------------
# Paths + constants
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
EEG_FILE = ROOT / "data" / "sub-001_task-eyesclosed_eeg.set"
OUT_FILE = Path(__file__).parent / "decline_demo.mp4"

STAGE_SECONDS = 60                # length of each stage in playback seconds
DISPLAY_SFREQ = 100               # downsample for plot performance
WINDOW_S = 5.0                    # rolling window width on x-axis
FPS = 24                          # animation frames per second
RENDER_DPI = 80                   # force ~1024x576; avoids retina 2x blow-up

# Match the app's status palette (src/theme/index.ts) so the video reads
# cohesively with the app screens.
STAGE_COLORS = {
    "A": "#2EA66B",   # statusGood
    "B": "#E8A317",   # statusWarn
    "C": "#D64545",   # statusBad
}
STAGE_LABELS = {
    "A": "Stage A — Healthy (MMSE 28)",
    "B": "Stage B — Mild Cognitive Impairment (MMSE 24)",
    "C": "Stage C — Alzheimer's Disease (MMSE 16)",
}


# ---------------------------------------------------------------------------
# EEG loading + stage synthesis
# ---------------------------------------------------------------------------
def load_window(seconds: int = STAGE_SECONDS) -> tuple[np.ndarray, float, list[str]]:
    """Return (data, sfreq, channel_names) for the cropped 60s window."""
    print(f"Loading EEG from {EEG_FILE.name}...")
    raw = mne.io.read_raw_eeglab(str(EEG_FILE), preload=True, verbose="ERROR")
    sfreq = float(raw.info["sfreq"])
    data = raw.get_data()  # (n_channels, n_samples), volts

    skip = int(5 * sfreq)
    n = int(seconds * sfreq)
    window = data[:, skip : skip + n]
    print(
        f"  {window.shape[0]} channels @ {sfreq:g} Hz · {window.shape[1] / sfreq:.1f}s window"
    )
    return window, sfreq, raw.ch_names


def highpass(data: np.ndarray, sfreq: float, cutoff_hz: float) -> np.ndarray:
    """Zero-phase Butterworth high-pass."""
    sos_b, sos_a = butter(4, cutoff_hz / (sfreq / 2), btype="highpass")
    return filtfilt(sos_b, sos_a, data, axis=-1)


def add_alpha(data: np.ndarray, sfreq: float, amplitude_uv: float = 12.0) -> np.ndarray:
    """Add a 10 Hz alpha-like sinusoid per channel (in V — same units as MNE)."""
    n = data.shape[1]
    t = np.arange(n) / sfreq
    alpha = (amplitude_uv * 1e-6) * np.sin(2 * np.pi * 10.0 * t)
    return data + alpha[None, :]


def synthesize_stages(window: np.ndarray, sfreq: float) -> dict[str, np.ndarray]:
    """Three transforms of the same window producing the decline arc."""
    print("Synthesizing stages...")
    stage_c = window.copy()                                # untouched AD
    stage_b = highpass(window, sfreq, cutoff_hz=3.0)       # mild MCI
    stage_a = add_alpha(highpass(window, sfreq, 6.0), sfreq)  # healthy

    return {"A": stage_a, "B": stage_b, "C": stage_c}


# ---------------------------------------------------------------------------
# Plot setup
# ---------------------------------------------------------------------------
def downsample_to(data: np.ndarray, sfreq_in: float, sfreq_out: float) -> np.ndarray:
    """Anti-aliased downsample using polyphase resampling."""
    if sfreq_in == sfreq_out:
        return data
    # Use rational up/down — pick integer ratios.
    up, down = int(sfreq_out), int(sfreq_in)
    g = np.gcd(up, down)
    return resample_poly(data, up // g, down // g, axis=-1)


def stack_with_offset(data: np.ndarray, gap_uv: float = 100.0) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert (n_channels, n_samples) into a single offset-stacked array for
    plotting. Returns (stacked_uv, channel_offsets_uv).
    """
    data_uv = data * 1e6  # V → µV
    n_ch = data_uv.shape[0]
    offsets = np.arange(n_ch) * gap_uv
    stacked = data_uv + offsets[:, None]
    return stacked, offsets


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if not EEG_FILE.exists():
        raise FileNotFoundError(f"Expected EEG file at {EEG_FILE}")

    window, sfreq, ch_names = load_window(seconds=STAGE_SECONDS)
    stages = synthesize_stages(window, sfreq)

    # Downsample each stage to display rate then concatenate.
    ds_stages = {k: downsample_to(v, sfreq, DISPLAY_SFREQ) for k, v in stages.items()}
    timeline = np.concatenate([ds_stages["A"], ds_stages["B"], ds_stages["C"]], axis=-1)
    n_per_stage = ds_stages["A"].shape[1]
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

    # One Line2D per channel (we'll update y data each frame).
    window_samples = int(WINDOW_S * DISPLAY_SFREQ)
    t_window = np.arange(window_samples) / DISPLAY_SFREQ
    lines = []
    for ch in range(stacked.shape[0]):
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
        0.5,
        1.05,
        "",
        transform=ax.transAxes,
        ha="center",
        va="bottom",
        fontsize=24,
        fontweight="bold",
        color=STAGE_COLORS["A"],
    )

    fig.subplots_adjust(left=0.07, right=0.98, top=0.86, bottom=0.08)

    # --- Animation --------------------------------------------------------
    n_frames = int(STAGE_SECONDS * 3 * FPS)
    samples_per_frame = DISPLAY_SFREQ // FPS  # 100 / 30 = 3 samples (slight drift OK)
    # Position the right edge of the rolling window at frame t (in samples).
    # The visible slice walks from (cursor - window_samples) to cursor.

    def stage_for(sample_idx: int) -> str:
        if sample_idx < n_per_stage:
            return "A"
        if sample_idx < 2 * n_per_stage:
            return "B"
        return "C"

    def init():
        return [*lines, stage_text]

    def update(frame: int):
        cursor = (frame + 1) * samples_per_frame
        cursor = min(cursor, n_total)
        start = max(0, cursor - window_samples)
        view = stacked[:, start:cursor]

        # Pad-left when the cursor is near the start so the window stays fixed-width.
        if view.shape[1] < window_samples:
            pad = window_samples - view.shape[1]
            view = np.concatenate(
                [np.full((view.shape[0], pad), np.nan), view], axis=-1,
            )

        for ch, ln in enumerate(lines):
            ln.set_ydata(view[ch])

        stage = stage_for(cursor - 1)
        stage_text.set_text(STAGE_LABELS[stage])
        stage_text.set_color(STAGE_COLORS[stage])
        return [*lines, stage_text]

    print(f"Rendering {n_frames} frames @ {FPS} fps -> {OUT_FILE.name}...")
    anim = FuncAnimation(
        fig, update, init_func=init, frames=n_frames, interval=1000 / FPS, blit=True,
    )

    writer = FFMpegWriter(
        fps=FPS,
        bitrate=2000,
        codec="libx264",
        # ultrafast x264 preset cuts encode time ~3-5x; yuv420p ensures
        # universal player compatibility (QuickTime, Slack, etc.).
        extra_args=["-preset", "ultrafast", "-pix_fmt", "yuv420p"],
    )
    anim.save(str(OUT_FILE), writer=writer, dpi=RENDER_DPI)
    plt.close(fig)
    print(f"Done. Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
