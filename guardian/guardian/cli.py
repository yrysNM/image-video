"""Guardian command line.

Examples:
  python -m guardian check --text "free porn here"      # classify text
  python -m guardian check --image shot.png             # OCR an image, classify
  python -m guardian scan --once                         # capture+scan real screen
  python -m guardian budget-demo                         # show time-budget blocking
  python -m guardian block-demo --reason "demo"          # show the block overlay
  python -m guardian run --config guardian.yaml          # start the always-on guard
  python -m guardian log                                 # show recent block events
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from . import enforcer, screen
from .activity import ActiveWindow, UsageStore, is_over_budget
from .config import BudgetTarget, Config, load_config
from .monitor import Monitor, build_detector


def _print_detection(det, label: str) -> int:
    status = "BLOCK" if det.blocked else "ALLOW"
    print(f"[{status}] {label}")
    print(f"  reason : {det.reason}")
    if det.matched:
        print(f"  matched: {', '.join(det.matched)}")
    print(f"  score  : {det.score}")
    return 2 if det.blocked else 0


def cmd_check(args, cfg: Config) -> int:
    detector = build_detector(cfg)
    if args.text is not None:
        return _print_detection(detector.inspect(args.text), "text")
    if args.image is not None:
        if not screen.ocr_available():
            print("OCR not available (install tesseract + pytesseract).", file=sys.stderr)
            return 1
        text = screen.ocr_image_file(args.image)
        print(f"OCR extracted {len(text)} chars from {args.image}")
        return _print_detection(detector.inspect(text), f"image:{os.path.basename(args.image)}")
    print("Provide --text or --image", file=sys.stderr)
    return 1


def cmd_scan(args, cfg: Config) -> int:
    if not screen.ocr_available():
        print("OCR not available (install tesseract + pytesseract).", file=sys.stderr)
        return 1
    text = screen.capture_screen_text()
    print(f"Captured screen, OCR got {len(text)} chars.")
    detector = build_detector(cfg)
    det = detector.inspect(text)
    code = _print_detection(det, "screen")
    if det.blocked and args.enforce:
        enforcer.enforce(cfg, "content", det.reason, {"matched": det.matched})
    return code


def cmd_budget_demo(args, cfg: Config) -> int:
    target = BudgetTarget(name="Instagram", match=["instagram"], daily_minutes=30)
    usage = UsageStore(None)
    print(f"Budget for {target.name}: {target.daily_minutes} min/day")
    minutes_used = 0
    step = 10
    while True:
        usage.add(target.name, step * 60)
        minutes_used += step
        used = usage.get(target.name)
        over = is_over_budget(used, target)
        print(f"  used {minutes_used:>3} min -> {'OVER BUDGET -> BLOCK' if over else 'ok'}")
        if over:
            event = enforcer.enforce(
                cfg, "budget", f"time's up for {target.name}",
                {"target": target.name, "used_seconds": int(used)},
            )
            print(f"  enforcement actions: {event.get('actions')}")
            return 0
        if minutes_used > 120:
            return 0


def cmd_block_demo(args, cfg: Config) -> int:
    event = enforcer.enforce(
        cfg,
        "content",
        args.reason,
        {"demo": True},
    )
    print(json.dumps(event, indent=2))
    return 0


def cmd_run(args, cfg: Config) -> int:
    print("Guardian is running. Screen scan:", cfg.screen_scan and screen.ocr_available(),
          "| clipboard:", cfg.clipboard_scan, "| budgets:", len(cfg.budgets))
    print("Press Ctrl+C to stop.")
    mon = Monitor(cfg)
    try:
        mon.run(iterations=args.iterations)
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


def cmd_log(args, cfg: Config) -> int:
    if not os.path.exists(cfg.log_file):
        print("No events logged yet.")
        return 0
    with open(cfg.log_file) as fh:
        lines = fh.readlines()
    for line in lines[-args.n :]:
        print(line.rstrip())
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="guardian", description="18+/content and time blocker")
    p.add_argument("--config", help="path to guardian.yaml")
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("check", help="classify text or an image")
    c.add_argument("--text")
    c.add_argument("--image")
    c.set_defaults(func=cmd_check)

    s = sub.add_parser("scan", help="capture the real screen and classify it")
    s.add_argument("--once", action="store_true", default=True)
    s.add_argument("--enforce", action="store_true")
    s.set_defaults(func=cmd_scan)

    b = sub.add_parser("budget-demo", help="demonstrate time-budget blocking")
    b.set_defaults(func=cmd_budget_demo)

    bd = sub.add_parser("block-demo", help="show the block overlay once")
    bd.add_argument("--reason", default="Adult content blocked")
    bd.set_defaults(func=cmd_block_demo)

    r = sub.add_parser("run", help="start the always-on monitor")
    r.add_argument("--iterations", type=int, default=None)
    r.set_defaults(func=cmd_run)

    lg = sub.add_parser("log", help="show recent block events")
    lg.add_argument("-n", type=int, default=20)
    lg.set_defaults(func=cmd_log)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    cfg = load_config(args.config)
    return args.func(args, cfg)
