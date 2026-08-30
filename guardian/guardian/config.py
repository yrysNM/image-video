"""Configuration loading for Guardian.

Reads an optional YAML file and merges it over sensible defaults. Everything has
a default so the app runs with zero configuration.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover - yaml is a declared dependency
    yaml = None


@dataclass
class BudgetTarget:
    name: str
    match: list[str]
    daily_minutes: int

    def matches(self, app: str, title: str) -> bool:
        haystack = f"{app} {title}".lower()
        return any(k.lower() in haystack for k in self.match)


@dataclass
class Enforcement:
    overlay: bool = True
    close_window: bool = True
    hosts_block: bool = False
    cooldown_seconds: int = 8


@dataclass
class Config:
    scan_interval_seconds: float = 3.0
    screen_scan: bool = True
    clipboard_scan: bool = True
    block_message: str = "Blocked by Guardian"
    soft_threshold: int = 3
    extra_hard_terms: list[str] = field(default_factory=list)
    extra_soft_terms: dict[str, int] = field(default_factory=dict)
    extra_domains: list[str] = field(default_factory=list)
    allow_context: list[str] | None = None
    budgets: list[BudgetTarget] = field(default_factory=list)
    enforcement: Enforcement = field(default_factory=Enforcement)
    state_dir: str = field(
        default_factory=lambda: os.path.join(
            os.path.expanduser("~"), ".guardian"
        )
    )

    @property
    def log_file(self) -> str:
        return os.path.join(self.state_dir, "guardian.log.jsonl")

    @property
    def usage_file(self) -> str:
        return os.path.join(self.state_dir, "usage.json")


def load_config(path: str | os.PathLike[str] | None) -> Config:
    cfg = Config()
    if not path:
        return cfg
    p = Path(path)
    if not p.exists():
        return cfg
    if yaml is None:
        raise RuntimeError("pyyaml is required to read a config file")
    data = yaml.safe_load(p.read_text()) or {}

    for key in (
        "scan_interval_seconds",
        "screen_scan",
        "clipboard_scan",
        "block_message",
        "soft_threshold",
        "extra_hard_terms",
        "extra_soft_terms",
        "extra_domains",
        "allow_context",
        "state_dir",
    ):
        if key in data and data[key] is not None:
            setattr(cfg, key, data[key])

    if isinstance(data.get("enforcement"), dict):
        e = data["enforcement"]
        cfg.enforcement = Enforcement(
            overlay=bool(e.get("overlay", True)),
            close_window=bool(e.get("close_window", True)),
            hosts_block=bool(e.get("hosts_block", False)),
            cooldown_seconds=int(e.get("cooldown_seconds", 8)),
        )

    budgets = data.get("budgets") or []
    cfg.budgets = [
        BudgetTarget(
            name=b["name"],
            match=list(b.get("match", [])),
            daily_minutes=int(b.get("daily_minutes", 60)),
        )
        for b in budgets
        if b.get("name")
    ]
    return cfg
