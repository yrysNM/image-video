"""Guardian — an always-on 18+/adult content and screen-time blocker."""

from .detector import ContentDetector, Detection, inspect_text

__all__ = ["ContentDetector", "Detection", "inspect_text"]
__version__ = "0.1.0"
