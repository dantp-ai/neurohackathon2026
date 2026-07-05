"""Shared pytest hooks for pipeline tests.

Two opt-in markers, gated by env vars so a plain `uv run pytest` runs only
the fast, hermetic tests:

  - `slow`: real foundation-model tests (~2 min cold start, HF auth).
    Opt in with `SLOW=1`.
  - `e2e`: end-to-end tests that need Supabase running and the trajectory
    NPZ present. Opt in with `E2E=1`.

Keeping the gates here (not in each test file) means adding a new marker'd
test is a one-line change with no skipif boilerplate.
"""

import os

import pytest


def pytest_collection_modifyitems(config, items):
    gates = {
        "slow": ("SLOW", "slow test; set SLOW=1 to run"),
        "e2e": ("E2E", "e2e test; set E2E=1 and run `supabase start` first"),
    }
    for marker, (env_var, reason) in gates.items():
        if os.getenv(env_var) == "1":
            continue
        skip = pytest.mark.skip(reason=reason)
        for item in items:
            if marker in item.keywords:
                item.add_marker(skip)
