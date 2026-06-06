"""
Band power extraction via Welch's method + session-relative normalization.

compute_band_powers(data, sfreq) -> dict
    One call per window; returns raw band powers and derived ratios.

SessionNormalizer
    Collects a per-patient baseline during the first ~2 minutes, then maps
    the three derived metrics to [0, 1] relative to that baseline.
    Falls back to population-level defaults for brand-new patients.
"""

from collections import deque

import numpy as np
from scipy import signal


BANDS: dict[str, tuple[float, float]] = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta":  (13.0, 30.0),
    "gamma": (30.0, 50.0),
}


def compute_band_powers(
    data: np.ndarray,
    sfreq: float,
    window_s: float = 4.0,
) -> dict[str, float]:
    """
    Compute mean band powers across all channels for one EEG window.

    Args:
        data:     (n_channels, n_samples) float32
        sfreq:    sampling frequency in Hz
        window_s: Welch segment length in seconds (controls freq resolution)

    Returns dict with keys:
        delta, theta, alpha, beta, gamma  — absolute band powers (µV²/Hz)
        engagement_index                  — β / (α + θ)   [attention proxy]
        theta_beta_ratio                  — θ / β         [fatigue / ADHD proxy]
        relative_alpha                    — α / total      [relaxation proxy]
    """
    n_ch, n_samples = data.shape
    nperseg = min(int(window_s * sfreq), n_samples)

    band_totals: dict[str, float] = {b: 0.0 for b in BANDS}

    for ch in range(n_ch):
        freqs, psd = signal.welch(
            data[ch],
            fs=sfreq,
            window="hann",
            nperseg=nperseg,
            noverlap=nperseg // 2,
        )
        for band, (lo, hi) in BANDS.items():
            idx = (freqs >= lo) & (freqs <= hi)
            band_totals[band] += float(np.trapz(psd[idx], freqs[idx]))

    # Average across channels
    bp = {b: v / n_ch for b, v in band_totals.items()}

    d, t, a, b, g = bp["delta"], bp["theta"], bp["alpha"], bp["beta"], bp["gamma"]
    total = d + t + a + b + g

    bp["engagement_index"] = b / (a + t)   if (a + t) > 1e-10 else 0.0
    bp["theta_beta_ratio"] = t / b          if b > 1e-10       else 0.0
    bp["relative_alpha"]   = a / total      if total > 1e-10   else 0.0

    return bp


class SessionNormalizer:
    """
    Maps raw EEG-derived ratios → normalized [0, 1] metrics per session.

    Strategy:
    • Collect first `baseline_s` seconds of windows as the patient's baseline.
    • After ≥10 windows, compute [mean − 2σ, mean + 2σ] clipping range.
    • Before enough baseline data: use population-level defaults.

    Outputs:
        fatigue   — high θ/β → high value (inverted engagement)
        attention — high engagement index → high value
        mood      — high relative α → more relaxed / positive
    """

    # Population-level fallback ranges (resting EEG, rough approximations)
    _DEFAULTS: dict[str, tuple[float, float]] = {
        "theta_beta_ratio": (0.3, 4.0),
        "engagement_index": (0.2, 2.0),
        "relative_alpha":   (0.10, 0.45),
    }
    _MIN_BASELINE_WINDOWS = 10

    def __init__(self, baseline_s: float = 120.0, stride_s: float = 5.0):
        cap = max(self._MIN_BASELINE_WINDOWS + 1, int(baseline_s / stride_s))
        self._buf: dict[str, deque] = {k: deque(maxlen=cap) for k in self._DEFAULTS}
        self._calibrated = False
        self._lo: dict[str, float] = {}
        self._hi: dict[str, float] = {}

    @property
    def calibrated(self) -> bool:
        return self._calibrated

    def update(self, metrics: dict[str, float]) -> None:
        """Feed one window's raw metrics into the baseline buffer."""
        for key in self._DEFAULTS:
            if key in metrics:
                self._buf[key].append(metrics[key])
        if not self._calibrated:
            min_len = min(len(b) for b in self._buf.values())
            if min_len >= self._MIN_BASELINE_WINDOWS:
                self._calibrate()

    def _calibrate(self) -> None:
        for key, buf in self._buf.items():
            arr = np.array(buf)
            mu, sigma = float(arr.mean()), float(arr.std()) + 1e-8
            self._lo[key] = mu - 2.0 * sigma
            self._hi[key] = mu + 2.0 * sigma
        self._calibrated = True

    def normalize(self, metrics: dict[str, float]) -> dict[str, float]:
        """
        Return {'fatigue': float, 'attention': float, 'mood': float} ∈ [0, 1].
        """
        def _clip01(v: float, lo: float, hi: float) -> float:
            return float(np.clip((v - lo) / (hi - lo + 1e-8), 0.0, 1.0))

        if self._calibrated:
            lo_tb, hi_tb = self._lo["theta_beta_ratio"], self._hi["theta_beta_ratio"]
            lo_ei, hi_ei = self._lo["engagement_index"], self._hi["engagement_index"]
            lo_ra, hi_ra = self._lo["relative_alpha"],   self._hi["relative_alpha"]
        else:
            lo_tb, hi_tb = self._DEFAULTS["theta_beta_ratio"]
            lo_ei, hi_ei = self._DEFAULTS["engagement_index"]
            lo_ra, hi_ra = self._DEFAULTS["relative_alpha"]

        tb = metrics.get("theta_beta_ratio", 0.0)
        ei = metrics.get("engagement_index", 0.0)
        ra = metrics.get("relative_alpha",   0.0)

        return {
            "fatigue":   _clip01(tb, lo_tb, hi_tb),  # high θ/β → fatigued
            "attention": _clip01(ei, lo_ei, hi_ei),  # high engagement → attentive
            "mood":      _clip01(ra, lo_ra, hi_ra),  # high α → relaxed / positive
        }
