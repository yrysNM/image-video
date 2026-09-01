"""Adult / 18+ content detection engine.

Pure, dependency-free text classifier used for both what the user *sees*
(OCR'd screen text) and what they *write* (clipboard / typed text that shows on
screen). Returns a structured decision so the caller can block immediately.

Design goals:
- Zero external dependencies (easy to unit test).
- Word-boundary matching to avoid false positives (e.g. "analysis" contains
  "anal", "Essex" contains "sex" — neither should trip the filter).
- A small set of *hard* terms and known porn domains trigger an immediate block;
  softer/ambiguous signals accumulate a score and block past a threshold.
- Fully configurable: extra terms / domains / allow terms can be supplied.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


# Unambiguously explicit terms. A single match blocks. Kept clinical; this is the
# blocklist of a content filter. Extend via config for site-specific needs.
DEFAULT_HARD_TERMS: tuple[str, ...] = (
    "porn", "porno", "pornography", "hardcore porn", "xxx",
    "hentai", "rule34", "camgirl", "camwhore", "escort service",
    "blowjob", "handjob", "cumshot", "creampie", "gangbang", "bukkake",
    "deepthroat", "masturbate", "masturbation", "orgasm", "ejaculate",
    "anal sex", "oral sex", "fellatio", "cunnilingus", "genitalia",
    "erotic", "erotica", "fetish porn", "nsfw porn",
)

# Ambiguous on their own — weighted; block when the total score meets threshold.
DEFAULT_SOFT_TERMS: dict[str, int] = {
    "nsfw": 2,
    "nude": 2,
    "nudes": 2,
    "naked": 1,
    "explicit": 1,
    "18+": 2,
    "adults only": 2,
    "onlyfans": 3,
    "sex": 1,
    "sexual": 1,
    "boobs": 2,
    "topless": 2,
    "lingerie": 1,
    "webcam girls": 3,
}

# Known adult sites. A match on any (in a URL, title, or on-screen text) blocks.
DEFAULT_DOMAINS: tuple[str, ...] = (
    "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com",
    "youporn.com", "spankbang.com", "onlyfans.com", "brazzers.com",
    "chaturbate.com", "stripchat.com", "cam4.com", "rule34.xxx", "e621.net",
    "fansly.com", "adultfriendfinder.com", "livejasmin.com",
)

# Phrases that, when present, suppress a soft match (reduce false positives for
# education / health / news contexts). Only downgrades soft signals, never hard.
DEFAULT_ALLOW_CONTEXT: tuple[str, ...] = (
    "sex education", "sexual health", "biological sex", "opposite sex",
    "same sex marriage", "sex assigned at birth", "sexual harassment",
)

SOFT_THRESHOLD_DEFAULT = 3


@dataclass
class Detection:
    blocked: bool
    score: int
    reason: str
    matched: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "blocked": self.blocked,
            "score": self.score,
            "reason": self.reason,
            "matched": self.matched,
        }


def _boundary_pattern(term: str) -> re.Pattern[str]:
    # Escape term, allow flexible whitespace between words, require word
    # boundaries at the ends so substrings inside larger words don't match.
    parts = [re.escape(p) for p in term.split()]
    body = r"\s+".join(parts)
    # For terms ending/starting with non-word chars (e.g. "18+") relax boundary.
    left = r"\b" if term[0].isalnum() else r"(?<!\w)"
    right = r"\b" if term[-1].isalnum() else r"(?!\w)"
    return re.compile(left + body + right, re.IGNORECASE)


class ContentDetector:
    def __init__(
        self,
        hard_terms: tuple[str, ...] | list[str] = DEFAULT_HARD_TERMS,
        soft_terms: dict[str, int] | None = None,
        domains: tuple[str, ...] | list[str] = DEFAULT_DOMAINS,
        allow_context: tuple[str, ...] | list[str] = DEFAULT_ALLOW_CONTEXT,
        soft_threshold: int = SOFT_THRESHOLD_DEFAULT,
    ) -> None:
        self.soft_threshold = soft_threshold
        self._hard = [(t, _boundary_pattern(t)) for t in hard_terms]
        soft = dict(DEFAULT_SOFT_TERMS if soft_terms is None else soft_terms)
        self._soft = [(t, w, _boundary_pattern(t)) for t, w in soft.items()]
        self._domains = [d.lower() for d in domains]
        self._allow = [a.lower() for a in allow_context]

    def inspect(self, text: str | None) -> Detection:
        if not text:
            return Detection(False, 0, "empty")
        lowered = text.lower()

        # 1) Known adult domains (substring match on host-like tokens).
        for domain in self._domains:
            if domain in lowered:
                return Detection(True, 100, f"adult site: {domain}", [domain])

        # 2) Hard explicit terms — immediate block.
        hard_hits = [term for term, pat in self._hard if pat.search(text)]
        if hard_hits:
            return Detection(
                True, 100, f"explicit term: {hard_hits[0]}", hard_hits
            )

        # 3) Soft/ambiguous terms — accumulate a score, minus allow-context.
        allow_present = any(ctx in lowered for ctx in self._allow)
        score = 0
        soft_hits: list[str] = []
        for term, weight, pat in self._soft:
            if pat.search(text):
                soft_hits.append(term)
                score += weight
        if allow_present:
            score -= 2  # education/health context softens ambiguous signals

        blocked = score >= self.soft_threshold
        reason = (
            f"adult signals (score {score})" if blocked else f"below threshold ({score})"
        )
        return Detection(blocked, max(score, 0), reason, soft_hits)


# Module-level default instance for convenience.
default_detector = ContentDetector()


def inspect_text(text: str | None) -> Detection:
    return default_detector.inspect(text)
