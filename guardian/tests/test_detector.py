from guardian.detector import ContentDetector, inspect_text


def test_blocks_hard_explicit_term():
    d = inspect_text("watch free porn videos")
    assert d.blocked
    assert "porn" in d.matched


def test_blocks_known_adult_domain():
    d = inspect_text("visit https://www.pornhub.com/ now")
    assert d.blocked
    assert any("pornhub.com" in m for m in d.matched)


def test_allows_plain_safe_text():
    d = inspect_text("The quarterly sales report is ready for review.")
    assert not d.blocked


def test_no_false_positive_on_substrings():
    # "analysis" contains "anal", "Essex"/"Sussex" contain "sex".
    for phrase in [
        "financial analysis of the canal project",
        "a trip to Sussex and Middlesex county",
        "sextuple bypass surgery statistics",
    ]:
        d = inspect_text(phrase)
        assert not d.blocked, f"false positive on: {phrase} -> {d.matched}"


def test_education_context_softens_ambiguous_terms():
    d = inspect_text("sex education class covers biological sex and health")
    assert not d.blocked


def test_soft_terms_accumulate_to_block():
    d = inspect_text("nude nudes topless onlyfans leak")
    assert d.blocked
    assert d.score >= 3


def test_typed_text_is_classified_same_as_seen():
    # "wrote" path uses the same classifier as the "saw" path.
    d = inspect_text("i want to search for hardcore porn")
    assert d.blocked


def test_custom_hard_terms_via_config():
    d = ContentDetector(hard_terms=("secretbadword",))
    assert d.inspect("this has secretbadword in it").blocked
    # default explicit terms still not required by this instance
    assert not d.inspect("ordinary text").blocked


def test_empty_text_is_allowed():
    assert not inspect_text("").blocked
    assert not inspect_text(None).blocked
