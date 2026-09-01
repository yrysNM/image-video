"""The always-on monitor loop.

Every tick it:
  1. checks the active window against per-app / per-site time budgets and blocks
     when a budget is exhausted;
  2. OCRs the screen (any program) and blocks immediately on adult content;
  3. checks the clipboard (what the user copied / is about to paste/write).
"""

from __future__ import annotations

import time

from . import enforcer, screen
from .activity import (
    ActiveWindow,
    UsageStore,
    get_active_window,
    is_over_budget,
    match_budget,
)
from .config import Config
from .detector import ContentDetector


def build_detector(cfg: Config) -> ContentDetector:
    from .detector import (
        DEFAULT_ALLOW_CONTEXT,
        DEFAULT_DOMAINS,
        DEFAULT_HARD_TERMS,
        DEFAULT_SOFT_TERMS,
    )

    hard = list(DEFAULT_HARD_TERMS) + list(cfg.extra_hard_terms)
    soft = dict(DEFAULT_SOFT_TERMS)
    soft.update(cfg.extra_soft_terms or {})
    domains = list(DEFAULT_DOMAINS) + list(cfg.extra_domains)
    allow = cfg.allow_context if cfg.allow_context is not None else list(
        DEFAULT_ALLOW_CONTEXT
    )
    return ContentDetector(
        hard_terms=hard,
        soft_terms=soft,
        domains=domains,
        allow_context=allow,
        soft_threshold=cfg.soft_threshold,
    )


def read_clipboard() -> str:
    try:
        import shutil
        import subprocess

        if shutil.which("xclip"):
            return subprocess.check_output(
                ["xclip", "-selection", "clipboard", "-o"],
                stderr=subprocess.DEVNULL,
                timeout=3,
            ).decode(errors="ignore")
    except Exception:
        return ""
    return ""


class Monitor:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.detector = build_detector(cfg)
        self.usage = UsageStore(cfg.usage_file)
        self._blocked_targets_cooldown: dict[str, float] = {}

    def _cooling_down(self, key: str) -> bool:
        until = self._blocked_targets_cooldown.get(key, 0)
        return time.monotonic() < until

    def _set_cooldown(self, key: str) -> None:
        self._blocked_targets_cooldown[key] = (
            time.monotonic() + max(5, self.cfg.enforcement.cooldown_seconds)
        )

    def tick(self, window: ActiveWindow | None, screen_text: str, clipboard: str) -> dict | None:
        """Evaluate one sample. Returns the enforcement event if it blocked."""
        # 1) Adult content on screen (any app) or clipboard -> immediate block.
        for source, text in (("screen", screen_text), ("clipboard", clipboard)):
            det = self.detector.inspect(text)
            if det.blocked and not self._cooling_down(f"content:{source}"):
                self._set_cooldown(f"content:{source}")
                return enforcer.enforce(
                    self.cfg,
                    "content",
                    f"{det.reason} ({source})",
                    {"matched": det.matched, "score": det.score, "source": source},
                    domains=det.matched,
                )

        # 2) Time budgets per app/site.
        if window is not None:
            target = match_budget(window, self.cfg.budgets)
            if target is not None:
                self.usage.add(target.name, self.cfg.scan_interval_seconds)
                self.usage.save()
                used = self.usage.get(target.name)
                if is_over_budget(used, target) and not self._cooling_down(
                    f"budget:{target.name}"
                ):
                    self._set_cooldown(f"budget:{target.name}")
                    return enforcer.enforce(
                        self.cfg,
                        "budget",
                        f"time's up for {target.name} "
                        f"({target.daily_minutes} min/day used)",
                        {
                            "target": target.name,
                            "used_seconds": round(used),
                            "limit_seconds": target.daily_minutes * 60,
                        },
                    )
        return None

    def run(self, iterations: int | None = None) -> None:
        ocr_ok = self.cfg.screen_scan and screen.ocr_available()
        count = 0
        while True:
            window = get_active_window()
            screen_text = ""
            if ocr_ok:
                try:
                    screen_text = screen.capture_screen_text()
                except Exception:
                    screen_text = ""
            clipboard = read_clipboard() if self.cfg.clipboard_scan else ""

            self.tick(window, screen_text, clipboard)

            count += 1
            if iterations is not None and count >= iterations:
                return
            time.sleep(self.cfg.scan_interval_seconds)
