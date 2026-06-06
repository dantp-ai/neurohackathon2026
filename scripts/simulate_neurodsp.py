"""
Synthetic EEG scenario generator using neurodsp.

Generates multi-channel EEG with controlled, time-varying spectral characteristics
and streams it over LSL at real-time speed. The daemon (pipeline/daemon.py) connects
to this stream exactly as it would to a real device.

Also prints a verification table comparing expected vs. computed metrics, so you can
confirm the band_power pipeline correctly tracks changes in brain state.

Usage:
    # Stream only (connect daemon in another terminal):
    uv run scripts/simulate_neurodsp.py --stream

    # Verify metrics without streaming:
    uv run scripts/simulate_neurodsp.py --verify

    # Both + save a plot:
    uv run scripts/simulate_neurodsp.py --stream --verify --plot

Connecting the daemon:
    uv run pipeline/daemon.py --patient-id <uuid>
    (no --simulate or --file flag — it connects to the LSL outlet this script creates)
"""

import argparse
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1]))
from pipeline.band_power import SessionNormalizer, compute_band_powers

# ---------------------------------------------------------------------------
# Brain-state scenario definitions
# ---------------------------------------------------------------------------

@dataclass
class BrainState:
    name: str
    duration_s: float
    # Oscillation components: list of (freq_hz, amplitude_uV)
    oscillations: list[tuple[float, float]]
    # Aperiodic (1/f) exponent — more negative = steeper slope = more delta/theta
    aperiodic_exp: float = -1.5
    # Human-readable expected metric directions (for the verification table)
    expected: dict[str, str] = None

    def __post_init__(self):
        if self.expected is None:
            self.expected = {}


# The default scenario sequence (~6 minutes total)
DEFAULT_SCENARIO: list[BrainState] = [
    BrainState(
        name="Alert / resting",
        duration_s=90,
        oscillations=[
            (10.0, 22.0),   # strong alpha peak at 10 Hz
            (20.0,  6.0),   # moderate beta
            ( 6.0,  4.0),   # low theta
        ],
        aperiodic_exp=-1.5,
        expected={"fatigue": "LOW", "attention": "MED", "relaxation": "HIGH"},
    ),
    BrainState(
        name="Fatigued",
        duration_s=90,
        oscillations=[
            ( 5.5, 45.0),   # dominant theta burst (classic fatigue signature)
            (10.0,  6.0),   # suppressed alpha
            (20.0,  2.0),   # very low beta
        ],
        aperiodic_exp=-2.0,  # steeper slope = more low-freq power
        expected={"fatigue": "HIGH", "attention": "LOW", "relaxation": "LOW"},
    ),
    BrainState(
        name="Focused / engaged",
        duration_s=90,
        oscillations=[
            (20.0, 18.0),   # strong beta (cognitive engagement)
            (10.0, 10.0),   # moderate alpha
            ( 6.0,  9.0),   # moderate theta (working memory load)
        ],
        aperiodic_exp=-1.2,
        expected={"fatigue": "LOW", "attention": "HIGH", "relaxation": "MED"},
    ),
    BrainState(
        name="Deeply relaxed",
        duration_s=90,
        oscillations=[
            (10.0, 35.0),   # very strong alpha (eyes-closed relaxation)
            (20.0,  3.0),   # minimal beta
            ( 6.0,  3.0),   # minimal theta
        ],
        aperiodic_exp=-1.8,
        expected={"fatigue": "LOW", "attention": "LOW", "relaxation": "HIGH"},
    ),
]


# ---------------------------------------------------------------------------
# Signal generation
# ---------------------------------------------------------------------------

