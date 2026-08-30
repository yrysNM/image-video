from guardian.activity import ActiveWindow
from guardian.config import BudgetTarget, Config, Enforcement
from guardian.monitor import Monitor


def _headless_cfg(tmp_path):
    return Config(
        scan_interval_seconds=60,
        screen_scan=False,
        clipboard_scan=False,
        state_dir=str(tmp_path),
        enforcement=Enforcement(overlay=False, close_window=False, hosts_block=False),
        budgets=[BudgetTarget(name="Instagram", match=["instagram"], daily_minutes=1)],
    )


def test_tick_blocks_on_adult_screen_text(tmp_path):
    cfg = _headless_cfg(tmp_path)
    mon = Monitor(cfg)
    event = mon.tick(window=None, screen_text="free porn here", clipboard="")
    assert event is not None
    assert event["kind"] == "content"


def test_tick_blocks_on_clipboard(tmp_path):
    cfg = _headless_cfg(tmp_path)
    mon = Monitor(cfg)
    event = mon.tick(window=None, screen_text="", clipboard="visit pornhub.com")
    assert event is not None
    assert event["kind"] == "content"


def test_tick_enforces_time_budget(tmp_path):
    cfg = _headless_cfg(tmp_path)  # Instagram limit = 1 min, tick = 60s
    mon = Monitor(cfg)
    win = ActiveWindow(app="chrome", title="Instagram — Chrome")
    # first tick accumulates 60s -> reaches the 60s limit -> block
    event = mon.tick(window=win, screen_text="", clipboard="")
    assert event is not None
    assert event["kind"] == "budget"
    assert event["detail"]["target"] == "Instagram"


def test_tick_allows_safe_activity(tmp_path):
    cfg = _headless_cfg(tmp_path)
    mon = Monitor(cfg)
    win = ActiveWindow(app="code", title="editor — VS Code")
    assert mon.tick(window=win, screen_text="quarterly report", clipboard="") is None
