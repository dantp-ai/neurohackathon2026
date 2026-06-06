"""
EEG stream sources.

LSLStream       — real device via Lab Streaming Layer (muselsl, BrainCo SDK)
SimulatedStream — synthetic EEG for development / demo
FileStream      — replay a recorded file at real-time speed (.set, .edf, .csv …)

All three expose the same interface:
    stream.sfreq           -> float
    stream.n_channels      -> int
    stream.channel_names   -> list[str]
    stream.pull_chunk(...)  -> (np.ndarray [n_new × n_ch], list[float] timestamps)
"""

import time
from abc import ABC, abstractmethod

import numpy as np


class EEGStream(ABC):
    @property
    @abstractmethod
    def sfreq(self) -> float: ...

    @property
    @abstractmethod
    def n_channels(self) -> int: ...

    @property
    @abstractmethod
    def channel_names(self) -> list[str]: ...

    @abstractmethod
    def pull_chunk(
        self, timeout: float = 0.1, max_samples: int = 128
    ) -> tuple[np.ndarray, list[float]]:
        """Return (samples [n×ch], timestamps). samples may have 0 rows."""


# ---------------------------------------------------------------------------
# Real device via LSL
# ---------------------------------------------------------------------------

class LSLStream(EEGStream):
    """
    Connect to a running LSL outlet — works with muselsl, BrainCo SDK,
    OpenBCI, and anything else that publishes an EEG stream over LSL.

    Start the outlet first:
        Muse:     muselsl stream
        BrainCo:  use their companion app or SDK in LSL mode
    """

    def __init__(self, stream_type: str = "EEG", timeout: float = 10.0):
        from pylsl import StreamInlet, resolve_stream

        print(f"Searching for LSL stream of type '{stream_type}'...")
        streams = resolve_stream("type", stream_type, timeout=timeout)
        if not streams:
            raise RuntimeError(
                f"No LSL stream of type '{stream_type}' found within {timeout}s. "
                "Is the device app running?"
            )
        self._inlet = StreamInlet(streams[0])
        info = self._inlet.info()
        self._sfreq = float(info.nominal_srate())
        self._n_channels = info.channel_count()
        self._channel_names = self._parse_channel_names(info)
        print(
            f"Connected: {self._n_channels} channels @ {self._sfreq} Hz  "
            f"({', '.join(self._channel_names[:4])}{'…' if self._n_channels > 4 else ''})"
        )

    @staticmethod
    def _parse_channel_names(info) -> list[str]:
        ch = info.desc().child("channels").child("channel")
        names = []
        while ch.name() == "channel":
            label = ch.child_value("label")
            names.append(label if label else f"ch{len(names)}")
            ch = ch.next_sibling()
        return names or [f"ch{i}" for i in range(info.channel_count())]

    @property
    def sfreq(self) -> float:
        return self._sfreq

    @property
    def n_channels(self) -> int:
        return self._n_channels

    @property
    def channel_names(self) -> list[str]:
        return self._channel_names

    def pull_chunk(
        self, timeout: float = 0.1, max_samples: int = 128
    ) -> tuple[np.ndarray, list[float]]:
        samples, timestamps = self._inlet.pull_chunk(
            timeout=timeout, max_samples=max_samples
        )
        if not samples:
            return np.empty((0, self._n_channels), dtype=np.float32), []
        return np.array(samples, dtype=np.float32), list(timestamps)


# ---------------------------------------------------------------------------
# Synthetic EEG for development and demo
# ---------------------------------------------------------------------------