def _generate_state(
    state: BrainState,
    sfreq: float,
    n_channels: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Generate (n_samples, n_channels) EEG for one brain state.

    Each channel gets slightly different oscillation amplitudes (+/-20%) to
    produce realistic spatial variation rather than identical channels.
    """
    from neurodsp.sim import sim_powerlaw, sim_oscillation

    n_samples = int(state.duration_s * sfreq)
    data = np.zeros((n_samples, n_channels), dtype=np.float32)

    for ch in range(n_channels):
        # Aperiodic (1/f) background
        aperiodic = sim_powerlaw(
            n_seconds=state.duration_s,
            fs=sfreq,
            exponent=state.aperiodic_exp,
        ).astype(np.float32)
        aperiodic *= 8.0  # scale to µV range

        # Periodic oscillations with per-channel amplitude jitter
        periodic = np.zeros(n_samples, dtype=np.float32)
        for freq, amp in state.oscillations:
            jitter = rng.uniform(0.8, 1.2)
            osc = sim_oscillation(
                n_seconds=state.duration_s,
                fs=sfreq,
                freq=freq,
            ).astype(np.float32)
            periodic += amp * jitter * osc

        data[:, ch] = aperiodic + periodic

    return data


def build_scenario(
    states: list[BrainState],
    sfreq: float,
    n_channels: int,
    crossfade_s: float = 5.0,
    seed: int = 42,
) -> np.ndarray:
    """
    Concatenate states with smooth crossfades.
    Returns (n_total_samples, n_channels).
    """
    rng = np.random.default_rng(seed)
    fade = int(crossfade_s * sfreq)
    segments = [_generate_state(s, sfreq, n_channels, rng) for s in states]

    # Crossfade between adjacent segments
    result = [segments[0]]
    for prev, curr in zip(segments, segments[1:]):
        tail = prev[-fade:]
        head = curr[:fade]
        t = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        blend = (1 - t) * tail + t * head
        result[-1] = np.concatenate([result[-1][:-fade], blend], axis=0)
        result.append(curr[fade:])

    return np.concatenate(result, axis=0)


# ---------------------------------------------------------------------------
# Verification: run the band_power pipeline and compare to expected
# ---------------------------------------------------------------------------

def verify(
    scenario_data: np.ndarray,
    states: list[BrainState],
    sfreq: float,
) -> None:
    """Process the scenario through band_power and print a comparison table."""
    n_channels = scenario_data.shape[1]
    window_s = 4.0
    stride_s = 2.0
    win = int(window_s * sfreq)
    stride = int(stride_s * sfreq)

    normalizer = SessionNormalizer(baseline_s=60.0, stride_s=stride_s)

    # Collect per-window results with timestamps
    results = []
    for start in range(0, len(scenario_data) - win + 1, stride):
        window = scenario_data[start:start + win].T  # (n_ch, n_samples)
        raw = compute_band_powers(window, sfreq, window_s=window_s)
        normalizer.update(raw)
        norm = normalizer.normalize(raw)
        t = (start + win / 2) / sfreq
        results.append((t, norm))

    # Map each result to its state
    state_start = 0.0
    print("\n" + "=" * 72)
    print(f"{'State':<22} {'fatigue':>10} {'attention':>10} {'relaxation':>12}  Expected")
    print("=" * 72)

    for state in states:
        state_end = state_start + state.duration_s
        windows_in_state = [
            norm for t, norm in results
            if state_start + 10 <= t < state_end - 10  # ignore crossfade edges
        ]
        if not windows_in_state:
            state_start = state_end
            continue

        mean_f = np.mean([w["fatigue"]    for w in windows_in_state])
        mean_a = np.mean([w["attention"]  for w in windows_in_state])
        mean_r = np.mean([w["relaxation"] for w in windows_in_state])

        exp = state.expected
        expected_str = (
            f"fatigue={exp.get('fatigue','?')}  "
            f"attn={exp.get('attention','?')}  "
            f"relax={exp.get('relaxation','?')}"
        )
        print(
            f"{state.name:<22} {mean_f:>10.2f} {mean_a:>10.2f} {mean_r:>12.2f}"
            f"  {expected_str}"
        )
        state_start = state_end

    print("=" * 72)
    print("(values are session-normalized [0, 1]; 1st state used as baseline)\n")


# ---------------------------------------------------------------------------
# Plotting
# ---------------------------------------------------------------------------

def plot_scenario(
    scenario_data: np.ndarray,
    states: list[BrainState],
    sfreq: float,
    out_path: str = "neurodsp_scenario.png",
) -> None:
    import matplotlib.pyplot as plt

    win = int(4.0 * sfreq)
    stride = int(2.0 * sfreq)
    normalizer = SessionNormalizer(baseline_s=60.0, stride_s=2.0)

    times, fatigue_vals, attn_vals, relax_vals = [], [], [], []
    for start in range(0, len(scenario_data) - win + 1, stride):
        window = scenario_data[start:start + win].T
        raw = compute_band_powers(window, sfreq, window_s=4.0)
        normalizer.update(raw)
        norm = normalizer.normalize(raw)
        times.append((start + win / 2) / sfreq)
        fatigue_vals.append(norm["fatigue"])
        attn_vals.append(norm["attention"])
        relax_vals.append(norm["relaxation"])

    fig, ax = plt.subplots(figsize=(14, 4))
    ax.plot(times, fatigue_vals,  label="Fatigue",    color="#e74c3c", lw=1.5)
    ax.plot(times, attn_vals,    label="Attention",  color="#3498db", lw=1.5)
    ax.plot(times, relax_vals,   label="Relaxation", color="#2ecc71", lw=1.5)

    # Shade state regions
    colors = ["#f8f9fa", "#fff3cd", "#d1ecf1", "#d4edda"]
    t = 0.0
    for state, color in zip(states, colors):
        ax.axvspan(t, t + state.duration_s, alpha=0.25, color=color)
        ax.text(t + state.duration_s / 2, 1.02, state.name,
                ha="center", fontsize=8, transform=ax.get_xaxis_transform())
        t += state.duration_s

    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Normalized metric [0, 1]")
    ax.set_title("neurodsp scenario — band power metrics over time")
    ax.set_ylim(-0.05, 1.1)
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    print(f"Plot saved → {out_path}")


# ---------------------------------------------------------------------------
# Video animation
# ---------------------------------------------------------------------------

def _compute_metrics(
    scenario_data: np.ndarray,
    sfreq: float,
    window_s: float = 4.0,
    stride_s: float = 2.0,
) -> tuple[list[float], list[float], list[float], list[float]]:
    """Return (times, fatigue, attention, relaxation) lists."""
    win = int(window_s * sfreq)
    stride = int(stride_s * sfreq)
    normalizer = SessionNormalizer(baseline_s=60.0, stride_s=stride_s)
    times, f_vals, a_vals, r_vals = [], [], [], []
    for start in range(0, len(scenario_data) - win + 1, stride):
        window = scenario_data[start:start + win].T
        raw = compute_band_powers(window, sfreq, window_s=window_s)
        normalizer.update(raw)
        norm = normalizer.normalize(raw)
        times.append((start + win / 2) / sfreq)
        f_vals.append(norm["fatigue"])
        a_vals.append(norm["attention"])
        r_vals.append(norm["relaxation"])
    return times, f_vals, a_vals, r_vals


def animate_scenario(
    scenario_data: np.ndarray,
    states: list[BrainState],
    sfreq: float,
    out_path: str = "neurodsp_scenario.mp4",
    target_duration_s: float = 15.0,
    fps: int = 25,
) -> None:
    import matplotlib.pyplot as plt
    import matplotlib.animation as animation
    from matplotlib.animation import FFMpegWriter
    import shutil

    print("Computing metrics for animation...")
    times, f_vals, a_vals, r_vals = _compute_metrics(scenario_data, sfreq)
    n_frames = len(times)

    # Target at least target_duration_s — slow down fps if needed
    actual_fps = min(fps, n_frames / target_duration_s)
    actual_fps = max(actual_fps, 1)
    actual_duration = n_frames / actual_fps
    print(f"  {n_frames} data points → {actual_duration:.1f}s video @ {actual_fps:.1f} fps")

    fig, ax = plt.subplots(figsize=(12, 4.5))
    fig.patch.set_facecolor("#0f1117")
    ax.set_facecolor("#0f1117")

    # Pre-draw state shading (static)
    state_colors = ["#1a1a2e", "#1a2e1a", "#1a1a2e", "#2e1a1a"]
    t_start = 0.0
    for state, color in zip(states, state_colors):
        ax.axvspan(t_start, t_start + state.duration_s, alpha=0.4, color=color, zorder=0)
        ax.text(
            t_start + state.duration_s / 2, 1.06, state.name,
            ha="center", fontsize=8, color="#aaaaaa",
            transform=ax.get_xaxis_transform(),
        )
        t_start += state.duration_s

    total_s = times[-1]
    ax.set_xlim(0, total_s)
    ax.set_ylim(-0.05, 1.15)
    ax.set_xlabel("Time (s)", color="#aaaaaa")
    ax.set_ylabel("Normalized metric [0–1]", color="#aaaaaa")
    ax.set_title("EEG Band Power Metrics — neurodsp scenario", color="white", fontsize=11)
    ax.tick_params(colors="#aaaaaa")
    for spine in ax.spines.values():
        spine.set_edgecolor("#333333")

    # Lines (start empty)
    line_f, = ax.plot([], [], color="#e74c3c", lw=2.0, label="Fatigue")
    line_a, = ax.plot([], [], color="#3498db", lw=2.0, label="Attention")
    line_r, = ax.plot([], [], color="#2ecc71", lw=2.0, label="Relaxation")
    vline = ax.axvline(0, color="white", lw=0.8, alpha=0.5, ls="--")

    # Value readouts
    val_text = ax.text(
        0.01, 0.97, "", transform=ax.transAxes,
        va="top", ha="left", fontsize=9, color="white",
        fontfamily="monospace",
    )

    legend = ax.legend(
        loc="upper right", framealpha=0.2,
        labelcolor="white", facecolor="#111111",
    )

    def init():
        line_f.set_data([], [])
        line_a.set_data([], [])
        line_r.set_data([], [])
        return line_f, line_a, line_r, vline, val_text

    def update(i):
        i = min(i + 1, n_frames)
        xs = times[:i]
        line_f.set_data(xs, f_vals[:i])
        line_a.set_data(xs, a_vals[:i])
        line_r.set_data(xs, r_vals[:i])
        if xs:
            vline.set_xdata([xs[-1], xs[-1]])
            val_text.set_text(
                f"t={xs[-1]:5.1f}s   "
                f"fatigue={f_vals[i-1]:.2f}  "
                f"attention={a_vals[i-1]:.2f}  "
                f"relaxation={r_vals[i-1]:.2f}"
            )
        return line_f, line_a, line_r, vline, val_text

    anim = animation.FuncAnimation(
        fig, update, frames=n_frames, init_func=init,
        blit=True, interval=1000 / actual_fps,
    )

    if shutil.which("ffmpeg"):
        writer = FFMpegWriter(fps=actual_fps, bitrate=1800)
        ext = ".mp4"
    else:
        from matplotlib.animation import PillowWriter
        writer = PillowWriter(fps=actual_fps)
        ext = ".gif"
        out_path = out_path.replace(".mp4", ext)

    out_path = out_path if out_path.endswith(ext) else out_path.rsplit(".", 1)[0] + ext
    print(f"Saving video → {out_path}  (this may take ~30s...)")
    anim.save(out_path, writer=writer, dpi=120)
    plt.close(fig)
    print(f"Done → {out_path}")


# ---------------------------------------------------------------------------
# LSL streaming
# ---------------------------------------------------------------------------

def stream_lsl(
    scenario_data: np.ndarray,
    sfreq: float,
    ch_names: list[str],
    loop: bool = True,
) -> None:
    from pylsl import StreamInfo, StreamOutlet, cf_float32

    n_channels = scenario_data.shape[1]
    info = StreamInfo(
        name="NeuroDSP-Sim",
        type="EEG",
        channel_count=n_channels,
        nominal_srate=sfreq,
        channel_format=cf_float32,
        source_id="neurodsp-sim-001",
    )
    # Label channels
    chans = info.desc().append_child("channels")
    for name in ch_names:
        ch = chans.append_child("channel")
        ch.append_child_value("label", name)
        ch.append_child_value("type", "EEG")
        ch.append_child_value("unit", "microvolts")

    outlet = StreamOutlet(info)
    chunk_samples = int(sfreq * 0.1)  # push 100ms chunks
    chunk_s = chunk_samples / sfreq

    total = len(scenario_data)
    print(f"LSL outlet started: {n_channels} ch @ {sfreq} Hz  "
          f"(scenario {total/sfreq:.0f}s, loop={loop})")
    print("Connect daemon: uv run pipeline/daemon.py --patient-id <uuid>\n")

    cursor = 0
    try:
        while True:
            t_start = time.monotonic()
            end = min(cursor + chunk_samples, total)
            chunk = scenario_data[cursor:end].tolist()
            outlet.push_chunk(chunk)
            cursor = end

            if cursor >= total:
                if not loop:
                    print("Scenario complete.")
                    break
                print("Looping scenario...")
                cursor = 0

            elapsed = time.monotonic() - t_start
            sleep_for = chunk_s - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
    except KeyboardInterrupt:
        print("\nStreaming stopped.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

CHANNEL_NAMES = ["AF7", "AF8", "TP9", "TP10"]  # matches 4-channel Muse layout
SFREQ = 256.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stream",   action="store_true", help="Stream via LSL")
    parser.add_argument("--verify",   action="store_true", help="Print metric verification table")
    parser.add_argument("--plot",     action="store_true", help="Save a static PNG timeline")
    parser.add_argument("--video",    action="store_true", help="Save an animated MP4 video")
    parser.add_argument("--no-loop",  action="store_true", help="Don't loop the scenario (stream once)")
    parser.add_argument("--sfreq",    type=float, default=SFREQ, help="Sampling rate (default: 256)")
    parser.add_argument("--channels", type=int,   default=4,    help="Number of channels (default: 4)")
    args = parser.parse_args()

    if not any([args.stream, args.verify, args.plot, args.video]):
        parser.print_help()
        print("\nExample: uv run scripts/simulate_neurodsp.py --verify --video")
        return

    n_ch = args.channels
    ch_names = CHANNEL_NAMES[:n_ch] if n_ch <= 4 else [f"ch{i}" for i in range(n_ch)]

    print("Generating scenario data...")
    data = build_scenario(DEFAULT_SCENARIO, sfreq=args.sfreq, n_channels=n_ch)
    total_s = len(data) / args.sfreq
    print(f"  {len(data)} samples  ·  {n_ch} channels  ·  {total_s:.0f}s total\n")

    if args.verify:
        verify(data, DEFAULT_SCENARIO, sfreq=args.sfreq)

    if args.plot:
        plot_scenario(data, DEFAULT_SCENARIO, sfreq=args.sfreq)

    if args.video:
        animate_scenario(data, DEFAULT_SCENARIO, sfreq=args.sfreq)

    if args.stream:
        stream_lsl(data, sfreq=args.sfreq, ch_names=ch_names, loop=not args.no_loop)


if __name__ == "__main__":
    main()
