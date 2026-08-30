"""Enforcement actions: log, close the offending window, block a site, and/or
show a fullscreen block overlay.

All actions are best-effort and degrade safely (e.g. no display -> overlay is
skipped but the event is still logged and the window still gets closed).
"""

from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import subprocess

from .config import Config


def log_event(cfg: Config, kind: str, reason: str, detail: dict | None = None) -> dict:
    event = {
        "time": dt.datetime.now().isoformat(timespec="seconds"),
        "kind": kind,  # "content" | "budget"
        "reason": reason,
        "detail": detail or {},
    }
    try:
        os.makedirs(cfg.state_dir, exist_ok=True)
        with open(cfg.log_file, "a") as fh:
            fh.write(json.dumps(event) + "\n")
    except Exception:
        pass
    return event


def close_active_window() -> bool:
    """Close the currently focused window (the offending app/tab)."""
    if shutil.which("xdotool"):
        try:
            wid = subprocess.check_output(
                ["xdotool", "getactivewindow"],
                stderr=subprocess.DEVNULL,
                timeout=3,
            ).decode().strip()
            subprocess.run(
                ["xdotool", "windowclose", wid],
                stderr=subprocess.DEVNULL,
                timeout=3,
                check=False,
            )
            return True
        except Exception:
            return False
    if shutil.which("wmctrl"):
        try:
            subprocess.run(
                ["wmctrl", "-c", ":ACTIVE:"], timeout=3, check=False
            )
            return True
        except Exception:
            return False
    return False


def hosts_block(domains: list[str], hosts_path: str = "/etc/hosts") -> bool:
    """Redirect adult domains to localhost via the hosts file (needs root)."""
    marker = "# guardian-block"
    try:
        existing = ""
        if os.path.exists(hosts_path):
            with open(hosts_path) as fh:
                existing = fh.read()
        lines = []
        for d in domains:
            if d and d not in existing:
                lines.append(f"127.0.0.1 {d} {marker}")
                lines.append(f"127.0.0.1 www.{d} {marker}")
        if not lines:
            return True
        with open(hosts_path, "a") as fh:
            fh.write("\n" + "\n".join(lines) + "\n")
        return True
    except Exception:
        return False


def show_overlay(message: str, reason: str, seconds: int = 8) -> bool:
    """Fullscreen, always-on-top block screen. Returns False if no GUI."""
    if not os.environ.get("DISPLAY") and os.name != "nt":
        return False
    try:
        import tkinter as tk
    except Exception:
        return False
    try:
        root = tk.Tk()
        root.title("Guardian")
        root.configure(bg="#0f172a")
        root.attributes("-topmost", True)
        try:
            root.attributes("-fullscreen", True)
        except Exception:
            root.geometry("900x600")
        # Try to grab all input so the block can't be trivially clicked away.
        try:
            root.grab_set_global()
        except Exception:
            pass

        frame = tk.Frame(root, bg="#0f172a")
        frame.place(relx=0.5, rely=0.5, anchor="center")
        tk.Label(
            frame, text="⛔  BLOCKED", fg="#f87171", bg="#0f172a",
            font=("DejaVu Sans", 64, "bold"),
        ).pack(pady=(0, 16))
        tk.Label(
            frame, text=message, fg="#e2e8f0", bg="#0f172a",
            font=("DejaVu Sans", 26),
        ).pack()
        tk.Label(
            frame, text=reason, fg="#94a3b8", bg="#0f172a",
            font=("DejaVu Sans", 18),
        ).pack(pady=(10, 0))
        tk.Label(
            frame, text=f"Guardian is protecting you. This will clear in {seconds}s.",
            fg="#64748b", bg="#0f172a", font=("DejaVu Sans", 14),
        ).pack(pady=(24, 0))

        root.after(max(1, seconds) * 1000, root.destroy)
        root.mainloop()
        return True
    except Exception:
        return False


def enforce(
    cfg: Config,
    kind: str,
    reason: str,
    detail: dict | None = None,
    domains: list[str] | None = None,
) -> dict:
    """Run the configured enforcement actions and return the logged event."""
    event = log_event(cfg, kind, reason, detail)
    actions: list[str] = ["logged"]

    if cfg.enforcement.close_window and close_active_window():
        actions.append("closed_window")
    if cfg.enforcement.hosts_block and domains and hosts_block(domains):
        actions.append("hosts_block")
    if cfg.enforcement.overlay and show_overlay(
        cfg.block_message, reason, cfg.enforcement.cooldown_seconds
    ):
        actions.append("overlay")

    event["actions"] = actions
    return event
