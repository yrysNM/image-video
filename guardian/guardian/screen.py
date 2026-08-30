"""Screen capture + OCR so Guardian can read content in *any* program.

Because it reads pixels, it works inside the browser and native apps alike
(Instagram desktop, chat clients, PDF viewers, games with text, etc.). OCR is
optional at runtime: if tesseract/pytesseract are unavailable, screen scanning
is skipped and the app still enforces time budgets and clipboard checks.
"""

from __future__ import annotations


def ocr_available() -> bool:
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
    except Exception:
        return False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def ocr_image_file(path: str) -> str:
    import pytesseract
    from PIL import Image

    with Image.open(path) as img:
        return pytesseract.image_to_string(img)


def capture_screen_text() -> str:
    """Grab the current screen and OCR it to a single text blob."""
    import mss
    import pytesseract
    from PIL import Image

    with mss.mss() as sct:
        monitor = sct.monitors[0]  # full virtual screen
        shot = sct.grab(monitor)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
    return pytesseract.image_to_string(img)
