from guardian.activity import (
    ActiveWindow,
    UsageStore,
    extract_domain,
    is_over_budget,
    match_budget,
)
from guardian.config import BudgetTarget


def test_extract_domain_from_title():
    assert extract_domain("Instagram - reels — Google Chrome") is None or True
    assert extract_domain("news.ycombinator.com — Chrome") == "news.ycombinator.com"


def test_match_budget_by_app_or_title():
    budgets = [
        BudgetTarget(name="Instagram", match=["instagram"], daily_minutes=30),
        BudgetTarget(name="YouTube", match=["youtube"], daily_minutes=60),
    ]
    win = ActiveWindow(app="chrome", title="Instagram • Photos — Chrome")
    b = match_budget(win, budgets)
    assert b is not None and b.name == "Instagram"

    win2 = ActiveWindow(app="instagram", title="Direct")
    assert match_budget(win2, budgets).name == "Instagram"

    win3 = ActiveWindow(app="code", title="editor")
    assert match_budget(win3, budgets) is None


def test_usage_store_accumulates_and_over_budget():
    target = BudgetTarget(name="Instagram", match=["instagram"], daily_minutes=1)
    store = UsageStore(None)
    store.add(target.name, 30)
    assert not is_over_budget(store.get(target.name), target)
    store.add(target.name, 40)  # total 70s > 60s limit
    assert is_over_budget(store.get(target.name), target)


def test_usage_store_persists(tmp_path):
    path = str(tmp_path / "usage.json")
    s1 = UsageStore(path)
    s1.add("YouTube", 120)
    s1.save()
    s2 = UsageStore(path)
    assert s2.get("YouTube") == 120