class SimulatedStream(EEGStream):
    """
    Generates physiologically plausible EEG-like signals in real-time.

    Signal model:
      • Pink (1/f) noise base
      • Alpha peak at a random frequency in 8–12 Hz
      • Periodic theta bursts (4–7 Hz, high amplitude) to simulate anomalies

    anomaly_every_s controls how often a theta-burst anomaly is injected.
    Set to None to disable anomaly injection.
    """

    def __init__(
        self,
        sfreq: float = 256.0,
        n_channels: int = 4,
        channel_names: list[str] | None = None,
        anomaly_every_s: float | None = 120.0,
        seed: int | None = None,
    ):
        self._sfreq = sfreq
        self._n_channels = n_channels
        self._channel_names = channel_names or [f"ch{i}" for i in range(n_channels)]
        self._anomaly_every_s = anomaly_every_s
        self._rng = np.random.default_rng(seed)
        self._t = 0.0
        self._last_pull = time.monotonic()
        print(
            f"SimulatedStream: {n_channels} channels @ {sfreq} Hz  "
            f"(anomaly every {anomaly_every_s}s)"
        )

    @property
    def sfreq(self) -> float:
        return self._sfreq

    @property
    def n_channels(self) -> int:
        return self._n_channels

    @property
    def channel_names(self) -> list[str]:
        return self._channel_names

    def _generate(self, n: int) -> np.ndarray:
        t = np.linspace(self._t, self._t + n / self._sfreq, n, endpoint=False)

        # Pink noise base via cumsum of white noise
        white = self._rng.standard_normal((n, self._n_channels)).astype(np.float32)
        pink = np.cumsum(white, axis=0)
        pink -= pink.mean(axis=0)
        pink /= (pink.std(axis=0) + 1e-8)
        pink *= 15.0  # µV scale

        # Alpha peak (individual alpha frequency varies per channel)
        for ch in range(self._n_channels):
            iaf = self._rng.uniform(8.5, 11.5)
            pink[:, ch] += 18.0 * np.sin(2 * np.pi * iaf * t).astype(np.float32)

        # Theta-burst anomaly
        if self._anomaly_every_s is not None:
            start_cycle = int(self._t / self._anomaly_every_s)
            end_cycle = int((self._t + n / self._sfreq) / self._anomaly_every_s)
            if start_cycle != end_cycle:
                theta_f = self._rng.uniform(4.0, 7.0)
                burst = 60.0 * np.sin(2 * np.pi * theta_f * t).astype(np.float32)
                pink += burst[:, None]

        return pink

    def pull_chunk(
        self, timeout: float = 0.1, max_samples: int = 128
    ) -> tuple[np.ndarray, list[float]]:
        now = time.monotonic()
        elapsed = now - self._last_pull
        # Pace to real-time
        if elapsed < timeout:
            time.sleep(timeout - elapsed)
        self._last_pull = time.monotonic()

        n = max(1, min(int(elapsed * self._sfreq), max_samples))
        samples = self._generate(n)
        timestamps = [self._t + i / self._sfreq for i in range(n)]
        self._t += n / self._sfreq
        return samples, timestamps


# ---------------------------------------------------------------------------
# File replay (for testing with data/sub-001_task-eyesclosed_eeg.set)
# ---------------------------------------------------------------------------

class FileStream(EEGStream):
    """
    Replay a recorded EEG file at real-time speed.
    Loops back to the start when the recording ends.

    Supported formats: .set .edf .bdf .fif .vhdr (via MNE), .csv
    """

    def __init__(
        self,
        filepath: str,
        sfreq_override: float | None = None,
        ch_names_override: list[str] | None = None,
    ):
        import mne
        from pathlib import Path

        ext = Path(filepath).suffix.lower()
        loaders = {
            ".edf": mne.io.read_raw_edf,
            ".bdf": mne.io.read_raw_bdf,
            ".set": mne.io.read_raw_eeglab,
            ".fif": mne.io.read_raw_fif,
            ".vhdr": mne.io.read_raw_brainvision,
        }

        if ext in loaders:
            raw = loaders[ext](filepath, preload=True, verbose=False)
            # (n_samples, n_channels)
            self._data = raw.get_data().T.astype(np.float32)
            self._sfreq = float(sfreq_override or raw.info["sfreq"])
            self._channel_names = ch_names_override or raw.ch_names
        elif ext == ".csv":
            import pandas as pd
            df = pd.read_csv(filepath)
            self._data = df.values.astype(np.float32)
            if sfreq_override is None:
                raise ValueError("sfreq_override is required for CSV files")
            self._sfreq = float(sfreq_override)
            self._channel_names = ch_names_override or list(df.columns)
        else:
            raise ValueError(
                f"Unsupported format: {ext}. "
                "Supported: .set .edf .bdf .fif .vhdr .csv"
            )

        self._cursor = 0
        self._last_pull = time.monotonic()
        self._t = 0.0
        n_s, n_ch = self._data.shape
        print(
            f"FileStream: {n_s} samples × {n_ch} channels @ {self._sfreq} Hz  "
            f"({n_s / self._sfreq:.1f}s recording)"
        )

    @property
    def sfreq(self) -> float:
        return self._sfreq

    @property
    def n_channels(self) -> int:
        return self._data.shape[1]

    @property
    def channel_names(self) -> list[str]:
        return self._channel_names

    def pull_chunk(
        self, timeout: float = 0.1, max_samples: int = 128
    ) -> tuple[np.ndarray, list[float]]:
        now = time.monotonic()
        elapsed = now - self._last_pull
        if elapsed < timeout:
            time.sleep(timeout - elapsed)
        self._last_pull = time.monotonic()

        n = max(1, min(int(elapsed * self._sfreq), max_samples))

        if self._cursor >= len(self._data):
            print("\nFileStream: end of recording — looping.")
            self._cursor = 0

        end = min(self._cursor + n, len(self._data))
        samples = self._data[self._cursor:end]
        timestamps = [self._t + i / self._sfreq for i in range(len(samples))]
        self._cursor = end
        self._t += len(samples) / self._sfreq
        return samples, timestamps
