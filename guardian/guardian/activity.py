"""Active-window detection and per-app / per-site time budgets.

The active-window probe is platform specific (Linux via xdotool is implemented
here; Windows/macOS hooks are documented in the README). The time-budget engine
is pure and unit tested.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass

from .config import BudgetTarget


@dataclass
class ActiveWindow:
    app: str
    title: str

    @property
    def label(self) -> str:
        return f"{self.app}: {self.title}".strip(": ").strip()


_URL_RE = re.compile(r"\b([a-z0-9.-]+\.[a-z]{2,})\b", re.IGNORECASE)


def extract_domain(title: str) -> str | None:
    """Best-effort domain from a browser window title (no extension needed)."""
    m = _URL_RE.search(title or "")
    return m.group(1).lower() if m else None


def get_active_window_linux() -> ActiveWindow | None:
    if not shutil.which("xdotool"):
        return None
    try:
        wid = subprocess.check_output(
            ["xdotool", "getactivewindow"], stderr=subprocess.DEVNULL, timeout=3
        ).decode().strip()
        title = subprocess.check_output(
            ["xdotool", "getwindowname", wid], stderr=subprocess.DEVNULL, timeout=3
        ).decode().strip()
        app = ""
        try:
            pid = subprocess.check_output(
                ["xdotool", "getwindowpid", wid],
                stderr=subprocess.DEVNULL,
                timeout=3,
            ).decode().strip()
            with open(f"/proc/{pid}/comm") as fh:
                app = fh.read().strip()
        except Exception:
            app = ""
        return ActiveWindow(app=app, title=title)
    except Exception:
        return None


def get_active_window() -> ActiveWindow | None:
    # Extension point for other platforms; Linux implemented.
    return get_active_window_linux()


def _today() -> str:
    return dt.date.today().isoformat()


class UsageStore:
    """Tracks accumulated seconds per budget target, persisted per day."""

    def __init__(self, path: str | None = None) -> None:
        self.path = path
        self.date = _today()
        self.seconds: dict[str, float] = {}
        self._load()

    def _load(self) -> None:
        if not self.path or not os.path.exists(self.path):
            return
        try:
            with open(self.path) as fh:
                data = json.load(fh)
            if data.get("date") == self.date:
                self.seconds = {k: float(v) for k, v in data.get("seconds", {}).items()}
        except Exception:
            self.seconds = {}

    def save(self) -> None:
        if not self.path:
            return
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump({"date": self.date, "seconds": self.seconds}, fh)
        os.replace(tmp, self.path)

    def _rollover(self) -> None:
        today = _today()
        if today != self.date:
            self.date = today
            self.seconds = {}

    def add(self, target: str, seconds: float) -> None:
        self._rollover()
        self.seconds[target] = self.seconds.get(target, 0.0) + seconds

    def get(self, target: str) -> float:
        self._rollover()
        return self.seconds.get(target, 0.0)


def match_budget(
    window: ActiveWindow, budgets: list[BudgetTarget]
) -> BudgetTarget | None:
    for b in budgets:
        if b.matches(window.app, window.title):
            return b
    return None


def is_over_budget(used_seconds: float, target: BudgetTarget) -> bool:
    return used_seconds >= target.daily_minutes * 60
